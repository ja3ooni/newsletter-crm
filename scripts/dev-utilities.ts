#!/usr/bin/env node

/**
 * Development Utilities
 * Collection of helpful development tools and shortcuts
 */

import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as readline from 'readline';
import { log } from './shared/Logger';
import { PlatformService } from './shared/PlatformService';

interface DevUtilityOptions {
  verbose?: boolean;
}

interface QualityCheckResult {
  name: string;
  passed: boolean;
}

interface TestType {
  name: string;
  command: string;
}

class DevUtilities {
  private options: {
    verbose: boolean;
  };
  private platformService: PlatformService;

  constructor(options: DevUtilityOptions = {}) {
    this.options = {
      verbose: options.verbose || false,
    };
    this.platformService = new PlatformService();
  }

  // Environment management
  async generateSecrets(): Promise<void> {
    log.info('Generating secure secrets for development...');

    const secrets = {
      JWT_SECRET: crypto.randomBytes(64).toString('hex'),
      JWT_REFRESH_SECRET: crypto.randomBytes(64).toString('hex'),
      ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
      SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
      API_KEY: crypto.randomBytes(32).toString('hex'),
      WEBHOOK_SECRET: crypto.randomBytes(32).toString('hex'),
    };

    log.info('\nGenerated secrets:');
    log.info('='.repeat(50));

    Object.entries(secrets).forEach(([key, value]) => {
      log.info(`${key}=${value}`);
    });

    log.info('='.repeat(50));
    log.info('\n💡 Copy these to your .env file');

    // Optionally update .env file
    if (fs.existsSync('.env')) {
      const updateEnv = await this.question(
        'Update .env file with these secrets? (y/N) '
      );

      if (updateEnv.toLowerCase() === 'y') {
        let envContent = fs.readFileSync('.env', 'utf8');

        Object.entries(secrets).forEach(([key, value]) => {
          const regex = new RegExp(`^${key}=.*$`, 'm');

          if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
          } else {
            envContent += `\n${key}=${value}`;
          }
        });

        fs.writeFileSync('.env', envContent);
        log.success('.env file updated with new secrets');
      }
    }
  }

  async validateEnvironment(): Promise<void> {
    log.info('Validating environment configuration...');

    const requiredVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
    ];

    const optionalVars = [
      'SMTP_HOST',
      'SMTP_PORT',
      'AWS_ACCESS_KEY_ID',
      'STRIPE_SECRET_KEY',
      'OPENAI_API_KEY',
    ];

    const issues: string[] = [];

    log.info('\n📋 Environment Variables Check:');
    log.info('='.repeat(50));

    // Check required variables
    log.info(`\nRequired Variables:`);
    requiredVars.forEach(varName => {
      const value = process.env[varName];

      if (value) {
        const displayValue =
          varName.includes('SECRET') ||
          varName.includes('KEY') ||
          varName.includes('URL')
            ? '[REDACTED]'
            : value;

        log.info(`✅ ${varName}: ${displayValue}`);
      } else {
        log.info(`❌ ${varName}: Not set`);
        issues.push(`Missing required variable: ${varName}`);
      }
    });

    // Check optional variables
    log.info(`\nOptional Variables:`);
    optionalVars.forEach(varName => {
      const value = process.env[varName];

      if (value) {
        const displayValue =
          varName.includes('SECRET') || varName.includes('KEY')
            ? '[REDACTED]'
            : value;

        log.info(`✅ ${varName}: ${displayValue}`);
      } else {
        log.info(`⚪ ${varName}: Not set (optional)`);
      }
    });

    // Validate specific configurations
    log.info(`\nConfiguration Validation:`);

    // Check JWT secret strength
    const jwtSecret = process.env.JWT_SECRET;

    if (jwtSecret) {
      if (jwtSecret.length < 32) {
        log.warning(
          '⚠️  JWT_SECRET is too short (should be at least 32 characters)'
        );
        issues.push('JWT_SECRET is too short');
      } else {
        log.info('✅ JWT_SECRET length is adequate');
      }
    }

    // Check database URL format
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl && !dbUrl.startsWith('postgresql://')) {
      log.warning('⚠️  DATABASE_URL should start with postgresql://');
      issues.push('Invalid DATABASE_URL format');
    } else if (dbUrl) {
      log.info('✅ DATABASE_URL format is valid');
    }

    // Check Redis URL format
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl && !redisUrl.startsWith('redis://')) {
      log.warning('⚠️  REDIS_URL should start with redis://');
      issues.push('Invalid REDIS_URL format');
    } else if (redisUrl) {
      log.info('✅ REDIS_URL format is valid');
    }

    log.info('='.repeat(50));

    if (issues.length === 0) {
      log.success('Environment configuration is valid!');
    } else {
      log.warning(`Found ${issues.length} configuration issues:`);
      issues.forEach(issue => log.info(`  • ${issue}`));
    }
  }

  // Database utilities
  async databaseUtils(action: string): Promise<void> {
    switch (action) {
      case 'backup':
        await this.backupDatabase();
        break;
      case 'restore':
        await this.restoreDatabase();
        break;
      case 'reset':
        await this.resetDatabase();
        break;
      case 'seed':
        await this.seedDatabase();
        break;
      case 'migrate':
        await this.migrateDatabase();
        break;
      default:
        log.error(`Unknown database action: ${action}`);
    }
  }

  async backupDatabase(): Promise<void> {
    log.info('Creating database backup...');

    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
      log.error('DATABASE_URL not configured');

      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `backup-${timestamp}.sql`;

    try {
      // Check if pg_dump is available
      const pgDumpInfo = await this.platformService.findExecutable('pg_dump');

      if (!pgDumpInfo || !pgDumpInfo.available) {
        log.error('pg_dump not found. Please install PostgreSQL client tools.');

        return;
      }

      const command = this.platformService.getDatabaseCommands().postgres;
      const result = await this.platformService.executeCommand({
        ...command,
        fallback: `pg_dump "${dbUrl}" > ${backupFile}`,
      });

      if (result.success) {
        log.success(`Database backup created: ${backupFile}`);
      } else {
        log.error(`Backup failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: unknown) {
      log.error(
        `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async restoreDatabase(): Promise<void> {
    log.info('Database restore functionality not implemented yet');
    // TODO: Implement database restore functionality
  }

  async resetDatabase(): Promise<void> {
    log.warning('This will delete all data in the database!');
    const confirm = await this.question(
      'Are you sure? Type "yes" to confirm: '
    );

    if (confirm !== 'yes') {
      log.info('Database reset cancelled');

      return;
    }

    try {
      if (fs.existsSync('package.json')) {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

        if (packageJson.scripts && packageJson.scripts['db:reset']) {
          execSync('npm run db:reset', { stdio: 'inherit' });
        } else {
          // Manual reset
          const dbUrl = process.env.DATABASE_URL;

          if (dbUrl) {
            execSync(
              `psql "${dbUrl}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`,
              { stdio: 'inherit' }
            );

            if (packageJson.scripts && packageJson.scripts['db:migrate']) {
              execSync('npm run db:migrate', { stdio: 'inherit' });
            }
          }
        }
      }

      log.success('Database reset completed');
    } catch (error: unknown) {
      log.error(
        `Database reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async seedDatabase(): Promise<void> {
    log.info('Seeding database with sample data...');

    try {
      if (fs.existsSync('package.json')) {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

        if (packageJson.scripts && packageJson.scripts['db:seed']) {
          execSync('npm run db:seed', { stdio: 'inherit' });
          log.success('Database seeded successfully');
        } else {
          log.warning('No db:seed script found in package.json');
        }
      }
    } catch (error: unknown) {
      log.error(
        `Database seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async migrateDatabase(): Promise<void> {
    log.info('Running database migrations...');

    try {
      if (fs.existsSync('package.json')) {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

        if (packageJson.scripts && packageJson.scripts['db:migrate']) {
          execSync('npm run db:migrate', { stdio: 'inherit' });
          log.success('Database migrations completed');
        } else {
          log.warning('No db:migrate script found in package.json');
        }
      }
    } catch (error: unknown) {
      log.error(
        `Database migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Service management
  async serviceManager(action: string, serviceName?: string): Promise<void> {
    switch (action) {
      case 'start':
        await this.startServices(serviceName);
        break;
      case 'stop':
        await this.stopServices(serviceName);
        break;
      case 'restart':
        await this.restartServices(serviceName);
        break;
      case 'logs':
        await this.showServiceLogs(serviceName);
        break;
      case 'status':
        await this.showServiceStatus();
        break;
      default:
        log.error(`Unknown service action: ${action}`);
    }
  }

  async startServices(serviceName?: string): Promise<void> {
    // Check if docker-compose is available
    const dockerComposeInfo =
      await this.platformService.findExecutable('docker-compose');

    if (!dockerComposeInfo || !dockerComposeInfo.available) {
      log.error('docker-compose not found. Please install Docker Compose.');

      return;
    }

    if (serviceName) {
      log.info(`Starting ${serviceName} service...`);
      try {
        execSync(`docker-compose up -d ${serviceName}`, { stdio: 'inherit' });
        log.success(`${serviceName} service started`);
      } catch (error: unknown) {
        log.error(
          `Failed to start ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      log.info('Starting all services...');
      try {
        execSync('docker-compose up -d', { stdio: 'inherit' });
        log.success('All services started');
      } catch (error: unknown) {
        log.error(
          `Failed to start services: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  async stopServices(serviceName?: string): Promise<void> {
    if (serviceName) {
      log.info(`Stopping ${serviceName} service...`);
      try {
        execSync(`docker-compose stop ${serviceName}`, { stdio: 'inherit' });
        log.success(`${serviceName} service stopped`);
      } catch (error: unknown) {
        log.error(
          `Failed to stop ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      log.info('Stopping all services...');
      try {
        execSync('docker-compose down', { stdio: 'inherit' });
        log.success('All services stopped');
      } catch (error: unknown) {
        log.error(
          `Failed to stop services: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  async restartServices(serviceName?: string): Promise<void> {
    if (serviceName) {
      log.info(`Restarting ${serviceName} service...`);
      try {
        execSync(`docker-compose restart ${serviceName}`, { stdio: 'inherit' });
        log.success(`${serviceName} service restarted`);
      } catch (error: unknown) {
        log.error(
          `Failed to restart ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      log.info('Restarting all services...');
      try {
        execSync('docker-compose restart', { stdio: 'inherit' });
        log.success('All services restarted');
      } catch (error: unknown) {
        log.error(
          `Failed to restart services: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  async showServiceLogs(serviceName?: string): Promise<void> {
    if (serviceName) {
      log.info(`Showing logs for ${serviceName}...`);
      try {
        execSync(`docker-compose logs -f --tail=100 ${serviceName}`, {
          stdio: 'inherit',
        });
      } catch (error: unknown) {
        log.error(
          `Failed to show logs for ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      log.info('Showing logs for all services...');
      try {
        execSync('docker-compose logs -f --tail=100', { stdio: 'inherit' });
      } catch (error: unknown) {
        log.error(
          `Failed to show logs: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  async showServiceStatus(): Promise<void> {
    log.info('Checking service status...');

    try {
      execSync('docker-compose ps', { stdio: 'inherit' });
    } catch (error: unknown) {
      log.error(
        `Failed to check service status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Code quality tools
  async runQualityChecks(fix = false): Promise<void> {
    log.info('Running code quality checks...');

    const checks = [
      {
        name: 'ESLint',
        command: `npx eslint . --ext .ts,.tsx,.js,.jsx ${fix ? '--fix' : ''}`,
      },
      {
        name: 'Prettier',
        command: fix
          ? 'npx prettier --write "**/*.{ts,tsx,js,jsx,json,md}"'
          : 'npx prettier --check "**/*.{ts,tsx,js,jsx,json,md}"',
      },
      { name: 'TypeScript', command: 'npx tsc --noEmit' },
    ];

    const results: QualityCheckResult[] = [];

    for (const check of checks) {
      try {
        log.info(`\n🔍 Running ${check.name}...`);
        execSync(check.command, { stdio: 'inherit' });
        log.info(`✅ ${check.name} passed`);
        results.push({ name: check.name, passed: true });
      } catch (error) {
        log.info(`❌ ${check.name} failed`);
        results.push({ name: check.name, passed: false });
      }
    }

    log.info('\n📊 Quality Check Results:');
    log.info('='.repeat(30));
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';

      log.info(`${status} ${result.name}`);
    });

    const passedCount = results.filter(r => r.passed).length;

    log.info(`\nPassed: ${passedCount}/${results.length}`);
  }

  // Development server management
  async devServer(action: string): Promise<void> {
    switch (action) {
      case 'start':
        await this.startDevServer();
        break;
      case 'build':
        await this.buildProject();
        break;
      case 'test':
        await this.runTests();
        break;
      default:
        log.error(`Unknown dev server action: ${action}`);
    }
  }

  async startDevServer(): Promise<void> {
    log.info('Starting development servers...');

    log.info('Available development commands:');
    log.info('  • npm run dev - Start all services');
    log.info('  • npm run dev:frontend - Start frontend only');
    log.info('  • npm run dev:services - Start backend services only');

    const choice = await this.question(
      'Which would you like to start? (all/frontend/services) '
    );

    try {
      switch (choice.toLowerCase()) {
        case 'frontend':
          execSync('npm run dev:frontend', { stdio: 'inherit' });
          break;
        case 'services':
          execSync('npm run dev:services', { stdio: 'inherit' });
          break;
        default:
          execSync('npm run dev', { stdio: 'inherit' });
      }
    } catch (error: unknown) {
      log.error(
        `Failed to start development server: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async buildProject(): Promise<void> {
    log.info('Building project...');

    try {
      execSync('npm run build', { stdio: 'inherit' });
      log.success('Project built successfully');
    } catch (error: unknown) {
      log.error(
        `Build failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async runTests(): Promise<void> {
    log.info('Running tests...');

    const testTypes: TestType[] = [
      { name: 'Unit Tests', command: 'npm run test:unit' },
      { name: 'Integration Tests', command: 'npm run test:integration' },
      { name: 'E2E Tests', command: 'npm run test:e2e' },
    ];

    log.info('Available test types:');
    testTypes.forEach((test, index) => {
      log.info(`  ${index + 1}. ${test.name}`);
    });
    log.info('  4. All Tests');

    const choice = await this.question(
      'Which tests would you like to run? (1-4) '
    );

    try {
      switch (choice) {
        case '1':
          if (testTypes[0]) {
            execSync(testTypes[0].command, { stdio: 'inherit' });
          }
          break;
        case '2':
          if (testTypes[1]) {
            execSync(testTypes[1].command, { stdio: 'inherit' });
          }
          break;
        case '3':
          if (testTypes[2]) {
            execSync(testTypes[2].command, { stdio: 'inherit' });
          }
          break;
        case '4':
          execSync('npm test', { stdio: 'inherit' });
          break;
        default:
          execSync('npm test', { stdio: 'inherit' });
      }
    } catch (error: unknown) {
      log.error(
        `Tests failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Utility methods
  async question(prompt: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise(resolve => {
      rl.question(prompt, answer => {
        rl.close();
        resolve(answer);
      });
    });
  }
}

// CLI interface
function showHelp(): void {
  const helpText = `
Development Utilities

Collection of helpful development tools and shortcuts.

Usage:
  node dev-utilities.js <command> [options]

Commands:
  secrets              Generate secure secrets for development
  validate-env         Validate environment configuration
  db <action>          Database utilities (backup/restore/reset/seed/migrate)
  service <action>     Service management (start/stop/restart/logs/status)
  quality [--fix]      Run code quality checks
  dev <action>         Development server management (start/build/test)

Examples:
  node dev-utilities.js secrets
  node dev-utilities.js validate-env
  node dev-utilities.js db reset
  node dev-utilities.js service start postgres
  node dev-utilities.js quality --fix
  node dev-utilities.js dev start
`;

  log.info(helpText);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();

    return;
  }

  const command = args[0];
  const subCommand = args[1];
  const options = {
    verbose: args.includes('--verbose'),
    fix: args.includes('--fix'),
  };

  const utils = new DevUtilities(options);

  try {
    switch (command) {
      case 'secrets':
        await utils.generateSecrets();
        break;
      case 'validate-env':
        await utils.validateEnvironment();
        break;
      case 'db':
        if (!subCommand) {
          log.error(
            'Database action required: backup/restore/reset/seed/migrate'
          );

          return;
        }
        await utils.databaseUtils(subCommand);
        break;
      case 'service':
        if (!subCommand) {
          log.error('Service action required: start/stop/restart/logs/status');

          return;
        }
        await utils.serviceManager(subCommand, args[2]);
        break;
      case 'quality':
        await utils.runQualityChecks(options.fix);
        break;
      case 'dev':
        if (!subCommand) {
          log.error('Dev action required: start/build/test');

          return;
        }
        await utils.devServer(subCommand);
        break;
      default:
        log.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error: unknown) {
    log.error(
      `Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    if (options.verbose && error instanceof Error) {
      log.error(error.stack || 'No stack trace available');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    log.error('Development utilities failed:', error);
    process.exit(1);
  });
}

export { DevUtilities };
