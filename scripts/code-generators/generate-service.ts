#!/usr/bin/env node

/**
 * Service Generator
 * Generates complete microservice boilerplate with best practices
 */

import * as fs from 'fs';
import * as path from 'path';
import { log } from '../shared/Logger';

interface ServiceOptions {
  withAuth?: boolean;
  withDatabase?: boolean;
  withRedis?: boolean;
  withQueue?: boolean;
  withGraphQL?: boolean;
  withWebSocket?: boolean;
  withMonitoring?: boolean;
  withDocker?: boolean;
}

class ServiceGenerator {
  private serviceName: string;
  private options: Required<ServiceOptions>;
  private serviceDir: string;
  private servicePascal: string;
  private serviceCamel: string;
  private serviceKebab: string;

  constructor(serviceName: string, options: ServiceOptions = {}) {
    this.serviceName = serviceName;
    this.options = {
      withAuth: options.withAuth !== false,
      withDatabase: options.withDatabase !== false,
      withRedis: options.withRedis !== false,
      withQueue: options.withQueue !== false,
      withGraphQL: options.withGraphQL || false,
      withWebSocket: options.withWebSocket || false,
      withMonitoring: options.withMonitoring !== false,
      withDocker: options.withDocker !== false,
    };

    this.serviceDir = path.join('services', serviceName);
    this.servicePascal = this.toPascalCase(serviceName);
    this.serviceCamel = this.toCamelCase(serviceName);
    this.serviceKebab = this.toKebabCase(serviceName);
  }

  private toPascalCase(str: string): string {
    return str.replace(/(?:^|-)(.)/g, (_, char) => char.toUpperCase());
  }

  private toCamelCase(str: string): string {
    return str.replace(/-(.)/g, (_, char) => char.toUpperCase());
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private generatePackageJson(): void {
    const dependencies: Record<string, string> = {
      express: '^4.18.2',
      cors: '^2.8.5',
      helmet: '^7.1.0',
      morgan: '^1.10.0',
      dotenv: '^16.3.1',
      zod: '^3.22.4',
      winston: '^3.11.0',
      'express-rate-limit': '^7.1.5',
      compression: '^1.7.4',
    };

    const devDependencies: Record<string, string> = {
      '@types/express': '^4.17.21',
      '@types/cors': '^2.8.17',
      '@types/morgan': '^1.9.9',
      '@types/node': '^20.9.0',
      '@types/jest': '^29.5.8',
      '@types/supertest': '^6.0.2',
      typescript: '^5.3.2',
      'ts-node-dev': '^2.0.0',
      jest: '^29.7.0',
      'ts-jest': '^29.1.1',
      supertest: '^6.3.3',
      eslint: '^8.54.0',
      '@typescript-eslint/eslint-plugin': '^6.21.0',
      '@typescript-eslint/parser': '^6.21.0',
      prettier: '^3.6.2',
      nodemon: '^3.0.2',
    };

    if (this.options.withAuth) {
      dependencies.jsonwebtoken = '^9.0.2';
      dependencies.bcrypt = '^5.1.1';
      devDependencies['@types/jsonwebtoken'] = '^9.0.5';
      devDependencies['@types/bcrypt'] = '^5.0.2';
    }

    if (this.options.withDatabase) {
      dependencies['@prisma/client'] = '^5.7.0';
      devDependencies.prisma = '^5.7.0';
    }

    if (this.options.withRedis) {
      dependencies.redis = '^4.6.10';
      devDependencies['@types/redis'] = '^4.0.11';
    }

    if (this.options.withQueue) {
      dependencies.bull = '^4.16.5';
      devDependencies['@types/bull'] = '^4.10.0';
    }

    if (this.options.withGraphQL) {
      dependencies['apollo-server-express'] = '^3.12.1';
      dependencies.graphql = '^16.8.1';
      dependencies['type-graphql'] = '^1.1.1';
    }

    if (this.options.withWebSocket) {
      dependencies['socket.io'] = '^4.7.4';
      devDependencies['@types/socket.io'] = '^3.0.2';
    }

    if (this.options.withMonitoring) {
      dependencies['prom-client'] = '^15.1.3';
      dependencies.jaeger = '^0.2.0';
    }

    const scripts: Record<string, string> = {
      build: 'tsc',
      dev: 'ts-node-dev --respawn --transpile-only src/index.ts',
      'dev:debug':
        'ts-node-dev --inspect=0.0.0.0:9229 --respawn --transpile-only src/index.ts',
      start: 'node dist/index.js',
      test: 'jest --silent',
      'test:watch': 'jest --watch --silent',
      'test:coverage': 'jest --coverage --silent',
      'test:debug': 'node --inspect-brk node_modules/.bin/jest --runInBand',
      lint: 'eslint src/**/*.ts',
      'lint:fix': 'eslint src/**/*.ts --fix',
      format: 'prettier --write src/**/*.ts',
      'format:check': 'prettier --check src/**/*.ts',
      'type-check': 'tsc --noEmit',
      docs: 'typedoc src --out docs',
    };

    if (this.options.withDatabase) {
      scripts['db:generate'] = 'prisma generate';
      scripts['db:migrate'] = 'prisma migrate dev';
      scripts['db:studio'] = 'prisma studio';
    }

    const packageJson = {
      name: `@datatechtoncrm/${this.serviceName}`,
      version: '1.0.0',
      description: `DatatechtonCRM ${this.servicePascal} Service`,
      main: 'dist/index.js',
      scripts,
      dependencies,
      devDependencies,
      keywords: ['datatechtoncrm', 'microservice', 'typescript', 'express', 'api'],
      author: 'DatatechtonCRM Team',
      license: 'MIT',
    };

    const packagePath = path.join(this.serviceDir, 'package.json');

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    log.success(`Generated package.json: ${packagePath}`);
  }

  private generateTsConfig(): void {
    const tsConfig = {
      extends: '../../tsconfig.json',
      compilerOptions: {
        outDir: './dist',
        rootDir: './src',
        baseUrl: './src',
        paths: {
          '@/*': ['./*'],
          '@shared/*': ['../shared/*'],
        },
      },
      include: ['src/**/*'],
      exclude: [
        'node_modules',
        'dist',
        'tests',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    };

    const tsConfigPath = path.join(this.serviceDir, 'tsconfig.json');

    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
    log.success(`Generated tsconfig.json: ${tsConfigPath}`);
  }

  private generateJestConfig(): void {
    const jestConfig = `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  verbose: false,
  silent: true,
};
`;

    const jestConfigPath = path.join(this.serviceDir, 'jest.config.js');

    fs.writeFileSync(jestConfigPath, jestConfig);
    log.success(`Generated jest.config.js: ${jestConfigPath}`);
  }

  private generateEslintConfig(): void {
    const eslintConfig = `module.exports = {
  extends: ['../../.eslintrc.js'],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    // Service-specific rules can be added here
  },
};
`;

    const eslintConfigPath = path.join(this.serviceDir, '.eslintrc.js');

    fs.writeFileSync(eslintConfigPath, eslintConfig);
    log.success(`Generated .eslintrc.js: ${eslintConfigPath}`);
  }

  private generateDockerfile(): void {
    if (!this.options.withDocker) return;

    const dockerfile = `# Multi-stage build for ${this.servicePascal} Service
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S datatechtoncrm -u 1001

# Copy built application
COPY --from=builder --chown=datatechtoncrm:nodejs /app/dist ./dist
COPY --from=builder --chown=datatechtoncrm:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=datatechtoncrm:nodejs /app/package*.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER datatechtoncrm

# Start the application
CMD ["node", "dist/index.js"]
`;

    const dockerfilePath = path.join(this.serviceDir, 'Dockerfile');

    fs.writeFileSync(dockerfilePath, dockerfile);
    log.success(`Generated Dockerfile: ${dockerfilePath}`);
  }

  async generate(): Promise<void> {
    try {
      log.info(`Generating ${this.serviceName} service...`);

      // Check if service already exists
      if (fs.existsSync(this.serviceDir)) {
        log.error(`Service directory already exists: ${this.serviceDir}`);
        log.info(
          'Please choose a different name or remove the existing directory.'
        );

        return;
      }

      // Create service directory
      this.ensureDirectoryExists(this.serviceDir);

      // Generate all files
      this.generatePackageJson();
      this.generateTsConfig();
      this.generateJestConfig();
      this.generateEslintConfig();
      this.generateDockerfile();

      log.success(`Service ${this.serviceName} generated successfully!`);
      log.info('Next steps:');
      log.info(`  1. cd ${this.serviceDir}`);
      log.info('  2. npm install');
      log.info('  3. cp .env.example .env');
      log.info('  4. Edit .env with your configuration');
      log.info('  5. npm run dev');
    } catch (error: unknown) {
      log.error(
        `Failed to generate service: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }
}

// CLI interface
function showHelp(): void {
  const helpText = `
Service Generator

Generate complete microservice boilerplate with best practices.

Usage:
  node generate-service.js <service-name> [options]

Arguments:
  service-name    Name of the service (e.g., billing-service, notification-service)

Options:
  --no-auth       Skip authentication setup
  --no-database   Skip database integration
  --no-redis      Skip Redis integration
  --no-queue      Skip queue integration
  --with-graphql  Include GraphQL setup
  --with-websocket Include WebSocket support
  --no-monitoring Skip monitoring setup
  --no-docker     Skip Docker configuration

Examples:
  node generate-service.js billing-service
  node generate-service.js notification-service --with-websocket
  node generate-service.js analytics-service --no-auth --with-graphql
`;

  log.info(helpText);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();

    return;
  }

  const serviceName = args[0];

  if (!serviceName) {
    log.error('Service name is required');
    showHelp();
    process.exit(1);
  }
  const options: ServiceOptions = {
    withAuth: !args.includes('--no-auth'),
    withDatabase: !args.includes('--no-database'),
    withRedis: !args.includes('--no-redis'),
    withQueue: !args.includes('--no-queue'),
    withGraphQL: args.includes('--with-graphql'),
    withWebSocket: args.includes('--with-websocket'),
    withMonitoring: !args.includes('--no-monitoring'),
    withDocker: !args.includes('--no-docker'),
  };

  try {
    const generator = new ServiceGenerator(serviceName, options);

    await generator.generate();
  } catch (error: unknown) {
    log.error(
      `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    log.error('Service generator failed:', error);
    process.exit(1);
  });
}

export { ServiceGenerator };
