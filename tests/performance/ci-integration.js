#!/usr/bin/env node

/**
 * CI/CD Performance Testing Integration
 *
 * Integrates performance testing into CI/CD pipelines with proper
 * result reporting, threshold validation, and artifact management.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  exportValidationReport,
  validatePerformanceResults,
} from './performance-validation.js';

// CI/CD Configuration
const ciConfig = {
  // Environment detection
  isCI:
    process.env.CI === 'true' ||
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.JENKINS_URL,

  // CI-specific settings
  baseUrl:
    process.env.CI_BASE_URL || process.env.BASE_URL || 'http://localhost:8000',
  authToken:
    process.env.CI_AUTH_TOKEN || process.env.AUTH_TOKEN || 'ci-test-token',

  // Test configuration
  testSuite: process.env.PERFORMANCE_TEST_SUITE || 'ci',
  timeout: parseInt(process.env.PERFORMANCE_TEST_TIMEOUT || '1800'), // 30 minutes

  // Output configuration
  outputDir: process.env.PERFORMANCE_OUTPUT_DIR || './performance-results',
  artifactDir: process.env.CI_ARTIFACT_DIR || './artifacts',

  // Validation settings
  strictMode: process.env.PERFORMANCE_STRICT_MODE === 'true',
  failOnWarnings: process.env.PERFORMANCE_FAIL_ON_WARNINGS === 'true',

  // Reporting
  slackWebhook: process.env.SLACK_WEBHOOK_URL,
  teamsWebhook: process.env.TEAMS_WEBHOOK_URL,

  // k6 configuration
  k6Binary: process.env.K6_BINARY || 'k6',
  k6Options: process.env.K6_OPTIONS || '',
};

// CI-optimized test suites
const ciTestSuites = {
  ci: {
    name: 'CI Performance Tests',
    description: 'Fast performance validation for CI/CD',
    maxDuration: '10m',
    tests: [
      { file: 'api-benchmarking-test.js', duration: '3m', vus: 20 },
      { file: 'database-performance-test.js', duration: '4m', vus: 15 },
      { file: 'email-performance-test.js', duration: '3m', vus: 10 },
    ],
  },
  smoke: {
    name: 'Performance Smoke Tests',
    description: 'Minimal performance validation',
    maxDuration: '5m',
    tests: [{ file: 'api-benchmarking-test.js', duration: '2m', vus: 10 }],
  },
  regression: {
    name: 'Performance Regression Tests',
    description: 'Comprehensive regression testing',
    maxDuration: '20m',
    tests: [
      { file: 'api-benchmarking-test.js', duration: '5m', vus: 30 },
      { file: 'database-performance-test.js', duration: '8m', vus: 25 },
      { file: 'email-performance-test.js', duration: '5m', vus: 15 },
      { file: 'capacity-planning-test.js', duration: '10m', vus: 100 },
    ],
  },
};

/**
 * Main CI integration function
 */
async function runCIPerformanceTests() {
  console.log('🚀 Starting CI Performance Testing Integration');
  console.log('📊 Configuration:', ciConfig);

  // Validate environment
  if (!validateCIEnvironment()) {
    process.exit(1);
  }

  // Setup directories
  setupDirectories();

  // Get test suite
  const suite = ciTestSuites[ciConfig.testSuite];

  if (!suite) {
    console.error(`❌ Unknown test suite: ${ciConfig.testSuite}`);
    console.log('Available suites:', Object.keys(ciTestSuites).join(', '));
    process.exit(1);
  }

  console.log(`🎯 Running ${suite.name}`);
  console.log(`📝 ${suite.description}`);

  let overallSuccess = true;
  const testResults = [];

  try {
    // Run performance tests
    for (const test of suite.tests) {
      console.log(`\n🔄 Running ${test.file}...`);

      const result = await runCITest(test);

      testResults.push(result);

      if (!result.success) {
        overallSuccess = false;
        console.error(`❌ Test failed: ${test.file}`);

        if (ciConfig.strictMode) {
          console.error('💥 Strict mode enabled - stopping on first failure');
          break;
        }
      }
    }

    // Validate results
    if (overallSuccess) {
      console.log('\n📋 Validating performance results...');

      const validationReport = validatePerformanceResults(ciConfig.outputDir);

      // Export reports
      exportValidationReport(validationReport, ciConfig.outputDir);

      // Copy artifacts for CI
      copyArtifacts();

      // Send notifications
      await sendNotifications(validationReport, testResults);

      // Determine exit code
      const exitCode = determineExitCode(validationReport);

      console.log(
        `\n📊 Performance testing completed with exit code: ${exitCode}`
      );
      process.exit(exitCode);
    } else {
      console.error('\n❌ Performance tests failed');
      await sendFailureNotification(testResults);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 CI Performance testing error:', error);
    await sendErrorNotification(error);
    process.exit(1);
  }
}

/**
 * Validates CI environment
 */
function validateCIEnvironment() {
  console.log('🔍 Validating CI environment...');

  // Check required tools
  try {
    execSync(`${ciConfig.k6Binary} version`, { stdio: 'pipe' });
    console.log('✅ k6 is available');
  } catch (error) {
    console.error('❌ k6 is not available or not in PATH');
    console.error(
      'Install k6: https://k6.io/docs/getting-started/installation/'
    );

    return false;
  }

  // Check service availability
  try {
    const healthCheck = `curl -f ${ciConfig.baseUrl}/health --max-time 10`;

    execSync(healthCheck, { stdio: 'pipe' });
    console.log('✅ Target service is healthy');
  } catch (error) {
    console.error(`❌ Target service is not available at ${ciConfig.baseUrl}`);
    console.error('Ensure services are running before performance tests');

    return false;
  }

  // Check disk space
  try {
    const df = execSync('df -h .', { encoding: 'utf8' });

    console.log('✅ Disk space check passed');
    console.log(df.split('\n')[1]); // Show available space
  } catch (error) {
    console.warn('⚠️  Could not check disk space');
  }

  return true;
}

/**
 * Sets up required directories
 */
function setupDirectories() {
  [ciConfig.outputDir, ciConfig.artifactDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
}

/**
 * Runs a single CI test
 */
async function runCITest(test) {
  const testPath = path.join(__dirname, test.file);
  const outputFile = path.join(
    ciConfig.outputDir,
    `${path.basename(test.file, '.js')}-results.json`
  );

  const env = {
    BASE_URL: ciConfig.baseUrl,
    AUTH_TOKEN: ciConfig.authToken,
    CI: 'true',
    ...process.env,
  };

  const envString = Object.entries(env)
    .map(([key, value]) => `-e ${key}=${value}`)
    .join(' ');

  const k6Options = [
    `--duration ${test.duration}`,
    `--vus ${test.vus}`,
    `--out json=${outputFile}`,
    '--quiet', // Reduce output in CI
    ciConfig.k6Options,
  ].filter(Boolean);

  const command = `timeout ${ciConfig.timeout} ${ciConfig.k6Binary} run ${envString} ${k6Options.join(' ')} ${testPath}`;

  try {
    const startTime = Date.now();

    console.log(`⚙️  Executing: ${path.basename(test.file)}`);
    console.log(`📊 Duration: ${test.duration}, VUs: ${test.vus}`);

    execSync(command, {
      stdio: ciConfig.isCI ? 'pipe' : 'inherit',
      timeout: ciConfig.timeout * 1000,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Completed in ${duration}s`);

    return {
      name: test.file,
      success: true,
      duration,
      outputFile,
    };
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);

    return {
      name: test.file,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Copies artifacts for CI system
 */
function copyArtifacts() {
  console.log('📦 Copying artifacts...');

  try {
    // Copy all result files
    const files = fs.readdirSync(ciConfig.outputDir);

    files.forEach(file => {
      const src = path.join(ciConfig.outputDir, file);
      const dest = path.join(ciConfig.artifactDir, file);

      fs.copyFileSync(src, dest);
    });

    console.log(`✅ Copied ${files.length} artifact files`);
  } catch (error) {
    console.warn('⚠️  Failed to copy artifacts:', error.message);
  }
}

/**
 * Determines exit code based on validation results
 */
function determineExitCode(validationReport) {
  if (validationReport.overallStatus === 'FAIL') {
    return 1;
  }

  if (validationReport.overallStatus === 'WARNING' && ciConfig.failOnWarnings) {
    return 1;
  }

  return 0;
}

/**
 * Sends success notifications
 */
async function sendNotifications(validationReport, testResults) {
  const message = formatSuccessMessage(validationReport, testResults);

  if (ciConfig.slackWebhook) {
    await sendSlackNotification(message, validationReport.overallStatus);
  }

  if (ciConfig.teamsWebhook) {
    await sendTeamsNotification(message, validationReport.overallStatus);
  }
}

/**
 * Sends failure notifications
 */
async function sendFailureNotification(testResults) {
  const message = formatFailureMessage(testResults);

  if (ciConfig.slackWebhook) {
    await sendSlackNotification(message, 'FAIL');
  }

  if (ciConfig.teamsWebhook) {
    await sendTeamsNotification(message, 'FAIL');
  }
}

/**
 * Sends error notifications
 */
async function sendErrorNotification(error) {
  const message = `🚨 Performance Testing Error\n\nError: ${error.message}\n\nCI Job: ${process.env.GITHUB_RUN_ID || process.env.BUILD_NUMBER || 'Unknown'}`;

  if (ciConfig.slackWebhook) {
    await sendSlackNotification(message, 'ERROR');
  }

  if (ciConfig.teamsWebhook) {
    await sendTeamsNotification(message, 'ERROR');
  }
}

/**
 * Formats success message
 */
function formatSuccessMessage(validationReport, testResults) {
  const emoji = {
    PASS: '✅',
    WARNING: '⚠️',
    FAIL: '❌',
  };

  return `${emoji[validationReport.overallStatus]} Performance Testing Results

**Overall Status:** ${validationReport.overallStatus}
**Tests Run:** ${testResults.length}
**Checks:** ${validationReport.summary.passedChecks}/${validationReport.summary.totalChecks} passed

**Test Results:**
${testResults.map(r => `• ${r.name}: ${r.success ? '✅' : '❌'} (${r.duration}s)`).join('\n')}

**Performance Summary:**
• Passed: ${validationReport.summary.passedChecks}
• Warnings: ${validationReport.summary.warningChecks}
• Failed: ${validationReport.summary.failedChecks}

CI Job: ${process.env.GITHUB_RUN_ID || process.env.BUILD_NUMBER || 'Unknown'}`;
}

/**
 * Formats failure message
 */
function formatFailureMessage(testResults) {
  const failedTests = testResults.filter(r => !r.success);

  return `❌ Performance Testing Failed

**Failed Tests:** ${failedTests.length}/${testResults.length}

${failedTests.map(r => `• ${r.name}: ${r.error}`).join('\n')}

CI Job: ${process.env.GITHUB_RUN_ID || process.env.BUILD_NUMBER || 'Unknown'}`;
}

/**
 * Sends Slack notification
 */
async function sendSlackNotification(message, status) {
  if (!ciConfig.slackWebhook) return;

  const color = {
    PASS: 'good',
    WARNING: 'warning',
    FAIL: 'danger',
    ERROR: 'danger',
  };

  const payload = {
    text: 'Performance Testing Results',
    attachments: [
      {
        color: color[status],
        text: message,
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    const response = await fetch(ciConfig.slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('✅ Slack notification sent');
    } else {
      console.warn('⚠️  Failed to send Slack notification');
    }
  } catch (error) {
    console.warn('⚠️  Slack notification error:', error.message);
  }
}

/**
 * Sends Teams notification
 */
async function sendTeamsNotification(message, status) {
  if (!ciConfig.teamsWebhook) return;

  const color = {
    PASS: '00FF00',
    WARNING: 'FFA500',
    FAIL: 'FF0000',
    ERROR: 'FF0000',
  };

  const payload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: 'Performance Testing Results',
    themeColor: color[status],
    sections: [
      {
        activityTitle: 'Performance Testing Results',
        activitySubtitle: `Status: ${status}`,
        text: message,
      },
    ],
  };

  try {
    const response = await fetch(ciConfig.teamsWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('✅ Teams notification sent');
    } else {
      console.warn('⚠️  Failed to send Teams notification');
    }
  } catch (error) {
    console.warn('⚠️  Teams notification error:', error.message);
  }
}

/**
 * Prints usage information
 */
function printUsage() {
  console.log(`
🎯 CI/CD Performance Testing Integration

Usage: node ci-integration.js [options]

Options:
  --suite <name>          - Test suite to run (ci, smoke, regression)
  --base-url <url>        - Base URL for testing
  --auth-token <token>    - Authentication token
  --output-dir <dir>      - Output directory
  --artifact-dir <dir>    - CI artifact directory
  --strict                - Enable strict mode (fail on first error)
  --fail-on-warnings      - Fail on performance warnings
  --timeout <seconds>     - Test timeout in seconds
  --help                  - Show this help message

Environment Variables:
  CI_BASE_URL            - Base URL for testing
  CI_AUTH_TOKEN          - Authentication token
  PERFORMANCE_TEST_SUITE - Test suite (ci, smoke, regression)
  PERFORMANCE_STRICT_MODE - Enable strict mode
  PERFORMANCE_FAIL_ON_WARNINGS - Fail on warnings
  PERFORMANCE_TEST_TIMEOUT - Test timeout in seconds
  PERFORMANCE_OUTPUT_DIR - Output directory
  CI_ARTIFACT_DIR        - CI artifact directory
  SLACK_WEBHOOK_URL      - Slack webhook for notifications
  TEAMS_WEBHOOK_URL      - Teams webhook for notifications

Examples:
  node ci-integration.js --suite smoke
  node ci-integration.js --suite ci --strict
  node ci-integration.js --suite regression --fail-on-warnings
  `);
}

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      case '--suite':
        ciConfig.testSuite = args[++i];
        break;
      case '--base-url':
        ciConfig.baseUrl = args[++i];
        break;
      case '--auth-token':
        ciConfig.authToken = args[++i];
        break;
      case '--output-dir':
        ciConfig.outputDir = args[++i];
        break;
      case '--artifact-dir':
        ciConfig.artifactDir = args[++i];
        break;
      case '--strict':
        ciConfig.strictMode = true;
        break;
      case '--fail-on-warnings':
        ciConfig.failOnWarnings = true;
        break;
      case '--timeout':
        ciConfig.timeout = parseInt(args[++i]);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  parseArguments();
  runCIPerformanceTests().catch(error => {
    console.error('💥 CI integration error:', error);
    process.exit(1);
  });
}

export { ciConfig, ciTestSuites, runCIPerformanceTests };
