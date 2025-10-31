#!/usr/bin/env node

/**
 * Coverage Threshold Checker
 *
 * Validates that test coverage meets minimum requirements
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_THRESHOLD = {
  statements: 70,
  branches: 65,
  functions: 70,
  lines: 70,
};

function checkCoverageThreshold() {
  const coveragePath = path.join(
    __dirname,
    '../coverage/coverage-summary.json'
  );

  if (!fs.existsSync(coveragePath)) {
    console.error(
      '❌ Coverage summary not found. Run tests with coverage first.'
    );
    process.exit(1);
  }

  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const total = coverage.total;

  console.log('📊 Coverage Analysis:');
  console.log('═'.repeat(50));

  let failed = false;
  const results = [];

  for (const [metric, threshold] of Object.entries(COVERAGE_THRESHOLD)) {
    const actual = total[metric].pct;
    const status = actual >= threshold ? '✅' : '❌';

    if (actual < threshold) {
      failed = true;
    }

    const result = {
      metric,
      actual,
      threshold,
      status: actual >= threshold ? 'PASS' : 'FAIL',
    };

    results.push(result);
    console.log(
      `${status} ${metric.padEnd(12)}: ${actual.toFixed(1)}% (threshold: ${threshold}%)`
    );
  }

  console.log('═'.repeat(50));

  if (failed) {
    console.log('❌ Coverage threshold check FAILED');
    console.log('\nTo improve coverage:');
    console.log('1. Add more unit tests for uncovered code');
    console.log('2. Remove unused code');
    console.log('3. Add integration tests for complex scenarios');
    process.exit(1);
  } else {
    console.log('✅ Coverage threshold check PASSED');
  }

  // Generate coverage badge data
  const badgeData = {
    schemaVersion: 1,
    label: 'coverage',
    message: `${total.statements.pct.toFixed(1)}%`,
    color:
      total.statements.pct >= 80
        ? 'brightgreen'
        : total.statements.pct >= 70
          ? 'yellow'
          : 'red',
  };

  fs.writeFileSync(
    path.join(__dirname, '../coverage/badge.json'),
    JSON.stringify(badgeData, null, 2)
  );

  return results;
}

if (require.main === module) {
  checkCoverageThreshold();
}

module.exports = { checkCoverageThreshold, COVERAGE_THRESHOLD };
