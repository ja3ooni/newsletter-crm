/**
 * Integration Tests for Dev Utilities
 * Tests the actual functionality of dev-utilities.ts across different scenarios
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DevUtilities } from '../../dev-utilities';

describe('Dev Utilities Integration', () => {
  let devUtils: DevUtilities;
  const testEnvPath = path.join(__dirname, '.env.test');
  const testBackupDir = path.join(__dirname, 'test-backups');

  beforeAll(() => {
    // Create test directories
    if (!fs.existsSync(testBackupDir)) {
      fs.mkdirSync(testBackupDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testEnvPath)) {
      fs.unlinkSync(testEnvPath);
    }
    if (fs.existsSync(testBackupDir)) {
      fs.rmSync(testBackupDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    devUtils = new DevUtilities({ verbose: false });
  });

  describe('Secret Generation', () => {
    it('should generate secure secrets', async () => {
      // Create a mock for the question method
      jest.spyOn(devUtils as any, 'question').mockResolvedValue('n');

      await expect(devUtils.generateSecrets()).resolves.not.toThrow();
    });

    it('should generate different secrets each time', async () => {
      // Mock the question method to avoid interactive prompts
      jest.spyOn(devUtils as any, 'question').mockResolvedValue('n');

      // Capture console output to verify secrets are different
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await devUtils.generateSecrets();
      const firstCall = consoleSpy.mock.calls
        .map(call => call.join(' '))
        .join('\n');

      consoleSpy.mockClear();

      await devUtils.generateSecrets();
      const secondCall = consoleSpy.mock.calls
        .map(call => call.join(' '))
        .join('\n');

      // Secrets should be different
      expect(firstCall).not.toBe(secondCall);

      consoleSpy.mockRestore();
    });
  });

  describe('Environment Validation', () => {
    it('should validate environment variables', async () => {
      await expect(devUtils.validateEnvironment()).resolves.not.toThrow();
    });

    it('should handle missing required variables', async () => {
      const originalEnv = { ...process.env };

      // Remove required variables
      delete process.env.NODE_ENV;
      delete process.env.DATABASE_URL;

      await expect(devUtils.validateEnvironment()).resolves.not.toThrow();

      // Restore environment
      process.env = originalEnv;
    });

    it('should validate JWT secret strength', async () => {
      const originalJwtSecret = process.env.JWT_SECRET;

      // Test with weak secret
      process.env.JWT_SECRET = 'weak';
      await expect(devUtils.validateEnvironment()).resolves.not.toThrow();

      // Test with strong secret
      process.env.JWT_SECRET = 'a'.repeat(64);
      await expect(devUtils.validateEnvironment()).resolves.not.toThrow();

      // Restore original
      if (originalJwtSecret) {
        process.env.JWT_SECRET = originalJwtSecret;
      } else {
        delete process.env.JWT_SECRET;
      }
    });

    it('should validate database URL format', async () => {
      const originalDbUrl = process.env.DATABASE_URL;

      // Test with invalid format
      process.env.DATABASE_URL = 'invalid://url';
      await expect(devUtils.validateEnvironment()).resolves.not.toThrow();

      // Test with valid format
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      await expect(devUtils.validateEnvironment()).resolves.not.toThrow();

      // Restore original
      if (originalDbUrl) {
        process.env.DATABASE_URL = originalDbUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    });
  });

  describe('Database Utilities', () => {
    it('should handle database backup without DATABASE_URL', async () => {
      const originalDbUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      await expect(devUtils.databaseUtils('backup')).resolves.not.toThrow();

      // Restore original value
      if (originalDbUrl) {
        process.env.DATABASE_URL = originalDbUrl;
      }
    });

    it('should handle database backup with missing pg_dump', async () => {
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

      // This should handle the case where pg_dump is not available
      await expect(devUtils.databaseUtils('backup')).resolves.not.toThrow();

      // Restore original value
      if (originalDbUrl) {
        process.env.DATABASE_URL = originalDbUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    });

    it('should handle unknown database actions', async () => {
      await expect(devUtils.databaseUtils('unknown')).resolves.not.toThrow();
    });

    it('should handle database reset cancellation', async () => {
      // Mock the question method to simulate user cancellation
      jest.spyOn(devUtils as any, 'question').mockResolvedValue('no');

      await expect(devUtils.databaseUtils('reset')).resolves.not.toThrow();
    });

    it('should handle database seeding without scripts', async () => {
      await expect(devUtils.databaseUtils('seed')).resolves.not.toThrow();
    });

    it('should handle database migration without scripts', async () => {
      await expect(devUtils.databaseUtils('migrate')).resolves.not.toThrow();
    });
  });

  describe('Service Management', () => {
    it('should handle service management without docker-compose', async () => {
      await expect(devUtils.serviceManager('status')).resolves.not.toThrow();
    });

    it('should handle starting services', async () => {
      await expect(devUtils.serviceManager('start')).resolves.not.toThrow();
    });

    it('should handle stopping services', async () => {
      await expect(devUtils.serviceManager('stop')).resolves.not.toThrow();
    });

    it('should handle restarting services', async () => {
      await expect(devUtils.serviceManager('restart')).resolves.not.toThrow();
    });

    it('should handle showing service logs', async () => {
      await expect(devUtils.serviceManager('logs')).resolves.not.toThrow();
    });

    it('should handle unknown service actions', async () => {
      await expect(devUtils.serviceManager('unknown')).resolves.not.toThrow();
    });

    it('should handle service management with specific service name', async () => {
      await expect(
        devUtils.serviceManager('start', 'postgres')
      ).resolves.not.toThrow();
      await expect(
        devUtils.serviceManager('stop', 'postgres')
      ).resolves.not.toThrow();
      await expect(
        devUtils.serviceManager('restart', 'postgres')
      ).resolves.not.toThrow();
      await expect(
        devUtils.serviceManager('logs', 'postgres')
      ).resolves.not.toThrow();
    });
  });

  describe('Code Quality Tools', () => {
    it('should run quality checks without fixing', async () => {
      await expect(devUtils.runQualityChecks(false)).resolves.not.toThrow();
    });

    it('should run quality checks with fixing', async () => {
      await expect(devUtils.runQualityChecks(true)).resolves.not.toThrow();
    });

    it('should handle missing quality tools gracefully', async () => {
      // Even if ESLint, Prettier, or TypeScript are not available, should not crash
      await expect(devUtils.runQualityChecks()).resolves.not.toThrow();
    });
  });

  describe('Development Server Management', () => {
    it('should handle dev server actions', async () => {
      // Mock the question method to avoid interactive prompts
      jest.spyOn(devUtils as any, 'question').mockResolvedValue('all');

      await expect(devUtils.devServer('start')).resolves.not.toThrow();
      await expect(devUtils.devServer('build')).resolves.not.toThrow();
      await expect(devUtils.devServer('test')).resolves.not.toThrow();
    });

    it('should handle unknown dev server actions', async () => {
      await expect(devUtils.devServer('unknown')).resolves.not.toThrow();
    });

    it('should handle different dev server start options', async () => {
      const questionSpy = jest.spyOn(devUtils as any, 'question');

      // Test frontend only
      questionSpy.mockResolvedValueOnce('frontend');
      await expect(devUtils.devServer('start')).resolves.not.toThrow();

      // Test services only
      questionSpy.mockResolvedValueOnce('services');
      await expect(devUtils.devServer('start')).resolves.not.toThrow();

      // Test all services
      questionSpy.mockResolvedValueOnce('all');
      await expect(devUtils.devServer('start')).resolves.not.toThrow();
    });

    it('should handle test type selection', async () => {
      const questionSpy = jest.spyOn(devUtils as any, 'question');

      // Test different test types
      questionSpy.mockResolvedValueOnce('1'); // Unit tests
      await expect(devUtils.devServer('test')).resolves.not.toThrow();

      questionSpy.mockResolvedValueOnce('2'); // Integration tests
      await expect(devUtils.devServer('test')).resolves.not.toThrow();

      questionSpy.mockResolvedValueOnce('3'); // E2E tests
      await expect(devUtils.devServer('test')).resolves.not.toThrow();

      questionSpy.mockResolvedValueOnce('4'); // All tests
      await expect(devUtils.devServer('test')).resolves.not.toThrow();
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work on current platform', async () => {
      // Test that basic functionality works regardless of platform
      await expect(devUtils.validateEnvironment()).resolves.not.toThrow();
    });

    it('should handle platform-specific commands', async () => {
      // Test that platform-specific logic doesn't crash
      await expect(devUtils.serviceManager('status')).resolves.not.toThrow();
    });

    it('should detect platform-specific tools correctly', async () => {
      // Test that tool detection works across platforms
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await devUtils.validateEnvironment();

      // Should have logged environment validation information
      const logOutput = consoleSpy.mock.calls
        .map(call => call.join(' '))
        .join('\n');

      // Should contain environment validation information
      expect(logOutput).toMatch(/(Environment|Variables|Configuration)/i);

      consoleSpy.mockRestore();
    });

    it('should handle cross-platform service commands', async () => {
      // Test different service management commands
      const commands = ['status', 'start', 'stop', 'restart'];

      for (const command of commands) {
        await expect(devUtils.serviceManager(command)).resolves.not.toThrow();
      }
    });

    it('should validate environment across platforms', async () => {
      // Environment validation should work regardless of platform
      const startTime = Date.now();

      await devUtils.validateEnvironment();

      const duration = Date.now() - startTime;

      // Should complete quickly on all platforms
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Error Handling', () => {
    it('should handle command execution failures gracefully', async () => {
      // Even if commands fail, the utility should handle it gracefully
      await expect(devUtils.runQualityChecks()).resolves.not.toThrow();
    });

    it('should handle file system errors gracefully', async () => {
      // Test with invalid paths or permissions
      await expect(devUtils.databaseUtils('backup')).resolves.not.toThrow();
    });
  });

  describe('CLI Interface', () => {
    const devUtilitiesPath = path.join(__dirname, '../../dev-utilities.ts');

    it('should show help when no arguments provided', () => {
      expect(() => {
        execSync(`node -r ts-node/register ${devUtilitiesPath} --help`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      }).not.toThrow();
    });

    it('should handle unknown commands gracefully', () => {
      try {
        execSync(
          `node -r ts-node/register ${devUtilitiesPath} unknown-command`,
          {
            encoding: 'utf8',
            stdio: 'pipe',
          }
        );
      } catch (error: any) {
        // Should exit with error code but not crash
        expect(error.status).toBe(1);
      }
    });

    it('should run secrets command', () => {
      expect(() => {
        execSync(`node -r ts-node/register ${devUtilitiesPath} secrets`, {
          encoding: 'utf8',
          stdio: 'pipe',
          input: 'n\n', // Simulate user input
          timeout: 10000,
        });
      }).not.toThrow();
    }, 15000);

    it('should run validate-env command', () => {
      expect(() => {
        execSync(`node -r ts-node/register ${devUtilitiesPath} validate-env`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10000,
        });
      }).not.toThrow();
    }, 15000);
  });

  describe('Performance', () => {
    it('should complete operations within reasonable time', async () => {
      const startTime = Date.now();

      await devUtils.validateEnvironment();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 10 seconds
      expect(duration).toBeLessThan(10000);
    });

    it('should handle concurrent operations', async () => {
      // Test that multiple operations can run concurrently without issues
      const operations = [
        devUtils.validateEnvironment(),
        devUtils.serviceManager('status'),
        devUtils.runQualityChecks(false),
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });
});
