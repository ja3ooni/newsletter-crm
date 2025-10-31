#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive Security Scanner for CI/CD Pipeline
 * Implements automated security scanning as required by task 2.3
 */
class SecurityTestRunner {
  constructor() {
    this.results = {
      dependencyVulnerabilities: [],
      codeSecurityIssues: [],
      cryptoIssues: [],
      configurationIssues: [],
      penetrationTestResults: null,
      overallScore: 0,
      passed: false,
    };

    this.config = {
      failOnCritical: true,
      failOnHigh: process.env.NODE_ENV === 'production',
      maxVulnerabilities: {
        critical: 0,
        high: process.env.NODE_ENV === 'production' ? 0 : 5,
        medium: 20,
        low: 50,
      },
    };
  }

  /**
   * Run comprehensive security scan
   */
  async runSecurityScan() {
    console.log('🔒 Starting comprehensive security scan...\n');

    try {
      // 1. Dependency vulnerability scanning
      await this.scanDependencies();

      // 2. Static code analysis for security issues
      await this.scanCodeSecurity();

      // 3. Crypto implementation analysis
      await this.scanCryptoSecurity();

      // 4. Configuration security check
      await this.scanConfiguration();

      // 5. Run penetration tests
      await this.runPenetrationTests();

      // 6. Generate final report
      this.generateSecurityReport();

      // 7. Determine pass/fail status
      this.evaluateResults();
    } catch (error) {
      console.error('❌ Security scan failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Scan dependencies for known vulnerabilities
   */
  async scanDependencies() {
    console.log('📦 Scanning dependencies for vulnerabilities...');

    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const auditData = JSON.parse(auditResult);

      if (auditData.vulnerabilities) {
        for (const [packageName, vulnData] of Object.entries(
          auditData.vulnerabilities
        )) {
          this.results.dependencyVulnerabilities.push({
            package: packageName,
            severity: vulnData.severity,
            title:
              vulnData.via?.[0]?.title || `Vulnerability in ${packageName}`,
            fixAvailable: vulnData.fixAvailable,
          });
        }
      }

      console.log(
        `   Found ${this.results.dependencyVulnerabilities.length} dependency vulnerabilities`
      );
    } catch (error) {
      if (error.status === 1) {
        // npm audit returns exit code 1 when vulnerabilities are found
        try {
          const auditData = JSON.parse(error.stdout);

          if (auditData.vulnerabilities) {
            for (const [packageName, vulnData] of Object.entries(
              auditData.vulnerabilities
            )) {
              this.results.dependencyVulnerabilities.push({
                package: packageName,
                severity: vulnData.severity,
                title:
                  vulnData.via?.[0]?.title || `Vulnerability in ${packageName}`,
                fixAvailable: vulnData.fixAvailable,
              });
            }
          }
        } catch (parseError) {
          console.warn('   ⚠️  Could not parse npm audit results');
        }
      } else {
        console.warn('   ⚠️  npm audit failed:', error.message);
      }
    }

    // Try Trivy scan if available
    try {
      console.log('   Running Trivy vulnerability scan...');
      const trivyResult = execSync('trivy fs --format json --quiet .', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const trivyData = JSON.parse(trivyResult);

      if (trivyData.Results) {
        for (const result of trivyData.Results) {
          if (result.Vulnerabilities) {
            for (const vuln of result.Vulnerabilities) {
              this.results.dependencyVulnerabilities.push({
                package: vuln.PkgName || result.Target,
                severity: vuln.Severity?.toLowerCase() || 'unknown',
                title: `${vuln.VulnerabilityID}: ${vuln.Title}`,
                description: vuln.Description,
                fixAvailable: vuln.FixedVersion
                  ? `Update to ${vuln.FixedVersion}`
                  : false,
              });
            }
          }
        }
      }

      console.log('   ✅ Trivy scan completed');
    } catch (error) {
      console.log(
        '   ⚠️  Trivy not available, skipping container vulnerability scan'
      );
    }
  }

  /**
   * Scan code for security issues using ESLint security plugin
   */
  async scanCodeSecurity() {
    console.log('🔍 Scanning code for security issues...');

    try {
      // Run ESLint with security plugin
      const eslintResult = execSync(
        'npx eslint . --ext .ts,.js --format json --config .eslintrc.security.js',
        {
          encoding: 'utf8',
          stdio: 'pipe',
        }
      );

      const eslintData = JSON.parse(eslintResult);

      for (const file of eslintData) {
        for (const message of file.messages) {
          if (message.ruleId && message.ruleId.includes('security')) {
            this.results.codeSecurityIssues.push({
              file: file.filePath,
              line: message.line,
              rule: message.ruleId,
              message: message.message,
              severity: message.severity === 2 ? 'high' : 'medium',
            });
          }
        }
      }

      console.log(
        `   Found ${this.results.codeSecurityIssues.length} code security issues`
      );
    } catch (error) {
      if (error.status === 1) {
        // ESLint returns exit code 1 when issues are found
        try {
          const eslintData = JSON.parse(error.stdout);

          for (const file of eslintData) {
            for (const message of file.messages) {
              if (
                message.ruleId &&
                (message.ruleId.includes('security') ||
                  message.ruleId.includes('no-eval') ||
                  message.ruleId.includes('no-implied-eval'))
              ) {
                this.results.codeSecurityIssues.push({
                  file: file.filePath,
                  line: message.line,
                  rule: message.ruleId,
                  message: message.message,
                  severity: message.severity === 2 ? 'high' : 'medium',
                });
              }
            }
          }
        } catch (parseError) {
          console.warn('   ⚠️  Could not parse ESLint security results');
        }
      } else {
        console.warn('   ⚠️  ESLint security scan failed:', error.message);
      }
    }

    // Run custom security pattern detection
    this.scanSecurityPatterns();
  }

  /**
   * Scan for security patterns in code
   */
  scanSecurityPatterns() {
    console.log('   Running custom security pattern detection...');

    const securityPatterns = [
      {
        pattern: /(password|secret|key|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
        severity: 'critical',
        message: 'Hardcoded secret detected',
      },
      {
        pattern: /console\.(log|debug|info|warn|error)/gi,
        severity: 'medium',
        message: 'Console logging in production code',
      },
      {
        pattern: /eval\s*\(/gi,
        severity: 'critical',
        message: 'Use of eval() function',
      },
      {
        pattern: /\b(md5|sha1|rc4)\b/gi,
        severity: 'high',
        message: 'Weak cryptographic algorithm',
      },
      {
        pattern: /Math\.random\(\)/gi,
        severity: 'medium',
        message: 'Weak random number generation for security purposes',
      },
    ];

    this.scanDirectory('.', securityPatterns);
  }

  /**
   * Recursively scan directory for security patterns
   */
  scanDirectory(dirPath, patterns) {
    const excludePaths = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.venv',
      'ailert/.venv',
      'ailert/node_modules',
      'MCP-Smartload',
      'migration-env',
    ];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (excludePaths.some(excluded => fullPath.includes(excluded))) {
          continue;
        }

        if (entry.isDirectory()) {
          this.scanDirectory(fullPath, patterns);
        } else if (entry.isFile() && this.shouldScanFile(entry.name)) {
          this.scanFileForPatterns(fullPath, patterns);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  /**
   * Scan individual file for security patterns
   */
  scanFileForPatterns(filePath, patterns) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      for (const pattern of patterns) {
        const matches = content.matchAll(pattern.pattern);

        for (const match of matches) {
          const lineNumber = this.getLineNumber(content, match.index || 0);

          this.results.codeSecurityIssues.push({
            file: filePath,
            line: lineNumber,
            rule: 'custom-security-pattern',
            message: pattern.message,
            severity: pattern.severity,
            match: match[0].substring(0, 100), // First 100 chars of match
          });
        }
      }
    } catch (error) {
      // Skip files we can't read
    }
  }

  /**
   * Check if file should be scanned
   */
  shouldScanFile(filename) {
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.yml', '.yaml'];
    const excludeFiles = [
      'package-lock.json',
      'yarn.lock',
      'tsconfig.json',
      'jest.config.js',
      '.eslintrc.js',
      '.eslintrc.security.js',
    ];

    if (excludeFiles.includes(filename)) {
      return false;
    }

    return extensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Get line number from content index
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Scan crypto implementation for security issues
   */
  async scanCryptoSecurity() {
    console.log('🔐 Scanning crypto implementations...');

    const cryptoPatterns = [
      {
        pattern: /crypto\.(createCipherGCM|createDecipherGCM)/gi,
        severity: 'critical',
        message:
          'Deprecated crypto method usage - use createCipheriv/createDecipheriv',
      },
      {
        pattern: /iv\s*[:=]\s*['"][0-9a-fA-F]{16,}['"]/gi,
        severity: 'high',
        message: 'Hardcoded initialization vector',
      },
      {
        pattern: /key\s*[:=]\s*['"][^'"]{16,}['"]/gi,
        severity: 'critical',
        message: 'Hardcoded encryption key',
      },
    ];

    this.scanDirectory(
      '.',
      cryptoPatterns.map(p => ({
        ...p,
        category: 'crypto',
      }))
    );

    // Test crypto implementations
    await this.testCryptoImplementations();

    console.log(
      `   Found ${this.results.cryptoIssues.length} crypto security issues`
    );
  }

  /**
   * Test crypto implementations for security
   */
  async testCryptoImplementations() {
    try {
      // Test if EncryptionService uses secure methods
      const {
        EncryptionService,
      } = require('../services/shared/security/EncryptionService');
      const encryptionService = new EncryptionService({ provider: 'local' });

      // Test encryption/decryption
      const testData = 'test-encryption-data';
      const encrypted = await encryptionService.encrypt(testData);

      if (encrypted.algorithm !== 'AES-256-GCM') {
        this.results.cryptoIssues.push({
          file: 'EncryptionService',
          severity: 'high',
          message: `Weak encryption algorithm: ${encrypted.algorithm}`,
        });
      }

      if (!encrypted.iv || !encrypted.authTag) {
        this.results.cryptoIssues.push({
          file: 'EncryptionService',
          severity: 'critical',
          message: 'Missing IV or authentication tag in encryption',
        });
      }
    } catch (error) {
      console.warn(
        '   ⚠️  Could not test crypto implementations:',
        error.message
      );
    }
  }

  /**
   * Scan configuration for security issues
   */
  async scanConfiguration() {
    console.log('⚙️  Scanning configuration for security issues...');

    // Check package.json for dangerous scripts
    this.checkPackageJsonSecurity();

    // Check environment files
    this.checkEnvironmentFiles();

    // Check Docker files
    this.checkDockerSecurity();

    console.log(
      `   Found ${this.results.configurationIssues.length} configuration issues`
    );
  }

  /**
   * Check package.json for security issues
   */
  checkPackageJsonSecurity() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

      if (packageJson.scripts) {
        for (const [scriptName, scriptCommand] of Object.entries(
          packageJson.scripts
        )) {
          if (
            scriptCommand.includes('rm -rf') ||
            scriptCommand.includes('del /f')
          ) {
            this.results.configurationIssues.push({
              file: 'package.json',
              severity: 'medium',
              message: `Dangerous script command in "${scriptName}": ${scriptCommand}`,
            });
          }

          if (scriptCommand.includes('curl') && scriptCommand.includes('sh')) {
            this.results.configurationIssues.push({
              file: 'package.json',
              severity: 'high',
              message: `Potentially dangerous curl|sh pattern in "${scriptName}"`,
            });
          }
        }
      }
    } catch (error) {
      // package.json not found or invalid
    }
  }

  /**
   * Check environment files for security issues
   */
  checkEnvironmentFiles() {
    const envFiles = [
      '.env',
      '.env.local',
      '.env.production',
      '.env.development',
    ];

    for (const envFile of envFiles) {
      if (fs.existsSync(envFile)) {
        try {
          const content = fs.readFileSync(envFile, 'utf8');

          if (
            content.includes('password=password') ||
            content.includes('secret=secret')
          ) {
            this.results.configurationIssues.push({
              file: envFile,
              severity: 'high',
              message: 'Weak default values in environment file',
            });
          }

          if (
            content.includes('localhost') &&
            process.env.NODE_ENV === 'production'
          ) {
            this.results.configurationIssues.push({
              file: envFile,
              severity: 'medium',
              message: 'Localhost configuration in production environment',
            });
          }

          // Check for exposed secrets
          const secretPatterns = /(sk-|pk-|key-)[a-zA-Z0-9]{20,}/g;
          const matches = content.match(secretPatterns);

          if (matches) {
            this.results.configurationIssues.push({
              file: envFile,
              severity: 'critical',
              message: `Potential API keys or secrets exposed in ${envFile}`,
            });
          }
        } catch (error) {
          // Could not read file
        }
      }
    }
  }

  /**
   * Check Docker configuration for security issues
   */
  checkDockerSecurity() {
    const dockerFiles = [
      'Dockerfile',
      'docker-compose.yml',
      'docker-compose.prod.yml',
    ];

    for (const dockerFile of dockerFiles) {
      if (fs.existsSync(dockerFile)) {
        try {
          const content = fs.readFileSync(dockerFile, 'utf8');

          if (
            content.includes('USER root') ||
            content.includes('--privileged')
          ) {
            this.results.configurationIssues.push({
              file: dockerFile,
              severity: 'high',
              message: 'Running as root or with privileged access in Docker',
            });
          }

          if (
            content.includes('ADD http://') ||
            content.includes('ADD https://')
          ) {
            this.results.configurationIssues.push({
              file: dockerFile,
              severity: 'medium',
              message: 'Using ADD with URLs can be a security risk',
            });
          }
        } catch (error) {
          // Could not read file
        }
      }
    }
  }

  /**
   * Run penetration tests
   */
  async runPenetrationTests() {
    console.log('🎯 Running penetration tests...');

    try {
      // Run the security penetration test suite
      const testResult = execSync(
        'npm test -- --testPathPattern=SecurityPenetrationTests --silent',
        {
          encoding: 'utf8',
          stdio: 'pipe',
        }
      );

      this.results.penetrationTestResults = {
        passed: true,
        output: testResult,
      };

      console.log('   ✅ Penetration tests passed');
    } catch (error) {
      this.results.penetrationTestResults = {
        passed: false,
        output: error.stdout || error.message,
        error: error.stderr || error.message,
      };

      console.log('   ❌ Penetration tests failed');
    }
  }

  /**
   * Generate comprehensive security report
   */
  generateSecurityReport() {
    console.log('\n📊 Security Scan Report');
    console.log('========================\n');

    // Dependency vulnerabilities
    const depVulns = this.results.dependencyVulnerabilities;
    const depCritical = depVulns.filter(v => v.severity === 'critical').length;
    const depHigh = depVulns.filter(v => v.severity === 'high').length;
    const depMedium = depVulns.filter(
      v => v.severity === 'moderate' || v.severity === 'medium'
    ).length;
    const depLow = depVulns.filter(v => v.severity === 'low').length;

    console.log(`📦 Dependency Vulnerabilities: ${depVulns.length} total`);
    console.log(
      `   Critical: ${depCritical}, High: ${depHigh}, Medium: ${depMedium}, Low: ${depLow}`
    );

    // Code security issues
    const codeIssues = this.results.codeSecurityIssues;
    const codeCritical = codeIssues.filter(
      i => i.severity === 'critical'
    ).length;
    const codeHigh = codeIssues.filter(i => i.severity === 'high').length;
    const codeMedium = codeIssues.filter(i => i.severity === 'medium').length;

    console.log(`\n🔍 Code Security Issues: ${codeIssues.length} total`);
    console.log(
      `   Critical: ${codeCritical}, High: ${codeHigh}, Medium: ${codeMedium}`
    );

    // Crypto issues
    console.log(
      `\n🔐 Crypto Security Issues: ${this.results.cryptoIssues.length} total`
    );

    // Configuration issues
    console.log(
      `\n⚙️  Configuration Issues: ${this.results.configurationIssues.length} total`
    );

    // Penetration test results
    const penTestStatus = this.results.penetrationTestResults?.passed
      ? '✅ PASSED'
      : '❌ FAILED';

    console.log(`\n🎯 Penetration Tests: ${penTestStatus}`);

    // Calculate overall security score
    this.calculateSecurityScore();
    console.log(
      `\n🏆 Overall Security Score: ${this.results.overallScore}/100`
    );

    // Generate detailed report file
    this.generateDetailedReport();
  }

  /**
   * Calculate overall security score
   */
  calculateSecurityScore() {
    let score = 100;

    // Deduct points for vulnerabilities
    const allIssues = [
      ...this.results.dependencyVulnerabilities,
      ...this.results.codeSecurityIssues,
      ...this.results.cryptoIssues,
      ...this.results.configurationIssues,
    ];

    const weights = { critical: 25, high: 10, medium: 5, low: 1 };

    for (const issue of allIssues) {
      const severity =
        issue.severity === 'moderate' ? 'medium' : issue.severity;

      score -= weights[severity] || 1;
    }

    // Deduct points for failed penetration tests
    if (!this.results.penetrationTestResults?.passed) {
      score -= 20;
    }

    this.results.overallScore = Math.max(0, score);
  }

  /**
   * Generate detailed report file
   */
  generateDetailedReport() {
    const reportDir = 'test-results/security';

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      overallScore: this.results.overallScore,
      passed: this.results.passed,
      summary: {
        dependencyVulnerabilities:
          this.results.dependencyVulnerabilities.length,
        codeSecurityIssues: this.results.codeSecurityIssues.length,
        cryptoIssues: this.results.cryptoIssues.length,
        configurationIssues: this.results.configurationIssues.length,
        penetrationTestsPassed:
          this.results.penetrationTestResults?.passed || false,
      },
      details: this.results,
    };

    fs.writeFileSync(
      path.join(reportDir, 'security-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Generate HTML report
    this.generateHtmlReport(report, reportDir);

    console.log(
      `\n📄 Detailed report saved to: ${reportDir}/security-report.json`
    );
    console.log(`📄 HTML report saved to: ${reportDir}/security-report.html`);
  }

  /**
   * Generate HTML report
   */
  generateHtmlReport(report, reportDir) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .score { font-size: 24px; font-weight: bold; }
        .passed { color: green; }
        .failed { color: red; }
        .section { margin: 20px 0; }
        .issue { background: #fff; border-left: 4px solid #ddd; padding: 10px; margin: 5px 0; }
        .critical { border-left-color: #d32f2f; }
        .high { border-left-color: #f57c00; }
        .medium { border-left-color: #fbc02d; }
        .low { border-left-color: #388e3c; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Scan Report</h1>
        <p>Generated: ${report.timestamp}</p>
        <div class="score ${report.passed ? 'passed' : 'failed'}">
            Security Score: ${report.overallScore}/100 (${report.passed ? 'PASSED' : 'FAILED'})
        </div>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <table>
            <tr><th>Category</th><th>Count</th></tr>
            <tr><td>Dependency Vulnerabilities</td><td>${report.summary.dependencyVulnerabilities}</td></tr>
            <tr><td>Code Security Issues</td><td>${report.summary.codeSecurityIssues}</td></tr>
            <tr><td>Crypto Issues</td><td>${report.summary.cryptoIssues}</td></tr>
            <tr><td>Configuration Issues</td><td>${report.summary.configurationIssues}</td></tr>
            <tr><td>Penetration Tests</td><td>${report.summary.penetrationTestsPassed ? 'PASSED' : 'FAILED'}</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>Dependency Vulnerabilities</h2>
        ${report.details.dependencyVulnerabilities
          .map(
            vuln => `
            <div class="issue ${vuln.severity}">
                <strong>${vuln.package}</strong> - ${vuln.title}<br>
                <small>Severity: ${vuln.severity} | Fix: ${vuln.fixAvailable || 'No fix available'}</small>
            </div>
        `
          )
          .join('')}
    </div>

    <div class="section">
        <h2>Code Security Issues</h2>
        ${report.details.codeSecurityIssues
          .map(
            issue => `
            <div class="issue ${issue.severity}">
                <strong>${issue.file}:${issue.line}</strong> - ${issue.message}<br>
                <small>Rule: ${issue.rule} | Severity: ${issue.severity}</small>
            </div>
        `
          )
          .join('')}
    </div>
</body>
</html>
    `;

    fs.writeFileSync(path.join(reportDir, 'security-report.html'), html);
  }

  /**
   * Evaluate results and determine pass/fail
   */
  evaluateResults() {
    const allIssues = [
      ...this.results.dependencyVulnerabilities,
      ...this.results.codeSecurityIssues,
      ...this.results.cryptoIssues,
      ...this.results.configurationIssues,
    ];

    const criticalCount = allIssues.filter(
      i => i.severity === 'critical'
    ).length;
    const highCount = allIssues.filter(i => i.severity === 'high').length;
    const mediumCount = allIssues.filter(
      i => i.severity === 'medium' || i.severity === 'moderate'
    ).length;
    const lowCount = allIssues.filter(i => i.severity === 'low').length;

    // Determine if scan passes based on thresholds
    let passed = true;
    const failureReasons = [];

    if (criticalCount > this.config.maxVulnerabilities.critical) {
      passed = false;
      failureReasons.push(
        `${criticalCount} critical vulnerabilities (max: ${this.config.maxVulnerabilities.critical})`
      );
    }

    if (highCount > this.config.maxVulnerabilities.high) {
      passed = false;
      failureReasons.push(
        `${highCount} high vulnerabilities (max: ${this.config.maxVulnerabilities.high})`
      );
    }

    if (mediumCount > this.config.maxVulnerabilities.medium) {
      passed = false;
      failureReasons.push(
        `${mediumCount} medium vulnerabilities (max: ${this.config.maxVulnerabilities.medium})`
      );
    }

    if (!this.results.penetrationTestResults?.passed) {
      passed = false;
      failureReasons.push('Penetration tests failed');
    }

    this.results.passed = passed;

    console.log(
      `\n🎯 Security Scan Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`
    );

    if (!passed) {
      console.log('\nFailure reasons:');
      failureReasons.forEach(reason => console.log(`   - ${reason}`));
      console.log('\n💡 Recommendations:');
      console.log('   - Fix critical and high severity vulnerabilities');
      console.log('   - Update dependencies with known vulnerabilities');
      console.log('   - Review and fix code security issues');
      console.log('   - Ensure all penetration tests pass');

      process.exit(1);
    } else {
      console.log('\n🎉 All security checks passed!');
    }
  }
}

// Run security scan if called directly
if (require.main === module) {
  const scanner = new SecurityTestRunner();

  scanner.runSecurityScan().catch(error => {
    console.error('Security scan failed:', error);
    process.exit(1);
  });
}

module.exports = { SecurityTestRunner };
