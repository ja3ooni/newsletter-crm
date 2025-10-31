#!/usr/bin/env node

/**
 * Developer Onboarding Tool
 * Interactive guide for new developers to set up their development environment
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { log } from './shared/Logger';
import { PlatformService } from './shared/PlatformService';

interface UserInfo {
  name: string;
  role: string;
  experience: string;
}

interface Prerequisite {
  name: string;
  command: string;
  minVersion: string;
}

interface PrerequisiteResult {
  name: string;
  installed: boolean;
  version?: string;
  valid: boolean;
  required: string;
}

interface Checklist {
  prerequisites: boolean;
  environment: boolean;
  dependencies: boolean;
  database: boolean;
  services: boolean;
  tests: boolean;
  documentation: boolean;
}

class DeveloperOnboarding {
  private rl: readline.Interface;
  private checklist: Checklist;
  private userInfo?: UserInfo;
  private platformService: PlatformService;

  constructor() {
    this.platformService = new PlatformService();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.checklist = {
      prerequisites: false,
      environment: false,
      dependencies: false,
      database: false,
      services: false,
      tests: false,
      documentation: false,
    };
  }

  async start(): Promise<void> {
    const welcomeMessage = `
╔══════════════════════════════════════════════════════════════╗
║                    DEVELOPER ONBOARDING                     ║
║                                                              ║
║  Welcome to the AiLert Platform Development Environment!     ║
║  This interactive guide will help you set up everything      ║
║  you need to start contributing to the project.             ║
╚══════════════════════════════════════════════════════════════╝
`;

    log.info(welcomeMessage);

    await this.askUserInfo();
    await this.checkPrerequisites();
    await this.setupEnvironment();
    await this.installDependencies();
    await this.setupDatabase();
    await this.startServices();
    await this.runTests();
    await this.showDocumentation();
    await this.completionSummary();

    this.rl.close();
  }

  async askUserInfo(): Promise<void> {
    log.info(`\nLet's get to know you better!`);

    const name = await this.question("What's your name? ");
    const role = await this.question(
      "What's your role? (Frontend/Backend/Full-stack/DevOps/Other) "
    );
    const experience = await this.question(
      'How familiar are you with Node.js/TypeScript? (Beginner/Intermediate/Advanced) '
    );

    log.info(`\nHi ${name}! Welcome to the team! 👋`);
    log.info(`Role: ${role}`);
    log.info(`Experience Level: ${experience}`);

    // Store user info for personalized experience
    this.userInfo = { name, role, experience };

    if (experience.toLowerCase() === 'beginner') {
      log.info(
        `\n💡 Since you're new to Node.js/TypeScript, I'll provide extra explanations along the way!`
      );
    }
  }

  async checkPrerequisites(): Promise<void> {
    log.step('Checking system prerequisites...');

    const prerequisites: Prerequisite[] = [
      { name: 'Node.js', command: 'node --version', minVersion: '18.0.0' },
      { name: 'npm', command: 'npm --version', minVersion: '9.0.0' },
      { name: 'Git', command: 'git --version', minVersion: '2.30.0' },
      { name: 'Docker', command: 'docker --version', minVersion: '20.0.0' },
      {
        name: 'Docker Compose',
        command: 'docker-compose --version',
        minVersion: '2.0.0',
      },
    ];

    const results: PrerequisiteResult[] = [];

    for (const prereq of prerequisites) {
      try {
        // Use PlatformService to find executable and get version
        const executableInfo = await this.platformService.findExecutable(
          prereq.name
        );

        if (executableInfo && executableInfo.available) {
          const version = executableInfo.version || 'Unknown';
          const isValid =
            version !== 'Unknown'
              ? this.compareVersions(version, prereq.minVersion) >= 0
              : false;

          results.push({
            name: prereq.name,
            installed: true,
            version,
            valid: isValid,
            required: prereq.minVersion,
          });

          if (isValid) {
            log.info(`✅ ${prereq.name}: ${version}`);
          } else {
            log.warning(
              `⚠️  ${prereq.name}: ${version} (requires ${prereq.minVersion}+)`
            );
          }
        } else {
          throw new Error(`${prereq.name} not found`);
        }
      } catch (error) {
        results.push({
          name: prereq.name,
          installed: false,
          valid: false,
          required: prereq.minVersion,
        });

        log.info(`❌ ${prereq.name}: Not installed`);
      }
    }

    const allValid = results.every(r => r.installed && r.valid);

    if (!allValid) {
      log.error(`\nSome prerequisites are missing or outdated.`);
      log.info('Please install/update the following:');

      results
        .filter(r => !r.installed || !r.valid)
        .forEach(r => {
          log.info(`  • ${r.name} ${r.required}+`);
        });

      log.info('\nInstallation guides:');
      log.info('  • Node.js: https://nodejs.org/');
      log.info('  • Docker: https://docs.docker.com/get-docker/');
      log.info('  • Git: https://git-scm.com/downloads');

      const proceed = await this.question(
        '\nDo you want to continue anyway? (y/N) '
      );

      if (proceed.toLowerCase() !== 'y') {
        log.info('Please install the prerequisites and run this script again.');
        process.exit(1);
      }
    } else {
      log.success('All prerequisites are installed and up to date!');
      this.checklist.prerequisites = true;
    }
  }

  async setupEnvironment(): Promise<void> {
    log.step('Setting up environment configuration...');

    // Check if .env exists
    if (!fs.existsSync('.env')) {
      if (fs.existsSync('.env.example')) {
        log.info('Creating .env file from .env.example...');
        fs.copyFileSync('.env.example', '.env');
        log.success('.env file created');
      } else {
        log.info('Creating basic .env file...');
        const envContent = this.generateBasicEnv();

        fs.writeFileSync('.env', envContent);
        log.success('Basic .env file created');
      }
    } else {
      log.info('.env file already exists');
    }

    // Setup service environment files
    if (fs.existsSync('services')) {
      const servicesDirs = fs
        .readdirSync('services', { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const serviceDir of servicesDirs) {
        const servicePath = path.join('services', serviceDir);
        const envPath = path.join(servicePath, '.env');
        const examplePath = path.join(servicePath, '.env.example');

        if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
          fs.copyFileSync(examplePath, envPath);
          log.info(`✅ Created .env for ${serviceDir}`);
        }
      }
    }

    // Setup frontend environment
    if (fs.existsSync('frontend') && !fs.existsSync('frontend/.env.local')) {
      if (fs.existsSync('frontend/.env.local.example')) {
        fs.copyFileSync('frontend/.env.local.example', 'frontend/.env.local');
        log.info('✅ Created frontend/.env.local');
      }
    }

    this.checklist.environment = true;
    log.success('Environment configuration completed');
  }

  private generateBasicEnv(): string {
    return `# Development Environment Variables
NODE_ENV=development
DEBUG=true

# Database
DATABASE_URL=postgresql://ailert:password@localhost:5432/ailert
POSTGRES_PASSWORD=ailert_dev_password
POSTGRES_DB=ailert
POSTGRES_USER=ailert

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=ailert_redis_password

# JWT
JWT_SECRET=dev_jwt_secret_change_in_production

# API URLs
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Email (Development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=

# Monitoring
GRAFANA_PASSWORD=admin
`;
  }

  async installDependencies(): Promise<void> {
    log.step('Installing project dependencies...');

    const installRoot = await this.question(
      'Install root dependencies? (Y/n) '
    );

    if (installRoot.toLowerCase() !== 'n') {
      log.info('Installing root dependencies...');
      try {
        execSync('npm install', { stdio: 'inherit' });
        log.success('Root dependencies installed');
      } catch (error: unknown) {
        log.error('Failed to install root dependencies');
        log.error(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    const installServices = await this.question(
      'Install service dependencies? (Y/n) '
    );

    if (installServices.toLowerCase() !== 'n' && fs.existsSync('services')) {
      const servicesDirs = fs
        .readdirSync('services', { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const serviceDir of servicesDirs) {
        const servicePath = path.join('services', serviceDir);
        const packageJsonPath = path.join(servicePath, 'package.json');

        if (fs.existsSync(packageJsonPath)) {
          log.info(`Installing dependencies for ${serviceDir}...`);
          try {
            execSync('npm install', { cwd: servicePath, stdio: 'inherit' });
            log.info(`✅ ${serviceDir} dependencies installed`);
          } catch (error) {
            log.info(`❌ Failed to install ${serviceDir} dependencies`);
          }
        }
      }
    }

    const installFrontend = await this.question(
      'Install frontend dependencies? (Y/n) '
    );

    if (
      installFrontend.toLowerCase() !== 'n' &&
      fs.existsSync('frontend/package.json')
    ) {
      log.info('Installing frontend dependencies...');
      try {
        execSync('npm install', { cwd: 'frontend', stdio: 'inherit' });
        log.success('Frontend dependencies installed');
      } catch (error: unknown) {
        log.error('Failed to install frontend dependencies');
      }
    }

    this.checklist.dependencies = true;
    log.success('Dependencies installation completed');
  }

  async setupDatabase(): Promise<void> {
    log.step('Setting up database...');

    const setupDb = await this.question('Set up database with Docker? (Y/n) ');

    if (setupDb.toLowerCase() !== 'n') {
      log.info('Starting database services...');
      try {
        execSync('docker-compose up -d postgres redis', { stdio: 'inherit' });

        // Wait for database to be ready
        log.info('Waiting for database to be ready...');
        await this.sleep(10000);

        // Run migrations if available
        if (fs.existsSync('package.json')) {
          const packageJson = JSON.parse(
            fs.readFileSync('package.json', 'utf8')
          );

          if (packageJson.scripts && packageJson.scripts['db:migrate']) {
            log.info('Running database migrations...');
            execSync('npm run db:migrate', { stdio: 'inherit' });
          }

          if (packageJson.scripts && packageJson.scripts['db:seed']) {
            const seedDb = await this.question(
              'Seed database with sample data? (Y/n) '
            );

            if (seedDb.toLowerCase() !== 'n') {
              log.info('Seeding database...');
              execSync('npm run db:seed', { stdio: 'inherit' });
            }
          }
        }

        log.success('Database setup completed');
        this.checklist.database = true;
      } catch (error: unknown) {
        log.error('Database setup failed');
        log.error(error instanceof Error ? error.message : 'Unknown error');
      }
    } else {
      log.info('Skipping database setup');
    }
  }

  async startServices(): Promise<void> {
    log.step('Starting development services...');

    const startServices = await this.question(
      'Start all development services? (Y/n) '
    );

    if (startServices.toLowerCase() !== 'n') {
      log.info('Starting infrastructure services...');
      try {
        execSync('docker-compose up -d', { stdio: 'inherit' });

        log.info('Services started! You can now run:');
        log.info('  • npm run dev - Start all development servers');
        log.info('  • npm run dev:frontend - Start only frontend');
        log.info('  • npm run dev:services - Start only backend services');

        this.checklist.services = true;
        log.success('Services started successfully');
      } catch (error: unknown) {
        log.error('Failed to start services');
        log.error(error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  async runTests(): Promise<void> {
    log.step('Running initial tests...');

    const runTests = await this.question('Run tests to verify setup? (Y/n) ');

    if (runTests.toLowerCase() !== 'n') {
      log.info('Running tests...');
      try {
        execSync('npm test -- --passWithNoTests --silent', {
          stdio: 'inherit',
        });
        log.success('Tests completed successfully');
        this.checklist.tests = true;
      } catch (error) {
        log.warning('Some tests failed, but this is normal for initial setup');
        log.info('You can run tests later with: npm test');
      }
    }
  }

  async showDocumentation(): Promise<void> {
    log.step('Documentation and next steps...');

    log.info(`\n📚 Important Documentation:`);
    log.info('  • README.md - Project overview and setup');
    log.info('  • CONTRIBUTING.md - Contribution guidelines');
    log.info('  • docs/development/setup-guide.md - Detailed setup guide');
    log.info('  • docs/api/ - API documentation');

    log.info(`\n🔧 Development Commands:`);
    log.info('  • npm run dev - Start all services in development mode');
    log.info('  • npm run build - Build all services for production');
    log.info('  • npm test - Run all tests');
    log.info('  • npm run lint - Run code linting');
    log.info('  • npm run format - Format code with Prettier');

    log.info(`\n🐛 Debugging Tools:`);
    log.info(
      '  • node scripts/debug-tools.js diagnostics - System diagnostics'
    );
    log.info(
      '  • node scripts/debug-tools.js performance - Performance monitoring'
    );
    log.info('  • node scripts/debug-tools.js logs - Log analysis');

    log.info(`\n🌐 Development URLs:`);
    log.info('  • Frontend: http://localhost:3000');
    log.info('  • API Gateway: http://localhost:8000');
    log.info('  • API Documentation: http://localhost:8000/docs');
    log.info('  • GraphQL Playground: http://localhost:8000/graphql');
    log.info('  • Grafana (Monitoring): http://localhost:3001 (admin/admin)');
    log.info('  • MailHog (Email Testing): http://localhost:8025');

    this.checklist.documentation = true;
  }

  async completionSummary(): Promise<void> {
    const completionMessage = `
╔══════════════════════════════════════════════════════════════╗
║                    ONBOARDING COMPLETE!                     ║
╚══════════════════════════════════════════════════════════════╝`;

    log.success(completionMessage);

    log.info(`\nSetup Checklist:`);
    Object.entries(this.checklist).forEach(([item, completed]) => {
      const status = completed ? '✅' : '❌';
      const name = item.charAt(0).toUpperCase() + item.slice(1);

      log.info(`  ${status} ${name}`);
    });

    const completedItems = Object.values(this.checklist).filter(Boolean).length;
    const totalItems = Object.keys(this.checklist).length;

    log.info(`\nCompletion: ${completedItems}/${totalItems} items`);

    if (completedItems === totalItems) {
      log.success(
        `\n🎉 Congratulations! Your development environment is fully set up!`
      );
      log.info(`\nNext Steps:`);
      log.info('1. Explore the codebase structure');
      log.info('2. Read the contributing guidelines');
      log.info('3. Pick up your first issue or task');
      log.info('4. Join the team communication channels');

      if (this.userInfo?.experience.toLowerCase() === 'beginner') {
        log.info(`\n💡 Beginner Tips:`);
        log.info(
          "• Start with the frontend components if you're more comfortable with UI"
        );
        log.info(
          '• Use the debug tools to understand how services communicate'
        );
        log.info("• Don't hesitate to ask questions in team channels");
        log.info('• Review existing code patterns before writing new features');
      }
    } else {
      log.warning(`\n⚠️  Some setup steps were skipped or failed.`);
      log.info(
        'You can re-run this onboarding script or complete the missing steps manually.'
      );
    }

    log.info(`\nWelcome to the team, ${this.userInfo?.name}! Happy coding! 🚀`);
  }

  // Utility methods
  async question(prompt: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(prompt, resolve);
    });
  }

  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractVersion(output: string): string {
    const match = output.match(/(\d+\.\d+\.\d+)/);

    return match && match[1] ? match[1] : '0.0.0';
  }

  private compareVersions(version1: string, version2: string): number {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;

      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }

    return 0;
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    const helpText = `
Developer Onboarding Tool

Interactive guide for new developers to set up their development environment.

Usage:
  node dev-onboarding.js

Features:
  • Interactive setup process
  • Prerequisites checking
  • Environment configuration
  • Dependencies installation
  • Database setup
  • Service startup
  • Test execution
  • Documentation overview

Example:
  node dev-onboarding.js
`;

    log.info(helpText);

    return;
  }

  const onboarding = new DeveloperOnboarding();

  await onboarding.start();
}

if (require.main === module) {
  main().catch(error => {
    log.error('Onboarding failed:', error);
    process.exit(1);
  });
}

export { DeveloperOnboarding };
