#!/usr/bin/env node

/**
 * Performance Test Runner
 *
 * Comprehensive performance testing suite for the DatatechtonCRM platform.
 * Runs load tests, stress tests, capacity planning, and benchmarking.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Configuration
const config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:8000',
  authToken: process.env.AUTH_TOKEN || 'test-token',
  outputDir: process.env.OUTPUT_DIR || './performance-results',
  k6Binary: process.env.K6_BINARY || 'k6',
};

// Test suites
const testSuites = {
  quick: {
    name: 'Quick Performance Test',
    description: 'Fast performance check for CI/CD',
    tests: [{ file: 'api-load-test.js', duration: '2m', vus: 10 }],
  },
  standard: {
    name: 'Standard Performance Test',
    description: 'Comprehensive performance testing',
    tests: [
      { file: 'api-load-test.js', duration: '5m', vus: 50 },
      { file: 'database-performance-test.js', duration: '8m', vus: 25 },
      { file: 'email-performance-test.js', duration: '10m', vus: 15 },
    ],
  },
  comprehensive: {
    name: 'Comprehensive Performance Test',
    description: 'Full performance testing suite',
    tests: [
      { file: 'api-load-test.js', duration: '10m', vus: 100 },
      { file: 'database-performance-test.js', duration: '15m', vus: 50 },
      { file: 'email-performance-test.js', duration: '12m', vus: 20 },
      { file: 'capacity-planning-test.js', duration: '20m', vus: 500 },
      { file: 'api-benchmarking-test.js', duration: '15m', vus: 30 },
      { file: 'stress-test.js', duration: '18m', vus: 300 },
      { file: 'spike-test.js', duration: '10m', vus: 1000 },
    ],
  },
  capacity: {
    name: 'Capacity Planning Test',
    description: 'Determine system capacity and scaling requirements',
    tests: [{ file: 'capacity-planning-test.js', duration: '25m', vus: 500 }],
  },
  benchmark: {
    name: 'API Benchmarking Test',
    description: 'Benchmark API response times and throughput',
    tests: [{ file: 'api-benchmarking-test.js', duration: '15m', vus: 50 }],
  },
};

// Utility functions
function createOutputDirectory() {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
}

function runK6Test(testFile, options = {}) {
  const testPath = path.join(__dirname, testFile);
  const outputFile = path.join(
    config.outputDir,
    `${path.basename(testFile, '.js')}-results.json`
  );

  const env = {
    BASE_URL: config.baseUrl,
    AUTH_TOKEN: config.authToken,
    ...process.env,
  };

  const envString = Object.entries(env)
    .map(([key, value]) => `-e ${key}=${value}`)
    .join(' ');

  const k6Options = [];

  if (options.duration) k6Options.push(`--duration ${options.duration}`);
  if (options.vus) k6Options.push(`--vus ${options.vus}`);

  const command = `${config.k6Binary} run ${envString} ${k6Options.join(' ')} --out json=${outputFile} ${testPath}`;

  console.log(`\n🚀 Running: ${testFile}`);
  console.log(`📊 Output: ${outputFile}`);
  console.log(`⚙️  Command: ${command}\n`);

  try {
    const startTime = Date.now();

    execSync(command, { stdio: 'inherit' });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Completed ${testFile} in ${duration}s\n`);

    return { success: true, duration, outputFile };
  } catch (error) {
    console.error(`❌ Failed to run ${testFile}:`, error.message);

    return { success: false, error: error.message };
  }
}

function generateSummaryReport(results) {
  const summaryPath = path.join(config.outputDir, 'performance-summary.json');
  const htmlReportPath = path.join(config.outputDir, 'performance-report.html');

  const summary = {
    timestamp: new Date().toISOString(),
    config,
    results,
    totalTests: results.length,
    successfulTests: results.filter(r => r.success).length,
    failedTests: results.filter(r => !r.success).length,
    totalDuration: results
      .reduce((sum, r) => sum + (parseFloat(r.duration) || 0), 0)
      .toFixed(2),
  };

  // Write JSON summary
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  // Generate HTML report
  const htmlReport = generateHTMLReport(summary);

  fs.writeFileSync(htmlReportPath, htmlReport);

  console.log(`📋 Summary report: ${summaryPath}`);
  console.log(`🌐 HTML report: ${htmlReportPath}`);

  return summary;
}

function generateHTMLReport(summary) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; margin-top: 5px; }
        .test-results { margin-top: 30px; }
        .test-item { background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .test-item.failed { border-left-color: #dc3545; }
        .test-name { font-weight: bold; margin-bottom: 5px; }
        .test-duration { color: #666; }
        .success { color: #28a745; }
        .failed { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Performance Test Report</h1>
            <p>Generated on ${new Date(summary.timestamp).toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-value">${summary.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value">${summary.successfulTests}</div>
                <div class="metric-label">Successful</div>
            </div>
            <div class="metric">
                <div class="metric-value">${summary.failedTests}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${summary.totalDuration}s</div>
                <div class="metric-label">Total Duration</div>
            </div>
        </div>

        <div class="test-results">
            <h2>Test Results</h2>
            ${summary.results
              .map(
                result => `
                <div class="test-item ${result.success ? '' : 'failed'}">
                    <div class="test-name">${result.testFile}</div>
                    <div class="test-duration">
                        Duration: ${result.duration || 'N/A'}s |
                        Status: <span class="${result.success ? 'success' : 'failed'}">${result.success ? 'SUCCESS' : 'FAILED'}</span>
                    </div>
                    ${result.error ? `<div style="color: #dc3545; margin-top: 10px;">Error: ${result.error}</div>` : ''}
                </div>
            `
              )
              .join('')}
        </div>

        <div style="margin-top: 30px; padding: 20px; background: #e9ecef; border-radius: 6px;">
            <h3>Configuration</h3>
            <p><strong>Base URL:</strong> ${summary.config.baseUrl}</p>
            <p><strong>Output Directory:</strong> ${summary.config.outputDir}</p>
            <p><strong>K6 Binary:</strong> ${summary.config.k6Binary}</p>
        </div>
    </div>
</body>
</html>
  `;
}

function printUsage() {
  console.log(`
🎯 Performance Test Runner

Usage: node run-performance-tests.js [suite] [options]

Test Suites:
  quick         - Quick performance check (2-5 minutes)
  standard      - Standard performance testing (15-30 minutes)
  comprehensive - Full performance suite (60-90 minutes)
  capacity      - Capacity planning test (25-30 minutes)
  benchmark     - API benchmarking test (15-20 minutes)

Options:
  --base-url <url>     - Base URL for testing (default: http://localhost:8000)
  --auth-token <token> - Authentication token (default: test-token)
  --output-dir <dir>   - Output directory (default: ./performance-results)
  --k6-binary <path>   - Path to k6 binary (default: k6)
  --help              - Show this help message

Examples:
  node run-performance-tests.js quick
  node run-performance-tests.js standard --base-url http://staging.example.com
  node run-performance-tests.js comprehensive --output-dir ./results

Environment Variables:
  BASE_URL      - Base URL for testing
  AUTH_TOKEN    - Authentication token
  OUTPUT_DIR    - Output directory
  K6_BINARY     - Path to k6 binary
  `);
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let suiteName = 'standard';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printUsage();

      return;
    } else if (arg === '--base-url') {
      config.baseUrl = args[++i];
    } else if (arg === '--auth-token') {
      config.authToken = args[++i];
    } else if (arg === '--output-dir') {
      config.outputDir = args[++i];
    } else if (arg === '--k6-binary') {
      config.k6Binary = args[++i];
    } else if (!arg.startsWith('--')) {
      suiteName = arg;
    }
  }

  // Validate suite
  if (!testSuites[suiteName]) {
    console.error(`❌ Unknown test suite: ${suiteName}`);
    console.log('Available suites:', Object.keys(testSuites).join(', '));

    return;
  }

  const suite = testSuites[suiteName];

  console.log(`🎯 Starting ${suite.name}`);
  console.log(`📝 ${suite.description}`);
  console.log(`🔧 Configuration:`, config);

  // Create output directory
  createOutputDirectory();

  // Run tests
  const results = [];

  for (const test of suite.tests) {
    const result = runK6Test(test.file, {
      duration: test.duration,
      vus: test.vus,
    });

    results.push({
      testFile: test.file,
      ...result,
    });

    // Short pause between tests
    if (results.length < suite.tests.length) {
      console.log('⏳ Waiting 10 seconds before next test...\n');
      execSync('sleep 10');
    }
  }

  // Generate summary report
  const summary = generateSummaryReport(results);

  // Print final summary
  console.log(`\n🎉 Performance testing completed!`);
  console.log(
    `📊 Results: ${summary.successfulTests}/${summary.totalTests} tests passed`
  );
  console.log(`⏱️  Total duration: ${summary.totalDuration}s`);

  if (summary.failedTests > 0) {
    console.log(
      `⚠️  ${summary.failedTests} tests failed - check the results for details`
    );
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { config, generateSummaryReport, runK6Test, testSuites };
