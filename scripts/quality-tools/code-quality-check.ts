#!/usr/bin/env node

/**
 * Comprehensive Code Quality Checker
 * Runs linting, formatting, type checking, and security audits
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '../shared/Logger';

interface QualityCheckOptions {
  fix?: boolean;
  verbose?: boolean;
  skipTests?: boolean;
  skipSecurity?: boolean;
}

interface ESLintResult {
  filePath: string;
  messages: Array<{
    line: number;
    column: number;
    severity: number;
    message: string;
    ruleId: string;
  }>;
  errorCount: number;
  warningCount: number;
}

interface CheckResult {
  passed: boolean;
  errors?: number;
  warnings?: number;
  total?: number;
  failed?: number;
  vulnerabilities?: number;
}

interface QualityResults {
  eslint: CheckResult;
  prettier: CheckResult;
  typescript: CheckResult;
  tests: CheckResult;
  security: CheckResult;
}

export class CodeQualityChecker {
  private options: Required<QualityCheckOptions>;
  private results: QualityResults;

  constructor(options: QualityCheckOptions = {}) {
    this.options = {
      fix: options.fix || false,
      verbose: options.verbose || false,
      skipTests: options.skipTests || false,
      skipSecurity: options.skipSecurity || false,
    };

    this.results = {
      eslint: { passed: false, errors: 0, warnings: 0 },
      prettier: { passed: false, errors: 0 },
      typescript: { passed: false, errors: 0 },
      tests: { passed: false, total: 0, failed: 0 },
      security: { passed: false, vulnerabilities: 0 },
    };
  }

  public async run(): Promise<void> {
    log.info('Starting comprehensive code quality check...');

    try {
      await this.checkESLint();
      await this.checkPrettier();
      await this.checkTypeScript();

      if (!this.options.skipTests) {
        await this.runTests();
      }

      if (!this.options.skipSecurity) {
        await this.checkSecurity();
      }

      this.generateReport();

      const allPassed = Object.values(this.results).every(
        result => result.passed
      );

      if (allPassed) {
        log.success('All quality checks passed! ✨');
        process.exit(0);
      } else {
        log.error('Some quality checks failed. See report above.');
        process.exit(1);
      }
    } catch (error) {
      log.error(
        `Quality check failed: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  }

  private async checkESLint(): Promise<void> {
    log.info('Running ESLint...');

    try {
      const fixFlag = this.options.fix ? '--fix' : '';
      const command = `npx eslint . --ext .ts,.tsx,.js,.jsx ${fixFlag} --format json`;

      const output = execSync(command, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const results: ESLintResult[] = JSON.parse(output);
      const totalErrors = results.reduce(
        (sum, file) => sum + file.errorCount,
        0
      );
      const totalWarnings = results.reduce(
        (sum, file) => sum + file.warningCount,
        0
      );

      this.results.eslint = {
        passed: totalErrors === 0,
        errors: totalErrors,
        warnings: totalWarnings,
      };

      if (totalErrors === 0) {
        log.success(`ESLint passed (${totalWarnings} warnings)`);
      } else {
        log.error(
          `ESLint failed with ${totalErrors} errors and ${totalWarnings} warnings`
        );

        if (this.options.verbose) {
          results.forEach(file => {
            if (file.messages.length > 0) {
              log.info(`\n${file.filePath}:`);
              file.messages.forEach(msg => {
                const level = msg.severity === 2 ? 'ERROR' : 'WARNING';

                log.info(
                  `  ${msg.line}:${msg.column} ${level} ${msg.message} (${msg.ruleId})`
                );
              });
            }
          });
        }
      }
    } catch (error: unknown) {
      // ESLint returns non-zero exit code when there are errors
      if (error && typeof error === 'object' && 'stdout' in error) {
        const results: ESLintResult[] = JSON.parse(
          (error as { stdout: string }).stdout
        );
        const totalErrors = results.reduce(
          (sum, file) => sum + file.errorCount,
          0
        );
        const totalWarnings = results.reduce(
          (sum, file) => sum + file.warningCount,
          0
        );

        this.results.eslint = {
          passed: false,
          errors: totalErrors,
          warnings: totalWarnings,
        };

        log.error(
          `ESLint failed with ${totalErrors} errors and ${totalWarnings} warnings`
        );
      } else {
        throw error;
      }
    }
  }

  private async checkPrettier(): Promise<void> {
    log.info('Checking Prettier formatting...');

    try {
      const checkCommand =
        'npx prettier --check "**/*.{ts,tsx,js,jsx,json,md}"';

      execSync(checkCommand, {
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe',
      });

      this.results.prettier = { passed: true, errors: 0 };
      log.success('Prettier formatting check passed');
    } catch (error) {
      this.results.prettier = { passed: false, errors: 1 };

      if (this.options.fix) {
        log.info('Fixing Prettier formatting issues...');
        try {
          const fixCommand =
            'npx prettier --write "**/*.{ts,tsx,js,jsx,json,md}"';

          execSync(fixCommand, { encoding: 'utf8' });

          this.results.prettier = { passed: true, errors: 0 };
          log.success('Prettier formatting issues fixed');
        } catch (fixError) {
          log.error('Failed to fix Prettier formatting issues');
        }
      } else {
        log.error(
          'Prettier formatting check failed. Run with --fix to auto-fix.'
        );
      }
    }
  }

  private async checkTypeScript(): Promise<void> {
    log.info('Running TypeScript type checking...');

    try {
      // Check root TypeScript project
      execSync('npx tsc --noEmit', {
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe',
      });

      // Check service TypeScript projects
      const servicesDirs = fs
        .readdirSync('services', { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => path.join('services', dirent.name));

      for (const serviceDir of servicesDirs) {
        const tsconfigPath = path.join(serviceDir, 'tsconfig.json');

        if (fs.existsSync(tsconfigPath)) {
          execSync(`npx tsc --noEmit --project ${tsconfigPath}`, {
            encoding: 'utf8',
            stdio: this.options.verbose ? 'inherit' : 'pipe',
          });
        }
      }

      // Check frontend TypeScript
      const frontendTsConfig = 'frontend/tsconfig.json';

      if (fs.existsSync(frontendTsConfig)) {
        execSync(`npx tsc --noEmit --project ${frontendTsConfig}`, {
          encoding: 'utf8',
          stdio: this.options.verbose ? 'inherit' : 'pipe',
        });
      }

      this.results.typescript = { passed: true, errors: 0 };
      log.success('TypeScript type checking passed');
    } catch (error) {
      this.results.typescript = { passed: false, errors: 1 };
      log.error('TypeScript type checking failed');

      if (
        this.options.verbose &&
        error &&
        typeof error === 'object' &&
        'stdout' in error
      ) {
        log.info(
          (error as { stdout?: string; message?: string }).stdout ||
            (error as { stdout?: string; message?: string }).message ||
            'Unknown error'
        );
      }
    }
  }

  private async runTests(): Promise<void> {
    log.info('Running tests...');

    try {
      const output = execSync('npm test -- --silent --passWithNoTests', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Parse Jest output to get test results
      const lines = output.split('\n');
      const summaryLine = lines.find(line => line.includes('Tests:'));

      if (summaryLine) {
        const passedMatch = summaryLine.match(/(\d+) passed/);
        const failedMatch = summaryLine.match(/(\d+) failed/);

        const passed = passedMatch ? parseInt(passedMatch[1] || '0', 10) : 0;
        const failed = failedMatch ? parseInt(failedMatch[1] || '0', 10) : 0;

        this.results.tests = {
          passed: failed === 0,
          total: passed + failed,
          failed,
        };

        if (failed === 0) {
          log.success(`All tests passed (${passed} tests)`);
        } else {
          log.error(`${failed} tests failed out of ${passed + failed} total`);
        }
      } else {
        this.results.tests = { passed: true, total: 0, failed: 0 };
        log.success('No tests found or all tests passed');
      }
    } catch (error) {
      this.results.tests = { passed: false, total: 0, failed: 1 };
      log.error('Test execution failed');

      if (
        this.options.verbose &&
        error &&
        typeof error === 'object' &&
        'stdout' in error
      ) {
        log.info(
          (error as { stdout?: string; message?: string }).stdout ||
            (error as { stdout?: string; message?: string }).message ||
            'Unknown error'
        );
      }
    }
  }

  private async checkSecurity(): Promise<void> {
    log.info('Running security audit...');

    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const auditResults = JSON.parse(auditOutput);
      const vulnerabilities = auditResults.metadata?.vulnerabilities || {};
      const totalVulns = Object.values(vulnerabilities).reduce(
        (sum: number, count: unknown) => sum + (count as number),
        0
      );

      this.results.security = {
        passed: totalVulns === 0,
        vulnerabilities: totalVulns,
      };

      if (totalVulns === 0) {
        log.success('No security vulnerabilities found');
      } else {
        log.error(`Found ${totalVulns} security vulnerabilities`);

        if (this.options.verbose) {
          log.info('Vulnerability breakdown:');
          Object.entries(vulnerabilities).forEach(([severity, count]) => {
            if ((count as number) > 0) {
              log.info(`  ${severity}: ${count}`);
            }
          });
        }
      }
    } catch (error: unknown) {
      // npm audit returns non-zero exit code when vulnerabilities are found
      if (error && typeof error === 'object' && 'stdout' in error) {
        try {
          const auditResults = JSON.parse((error as { stdout: string }).stdout);
          const vulnerabilities = auditResults.metadata?.vulnerabilities || {};
          const totalVulns = Object.values(vulnerabilities).reduce(
            (sum: number, count: unknown) => sum + (count as number),
            0
          );

          this.results.security = {
            passed: false,
            vulnerabilities: totalVulns,
          };

          log.error(`Found ${totalVulns} security vulnerabilities`);
        } catch (parseError) {
          this.results.security = { passed: false, vulnerabilities: 1 };
          log.error('Security audit failed');
        }
      } else {
        this.results.security = { passed: false, vulnerabilities: 1 };
        log.error('Security audit failed');
      }
    }
  }

  private generateReport(): void {
    const separator = '='.repeat(60);

    log.info(`\n${separator}`);
    log.info('CODE QUALITY REPORT');
    log.info(separator);

    const checks = [
      {
        name: 'ESLint',
        result: this.results.eslint,
        details: `${this.results.eslint.errors} errors, ${this.results.eslint.warnings} warnings`,
      },
      {
        name: 'Prettier',
        result: this.results.prettier,
        details: this.results.prettier.passed
          ? 'All files formatted correctly'
          : 'Formatting issues found',
      },
      {
        name: 'TypeScript',
        result: this.results.typescript,
        details: this.results.typescript.passed
          ? 'No type errors'
          : 'Type errors found',
      },
      {
        name: 'Tests',
        result: this.results.tests,
        details: `${this.results.tests.total} tests, ${this.results.tests.failed} failed`,
      },
      {
        name: 'Security',
        result: this.results.security,
        details: `${this.results.security.vulnerabilities} vulnerabilities`,
      },
    ];

    checks.forEach(check => {
      const status = check.result.passed ? '✅ PASS' : '❌ FAIL';

      log.info(`${status} ${check.name.padEnd(12)} ${check.details}`);
    });

    log.info(separator);

    const totalChecks = checks.length;
    const passedChecks = checks.filter(check => check.result.passed).length;

    log.info(`Overall: ${passedChecks}/${totalChecks} checks passed`);

    if (passedChecks === totalChecks) {
      log.success('🎉 All quality checks passed!');
    } else {
      log.error(`⚠️  ${totalChecks - passedChecks} quality checks failed`);
    }
  }
}

// CLI interface
function showHelp(): void {
  log.info(`
Code Quality Checker

Run comprehensive code quality checks including linting, formatting, type checking, and security audits.

Usage:
  node code-quality-check.js [options]

Options:
  --fix           Automatically fix issues where possible
  --verbose       Show detailed output
  --skip-tests    Skip running tests
  --skip-security Skip security audit
  --help, -h      Show this help message

Examples:
  node code-quality-check.js
  node code-quality-check.js --fix --verbose
  node code-quality-check.js --skip-tests --skip-security
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();

    return;
  }

  const options: QualityCheckOptions = {
    fix: args.includes('--fix'),
    verbose: args.includes('--verbose'),
    skipTests: args.includes('--skip-tests'),
    skipSecurity: args.includes('--skip-security'),
  };

  const checker = new CodeQualityChecker(options);

  await checker.run();
}

if (require.main === module) {
  main().catch(error => {
    log.error(
      `Quality check failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
