#!/usr/bin/env node

/**
 * Performance Analysis Script
 *
 * Analyzes performance test results and detects regressions
 */

const fs = require('fs');
const path = require('path');

const PERFORMANCE_THRESHOLDS = {
  debugTools: {
    maxExecutionTime: 30000, // 30 seconds
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  },
  devUtilities: {
    maxExecutionTime: 15000, // 15 seconds
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
  },
  devOnboarding: {
    maxExecutionTime: 60000, // 60 seconds
    maxMemoryUsage: 75 * 1024 * 1024, // 75MB
  },
};

function analyzePerformance() {
  const resultsDir = path.join(__dirname, '../__tests__/performance-results');

  if (!fs.existsSync(resultsDir)) {
    console.error('❌ Performance results directory not found');
    process.exit(1);
  }

  console.log('🚀 Performance Analysis:');
  console.log('═'.repeat(60));

  const results = [];
  let hasRegressions = false;

  // Read all performance result files
  const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(resultsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const toolName = path.basename(file, '.json');
    const thresholds =
      PERFORMANCE_THRESHOLDS[toolName] || PERFORMANCE_THRESHOLDS.debugTools;

    console.log(`\n📊 ${toolName}:`);
    console.log('-'.repeat(40));

    const analysis = analyzeToolPerformance(data, thresholds);
    results.push({
      tool: toolName,
      ...analysis,
    });

    if (analysis.hasRegressions) {
      hasRegressions = true;
    }

    displayToolAnalysis(analysis);
  }

  // Generate performance trends
  generatePerformanceTrends(results);

  // Generate performance report
  generatePerformanceReport(results);

  console.log('\n═'.repeat(60));

  if (hasRegressions) {
    console.log('❌ Performance regressions detected!');
    console.log('\nRecommendations:');
    console.log('1. Profile the affected tools to identify bottlenecks');
    console.log('2. Check for memory leaks or inefficient algorithms');
    console.log('3. Consider optimizing database queries or external calls');
    console.log('4. Review recent changes that might impact performance');
    process.exit(1);
  } else {
    console.log('✅ No performance regressions detected');
  }

  return results;
}

function analyzeToolPerformance(data, thresholds) {
  const analysis = {
    executionTime: data.executionTime || 0,
    memoryUsage: data.memoryUsage || 0,
    cpuUsage: data.cpuUsage || 0,
    hasRegressions: false,
    issues: [],
    recommendations: [],
  };

  // Check execution time
  if (analysis.executionTime > thresholds.maxExecutionTime) {
    analysis.hasRegressions = true;
    analysis.issues.push(
      `Execution time exceeded threshold: ${analysis.executionTime}ms > ${thresholds.maxExecutionTime}ms`
    );
    analysis.recommendations.push(
      'Optimize slow operations and consider parallel processing'
    );
  }

  // Check memory usage
  if (analysis.memoryUsage > thresholds.maxMemoryUsage) {
    analysis.hasRegressions = true;
    analysis.issues.push(
      `Memory usage exceeded threshold: ${formatBytes(analysis.memoryUsage)} > ${formatBytes(thresholds.maxMemoryUsage)}`
    );
    analysis.recommendations.push(
      'Check for memory leaks and optimize data structures'
    );
  }

  // Check for performance trends
  if (data.trend) {
    if (data.trend.executionTime > 1.2) {
      // 20% increase
      analysis.issues.push(`Execution time trend shows 20%+ increase`);
      analysis.recommendations.push(
        'Investigate recent changes that might impact performance'
      );
    }

    if (data.trend.memoryUsage > 1.15) {
      // 15% increase
      analysis.issues.push(`Memory usage trend shows 15%+ increase`);
      analysis.recommendations.push('Review memory allocation patterns');
    }
  }

  return analysis;
}

function displayToolAnalysis(analysis) {
  console.log(`⏱️  Execution Time: ${analysis.executionTime}ms`);
  console.log(`💾 Memory Usage: ${formatBytes(analysis.memoryUsage)}`);
  console.log(`🖥️  CPU Usage: ${analysis.cpuUsage.toFixed(1)}%`);

  if (analysis.issues.length > 0) {
    console.log(`❌ Issues:`);
    analysis.issues.forEach(issue => console.log(`   • ${issue}`));
  }

  if (analysis.recommendations.length > 0) {
    console.log(`💡 Recommendations:`);
    analysis.recommendations.forEach(rec => console.log(`   • ${rec}`));
  }

  if (analysis.issues.length === 0) {
    console.log('✅ Performance within acceptable limits');
  }
}

function generatePerformanceTrends(results) {
  const trendsPath = path.join(
    __dirname,
    '../__tests__/performance-results/trends.json'
  );

  let trends = {};
  if (fs.existsSync(trendsPath)) {
    trends = JSON.parse(fs.readFileSync(trendsPath, 'utf8'));
  }

  const timestamp = new Date().toISOString();

  for (const result of results) {
    if (!trends[result.tool]) {
      trends[result.tool] = [];
    }

    trends[result.tool].push({
      timestamp,
      executionTime: result.executionTime,
      memoryUsage: result.memoryUsage,
      cpuUsage: result.cpuUsage,
    });

    // Keep only last 50 entries
    if (trends[result.tool].length > 50) {
      trends[result.tool] = trends[result.tool].slice(-50);
    }
  }

  fs.writeFileSync(trendsPath, JSON.stringify(trends, null, 2));
}

function generatePerformanceReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTools: results.length,
      toolsWithRegressions: results.filter(r => r.hasRegressions).length,
      overallStatus: results.some(r => r.hasRegressions) ? 'FAILED' : 'PASSED',
    },
    results,
    thresholds: PERFORMANCE_THRESHOLDS,
  };

  const reportPath = path.join(
    __dirname,
    '../__tests__/performance-results/report.json'
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Generate markdown report
  const markdownReport = generateMarkdownReport(report);
  const markdownPath = path.join(
    __dirname,
    '../__tests__/performance-results/report.md'
  );
  fs.writeFileSync(markdownPath, markdownReport);
}

function generateMarkdownReport(report) {
  let markdown = `# Performance Analysis Report\n\n`;
  markdown += `**Generated:** ${report.timestamp}\n`;
  markdown += `**Status:** ${report.summary.overallStatus === 'PASSED' ? '✅ PASSED' : '❌ FAILED'}\n\n`;

  markdown += `## Summary\n\n`;
  markdown += `- **Total Tools Tested:** ${report.summary.totalTools}\n`;
  markdown += `- **Tools with Regressions:** ${report.summary.toolsWithRegressions}\n\n`;

  markdown += `## Results\n\n`;

  for (const result of report.results) {
    const status = result.hasRegressions ? '❌' : '✅';
    markdown += `### ${status} ${result.tool}\n\n`;
    markdown += `- **Execution Time:** ${result.executionTime}ms\n`;
    markdown += `- **Memory Usage:** ${formatBytes(result.memoryUsage)}\n`;
    markdown += `- **CPU Usage:** ${result.cpuUsage.toFixed(1)}%\n`;

    if (result.issues.length > 0) {
      markdown += `\n**Issues:**\n`;
      result.issues.forEach(issue => (markdown += `- ${issue}\n`));
    }

    if (result.recommendations.length > 0) {
      markdown += `\n**Recommendations:**\n`;
      result.recommendations.forEach(rec => (markdown += `- ${rec}\n`));
    }

    markdown += `\n`;
  }

  return markdown;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

if (require.main === module) {
  analyzePerformance();
}

module.exports = { analyzePerformance, PERFORMANCE_THRESHOLDS };
