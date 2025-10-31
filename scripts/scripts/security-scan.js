#!/usr/bin/env node

/**
 * Security Scanner for Developer Tools
 *
 * Performs security analysis and vulnerability detection
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SECURITY_RULES = {
  // Dangerous patterns to look for
  dangerousPatterns: [
    {
      pattern: /eval\s*\(/g,
      severity: 'HIGH',
      message: 'Use of eval() can lead to code injection vulnerabilities',
    },
    {
      pattern: /exec\s*\(/g,
      severity: 'MEDIUM',
      message:
        'Direct use of exec() should be carefully reviewed for command injection',
    },
    {
      pattern: /spawn\s*\(/g,
      severity: 'LOW',
      message:
        'Use of spawn() should validate inputs to prevent command injection',
    },
    {
      pattern: /process\.env\[\s*[^'"`\]]+\s*\]/g,
      severity: 'LOW',
      message: 'Dynamic environment variable access should be validated',
    },
    {
      pattern: /console\.log\s*\(/g,
      severity: 'LOW',
      message: 'Console.log statements should be replaced with proper logging',
    },
    {
      pattern: /password|secret|key|token/gi,
      severity: 'MEDIUM',
      message: 'Potential hardcoded secrets detected',
    },
  ],

  // File patterns to exclude from scanning
  excludePatterns: [
    /node_modules/,
    /\.git/,
    /coverage/,
    /dist/,
    /\.test\./,
    /\.spec\./,
  ],

  // Required security headers for any HTTP servers
  requiredHeaders: [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection',
    'Strict-Transport-Security',
  ],
};

function performSecurityScan() {
  console.log('🔒 Security Scan Starting...');
  console.log('═'.repeat(50));

  const results = {
    timestamp: new Date().toISOString(),
    summary: {
      filesScanned: 0,
      vulnerabilities: 0,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
    },
    findings: [],
    recommendations: [],
  };

  // Scan source files
  scanSourceFiles(results);

  // Check dependencies
  checkDependencies(results);

  // Validate configurations
  validateConfigurations(results);

  // Generate security report
  generateSecurityReport(results);

  // Display results
  displayResults(results);

  return results;
}

function scanSourceFiles(results) {
  console.log('📁 Scanning source files...');

  const sourceDir = path.join(__dirname, '..');
  const files = getAllFiles(sourceDir, ['.ts', '.js']);

  for (const file of files) {
    // Skip excluded patterns
    if (SECURITY_RULES.excludePatterns.some(pattern => pattern.test(file))) {
      continue;
    }

    results.summary.filesScanned++;
    scanFile(file, results);
  }
}

function scanFile(filePath, results) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);

    for (const rule of SECURITY_RULES.dangerousPatterns) {
      const matches = content.match(rule.pattern);
      if (matches) {
        for (const match of matches) {
          const lineNumber = getLineNumber(content, match);

          const finding = {
            file: relativePath,
            line: lineNumber,
            severity: rule.severity,
            message: rule.message,
            pattern: match.trim(),
            rule: rule.pattern.toString(),
          };

          results.findings.push(finding);
          results.summary.vulnerabilities++;

          switch (rule.severity) {
            case 'HIGH':
              results.summary.highSeverity++;
              break;
            case 'MEDIUM':
              results.summary.mediumSeverity++;
              break;
            case 'LOW':
              results.summary.lowSeverity++;
              break;
          }
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  Could not scan file ${filePath}: ${error.message}`);
  }
}

function checkDependencies(results) {
  console.log('📦 Checking dependencies...');

  try {
    const packagePath = path.join(__dirname, '../package.json');
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      // Check for known vulnerable packages
      const vulnerablePackages = [
        'lodash', // Example - check for specific versions
        'moment', // Deprecated
        'request', // Deprecated
      ];

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const [pkg, version] of Object.entries(allDeps)) {
        if (vulnerablePackages.includes(pkg)) {
          results.findings.push({
            file: 'package.json',
            line: 0,
            severity: 'MEDIUM',
            message: `Potentially vulnerable or deprecated package: ${pkg}`,
            pattern: `${pkg}@${version}`,
            rule: 'dependency-check',
          });
          results.summary.vulnerabilities++;
          results.summary.mediumSeverity++;
        }
      }
    }

    // Run npm audit if available
    try {
      const auditResult = execSync('npm audit --json', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const audit = JSON.parse(auditResult);
      if (audit.vulnerabilities) {
        for (const [pkg, vuln] of Object.entries(audit.vulnerabilities)) {
          results.findings.push({
            file: 'package.json',
            line: 0,
            severity: vuln.severity.toUpperCase(),
            message: `npm audit: ${vuln.title || 'Vulnerability detected'}`,
            pattern: pkg,
            rule: 'npm-audit',
          });
          results.summary.vulnerabilities++;

          switch (vuln.severity.toUpperCase()) {
            case 'HIGH':
            case 'CRITICAL':
              results.summary.highSeverity++;
              break;
            case 'MODERATE':
              results.summary.mediumSeverity++;
              break;
            case 'LOW':
              results.summary.lowSeverity++;
              break;
          }
        }
      }
    } catch (auditError) {
      // npm audit might fail if no vulnerabilities or npm not available
      console.log('ℹ️  npm audit completed (no output or npm not available)');
    }
  } catch (error) {
    console.warn(`⚠️  Could not check dependencies: ${error.message}`);
  }
}

function validateConfigurations(results) {
  console.log('⚙️  Validating configurations...');

  // Check for sensitive files that shouldn't be committed
  const sensitiveFiles = [
    '.env',
    '.env.local',
    '.env.production',
    'config/secrets.json',
    'private.key',
    'certificate.pem',
  ];

  for (const file of sensitiveFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      results.findings.push({
        file,
        line: 0,
        severity: 'HIGH',
        message: 'Sensitive file detected in repository',
        pattern: file,
        rule: 'sensitive-file-check',
      });
      results.summary.vulnerabilities++;
      results.summary.highSeverity++;
    }
  }

  // Check TypeScript configuration
  const tsconfigPath = path.join(__dirname, '../tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

    if (!tsconfig.compilerOptions?.strict) {
      results.findings.push({
        file: 'tsconfig.json',
        line: 0,
        severity: 'MEDIUM',
        message: 'TypeScript strict mode not enabled',
        pattern: 'strict: false',
        rule: 'typescript-config',
      });
      results.summary.vulnerabilities++;
      results.summary.mediumSeverity++;
    }
  }
}

function generateSecurityReport(results) {
  // Add recommendations based on findings
  if (results.summary.highSeverity > 0) {
    results.recommendations.push(
      'Address all HIGH severity vulnerabilities immediately'
    );
  }

  if (results.summary.mediumSeverity > 0) {
    results.recommendations.push('Review and fix MEDIUM severity issues');
  }

  if (results.findings.some(f => f.rule.includes('eval'))) {
    results.recommendations.push(
      'Replace eval() usage with safer alternatives'
    );
  }

  if (results.findings.some(f => f.message.includes('console.log'))) {
    results.recommendations.push('Replace console.log with structured logging');
  }

  results.recommendations.push(
    'Run security scans regularly in CI/CD pipeline'
  );
  results.recommendations.push(
    'Keep dependencies updated and monitor for vulnerabilities'
  );
  results.recommendations.push(
    'Use environment variables for sensitive configuration'
  );

  // Save detailed report
  const reportPath = path.join(__dirname, '../security-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  // Generate markdown report
  const markdownReport = generateMarkdownSecurityReport(results);
  const markdownPath = path.join(__dirname, '../security-report.md');
  fs.writeFileSync(markdownPath, markdownReport);
}

function generateMarkdownSecurityReport(results) {
  let markdown = `# Security Scan Report\n\n`;
  markdown += `**Generated:** ${results.timestamp}\n`;
  markdown += `**Status:** ${results.summary.vulnerabilities === 0 ? '✅ PASSED' : '❌ ISSUES FOUND'}\n\n`;

  markdown += `## Summary\n\n`;
  markdown += `- **Files Scanned:** ${results.summary.filesScanned}\n`;
  markdown += `- **Total Vulnerabilities:** ${results.summary.vulnerabilities}\n`;
  markdown += `- **High Severity:** ${results.summary.highSeverity}\n`;
  markdown += `- **Medium Severity:** ${results.summary.mediumSeverity}\n`;
  markdown += `- **Low Severity:** ${results.summary.lowSeverity}\n\n`;

  if (results.findings.length > 0) {
    markdown += `## Findings\n\n`;

    const groupedFindings = groupBy(results.findings, 'severity');

    for (const severity of ['HIGH', 'MEDIUM', 'LOW']) {
      const findings = groupedFindings[severity] || [];
      if (findings.length > 0) {
        markdown += `### ${severity} Severity (${findings.length})\n\n`;

        for (const finding of findings) {
          markdown += `- **${finding.file}:${finding.line}** - ${finding.message}\n`;
          markdown += `  \`${finding.pattern}\`\n\n`;
        }
      }
    }
  }

  if (results.recommendations.length > 0) {
    markdown += `## Recommendations\n\n`;
    results.recommendations.forEach(rec => (markdown += `- ${rec}\n`));
  }

  return markdown;
}

function displayResults(results) {
  console.log('\n📊 Security Scan Results:');
  console.log('═'.repeat(50));
  console.log(`Files Scanned: ${results.summary.filesScanned}`);
  console.log(`Total Vulnerabilities: ${results.summary.vulnerabilities}`);
  console.log(`High Severity: ${results.summary.highSeverity}`);
  console.log(`Medium Severity: ${results.summary.mediumSeverity}`);
  console.log(`Low Severity: ${results.summary.lowSeverity}`);

  if (results.findings.length > 0) {
    console.log('\n🔍 Top Issues:');
    const topIssues = results.findings
      .filter(f => f.severity === 'HIGH')
      .slice(0, 5);

    for (const issue of topIssues) {
      console.log(`❌ ${issue.file}:${issue.line} - ${issue.message}`);
    }
  }

  console.log('═'.repeat(50));

  if (results.summary.highSeverity > 0) {
    console.log('❌ Security scan FAILED - High severity issues found');
    process.exit(1);
  } else if (results.summary.vulnerabilities > 0) {
    console.log('⚠️  Security scan completed with warnings');
  } else {
    console.log('✅ Security scan PASSED - No issues found');
  }
}

// Helper functions
function getAllFiles(dir, extensions) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function getLineNumber(content, searchString) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchString)) {
      return i + 1;
    }
  }
  return 1;
}

function groupBy(array, key) {
  return array.reduce((groups, item) => {
    const group = item[key];
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
}

if (require.main === module) {
  performSecurityScan();
}

module.exports = { performSecurityScan, SECURITY_RULES };
