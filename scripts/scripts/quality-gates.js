#!/usr/bin/env node

/**
 * Quality Gates Checker
 *
 * Validates that all quality metrics meet minimum requirements
 */

const fs = require('fs');
const path = require('path');

const QUALITY_GATES = {
  coverage: {
    statements: 70,
    branches: 65,
    functions: 70,
    lines: 70,
  },
  performance: {
    maxExecutionTime: 30000, // 30 seconds
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  },
  security: {
    maxHighSeverity: 0,
    maxMediumSeverity: 5,
    maxTotalVulnerabilities: 10,
  },
  codeQuality: {
    maxESLintErrors: 0,
    maxESLintWarnings: 10,
    maxTypeScriptErrors: 0,
  },
};

function checkQualityGates() {
  console.log('🚪 Quality Gates Check:');
  console.log('═'.repeat(60));

  const results = {
    timestamp: new Date().toISOString(),
    gates: {},
    overallStatus: 'PASSED',
    summary: {
      totalGates: 0,
      passedGates: 0,
      failedGates: 0,
    },
  };

  // Check coverage gate
  results.gates.coverage = checkCoverageGate();

  // Check performance gate
  results.gates.performance = checkPerformanceGate();

  // Check security gate
  results.gates.security = checkSecurityGate();

  // Check code quality gate
  results.gates.codeQuality = checkCodeQualityGate();

  // Calculate summary
  for (const [gateName, gateResult] of Object.entries(results.gates)) {
    results.summary.totalGates++;
    if (gateResult.status === 'PASSED') {
      results.summary.passedGates++;
    } else {
      results.summary.failedGates++;
      results.overallStatus = 'FAILED';
    }
  }

  // Display results
  displayQualityGatesResults(results);

  // Generate quality report
  generateQualityReport(results);

  if (results.overallStatus === 'FAILED') {
    console.log('\n❌ Quality gates check FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ Quality gates check PASSED');
  }

  return results;
}

function checkCoverageGate() {
  console.log('\n📊 Coverage Gate:');
  console.log('-'.repeat(40));

  const gate = {
    name: 'Coverage',
    status: 'PASSED',
    metrics: {},
    issues: [],
  };

  try {
    const coveragePath = path.join(
      __dirname,
      '../coverage/coverage-summary.json'
    );

    if (!fs.existsSync(coveragePath)) {
      gate.status = 'FAILED';
      gate.issues.push('Coverage summary not found');
      console.log('❌ Coverage summary not found');
      return gate;
    }

    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    const total = coverage.total;

    for (const [metric, threshold] of Object.entries(QUALITY_GATES.coverage)) {
      const actual = total[metric].pct;
      gate.metrics[metric] = {
        actual,
        threshold,
        status: actual >= threshold ? 'PASSED' : 'FAILED',
      };

      const status = actual >= threshold ? '✅' : '❌';
      console.log(
        `${status} ${metric.padEnd(12)}: ${actual.toFixed(1)}% (≥${threshold}%)`
      );

      if (actual < threshold) {
        gate.status = 'FAILED';
        gate.issues.push(
          `${metric} coverage below threshold: ${actual.toFixed(1)}% < ${threshold}%`
        );
      }
    }
  } catch (error) {
    gate.status = 'FAILED';
    gate.issues.push(`Coverage check failed: ${error.message}`);
    console.log(`❌ Coverage check failed: ${error.message}`);
  }

  return gate;
}

function checkPerformanceGate() {
  console.log('\n🚀 Performance Gate:');
  console.log('-'.repeat(40));

  const gate = {
    name: 'Performance',
    status: 'PASSED',
    metrics: {},
    issues: [],
  };

  try {
    const reportPath = path.join(
      __dirname,
      '../__tests__/performance-results/report.json'
    );

    if (!fs.existsSync(reportPath)) {
      gate.status = 'FAILED';
      gate.issues.push('Performance report not found');
      console.log('❌ Performance report not found');
      return gate;
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    if (report.summary.overallStatus === 'FAILED') {
      gate.status = 'FAILED';
      gate.issues.push('Performance regressions detected');
      console.log('❌ Performance regressions detected');
    } else {
      console.log('✅ No performance regressions');
    }

    gate.metrics.toolsWithRegressions = {
      actual: report.summary.toolsWithRegressions,
      threshold: 0,
      status: report.summary.toolsWithRegressions === 0 ? 'PASSED' : 'FAILED',
    };
  } catch (error) {
    gate.status = 'FAILED';
    gate.issues.push(`Performance check failed: ${error.message}`);
    console.log(`❌ Performance check failed: ${error.message}`);
  }

  return gate;
}

function checkSecurityGate() {
  console.log('\n🔒 Security Gate:');
  console.log('-'.repeat(40));

  const gate = {
    name: 'Security',
    status: 'PASSED',
    metrics: {},
    issues: [],
  };

  try {
    const reportPath = path.join(__dirname, '../security-report.json');

    if (!fs.existsSync(reportPath)) {
      gate.status = 'FAILED';
      gate.issues.push('Security report not found');
      console.log('❌ Security report not found');
      return gate;
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const summary = report.summary;

    // Check high severity vulnerabilities
    gate.metrics.highSeverity = {
      actual: summary.highSeverity,
      threshold: QUALITY_GATES.security.maxHighSeverity,
      status:
        summary.highSeverity <= QUALITY_GATES.security.maxHighSeverity
          ? 'PASSED'
          : 'FAILED',
    };

    // Check medium severity vulnerabilities
    gate.metrics.mediumSeverity = {
      actual: summary.mediumSeverity,
      threshold: QUALITY_GATES.security.maxMediumSeverity,
      status:
        summary.mediumSeverity <= QUALITY_GATES.security.maxMediumSeverity
          ? 'PASSED'
          : 'FAILED',
    };

    // Check total vulnerabilities
    gate.metrics.totalVulnerabilities = {
      actual: summary.vulnerabilities,
      threshold: QUALITY_GATES.security.maxTotalVulnerabilities,
      status:
        summary.vulnerabilities <=
        QUALITY_GATES.security.maxTotalVulnerabilities
          ? 'PASSED'
          : 'FAILED',
    };

    for (const [metric, data] of Object.entries(gate.metrics)) {
      const status = data.status === 'PASSED' ? '✅' : '❌';
      console.log(
        `${status} ${metric.padEnd(20)}: ${data.actual} (≤${data.threshold})`
      );

      if (data.status === 'FAILED') {
        gate.status = 'FAILED';
        gate.issues.push(
          `${metric} exceeds threshold: ${data.actual} > ${data.threshold}`
        );
      }
    }
  } catch (error) {
    gate.status = 'FAILED';
    gate.issues.push(`Security check failed: ${error.message}`);
    console.log(`❌ Security check failed: ${error.message}`);
  }

  return gate;
}

function checkCodeQualityGate() {
  console.log('\n📝 Code Quality Gate:');
  console.log('-'.repeat(40));

  const gate = {
    name: 'Code Quality',
    status: 'PASSED',
    metrics: {},
    issues: [],
  };

  try {
    // Check ESLint results (if available)
    const eslintPath = path.join(__dirname, '../eslint-results.json');
    if (fs.existsSync(eslintPath)) {
      const eslintResults = JSON.parse(fs.readFileSync(eslintPath, 'utf8'));

      let totalErrors = 0;
      let totalWarnings = 0;

      for (const result of eslintResults) {
        totalErrors += result.errorCount;
        totalWarnings += result.warningCount;
      }

      gate.metrics.eslintErrors = {
        actual: totalErrors,
        threshold: QUALITY_GATES.codeQuality.maxESLintErrors,
        status:
          totalErrors <= QUALITY_GATES.codeQuality.maxESLintErrors
            ? 'PASSED'
            : 'FAILED',
      };

      gate.metrics.eslintWarnings = {
        actual: totalWarnings,
        threshold: QUALITY_GATES.codeQuality.maxESLintWarnings,
        status:
          totalWarnings <= QUALITY_GATES.codeQuality.maxESLintWarnings
            ? 'PASSED'
            : 'FAILED',
      };

      const errorStatus = totalErrors === 0 ? '✅' : '❌';
      const warningStatus =
        totalWarnings <= QUALITY_GATES.codeQuality.maxESLintWarnings
          ? '✅'
          : '❌';

      console.log(
        `${errorStatus} ESLint Errors: ${totalErrors} (≤${QUALITY_GATES.codeQuality.maxESLintErrors})`
      );
      console.log(
        `${warningStatus} ESLint Warnings: ${totalWarnings} (≤${QUALITY_GATES.codeQuality.maxESLintWarnings})`
      );

      if (totalErrors > QUALITY_GATES.codeQuality.maxESLintErrors) {
        gate.status = 'FAILED';
        gate.issues.push(
          `ESLint errors exceed threshold: ${totalErrors} > ${QUALITY_GATES.codeQuality.maxESLintErrors}`
        );
      }

      if (totalWarnings > QUALITY_GATES.codeQuality.maxESLintWarnings) {
        gate.status = 'FAILED';
        gate.issues.push(
          `ESLint warnings exceed threshold: ${totalWarnings} > ${QUALITY_GATES.codeQuality.maxESLintWarnings}`
        );
      }
    } else {
      console.log('ℹ️  ESLint results not found, assuming passed');
    }

    // Check TypeScript compilation
    try {
      const { execSync } = require('child_process');
      execSync('npm run type-check', {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
      });

      gate.metrics.typeScriptErrors = {
        actual: 0,
        threshold: 0,
        status: 'PASSED',
      };

      console.log('✅ TypeScript compilation: 0 errors');
    } catch (error) {
      gate.status = 'FAILED';
      gate.issues.push('TypeScript compilation errors detected');
      console.log('❌ TypeScript compilation errors detected');

      gate.metrics.typeScriptErrors = {
        actual: 1, // We don't have exact count, but there are errors
        threshold: 0,
        status: 'FAILED',
      };
    }
  } catch (error) {
    gate.status = 'FAILED';
    gate.issues.push(`Code quality check failed: ${error.message}`);
    console.log(`❌ Code quality check failed: ${error.message}`);
  }

  return gate;
}

function displayQualityGatesResults(results) {
  console.log('\n═'.repeat(60));
  console.log('📋 Quality Gates Summary:');
  console.log('═'.repeat(60));

  for (const [gateName, gateResult] of Object.entries(results.gates)) {
    const status = gateResult.status === 'PASSED' ? '✅' : '❌';
    console.log(`${status} ${gateName.padEnd(15)}: ${gateResult.status}`);

    if (gateResult.issues.length > 0) {
      gateResult.issues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
    }
  }

  console.log('═'.repeat(60));
  console.log(`Total Gates: ${results.summary.totalGates}`);
  console.log(`Passed: ${results.summary.passedGates}`);
  console.log(`Failed: ${results.summary.failedGates}`);
  console.log(
    `Overall Status: ${results.overallStatus === 'PASSED' ? '✅' : '❌'} ${results.overallStatus}`
  );
}

function generateQualityReport(results) {
  // Save detailed report
  const reportPath = path.join(__dirname, '../quality-report');
  if (!fs.existsSync(reportPath)) {
    fs.mkdirSync(reportPath, { recursive: true });
  }

  // JSON report
  fs.writeFileSync(
    path.join(reportPath, 'quality-gates.json'),
    JSON.stringify(results, null, 2)
  );

  // Markdown summary
  const summary = generateMarkdownSummary(results);
  fs.writeFileSync(path.join(reportPath, 'summary.md'), summary);

  // Badge data
  const badgeData = {
    schemaVersion: 1,
    label: 'quality gates',
    message: `${results.summary.passedGates}/${results.summary.totalGates} passed`,
    color: results.overallStatus === 'PASSED' ? 'brightgreen' : 'red',
  };

  fs.writeFileSync(
    path.join(reportPath, 'badge.json'),
    JSON.stringify(badgeData, null, 2)
  );
}

function generateMarkdownSummary(results) {
  let markdown = `# Quality Gates Report\n\n`;
  markdown += `**Generated:** ${results.timestamp}\n`;
  markdown += `**Overall Status:** ${results.overallStatus === 'PASSED' ? '✅ PASSED' : '❌ FAILED'}\n\n`;

  markdown += `## Summary\n\n`;
  markdown += `- **Total Gates:** ${results.summary.totalGates}\n`;
  markdown += `- **Passed:** ${results.summary.passedGates}\n`;
  markdown += `- **Failed:** ${results.summary.failedGates}\n\n`;

  markdown += `## Gate Results\n\n`;

  for (const [gateName, gateResult] of Object.entries(results.gates)) {
    const status = gateResult.status === 'PASSED' ? '✅' : '❌';
    markdown += `### ${status} ${gateName}\n\n`;

    if (gateResult.metrics && Object.keys(gateResult.metrics).length > 0) {
      markdown += `**Metrics:**\n`;
      for (const [metric, data] of Object.entries(gateResult.metrics)) {
        const metricStatus = data.status === 'PASSED' ? '✅' : '❌';
        markdown += `- ${metricStatus} ${metric}: ${data.actual} (threshold: ${data.threshold})\n`;
      }
      markdown += `\n`;
    }

    if (gateResult.issues.length > 0) {
      markdown += `**Issues:**\n`;
      gateResult.issues.forEach(issue => (markdown += `- ${issue}\n`));
      markdown += `\n`;
    }
  }

  return markdown;
}

if (require.main === module) {
  checkQualityGates();
}

module.exports = { checkQualityGates, QUALITY_GATES };
