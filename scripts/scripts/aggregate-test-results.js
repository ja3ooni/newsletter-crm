#!/usr/bin/env node

/**
 * Test Results Aggregator
 *
 * Aggregates test results from multiple test runs and platforms
 */

const fs = require('fs');
const path = require('path');

function aggregateTestResults() {
  console.log('📊 Aggregating test results...');
  console.log('═'.repeat(50));

  const aggregation = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalSuites: 0,
      passedSuites: 0,
      failedSuites: 0,
      platforms: [],
      coverage: null,
      performance: null,
      security: null,
    },
    platforms: {},
    testSuites: [],
    failures: [],
    coverage: null,
    performance: null,
    security: null,
  };

  // Aggregate unit test results
  aggregateUnitTests(aggregation);

  // Aggregate integration test results
  aggregateIntegrationTests(aggregation);

  // Aggregate performance test results
  aggregatePerformanceTests(aggregation);

  // Aggregate coverage data
  aggregateCoverage(aggregation);

  // Aggregate security scan results
  aggregateSecurityResults(aggregation);

  // Generate aggregated report
  generateAggregatedReport(aggregation);

  // Display summary
  displayAggregationSummary(aggregation);

  return aggregation;
}

function aggregateUnitTests(aggregation) {
  console.log('🧪 Aggregating unit test results...');

  const testResultsDir = path.join(__dirname, '../test-results');

  if (!fs.existsSync(testResultsDir)) {
    console.log('ℹ️  No unit test results found');
    return;
  }

  const files = fs.readdirSync(testResultsDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const filePath = path.join(testResultsDir, file);
      const results = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Extract platform from filename (e.g., results-ubuntu-node18.json)
      const platform = extractPlatformFromFilename(file);

      if (!aggregation.platforms[platform]) {
        aggregation.platforms[platform] = {
          name: platform,
          tests: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          suites: [],
        };
        aggregation.summary.platforms.push(platform);
      }

      // Aggregate Jest results format
      if (results.testResults) {
        for (const testResult of results.testResults) {
          aggregation.summary.totalSuites++;
          aggregation.platforms[platform].suites.push({
            name: testResult.name,
            tests:
              testResult.numPassingTests +
              testResult.numFailingTests +
              testResult.numPendingTests,
            passed: testResult.numPassingTests,
            failed: testResult.numFailingTests,
            skipped: testResult.numPendingTests,
            duration:
              testResult.perfStats?.end - testResult.perfStats?.start || 0,
          });

          aggregation.summary.totalTests +=
            testResult.numPassingTests +
            testResult.numFailingTests +
            testResult.numPendingTests;
          aggregation.summary.passedTests += testResult.numPassingTests;
          aggregation.summary.failedTests += testResult.numFailingTests;
          aggregation.summary.skippedTests += testResult.numPendingTests;

          aggregation.platforms[platform].tests +=
            testResult.numPassingTests +
            testResult.numFailingTests +
            testResult.numPendingTests;
          aggregation.platforms[platform].passed += testResult.numPassingTests;
          aggregation.platforms[platform].failed += testResult.numFailingTests;
          aggregation.platforms[platform].skipped += testResult.numPendingTests;

          if (testResult.numFailingTests > 0) {
            aggregation.summary.failedSuites++;

            // Collect failure details
            if (testResult.assertionResults) {
              for (const assertion of testResult.assertionResults) {
                if (assertion.status === 'failed') {
                  aggregation.failures.push({
                    suite: testResult.name,
                    test: assertion.title,
                    platform: platform,
                    error: assertion.failureMessages?.[0] || 'Unknown error',
                    type: 'unit',
                  });
                }
              }
            }
          } else {
            aggregation.summary.passedSuites++;
          }
        }
      }
    } catch (error) {
      console.warn(
        `⚠️  Could not parse test results from ${file}: ${error.message}`
      );
    }
  }
}

function aggregateIntegrationTests(aggregation) {
  console.log('🔗 Aggregating integration test results...');

  const integrationDir = path.join(
    __dirname,
    '../__tests__/integration/reports'
  );

  if (!fs.existsSync(integrationDir)) {
    console.log('ℹ️  No integration test results found');
    return;
  }

  const files = fs.readdirSync(integrationDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const filePath = path.join(integrationDir, file);
      const results = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Add integration test results to aggregation
      if (results.testResults) {
        for (const testResult of results.testResults) {
          aggregation.testSuites.push({
            name: testResult.name,
            type: 'integration',
            tests:
              testResult.numPassingTests +
              testResult.numFailingTests +
              testResult.numPendingTests,
            passed: testResult.numPassingTests,
            failed: testResult.numFailingTests,
            skipped: testResult.numPendingTests,
            duration:
              testResult.perfStats?.end - testResult.perfStats?.start || 0,
          });
        }
      }
    } catch (error) {
      console.warn(
        `⚠️  Could not parse integration test results from ${file}: ${error.message}`
      );
    }
  }
}

function aggregatePerformanceTests(aggregation) {
  console.log('🚀 Aggregating performance test results...');

  const performanceReportPath = path.join(
    __dirname,
    '../__tests__/performance-results/report.json'
  );

  if (fs.existsSync(performanceReportPath)) {
    try {
      const performanceReport = JSON.parse(
        fs.readFileSync(performanceReportPath, 'utf8')
      );
      aggregation.performance = performanceReport;
      aggregation.summary.performance = {
        status: performanceReport.summary.overallStatus,
        toolsWithRegressions: performanceReport.summary.toolsWithRegressions,
        totalTools: performanceReport.summary.totalTools,
      };
    } catch (error) {
      console.warn(`⚠️  Could not parse performance results: ${error.message}`);
    }
  } else {
    console.log('ℹ️  No performance test results found');
  }
}

function aggregateCoverage(aggregation) {
  console.log('📊 Aggregating coverage data...');

  const coveragePath = path.join(
    __dirname,
    '../coverage/coverage-summary.json'
  );

  if (fs.existsSync(coveragePath)) {
    try {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      aggregation.coverage = coverage;
      aggregation.summary.coverage = {
        statements: coverage.total.statements.pct,
        branches: coverage.total.branches.pct,
        functions: coverage.total.functions.pct,
        lines: coverage.total.lines.pct,
      };
    } catch (error) {
      console.warn(`⚠️  Could not parse coverage data: ${error.message}`);
    }
  } else {
    console.log('ℹ️  No coverage data found');
  }
}

function aggregateSecurityResults(aggregation) {
  console.log('🔒 Aggregating security scan results...');

  const securityReportPath = path.join(__dirname, '../security-report.json');

  if (fs.existsSync(securityReportPath)) {
    try {
      const securityReport = JSON.parse(
        fs.readFileSync(securityReportPath, 'utf8')
      );
      aggregation.security = securityReport;
      aggregation.summary.security = {
        vulnerabilities: securityReport.summary.vulnerabilities,
        highSeverity: securityReport.summary.highSeverity,
        mediumSeverity: securityReport.summary.mediumSeverity,
        lowSeverity: securityReport.summary.lowSeverity,
      };
    } catch (error) {
      console.warn(`⚠️  Could not parse security results: ${error.message}`);
    }
  } else {
    console.log('ℹ️  No security scan results found');
  }
}

function generateAggregatedReport(aggregation) {
  const reportDir = path.join(__dirname, '../test-aggregation');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Save detailed JSON report
  fs.writeFileSync(
    path.join(reportDir, 'aggregated-results.json'),
    JSON.stringify(aggregation, null, 2)
  );

  // Generate HTML report
  const htmlReport = generateHtmlReport(aggregation);
  fs.writeFileSync(path.join(reportDir, 'report.html'), htmlReport);

  // Generate markdown summary
  const markdownSummary = generateMarkdownSummary(aggregation);
  fs.writeFileSync(path.join(reportDir, 'summary.md'), markdownSummary);

  // Generate CI/CD summary
  const ciSummary = generateCISummary(aggregation);
  fs.writeFileSync(path.join(reportDir, 'ci-summary.txt'), ciSummary);
}

function generateHtmlReport(aggregation) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Developer Tools Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .platform-section { margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Developer Tools Test Report</h1>
        <p><strong>Generated:</strong> ${aggregation.timestamp}</p>
        <p><strong>Overall Status:</strong> ${aggregation.summary.failedTests === 0 ? '✅ PASSED' : '❌ FAILED'}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Tests</h3>
            <p class="passed">Passed: ${aggregation.summary.passedTests}</p>
            <p class="failed">Failed: ${aggregation.summary.failedTests}</p>
            <p class="skipped">Skipped: ${aggregation.summary.skippedTests}</p>
            <p><strong>Total: ${aggregation.summary.totalTests}</strong></p>
        </div>

        <div class="metric">
            <h3>Coverage</h3>
            ${
              aggregation.summary.coverage
                ? `
                <p>Statements: ${aggregation.summary.coverage.statements.toFixed(1)}%</p>
                <p>Branches: ${aggregation.summary.coverage.branches.toFixed(1)}%</p>
                <p>Functions: ${aggregation.summary.coverage.functions.toFixed(1)}%</p>
                <p>Lines: ${aggregation.summary.coverage.lines.toFixed(1)}%</p>
            `
                : '<p>No coverage data</p>'
            }
        </div>

        <div class="metric">
            <h3>Security</h3>
            ${
              aggregation.summary.security
                ? `
                <p class="failed">High: ${aggregation.summary.security.highSeverity}</p>
                <p class="failed">Medium: ${aggregation.summary.security.mediumSeverity}</p>
                <p>Low: ${aggregation.summary.security.lowSeverity}</p>
                <p><strong>Total: ${aggregation.summary.security.vulnerabilities}</strong></p>
            `
                : '<p>No security data</p>'
            }
        </div>
    </div>

    <h2>Platform Results</h2>
    ${Object.entries(aggregation.platforms)
      .map(
        ([platform, data]) => `
        <div class="platform-section">
            <h3>${platform}</h3>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Total Tests</td>
                    <td>${data.tests}</td>
                </tr>
                <tr>
                    <td>Passed</td>
                    <td class="passed">${data.passed}</td>
                </tr>
                <tr>
                    <td>Failed</td>
                    <td class="failed">${data.failed}</td>
                </tr>
                <tr>
                    <td>Skipped</td>
                    <td class="skipped">${data.skipped}</td>
                </tr>
            </table>
        </div>
    `
      )
      .join('')}

    ${
      aggregation.failures.length > 0
        ? `
        <h2>Failures</h2>
        <table>
            <tr>
                <th>Suite</th>
                <th>Test</th>
                <th>Platform</th>
                <th>Error</th>
            </tr>
            ${aggregation.failures
              .map(
                failure => `
                <tr>
                    <td>${failure.suite}</td>
                    <td>${failure.test}</td>
                    <td>${failure.platform}</td>
                    <td><pre>${failure.error}</pre></td>
                </tr>
            `
              )
              .join('')}
        </table>
    `
        : ''
    }
</body>
</html>
  `;
}

function generateMarkdownSummary(aggregation) {
  let markdown = `# Developer Tools Test Report\n\n`;
  markdown += `**Generated:** ${aggregation.timestamp}\n`;
  markdown += `**Overall Status:** ${aggregation.summary.failedTests === 0 ? '✅ PASSED' : '❌ FAILED'}\n\n`;

  markdown += `## Summary\n\n`;
  markdown += `- **Total Tests:** ${aggregation.summary.totalTests}\n`;
  markdown += `- **Passed:** ${aggregation.summary.passedTests}\n`;
  markdown += `- **Failed:** ${aggregation.summary.failedTests}\n`;
  markdown += `- **Skipped:** ${aggregation.summary.skippedTests}\n`;
  markdown += `- **Platforms:** ${aggregation.summary.platforms.join(', ')}\n\n`;

  if (aggregation.summary.coverage) {
    markdown += `## Coverage\n\n`;
    markdown += `- **Statements:** ${aggregation.summary.coverage.statements.toFixed(1)}%\n`;
    markdown += `- **Branches:** ${aggregation.summary.coverage.branches.toFixed(1)}%\n`;
    markdown += `- **Functions:** ${aggregation.summary.coverage.functions.toFixed(1)}%\n`;
    markdown += `- **Lines:** ${aggregation.summary.coverage.lines.toFixed(1)}%\n\n`;
  }

  if (aggregation.summary.security) {
    markdown += `## Security\n\n`;
    markdown += `- **Total Vulnerabilities:** ${aggregation.summary.security.vulnerabilities}\n`;
    markdown += `- **High Severity:** ${aggregation.summary.security.highSeverity}\n`;
    markdown += `- **Medium Severity:** ${aggregation.summary.security.mediumSeverity}\n`;
    markdown += `- **Low Severity:** ${aggregation.summary.security.lowSeverity}\n\n`;
  }

  if (aggregation.summary.performance) {
    markdown += `## Performance\n\n`;
    markdown += `- **Status:** ${aggregation.summary.performance.status}\n`;
    markdown += `- **Tools with Regressions:** ${aggregation.summary.performance.toolsWithRegressions}\n`;
    markdown += `- **Total Tools:** ${aggregation.summary.performance.totalTools}\n\n`;
  }

  return markdown;
}

function generateCISummary(aggregation) {
  let summary = `Developer Tools CI/CD Summary\n`;
  summary += `================================\n`;
  summary += `Generated: ${aggregation.timestamp}\n`;
  summary += `Overall Status: ${aggregation.summary.failedTests === 0 ? 'PASSED' : 'FAILED'}\n\n`;
  summary += `Tests: ${aggregation.summary.passedTests}/${aggregation.summary.totalTests} passed\n`;
  summary += `Platforms: ${aggregation.summary.platforms.length}\n`;

  if (aggregation.summary.coverage) {
    summary += `Coverage: ${aggregation.summary.coverage.statements.toFixed(1)}%\n`;
  }

  if (aggregation.summary.security) {
    summary += `Security: ${aggregation.summary.security.vulnerabilities} vulnerabilities\n`;
  }

  if (aggregation.failures.length > 0) {
    summary += `\nFailures:\n`;
    aggregation.failures.forEach(failure => {
      summary += `- ${failure.suite}: ${failure.test} (${failure.platform})\n`;
    });
  }

  return summary;
}

function displayAggregationSummary(aggregation) {
  console.log('\n📋 Aggregation Summary:');
  console.log('═'.repeat(50));
  console.log(`Total Tests: ${aggregation.summary.totalTests}`);
  console.log(`Passed: ${aggregation.summary.passedTests}`);
  console.log(`Failed: ${aggregation.summary.failedTests}`);
  console.log(`Skipped: ${aggregation.summary.skippedTests}`);
  console.log(`Platforms: ${aggregation.summary.platforms.join(', ')}`);

  if (aggregation.summary.coverage) {
    console.log(
      `Coverage: ${aggregation.summary.coverage.statements.toFixed(1)}%`
    );
  }

  if (aggregation.summary.security) {
    console.log(
      `Security Issues: ${aggregation.summary.security.vulnerabilities}`
    );
  }

  console.log('═'.repeat(50));

  const status =
    aggregation.summary.failedTests === 0 ? '✅ PASSED' : '❌ FAILED';
  console.log(`Overall Status: ${status}`);
}

function extractPlatformFromFilename(filename) {
  // Extract platform from filename like "results-ubuntu-node18.json"
  const match = filename.match(/results-([^-]+)-/);
  return match ? match[1] : 'unknown';
}

if (require.main === module) {
  aggregateTestResults();
}

module.exports = { aggregateTestResults };
