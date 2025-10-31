#!/usr/bin/env node

/**
 * Jest Test Results Processor
 *
 * Processes Jest test results and generates additional reports
 */

const fs = require('fs');
const path = require('path');

function processTestResults(results) {
  // Ensure test-results directory exists
  const testResultsDir = path.join(__dirname, '../test-results');
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }

  // Generate platform-specific results filename
  const platform = process.platform;
  const nodeVersion = process.version.replace(/[^0-9]/g, '');
  const filename = `results-${platform}-node${nodeVersion}.json`;
  const filePath = path.join(testResultsDir, filename);

  // Process and enhance results
  const processedResults = {
    ...results,
    metadata: {
      platform: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      ci: !!process.env.CI,
    },
    summary: {
      totalTests: results.numTotalTests,
      passedTests: results.numPassedTests,
      failedTests: results.numFailedTests,
      skippedTests: results.numPendingTests,
      totalSuites: results.numTotalTestSuites,
      passedSuites: results.numPassedTestSuites,
      failedSuites: results.numFailedTestSuites,
      duration: results.testResults.reduce((total, result) => {
        return total + (result.perfStats?.end - result.perfStats?.start || 0);
      }, 0),
    },
    coverage: results.coverageMap
      ? {
          statements: results.coverageMap.getCoverageSummary().statements,
          branches: results.coverageMap.getCoverageSummary().branches,
          functions: results.coverageMap.getCoverageSummary().functions,
          lines: results.coverageMap.getCoverageSummary().lines,
        }
      : null,
  };

  // Extract failure details
  processedResults.failures = [];
  results.testResults.forEach(testResult => {
    if (testResult.numFailingTests > 0 && testResult.assertionResults) {
      testResult.assertionResults.forEach(assertion => {
        if (assertion.status === 'failed') {
          processedResults.failures.push({
            suite: testResult.testFilePath,
            test: assertion.title,
            error: assertion.failureMessages?.[0] || 'Unknown error',
            duration: assertion.duration || 0,
          });
        }
      });
    }
  });

  // Extract performance data
  processedResults.performance = {
    slowestTests: results.testResults
      .map(result => ({
        file: result.testFilePath,
        duration: result.perfStats?.end - result.perfStats?.start || 0,
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10),

    averageTestDuration:
      processedResults.summary.duration /
      Math.max(processedResults.summary.totalTests, 1),

    memoryUsage: process.memoryUsage
      ? {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss,
        }
      : null,
  };

  // Save processed results
  fs.writeFileSync(filePath, JSON.stringify(processedResults, null, 2));

  // Generate summary report
  generateSummaryReport(processedResults, testResultsDir);

  // Generate performance report if needed
  if (processedResults.performance) {
    generatePerformanceReport(processedResults, testResultsDir);
  }

  // Log summary to console
  logSummary(processedResults);

  return results; // Return original results for Jest
}

function generateSummaryReport(results, outputDir) {
  const summary = {
    timestamp: results.metadata.timestamp,
    platform: results.metadata.platform,
    nodeVersion: results.metadata.nodeVersion,
    status: results.summary.failedTests === 0 ? 'PASSED' : 'FAILED',
    tests: {
      total: results.summary.totalTests,
      passed: results.summary.passedTests,
      failed: results.summary.failedTests,
      skipped: results.summary.skippedTests,
    },
    suites: {
      total: results.summary.totalSuites,
      passed: results.summary.passedSuites,
      failed: results.summary.failedSuites,
    },
    duration: results.summary.duration,
    coverage: results.coverage,
    failures: results.failures.length,
    performance: {
      averageTestDuration: results.performance.averageTestDuration,
      slowestTest: results.performance.slowestTests[0],
    },
  };

  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );

  // Generate markdown summary
  const markdown = generateMarkdownSummary(summary);
  fs.writeFileSync(path.join(outputDir, 'summary.md'), markdown);
}

function generatePerformanceReport(results, outputDir) {
  const performanceDir = path.join(
    outputDir,
    '../__tests__/performance-results'
  );
  if (!fs.existsSync(performanceDir)) {
    fs.mkdirSync(performanceDir, { recursive: true });
  }

  const performanceReport = {
    timestamp: results.metadata.timestamp,
    platform: results.metadata.platform,
    summary: {
      totalTests: results.summary.totalTests,
      totalDuration: results.summary.duration,
      averageDuration: results.performance.averageTestDuration,
      memoryUsage: results.performance.memoryUsage,
    },
    slowestTests: results.performance.slowestTests,
    thresholds: {
      maxTestDuration: 5000, // 5 seconds
      maxSuiteDuration: 30000, // 30 seconds
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    },
    issues: [],
  };

  // Check for performance issues
  results.performance.slowestTests.forEach(test => {
    if (test.duration > performanceReport.thresholds.maxTestDuration) {
      performanceReport.issues.push({
        type: 'slow_test',
        file: test.file,
        duration: test.duration,
        threshold: performanceReport.thresholds.maxTestDuration,
      });
    }
  });

  if (
    results.performance.memoryUsage &&
    results.performance.memoryUsage.heapUsed >
      performanceReport.thresholds.maxMemoryUsage
  ) {
    performanceReport.issues.push({
      type: 'high_memory_usage',
      actual: results.performance.memoryUsage.heapUsed,
      threshold: performanceReport.thresholds.maxMemoryUsage,
    });
  }

  fs.writeFileSync(
    path.join(performanceDir, 'test-performance.json'),
    JSON.stringify(performanceReport, null, 2)
  );
}

function generateMarkdownSummary(summary) {
  let markdown = `# Test Results Summary\n\n`;
  markdown += `**Platform:** ${summary.platform}\n`;
  markdown += `**Node Version:** ${summary.nodeVersion}\n`;
  markdown += `**Timestamp:** ${summary.timestamp}\n`;
  markdown += `**Status:** ${summary.status === 'PASSED' ? '✅ PASSED' : '❌ FAILED'}\n\n`;

  markdown += `## Test Results\n\n`;
  markdown += `- **Total Tests:** ${summary.tests.total}\n`;
  markdown += `- **Passed:** ${summary.tests.passed}\n`;
  markdown += `- **Failed:** ${summary.tests.failed}\n`;
  markdown += `- **Skipped:** ${summary.tests.skipped}\n`;
  markdown += `- **Duration:** ${(summary.duration / 1000).toFixed(2)}s\n\n`;

  if (summary.coverage) {
    markdown += `## Coverage\n\n`;
    markdown += `- **Statements:** ${summary.coverage.statements.pct.toFixed(1)}%\n`;
    markdown += `- **Branches:** ${summary.coverage.branches.pct.toFixed(1)}%\n`;
    markdown += `- **Functions:** ${summary.coverage.functions.pct.toFixed(1)}%\n`;
    markdown += `- **Lines:** ${summary.coverage.lines.pct.toFixed(1)}%\n\n`;
  }

  if (summary.failures > 0) {
    markdown += `## Issues\n\n`;
    markdown += `- **Failed Tests:** ${summary.failures}\n`;
    markdown += `- **Failed Suites:** ${summary.suites.failed}\n\n`;
  }

  return markdown;
}

function logSummary(results) {
  const status = results.summary.failedTests === 0 ? '✅ PASSED' : '❌ FAILED';
  const duration = (results.summary.duration / 1000).toFixed(2);

  console.log('\n📊 Test Results Summary:');
  console.log('═'.repeat(40));
  console.log(`Status: ${status}`);
  console.log(
    `Tests: ${results.summary.passedTests}/${results.summary.totalTests} passed`
  );
  console.log(`Duration: ${duration}s`);
  console.log(`Platform: ${results.metadata.platform}`);

  if (results.coverage) {
    console.log(`Coverage: ${results.coverage.statements.pct.toFixed(1)}%`);
  }

  if (results.failures.length > 0) {
    console.log(`Failures: ${results.failures.length}`);
  }

  console.log('═'.repeat(40));
}

module.exports = processTestResults;
