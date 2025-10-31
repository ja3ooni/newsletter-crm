#!/usr/bin/env node

/**
 * Final Report Generator
 *
 * Generates comprehensive final report combining all test results,
 * quality metrics, and recommendations
 */

const fs = require('fs');
const path = require('path');

function generateFinalReport() {
  console.log('📄 Generating final report...');
  console.log('═'.repeat(50));

  const report = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: getPackageVersion(),
      environment: process.env.NODE_ENV || 'development',
      platform: process.platform,
      nodeVersion: process.version,
    },
    summary: {
      overallStatus: 'PASSED',
      totalIssues: 0,
      criticalIssues: 0,
      recommendations: [],
    },
    sections: {},
  };

  // Load and process all available reports
  loadTestResults(report);
  loadCoverageResults(report);
  loadPerformanceResults(report);
  loadSecurityResults(report);
  loadQualityGatesResults(report);

  // Calculate overall status and recommendations
  calculateOverallStatus(report);
  generateRecommendations(report);

  // Generate different report formats
  saveReports(report);

  // Display summary
  displayFinalSummary(report);

  return report;
}

function loadTestResults(report) {
  console.log('📊 Loading test results...');

  const aggregationPath = path.join(
    __dirname,
    '../test-aggregation/aggregated-results.json'
  );

  if (fs.existsSync(aggregationPath)) {
    try {
      const aggregation = JSON.parse(fs.readFileSync(aggregationPath, 'utf8'));

      report.sections.testing = {
        status: aggregation.summary.failedTests === 0 ? 'PASSED' : 'FAILED',
        totalTests: aggregation.summary.totalTests,
        passedTests: aggregation.summary.passedTests,
        failedTests: aggregation.summary.failedTests,
        skippedTests: aggregation.summary.skippedTests,
        platforms: aggregation.summary.platforms,
        failures: aggregation.failures,
        testSuites: aggregation.testSuites,
      };

      if (aggregation.summary.failedTests > 0) {
        report.summary.totalIssues += aggregation.summary.failedTests;
        report.summary.criticalIssues += aggregation.failures.filter(
          f => f.type === 'unit'
        ).length;
      }
    } catch (error) {
      console.warn(`⚠️  Could not load test results: ${error.message}`);
      report.sections.testing = { status: 'ERROR', error: error.message };
    }
  } else {
    console.log('ℹ️  No aggregated test results found');
    report.sections.testing = { status: 'NOT_RUN' };
  }
}

function loadCoverageResults(report) {
  console.log('📈 Loading coverage results...');

  const coveragePath = path.join(
    __dirname,
    '../coverage/coverage-summary.json'
  );

  if (fs.existsSync(coveragePath)) {
    try {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));

      const thresholds = {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      };

      let coverageIssues = 0;
      const metrics = {};

      for (const [metric, threshold] of Object.entries(thresholds)) {
        const actual = coverage.total[metric].pct;
        metrics[metric] = {
          actual,
          threshold,
          status: actual >= threshold ? 'PASSED' : 'FAILED',
        };

        if (actual < threshold) {
          coverageIssues++;
        }
      }

      report.sections.coverage = {
        status: coverageIssues === 0 ? 'PASSED' : 'FAILED',
        metrics,
        overall: coverage.total,
        files: Object.keys(coverage).filter(k => k !== 'total').length,
      };

      if (coverageIssues > 0) {
        report.summary.totalIssues += coverageIssues;
      }
    } catch (error) {
      console.warn(`⚠️  Could not load coverage results: ${error.message}`);
      report.sections.coverage = { status: 'ERROR', error: error.message };
    }
  } else {
    console.log('ℹ️  No coverage results found');
    report.sections.coverage = { status: 'NOT_RUN' };
  }
}

function loadPerformanceResults(report) {
  console.log('🚀 Loading performance results...');

  const performancePath = path.join(
    __dirname,
    '../__tests__/performance-results/report.json'
  );

  if (fs.existsSync(performancePath)) {
    try {
      const performance = JSON.parse(fs.readFileSync(performancePath, 'utf8'));

      report.sections.performance = {
        status: performance.summary.overallStatus,
        totalTools: performance.summary.totalTools,
        toolsWithRegressions: performance.summary.toolsWithRegressions,
        results: performance.results,
        thresholds: performance.thresholds,
      };

      if (performance.summary.overallStatus === 'FAILED') {
        report.summary.totalIssues += performance.summary.toolsWithRegressions;
        report.summary.criticalIssues +=
          performance.summary.toolsWithRegressions;
      }
    } catch (error) {
      console.warn(`⚠️  Could not load performance results: ${error.message}`);
      report.sections.performance = { status: 'ERROR', error: error.message };
    }
  } else {
    console.log('ℹ️  No performance results found');
    report.sections.performance = { status: 'NOT_RUN' };
  }
}

function loadSecurityResults(report) {
  console.log('🔒 Loading security results...');

  const securityPath = path.join(__dirname, '../security-report.json');

  if (fs.existsSync(securityPath)) {
    try {
      const security = JSON.parse(fs.readFileSync(securityPath, 'utf8'));

      report.sections.security = {
        status: security.summary.highSeverity === 0 ? 'PASSED' : 'FAILED',
        totalVulnerabilities: security.summary.vulnerabilities,
        highSeverity: security.summary.highSeverity,
        mediumSeverity: security.summary.mediumSeverity,
        lowSeverity: security.summary.lowSeverity,
        filesScanned: security.summary.filesScanned,
        findings: security.findings.slice(0, 10), // Top 10 findings
        recommendations: security.recommendations,
      };

      report.summary.totalIssues += security.summary.vulnerabilities;
      report.summary.criticalIssues += security.summary.highSeverity;
    } catch (error) {
      console.warn(`⚠️  Could not load security results: ${error.message}`);
      report.sections.security = { status: 'ERROR', error: error.message };
    }
  } else {
    console.log('ℹ️  No security results found');
    report.sections.security = { status: 'NOT_RUN' };
  }
}

function loadQualityGatesResults(report) {
  console.log('🚪 Loading quality gates results...');

  const qualityPath = path.join(
    __dirname,
    '../quality-report/quality-gates.json'
  );

  if (fs.existsSync(qualityPath)) {
    try {
      const quality = JSON.parse(fs.readFileSync(qualityPath, 'utf8'));

      report.sections.qualityGates = {
        status: quality.overallStatus,
        totalGates: quality.summary.totalGates,
        passedGates: quality.summary.passedGates,
        failedGates: quality.summary.failedGates,
        gates: quality.gates,
      };

      if (quality.overallStatus === 'FAILED') {
        report.summary.totalIssues += quality.summary.failedGates;
        report.summary.criticalIssues += quality.summary.failedGates;
      }
    } catch (error) {
      console.warn(
        `⚠️  Could not load quality gates results: ${error.message}`
      );
      report.sections.qualityGates = { status: 'ERROR', error: error.message };
    }
  } else {
    console.log('ℹ️  No quality gates results found');
    report.sections.qualityGates = { status: 'NOT_RUN' };
  }
}

function calculateOverallStatus(report) {
  const sections = Object.values(report.sections);
  const failedSections = sections.filter(s => s.status === 'FAILED');
  const errorSections = sections.filter(s => s.status === 'ERROR');

  if (errorSections.length > 0) {
    report.summary.overallStatus = 'ERROR';
  } else if (failedSections.length > 0) {
    report.summary.overallStatus = 'FAILED';
  } else if (sections.some(s => s.status === 'NOT_RUN')) {
    report.summary.overallStatus = 'INCOMPLETE';
  } else {
    report.summary.overallStatus = 'PASSED';
  }
}

function generateRecommendations(report) {
  const recommendations = [];

  // Testing recommendations
  if (report.sections.testing?.status === 'FAILED') {
    recommendations.push({
      priority: 'HIGH',
      category: 'Testing',
      message: `Fix ${report.sections.testing.failedTests} failing tests`,
      action: 'Review test failures and fix underlying issues',
    });
  }

  // Coverage recommendations
  if (report.sections.coverage?.status === 'FAILED') {
    const failedMetrics = Object.entries(report.sections.coverage.metrics)
      .filter(([_, data]) => data.status === 'FAILED')
      .map(
        ([metric, data]) =>
          `${metric} (${data.actual.toFixed(1)}% < ${data.threshold}%)`
      );

    recommendations.push({
      priority: 'MEDIUM',
      category: 'Coverage',
      message: `Improve test coverage for: ${failedMetrics.join(', ')}`,
      action: 'Add more unit tests and integration tests',
    });
  }

  // Performance recommendations
  if (report.sections.performance?.status === 'FAILED') {
    recommendations.push({
      priority: 'HIGH',
      category: 'Performance',
      message: `Address performance regressions in ${report.sections.performance.toolsWithRegressions} tools`,
      action: 'Profile and optimize slow operations',
    });
  }

  // Security recommendations
  if (report.sections.security?.highSeverity > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      category: 'Security',
      message: `Fix ${report.sections.security.highSeverity} high-severity security issues`,
      action: 'Address security vulnerabilities immediately',
    });
  }

  // Quality gates recommendations
  if (report.sections.qualityGates?.status === 'FAILED') {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Quality',
      message: `${report.sections.qualityGates.failedGates} quality gates failed`,
      action: 'Review and fix quality gate failures',
    });
  }

  // General recommendations
  recommendations.push({
    priority: 'LOW',
    category: 'Maintenance',
    message: 'Keep dependencies updated and run security scans regularly',
    action: 'Set up automated dependency updates and security monitoring',
  });

  recommendations.push({
    priority: 'LOW',
    category: 'Documentation',
    message: 'Ensure all tools have up-to-date documentation',
    action: 'Review and update README files and inline documentation',
  });

  report.summary.recommendations = recommendations;
}

function saveReports(report) {
  const reportDir = path.join(__dirname, '../quality-report');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Save detailed JSON report
  fs.writeFileSync(
    path.join(reportDir, 'final-report.json'),
    JSON.stringify(report, null, 2)
  );

  // Generate and save HTML report
  const htmlReport = generateHtmlReport(report);
  fs.writeFileSync(path.join(reportDir, 'final-report.html'), htmlReport);

  // Generate and save markdown report
  const markdownReport = generateMarkdownReport(report);
  fs.writeFileSync(path.join(reportDir, 'final-report.md'), markdownReport);

  // Generate executive summary
  const executiveSummary = generateExecutiveSummary(report);
  fs.writeFileSync(
    path.join(reportDir, 'executive-summary.md'),
    executiveSummary
  );

  // Generate CI/CD summary for GitHub Actions
  const ciSummary = generateCISummary(report);
  fs.writeFileSync(path.join(reportDir, 'summary.md'), ciSummary);
}

function generateHtmlReport(report) {
  const statusColor = {
    PASSED: '#28a745',
    FAILED: '#dc3545',
    ERROR: '#fd7e14',
    INCOMPLETE: '#ffc107',
    NOT_RUN: '#6c757d',
  };

  return `
<!DOCTYPE html>
<html>
<head>
    <title>Developer Tools Final Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header .meta { opacity: 0.9; margin-top: 10px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.9em; }
        .summary { padding: 30px; border-bottom: 1px solid #eee; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #495057; }
        .summary-card .number { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .section { padding: 30px; border-bottom: 1px solid #eee; }
        .section h2 { color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; }
        .section-status { float: right; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .recommendation { margin: 10px 0; padding: 10px; border-left: 4px solid #ffc107; background: white; }
        .recommendation.critical { border-left-color: #dc3545; }
        .recommendation.high { border-left-color: #fd7e14; }
        .recommendation.medium { border-left-color: #ffc107; }
        .recommendation.low { border-left-color: #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #dee2e6; padding: 12px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .metric-good { color: #28a745; font-weight: bold; }
        .metric-bad { color: #dc3545; font-weight: bold; }
        .metric-warning { color: #ffc107; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Developer Tools Final Report</h1>
            <div class="meta">
                <p><strong>Generated:</strong> ${report.metadata.timestamp}</p>
                <p><strong>Version:</strong> ${report.metadata.version} | <strong>Platform:</strong> ${report.metadata.platform} | <strong>Node:</strong> ${report.metadata.nodeVersion}</p>
                <span class="status-badge" style="background-color: ${statusColor[report.summary.overallStatus]}">
                    ${report.summary.overallStatus}
                </span>
            </div>
        </div>

        <div class="summary">
            <h2>Executive Summary</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <h3>Overall Status</h3>
                    <div class="number" style="color: ${statusColor[report.summary.overallStatus]}">${report.summary.overallStatus}</div>
                </div>
                <div class="summary-card">
                    <h3>Total Issues</h3>
                    <div class="number" style="color: ${report.summary.totalIssues > 0 ? '#dc3545' : '#28a745'}">${report.summary.totalIssues}</div>
                </div>
                <div class="summary-card">
                    <h3>Critical Issues</h3>
                    <div class="number" style="color: ${report.summary.criticalIssues > 0 ? '#dc3545' : '#28a745'}">${report.summary.criticalIssues}</div>
                </div>
                <div class="summary-card">
                    <h3>Recommendations</h3>
                    <div class="number" style="color: #6c757d">${report.summary.recommendations.length}</div>
                </div>
            </div>
        </div>

        ${Object.entries(report.sections)
          .map(
            ([sectionName, sectionData]) => `
            <div class="section">
                <h2>
                    ${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}
                    <span class="section-status status-badge" style="background-color: ${statusColor[sectionData.status]}">
                        ${sectionData.status}
                    </span>
                </h2>
                ${generateSectionContent(sectionName, sectionData)}
            </div>
        `
          )
          .join('')}

        <div class="section">
            <h2>Recommendations</h2>
            <div class="recommendations">
                ${report.summary.recommendations
                  .map(
                    rec => `
                    <div class="recommendation ${rec.priority.toLowerCase()}">
                        <strong>[${rec.priority}] ${rec.category}:</strong> ${rec.message}
                        <br><small><strong>Action:</strong> ${rec.action}</small>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>
    </div>
</body>
</html>
  `;
}

function generateSectionContent(sectionName, sectionData) {
  switch (sectionName) {
    case 'testing':
      return `
        <p><strong>Total Tests:</strong> ${sectionData.totalTests || 0}</p>
        <p><strong>Passed:</strong> <span class="metric-good">${sectionData.passedTests || 0}</span></p>
        <p><strong>Failed:</strong> <span class="metric-bad">${sectionData.failedTests || 0}</span></p>
        <p><strong>Skipped:</strong> <span class="metric-warning">${sectionData.skippedTests || 0}</span></p>
        <p><strong>Platforms:</strong> ${(sectionData.platforms || []).join(', ')}</p>
      `;

    case 'coverage':
      if (sectionData.metrics) {
        return `
          <table>
            <tr><th>Metric</th><th>Actual</th><th>Threshold</th><th>Status</th></tr>
            ${Object.entries(sectionData.metrics)
              .map(
                ([metric, data]) => `
              <tr>
                <td>${metric}</td>
                <td class="${data.status === 'PASSED' ? 'metric-good' : 'metric-bad'}">${data.actual.toFixed(1)}%</td>
                <td>${data.threshold}%</td>
                <td class="${data.status === 'PASSED' ? 'metric-good' : 'metric-bad'}">${data.status}</td>
              </tr>
            `
              )
              .join('')}
          </table>
        `;
      }
      return '<p>No coverage data available</p>';

    case 'security':
      return `
        <p><strong>Files Scanned:</strong> ${sectionData.filesScanned || 0}</p>
        <p><strong>Total Vulnerabilities:</strong> ${sectionData.totalVulnerabilities || 0}</p>
        <p><strong>High Severity:</strong> <span class="metric-bad">${sectionData.highSeverity || 0}</span></p>
        <p><strong>Medium Severity:</strong> <span class="metric-warning">${sectionData.mediumSeverity || 0}</span></p>
        <p><strong>Low Severity:</strong> ${sectionData.lowSeverity || 0}</p>
      `;

    case 'performance':
      return `
        <p><strong>Total Tools:</strong> ${sectionData.totalTools || 0}</p>
        <p><strong>Tools with Regressions:</strong> <span class="metric-bad">${sectionData.toolsWithRegressions || 0}</span></p>
      `;

    case 'qualityGates':
      return `
        <p><strong>Total Gates:</strong> ${sectionData.totalGates || 0}</p>
        <p><strong>Passed:</strong> <span class="metric-good">${sectionData.passedGates || 0}</span></p>
        <p><strong>Failed:</strong> <span class="metric-bad">${sectionData.failedGates || 0}</span></p>
      `;

    default:
      return '<p>No additional details available</p>';
  }
}

function generateMarkdownReport(report) {
  let markdown = `# Developer Tools Final Report\n\n`;
  markdown += `**Generated:** ${report.metadata.timestamp}\n`;
  markdown += `**Version:** ${report.metadata.version}\n`;
  markdown += `**Platform:** ${report.metadata.platform}\n`;
  markdown += `**Node Version:** ${report.metadata.nodeVersion}\n`;
  markdown += `**Overall Status:** ${getStatusEmoji(report.summary.overallStatus)} ${report.summary.overallStatus}\n\n`;

  markdown += `## Executive Summary\n\n`;
  markdown += `- **Total Issues:** ${report.summary.totalIssues}\n`;
  markdown += `- **Critical Issues:** ${report.summary.criticalIssues}\n`;
  markdown += `- **Recommendations:** ${report.summary.recommendations.length}\n\n`;

  for (const [sectionName, sectionData] of Object.entries(report.sections)) {
    markdown += `## ${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}\n\n`;
    markdown += `**Status:** ${getStatusEmoji(sectionData.status)} ${sectionData.status}\n\n`;

    // Add section-specific details
    if (sectionName === 'testing' && sectionData.totalTests) {
      markdown += `- **Total Tests:** ${sectionData.totalTests}\n`;
      markdown += `- **Passed:** ${sectionData.passedTests}\n`;
      markdown += `- **Failed:** ${sectionData.failedTests}\n`;
      markdown += `- **Skipped:** ${sectionData.skippedTests}\n`;
      markdown += `- **Platforms:** ${sectionData.platforms.join(', ')}\n\n`;
    }

    if (sectionName === 'coverage' && sectionData.metrics) {
      markdown += `| Metric | Actual | Threshold | Status |\n`;
      markdown += `|--------|--------|-----------|--------|\n`;
      for (const [metric, data] of Object.entries(sectionData.metrics)) {
        const statusEmoji = data.status === 'PASSED' ? '✅' : '❌';
        markdown += `| ${metric} | ${data.actual.toFixed(1)}% | ${data.threshold}% | ${statusEmoji} ${data.status} |\n`;
      }
      markdown += `\n`;
    }
  }

  markdown += `## Recommendations\n\n`;
  for (const rec of report.summary.recommendations) {
    const priorityEmoji =
      {
        CRITICAL: '🚨',
        HIGH: '⚠️',
        MEDIUM: '💡',
        LOW: 'ℹ️',
      }[rec.priority] || '•';

    markdown += `### ${priorityEmoji} ${rec.category} (${rec.priority})\n\n`;
    markdown += `**Issue:** ${rec.message}\n\n`;
    markdown += `**Action:** ${rec.action}\n\n`;
  }

  return markdown;
}

function generateExecutiveSummary(report) {
  let summary = `# Executive Summary - Developer Tools Quality Report\n\n`;
  summary += `**Date:** ${new Date(report.metadata.timestamp).toLocaleDateString()}\n`;
  summary += `**Overall Status:** ${getStatusEmoji(report.summary.overallStatus)} ${report.summary.overallStatus}\n\n`;

  summary += `## Key Findings\n\n`;

  if (report.summary.overallStatus === 'PASSED') {
    summary += `✅ All quality checks passed successfully. The developer tools are ready for production use.\n\n`;
  } else {
    summary += `❌ Quality issues detected that require attention before production deployment.\n\n`;
  }

  summary += `- **Total Issues Identified:** ${report.summary.totalIssues}\n`;
  summary += `- **Critical Issues:** ${report.summary.criticalIssues}\n`;
  summary += `- **Action Items:** ${report.summary.recommendations.length}\n\n`;

  summary += `## Section Status\n\n`;
  for (const [sectionName, sectionData] of Object.entries(report.sections)) {
    summary += `- **${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}:** ${getStatusEmoji(sectionData.status)} ${sectionData.status}\n`;
  }

  summary += `\n## Priority Actions\n\n`;
  const criticalRecs = report.summary.recommendations.filter(
    r => r.priority === 'CRITICAL'
  );
  const highRecs = report.summary.recommendations.filter(
    r => r.priority === 'HIGH'
  );

  if (criticalRecs.length > 0) {
    summary += `### 🚨 Critical (Immediate Action Required)\n\n`;
    criticalRecs.forEach(rec => {
      summary += `- **${rec.category}:** ${rec.message}\n`;
    });
    summary += `\n`;
  }

  if (highRecs.length > 0) {
    summary += `### ⚠️ High Priority\n\n`;
    highRecs.forEach(rec => {
      summary += `- **${rec.category}:** ${rec.message}\n`;
    });
    summary += `\n`;
  }

  summary += `## Next Steps\n\n`;
  if (report.summary.criticalIssues > 0) {
    summary += `1. **Immediate:** Address all critical issues before proceeding\n`;
    summary += `2. **Short-term:** Fix high-priority issues within 1-2 days\n`;
    summary += `3. **Medium-term:** Address remaining issues within 1 week\n`;
  } else if (report.summary.totalIssues > 0) {
    summary += `1. **Short-term:** Address identified issues within 2-3 days\n`;
    summary += `2. **Medium-term:** Implement recommended improvements\n`;
    summary += `3. **Long-term:** Establish regular quality monitoring\n`;
  } else {
    summary += `1. **Deployment:** Tools are ready for production deployment\n`;
    summary += `2. **Monitoring:** Continue regular quality checks\n`;
    summary += `3. **Maintenance:** Keep dependencies updated and secure\n`;
  }

  return summary;
}

function generateCISummary(report) {
  let summary = `## 🔍 Developer Tools CI/CD Summary\n\n`;
  summary += `**Status:** ${getStatusEmoji(report.summary.overallStatus)} ${report.summary.overallStatus}\n`;
  summary += `**Issues:** ${report.summary.totalIssues} total, ${report.summary.criticalIssues} critical\n\n`;

  // Section status table
  summary += `| Section | Status | Details |\n`;
  summary += `|---------|--------|---------|\n`;

  for (const [sectionName, sectionData] of Object.entries(report.sections)) {
    const emoji = getStatusEmoji(sectionData.status);
    let details = '';

    switch (sectionName) {
      case 'testing':
        details = `${sectionData.passedTests || 0}/${sectionData.totalTests || 0} tests passed`;
        break;
      case 'coverage':
        if (sectionData.overall) {
          details = `${sectionData.overall.statements.pct.toFixed(1)}% coverage`;
        }
        break;
      case 'security':
        details = `${sectionData.totalVulnerabilities || 0} vulnerabilities`;
        break;
      case 'performance':
        details = `${sectionData.toolsWithRegressions || 0} regressions`;
        break;
      case 'qualityGates':
        details = `${sectionData.passedGates || 0}/${sectionData.totalGates || 0} gates passed`;
        break;
    }

    summary += `| ${sectionName} | ${emoji} ${sectionData.status} | ${details} |\n`;
  }

  if (report.summary.recommendations.length > 0) {
    summary += `\n### 📋 Action Items\n\n`;
    const priorityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    for (const priority of priorityOrder) {
      const recs = report.summary.recommendations.filter(
        r => r.priority === priority
      );
      if (recs.length > 0) {
        summary += `**${priority}:**\n`;
        recs.forEach(rec => {
          summary += `- ${rec.category}: ${rec.message}\n`;
        });
        summary += `\n`;
      }
    }
  }

  return summary;
}

function displayFinalSummary(report) {
  console.log('\n📋 Final Report Summary:');
  console.log('═'.repeat(60));
  console.log(
    `Overall Status: ${getStatusEmoji(report.summary.overallStatus)} ${report.summary.overallStatus}`
  );
  console.log(`Total Issues: ${report.summary.totalIssues}`);
  console.log(`Critical Issues: ${report.summary.criticalIssues}`);
  console.log(`Recommendations: ${report.summary.recommendations.length}`);

  console.log('\n📊 Section Status:');
  for (const [sectionName, sectionData] of Object.entries(report.sections)) {
    const emoji = getStatusEmoji(sectionData.status);
    console.log(`${emoji} ${sectionName.padEnd(15)}: ${sectionData.status}`);
  }

  if (report.summary.criticalIssues > 0) {
    console.log('\n🚨 Critical issues found - immediate action required!');
  } else if (report.summary.totalIssues > 0) {
    console.log('\n⚠️  Issues found - review and address before deployment');
  } else {
    console.log('\n✅ All checks passed - ready for deployment!');
  }

  console.log('═'.repeat(60));
  console.log('📄 Reports generated in quality-report/ directory');
}

function getStatusEmoji(status) {
  const emojis = {
    PASSED: '✅',
    FAILED: '❌',
    ERROR: '🔥',
    INCOMPLETE: '⚠️',
    NOT_RUN: '⏭️',
  };
  return emojis[status] || '❓';
}

function getPackageVersion() {
  try {
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    return 'unknown';
  }
}

if (require.main === module) {
  generateFinalReport();
}

module.exports = { generateFinalReport };
