#!/usr/bin/env node

/**
 * Performance Validation Runner
 *
 * Runs performance tests and validates results against defined thresholds.
 * Generates comprehensive reports with recommendations.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  exportValidationReport,
  validatePerformanceResults,
} from './performance-validation.js';

// Configuration
const config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:8000',
  authToken: process.env.AUTH_TOKEN || 'test-token',
  outputDir: process.env.OUTPUT_DIR || './performance-results',
  k6Binary: process.env.K6_BINARY || 'k6',
  validationEnabled: process.env.VALIDATION_ENABLED !== 'false',
  thresholdFile: process.env.THRESHOLD_FILE || null,
};

// Test configurations for validation
const validationTests = [
  {
    name: 'API Performance Validation',
    file: 'api-benchmarking-test.js',
    duration: '5m',
    vus: 30,
    required: true,
  },
  {
    name: 'Database Performance Validation',
    file: 'database-performance-test.js',
    duration: '8m',
    vus: 20,
    required: true,
  },
  {
    name: 'Email Performance Validation',
    file: 'email-performance-test.js',
    duration: '6m',
    vus: 10,
    required: true,
  },
];

/**
 * Main validation runner
 */
async function runPerformanceValidation() {
  console.log('🎯 Starting Performance Validation');
  console.log('📊 Configuration:', config);

  // Create output directory
  createOutputDirectory();

  // Run performance tests
  const testResults = [];
  let allTestsPassed = true;

  for (const test of validationTests) {
    console.log(`\n🚀 Running ${test.name}...`);

    const result = await runValidationTest(test);

    testResults.push(result);

    if (!result.success && test.required) {
      allTestsPassed = false;
      console.error(`❌ Required test failed: ${test.name}`);
    }
  }

  // Validate results if all tests completed
  if (config.validationEnabled && allTestsPassed) {
    console.log('\n📋 Validating performance results...');

    try {
      const validationReport = validatePerformanceResults(config.outputDir);

      // Export validation report
      exportValidationReport(validationReport, config.outputDir);

      // Print validation summary
      printValidationSummary(validationReport);

      // Exit with appropriate code
      if (validationReport.overallStatus === 'FAIL') {
        console.error('\n❌ Performance validation failed!');
        process.exit(1);
      } else if (validationReport.overallStatus === 'WARNING') {
        console.warn('\n⚠️  Performance validation completed with warnings');
        process.exit(0);
      } else {
        console.log('\n✅ Performance validation passed!');
        process.exit(0);
      }
    } catch (error) {
      console.error('\n❌ Validation error:', error.message);
      process.exit(1);
    }
  } else if (!allTestsPassed) {
    console.error('\n❌ Performance tests failed - skipping validation');
    process.exit(1);
  } else {
    console.log('\n✅ Performance tests completed (validation disabled)');
    process.exit(0);
  }
}

/**
 * Runs a single validation test
 */
async function runValidationTest(test) {
  const testPath = path.join(__dirname, test.file);
  const outputFile = path.join(
    config.outputDir,
    `${path.basename(test.file, '.js')}-results.json`
  );

  const env = {
    BASE_URL: config.baseUrl,
    AUTH_TOKEN: config.authToken,
    ...process.env,
  };

  const envString = Object.entries(env)
    .map(([key, value]) => `-e ${key}=${value}`)
    .join(' ');

  const k6Options = [
    `--duration ${test.duration}`,
    `--vus ${test.vus}`,
    `--out json=${outputFile}`,
  ];

  const command = `${config.k6Binary} run ${envString} ${k6Options.join(' ')} ${testPath}`;

  try {
    const startTime = Date.now();

    console.log(`⚙️  Command: ${command}`);
    execSync(command, { stdio: 'inherit' });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Completed ${test.name} in ${duration}s`);

    return {
      name: test.name,
      success: true,
      duration,
      outputFile,
    };
  } catch (error) {
    console.error(`❌ Failed ${test.name}:`, error.message);

    return {
      name: test.name,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Creates output directory
 */
function createOutputDirectory() {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
}

/**
 * Prints validation summary
 */
function printValidationSummary(report) {
  console.log('\n📊 Performance Validation Summary');
  console.log('=====================================');
  console.log(
    `Overall Status: ${getStatusEmoji(report.overallStatus)} ${report.overallStatus}`
  );
  console.log(`Total Checks: ${report.summary.totalChecks}`);
  console.log(`✅ Passed: ${report.summary.passedChecks}`);
  console.log(`⚠️  Warnings: ${report.summary.warningChecks}`);
  console.log(`❌ Failed: ${report.summary.failedChecks}`);

  // Print category summaries
  console.log('\nCategory Results:');
  Object.entries(report.categories).forEach(([category, validation]) => {
    console.log(
      `  ${category.toUpperCase()}: ${getStatusEmoji(validation.status)} ${validation.status}`
    );
  });

  // Print recommendations if any
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }

  console.log('=====================================');
}

/**
 * Gets emoji for status
 */
function getStatusEmoji(status) {
  const emojis = {
    PASS: '✅',
    WARNING: '⚠️',
    FAIL: '❌',
    ERROR: '💥',
  };

  return emojis[status] || '❓';
}

/**
 * Prints usage information
 */
function printUsage() {
  console.log(`
🎯 Performance Validation Runner

Usage: node validate-performance.js [options]

Options:
  --base-url <url>        - Base URL for testing (default: http://localhost:8000)
  --auth-token <token>    - Authentication token (default: test-token)
  --output-dir <dir>      - Output directory (default: ./performance-results)
  --k6-binary <path>      - Path to k6 binary (default: k6)
  --no-validation         - Skip validation step
  --threshold-file <file> - Custom threshold configuration file
  --help                  - Show this help message

Environment Variables:
  BASE_URL               - Base URL for testing
  AUTH_TOKEN            - Authentication token
  OUTPUT_DIR            - Output directory
  K6_BINARY             - Path to k6 binary
  VALIDATION_ENABLED    - Enable/disable validation (default: true)
  THRESHOLD_FILE        - Custom threshold configuration file

Examples:
  node validate-performance.js
  node validate-performance.js --base-url http://staging.example.com
  node validate-performance.js --no-validation
  node validate-performance.js --threshold-file custom-thresholds.json
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
      case '--base-url':
        config.baseUrl = args[++i];
        break;
      case '--auth-token':
        config.authToken = args[++i];
        break;
      case '--output-dir':
        config.outputDir = args[++i];
        break;
      case '--k6-binary':
        config.k6Binary = args[++i];
        break;
      case '--no-validation':
        config.validationEnabled = false;
        break;
      case '--threshold-file':
        config.thresholdFile = args[++i];
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
  runPerformanceValidation().catch(error => {
    console.error('💥 Validation runner error:', error);
    process.exit(1);
  });
}

export { config, runPerformanceValidation };
