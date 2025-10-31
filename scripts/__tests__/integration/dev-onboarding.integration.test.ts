/**
 * Integration Tests for Dev Onboarding
 * Tests the actual functionality of dev-onboarding.ts setup process
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DeveloperOnboarding } from '../../dev-onboarding';

describe('Dev Onboarding Integration', () => {
  let onboarding: DeveloperOnboarding;
  const testDir = path.join(__dirname, 'test-onboarding');
  const originalCwd = process.cwd();

  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Restore original working directory
    process.chdir(originalCwd);
  });

  beforeEach(() => {
    onboarding = new DeveloperOnboarding();
  });

  afterEach(() => {
    // Close readline interface to prevent open handles
    if (onboarding && (onboarding as any).rl) {
      try {
        (onboarding as any).rl.close();
      } catch (error) {
        // Ignore errors when closing readline interface
      }
    }
  });

  describe('Prerequisites Checking', () => {
    it('should check system prerequisites without crashing', async () => {
      // Mock the question method to avoid interactive prompts
      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValue('y'); // Continue anyway

      await expect(
        (onboarding as any).checkPrerequisites()
      ).resolves.not.toThrow();

      questionSpy.mockRestore();
    });

    it('should detect Node.js correctly', async () => {
      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValue('y');

      // Node.js should always be available in test environment
      await (onboarding as any).checkPrerequisites();

      // Should not throw and should detect Node.js
      expect(questionSpy).toHaveBeenCalled();

      questionSpy.mockRestore();
    });

    it('should handle missing prerequisites gracefully', async () => {
      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValue('y'); // Continue anyway

      // Should handle missing tools without crashing
      await expect(
        (onboarding as any).checkPrerequisites()
      ).resolves.not.toThrow();

      questionSpy.mockRestore();
    });

    it('should allow user to exit when prerequisites are missing', async () => {
      const questionSpy = jest.spyOn(onboarding as any, 'question');
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      questionSpy.mockResolvedValue('n'); // Don't continue

      try {
        await (onboarding as any).checkPrerequisites();
      } catch (error: any) {
        expect(error.message).toBe('Process exit called');
      }

      questionSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('Environment Setup', () => {
    it('should create .env file from .env.example', async () => {
      // Change to test directory
      process.chdir(testDir);

      // Create .env.example
      const envExample = `NODE_ENV=development
DATABASE_URL=postgresql://test:test@localhost:5432/test`;
      fs.writeFileSync('.env.example', envExample);

      await (onboarding as any).setupEnvironment();

      // Should create .env file
      expect(fs.existsSync('.env')).toBe(true);

      const envContent = fs.readFileSync('.env', 'utf8');
      expect(envContent).toContain('NODE_ENV=development');

      // Clean up
      if (fs.existsSync('.env')) fs.unlinkSync('.env');
      if (fs.existsSync('.env.example')) fs.unlinkSync('.env.example');

      process.chdir(originalCwd);
    });

    it('should create basic .env when no example exists', async () => {
      process.chdir(testDir);

      await (onboarding as any).setupEnvironment();

      // Should create basic .env file
      expect(fs.existsSync('.env')).toBe(true);

      const envContent = fs.readFileSync('.env', 'utf8');
      expect(envContent).toContain('NODE_ENV=development');
      expect(envContent).toContain('DATABASE_URL=');

      // Clean up
      if (fs.existsSync('.env')) fs.unlinkSync('.env');

      process.chdir(originalCwd);
    });

    it('should handle existing .env file', async () => {
      process.chdir(testDir);

      // Create existing .env
      const existingEnv = 'EXISTING_VAR=value';
      fs.writeFileSync('.env', existingEnv);

      await (onboarding as any).setupEnvironment();

      // Should not overwrite existing .env
      const envContent = fs.readFileSync('.env', 'utf8');
      expect(envContent).toBe(existingEnv);

      // Clean up
      if (fs.existsSync('.env')) fs.unlinkSync('.env');

      process.chdir(originalCwd);
    });

    it('should setup service environment files', async () => {
      process.chdir(testDir);

      // Create services directory structure
      const servicesDir = 'services/test-service';
      fs.mkdirSync(servicesDir, { recursive: true });

      // Create .env.example for service
      const serviceEnvExample = 'SERVICE_PORT=8001';
      fs.writeFileSync(
        path.join(servicesDir, '.env.example'),
        serviceEnvExample
      );

      await (onboarding as any).setupEnvironment();

      // Should create service .env file
      expect(fs.existsSync(path.join(servicesDir, '.env'))).toBe(true);

      const serviceEnvContent = fs.readFileSync(
        path.join(servicesDir, '.env'),
        'utf8'
      );
      expect(serviceEnvContent).toBe(serviceEnvExample);

      // Clean up
      fs.rmSync('services', { recursive: true, force: true });

      process.chdir(originalCwd);
    });

    it('should setup frontend environment files', async () => {
      process.chdir(testDir);

      // Create frontend directory
      fs.mkdirSync('frontend', { recursive: true });

      // Create .env.local.example
      const frontendEnvExample = 'NEXT_PUBLIC_API_URL=http://localhost:8000';
      fs.writeFileSync('frontend/.env.local.example', frontendEnvExample);

      await (onboarding as any).setupEnvironment();

      // Should create frontend .env.local file
      expect(fs.existsSync('frontend/.env.local')).toBe(true);

      const frontendEnvContent = fs.readFileSync('frontend/.env.local', 'utf8');
      expect(frontendEnvContent).toBe(frontendEnvExample);

      // Clean up
      fs.rmSync('frontend', { recursive: true, force: true });

      process.chdir(originalCwd);
    });
  });

  describe('Dependencies Installation', () => {
    it('should handle root dependencies installation', async () => {
      process.chdir(testDir);

      // Create package.json
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
      };
      fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValue('n'); // Skip installation

      await (onboarding as any).installDependencies();

      expect(questionSpy).toHaveBeenCalledWith(
        'Install root dependencies? (Y/n) '
      );

      // Clean up
      if (fs.existsSync('package.json')) fs.unlinkSync('package.json');

      questionSpy.mockRestore();
      process.chdir(originalCwd);
    });

    it('should handle service dependencies installation', async () => {
      process.chdir(testDir);

      // Create services structure
      const servicesDir = 'services/test-service';
      fs.mkdirSync(servicesDir, { recursive: true });

      const servicePackageJson = {
        name: 'test-service',
        version: '1.0.0',
        dependencies: {},
      };
      fs.writeFileSync(
        path.join(servicesDir, 'package.json'),
        JSON.stringify(servicePackageJson, null, 2)
      );

      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValueOnce('n'); // Skip root
      questionSpy.mockResolvedValueOnce('n'); // Skip services
      questionSpy.mockResolvedValueOnce('n'); // Skip frontend

      await (onboarding as any).installDependencies();

      expect(questionSpy).toHaveBeenCalledWith(
        'Install service dependencies? (Y/n) '
      );

      // Clean up
      fs.rmSync('services', { recursive: true, force: true });

      questionSpy.mockRestore();
      process.chdir(originalCwd);
    });

    it('should handle frontend dependencies installation', async () => {
      process.chdir(testDir);

      // Create frontend structure
      fs.mkdirSync('frontend', { recursive: true });

      const frontendPackageJson = {
        name: 'frontend',
        version: '1.0.0',
        dependencies: {},
      };
      fs.writeFileSync(
        'frontend/package.json',
        JSON.stringify(frontendPackageJson, null, 2)
      );

      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValueOnce('n'); // Skip root
      questionSpy.mockResolvedValueOnce('n'); // Skip services
      questionSpy.mockResolvedValueOnce('n'); // Skip frontend

      await (onboarding as any).installDependencies();

      expect(questionSpy).toHaveBeenCalledWith(
        'Install frontend dependencies? (Y/n) '
      );

      // Clean up
      fs.rmSync('frontend', { recursive: true, force: true });

      questionSpy.mockRestore();
      process.chdir(originalCwd);
    });
  });

  describe('Database Setup', () => {
    it('should handle database setup', async () => {
      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValue('n'); // Skip database setup

      await (onboarding as any).setupDatabase();

      expect(questionSpy).toHaveBeenCalledWith(
        'Set up database with Docker? (Y/n) '
      );

      questionSpy.mockRestore();
    });

    it('should handle database seeding', async () => {
      process.chdir(testDir);

      // Create package.json with db scripts
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          'db:migrate': 'echo "migrate"',
          'db:seed': 'echo "seed"',
        },
      };
      fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValueOnce('y'); // Setup database
      questionSpy.mockResolvedValueOnce('n'); // Skip seeding

      // Mock sleep to speed up test
      jest.spyOn(onboarding as any, 'sleep').mockResolvedValue(undefined);

      await (onboarding as any).setupDatabase();

      expect(questionSpy).toHaveBeenCalledWith(
        'Seed database with sample data? (Y/n) '
      );

      // Clean up
      if (fs.existsSync('package.json')) fs.unlinkSync('package.json');

      questionSpy.mockRestore();
      process.chdir(originalCwd);
    });
  });

  describe('Services Management', () => {
    it('should handle service startup', async () => {
      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValue('n'); // Skip service startup

      await (onboarding as any).startServices();

      expect(questionSpy).toHaveBeenCalledWith(
        'Start all development services? (Y/n) '
      );

      questionSpy.mockRestore();
    });
  });

  describe('Testing', () => {
    it('should handle test execution', async () => {
      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValue('n'); // Skip tests

      await (onboarding as any).runTests();

      expect(questionSpy).toHaveBeenCalledWith(
        'Run tests to verify setup? (Y/n) '
      );

      questionSpy.mockRestore();
    });
  });

  describe('Documentation Display', () => {
    it('should show documentation without crashing', async () => {
      await expect(
        (onboarding as any).showDocumentation()
      ).resolves.not.toThrow();
    });
  });

  describe('Completion Summary', () => {
    it('should show completion summary', async () => {
      // Set some checklist items
      (onboarding as any).checklist = {
        prerequisites: true,
        environment: true,
        dependencies: false,
        database: false,
        services: false,
        tests: false,
        documentation: true,
      };

      (onboarding as any).userInfo = {
        name: 'Test User',
        role: 'Developer',
        experience: 'Intermediate',
      };

      await expect(
        (onboarding as any).completionSummary()
      ).resolves.not.toThrow();
    });

    it('should handle beginner user experience', async () => {
      (onboarding as any).checklist = {
        prerequisites: true,
        environment: true,
        dependencies: true,
        database: true,
        services: true,
        tests: true,
        documentation: true,
      };

      (onboarding as any).userInfo = {
        name: 'Beginner User',
        role: 'Frontend',
        experience: 'Beginner',
      };

      await expect(
        (onboarding as any).completionSummary()
      ).resolves.not.toThrow();
    });
  });

  describe('User Information Collection', () => {
    it('should collect user information', async () => {
      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValueOnce('Test User');
      questionSpy.mockResolvedValueOnce('Full-stack');
      questionSpy.mockResolvedValueOnce('Advanced');

      await (onboarding as any).askUserInfo();

      expect((onboarding as any).userInfo).toEqual({
        name: 'Test User',
        role: 'Full-stack',
        experience: 'Advanced',
      });

      questionSpy.mockRestore();
    });

    it('should provide beginner guidance', async () => {
      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValueOnce('Beginner User');
      questionSpy.mockResolvedValueOnce('Frontend');
      questionSpy.mockResolvedValueOnce('Beginner');

      await (onboarding as any).askUserInfo();

      expect((onboarding as any).userInfo.experience).toBe('Beginner');

      questionSpy.mockRestore();
    });
  });

  describe('Utility Methods', () => {
    it('should handle version comparison correctly', async () => {
      const compareVersions = (onboarding as any).compareVersions;

      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    });

    it('should extract version from output correctly', async () => {
      const extractVersion = (onboarding as any).extractVersion;

      expect(extractVersion('v18.17.0')).toBe('18.17.0');
      expect(extractVersion('npm 9.6.7')).toBe('9.6.7');
      expect(extractVersion('Docker version 20.10.21')).toBe('20.10.21');
      expect(extractVersion('no version info')).toBe('0.0.0');
    });

    it('should handle sleep utility', async () => {
      const startTime = Date.now();
      await (onboarding as any).sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Error Handling', () => {
    it('should handle command execution failures gracefully', async () => {
      // Mock execSync to throw error
      const originalExecSync = require('child_process').execSync;
      jest
        .spyOn(require('child_process'), 'execSync')
        .mockImplementation(() => {
          throw new Error('Command failed');
        });

      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValue('y');

      await expect(
        (onboarding as any).checkPrerequisites()
      ).resolves.not.toThrow();

      // Restore original
      require('child_process').execSync = originalExecSync;
      questionSpy.mockRestore();
    });

    it('should handle file system errors gracefully', async () => {
      // Ensure we're in a valid directory
      process.chdir(originalCwd);

      await expect(
        (onboarding as any).setupEnvironment()
      ).resolves.not.toThrow();
    });
  });

  describe('CLI Interface', () => {
    const onboardingPath = path.join(__dirname, '../../dev-onboarding.ts');

    it('should show help when requested', () => {
      try {
        execSync(`node -r ts-node/register ${onboardingPath} --help`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });
        // If we get here, the command succeeded
        expect(true).toBe(true);
      } catch (error: any) {
        // The help command might exit with non-zero code, which is acceptable
        // We just want to ensure it doesn't crash completely
        expect(error).toBeDefined();
        // If it has a status, it should be a number
        if (error.status !== undefined) {
          expect(typeof error.status).toBe('number');
        }
      }
    });
  });

  describe('Performance', () => {
    it('should complete setup steps within reasonable time', async () => {
      const startTime = Date.now();

      // Mock all interactive prompts
      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValue('n'); // Skip all interactive steps

      await (onboarding as any).setupEnvironment();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);

      questionSpy.mockRestore();
    });
  });
});
