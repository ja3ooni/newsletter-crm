#!/usr/bin/env node

/**
 * Integration Test Runner
 * Runs integration tests for developer tools with proper setup and teardown
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const INTEGRATION_CONFIG = path.join(
  __dirname,
  '__tests__/integration/jest.integration.config.js'
);

function runIntegrationTests() {
  console.log('🧪 Running Developer Tools Integration Tests...\n');

  try {
    // Ensure test directories exist
    const testDirs = [
      path.join(__dirname, '__tests__/integration'),
      path.join(__dirname, 'coverage/integration'),
    ];

    testDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Set environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';

    // Run integration tests with specific configuration
    const command = `npx jest --config="${INTEGRATION_CONFIG}" --runInBand --detectOpenHandles --forceExit`;

    console.log(`Running command: ${command}\n`);

    execSync(command, {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        LOG_LEVEL: 'error',
      },
    });

    console.log('\n✅ Integration tests completed successfully!');

    // Display coverage summary if available
    const coveragePath = path.join(
      __dirname,
      'coverage/integration/lcov-report/index.html'
    );
    if (fs.existsSync(coveragePath)) {
      console.log(`📊 Coverage report available at: ${coveragePath}`);
    }
  } catch (error) {
    console.error('\n❌ Integration tests failed:');
    console.error(error.message);

    if (error.stdout) {
      console.error('\nStdout:', error.stdout.toString());
    }

    if (error.stderr) {
      console.error('\nStderr:', error.stderr.toString());
    }

    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Integration Test Runner for Developer Tools

Usage:
  node run-integration-tests.js [options]

Options:
  --help, -h     Show this help message
  --verbose, -v  Run tests with verbose output
  --coverage     Generate coverage report
  --watch        Run tests in watch mode

Examples:
  node run-integration-tests.js
  node run-integration-tests.js --verbose
  node run-integration-tests.js --coverage

Test Categories:
  • Debug Tools Integration Tests
  • Dev Utilities Integration Tests
  • Dev Onboarding Integration Tests
  • Performance Regression Tests
  • Cross-Platform Compatibility Tests
`);
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Run the tests
runIntegrationTests();
