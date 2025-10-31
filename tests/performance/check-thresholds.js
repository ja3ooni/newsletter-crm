#!/usr/bin/env node

/**
 * Performance Threshold Checker
 *
 * Validates performance test results against defined thresholds
 * and fails the build if performance degrades beyond acceptable limits.
 */

import fs from 'fs';
import path from 'path';

// Performance thresholds
const THRESHOLDS = {
  responseTime: {
    p95: 2000, // 95th percentile under 2 seconds
    p99: 5000, // 99th percentile under 5 seconds
    avg: 1000, // Average under 1 second
  },
  errorRate: {
    max: 0.05, // Maximum 5% error rate
  },
  throughput: {
    min: 50, // Minimum 50 requests per second
  },
  availability: {
    min: 0.99, // Minimum 99% availability
  },
};

function main() {
  const resultsDir = process.env.OUTPUT_DIR || './performance-results';

  if (!fs.existsSync(resultsDir)) {
    console.error('❌ Performance results directory not found');
    process.exit(1);
  }

  const resultFiles = fs
    .readdirSync(resultsDir)
    .filter(file => file.endsWith('-results.json'))
    .map(file => path.join(resultsDir, file));

  if (resultFiles.length === 0) {
    console.error('❌ No performance result files found');
    process.exit(1);
  }

  let overallPass = true;
  const violations = [];

  resultFiles.forEach(file => {
    console.log(`\n📊 Checking thresholds for: ${path.basename(file)}`);

    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const testViolations = checkThresholds(data, path.basename(file));

      if (testViolations.length > 0) {
        overallPass = false;
        violations.push(...testViolations);
      }
    } catch (error) {
      console.error(`❌ Failed to process ${file}: ${error.message}`);
      overallPass = false;
    }
  });

  // Generate threshold report
  generateThresholdReport(violations, overallPass);

  if (!overallPass) {
    console.error('\n❌ Performance thresholds violated!');
    console.error('Build failed due to performance degradation.');
    process.exit(1);
  } else {
    console.log('\n✅ All performance thresholds passed!');
    process.exit(0);
  }
}

function checkThresholds(data, testName) {
  const violations = [];
  const metrics = data.metrics;

  if (!metrics) {
    violations.push({
      test: testName,
      metric: 'general',
      issue: 'No metrics found in test results',
      severity: 'high',
    });

    return violations;
  }

  // Check response time thresholds
  if (metrics.http_req_duration) {
    const duration = metrics.http_req_duration.values;

    if (duration.avg > THRESHOLDS.responseTime.avg) {
      violations.push({
        test: testName,
        metric: 'response_time_avg',
        value: duration.avg.toFixed(2),
        threshold: THRESHOLDS.responseTime.avg,
        issue: `Average response time (${duration.avg.toFixed(2)}ms) exceeds threshold (${THRESHOLDS.responseTime.avg}ms)`,
        severity: 'medium',
      });
    }

    if (duration['p(95)'] > THRESHOLDS.responseTime.p95) {
      violations.push({
        test: testName,
        metric: 'response_time_p95',
        value: duration['p(95)'].toFixed(2),
        threshold: THRESHOLDS.responseTime.p95,
        issue: `95th percentile response time (${duration['p(95)'].toFixed(2)}ms) exceeds threshold (${THRESHOLDS.responseTime.p95}ms)`,
        severity: 'high',
      });
    }

    if (duration['p(99)'] > THRESHOLDS.responseTime.p99) {
      violations.push({
        test: testName,
        metric: 'response_time_p99',
        value: duration['p(99)'].toFixed(2),
        threshold: THRESHOLDS.responseTime.p99,
        issue: `99th percentile response time (${duration['p(99)'].toFixed(2)}ms) exceeds threshold (${THRESHOLDS.responseTime.p99}ms)`,
        severity: 'medium',
      });
    }
  }

  // Check error rate thresholds
  if (metrics.http_req_failed) {
    const errorRate = metrics.http_req_failed.values.rate;

    if (errorRate > THRESHOLDS.errorRate.max) {
      violations.push({
        test: testName,
        metric: 'error_rate',
        value: (errorRate * 100).toFixed(2),
        threshold: (THRESHOLDS.errorRate.max * 100).toFixed(2),
        issue: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${(THRESHOLDS.errorRate.max * 100).toFixed(2)}%)`,
        severity: 'high',
      });
    }
  }

  // Check throughput thresholds
  if (metrics.http_reqs && data.state?.testRunDurationMs) {
    const throughput =
      metrics.http_reqs.values.count / (data.state.testRunDurationMs / 1000);

    if (throughput < THRESHOLDS.throughput.min) {
      violations.push({
        test: testName,
        metric: 'throughput',
        value: throughput.toFixed(2),
        threshold: THRESHOLDS.throughput.min,
        issue: `Throughput (${throughput.toFixed(2)} req/s) below threshold (${THRESHOLDS.throughput.min} req/s)`,
        severity: 'medium',
      });
    }
  }

  // Check custom metrics if available
  if (metrics.system_health) {
    const availability = metrics.system_health.values.rate;

    if (availability < THRESHOLDS.availability.min) {
      violations.push({
        test: testName,
        metric: 'availability',
        value: (availability * 100).toFixed(2),
        threshold: (THRESHOLDS.availability.min * 100).toFixed(2),
        issue: `System availability (${(availability * 100).toFixed(2)}%) below threshold (${(THRESHOLDS.availability.min * 100).toFixed(2)}%)`,
        severity: 'high',
      });
    }
  }

  // Log results for this test
  if (violations.length === 0) {
    console.log(`  ✅ All thresholds passed`);
  } else {
    console.log(`  ❌ ${violations.length} threshold violation(s) found`);
    violations.forEach(v => {
      const severity = v.severity === 'high' ? '🔴' : '🟡';

      console.log(`    ${severity} ${v.issue}`);
    });
  }

  return violations;
}

function generateThresholdReport(violations, overallPass) {
  const report = {
    timestamp: new Date().toISOString(),
    overallPass,
    thresholds: THRESHOLDS,
    violations: violations.map(v => ({
      test: v.test,
      metric: v.metric,
      value: v.value,
      threshold: v.threshold,
      issue: v.issue,
      severity: v.severity,
    })),
    summary: {
      totalViolations: violations.length,
      highSeverity: violations.filter(v => v.severity === 'high').length,
      mediumSeverity: violations.filter(v => v.severity === 'medium').length,
    },
  };

  const reportPath = path.join(
    process.env.OUTPUT_DIR || './performance-results',
    'threshold-report.json'
  );

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n📋 Threshold report saved to: ${reportPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { THRESHOLDS, checkThresholds };
