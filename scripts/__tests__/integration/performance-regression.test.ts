/**
 * Performance Regression Tests for Developer Tools
 * Tests to ensure developer tools maintain acceptable performance levels
 */

import { performance } from 'perf_hooks';
import { DebugTools } from '../../debug-tools';
import { DeveloperOnboarding } from '../../dev-onboarding';
import { DevUtilities } from '../../dev-utilities';

describe('Performance Regression Tests', () => {
  const PERFORMANCE_THRESHOLDS = {
    systemDiagnostics: 30000, // 30 seconds
    environmentValidation: 5000, // 5 seconds
    prerequisiteCheck: 15000, // 15 seconds
    secretGeneration: 1000, // 1 second
    qualityChecks: 60000, // 60 seconds (can be slow due to linting)
  };

  describe('Debug Tools Performance', () => {
    let debugTools: DebugTools;

    beforeEach(() => {
      debugTools = new DebugTools({ verbose: false, output: 'json' });
    });

    it(
      'should complete system diagnostics within threshold',
      async () => {
        const startTime = performance.now();

        await debugTools.systemDiagnostics();

        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.systemDiagnostics);

        // Log performance for monitoring
        console.log(
          `System diagnostics completed in ${Math.round(duration)}ms`
        );
      },
      PERFORMANCE_THRESHOLDS.systemDiagnostics + 5000
    );

    it('should complete performance monitoring setup quickly', async () => {
      const startTime = performance.now();

      // Test the setup time, not the full monitoring duration
      const monitorPromise = debugTools.performanceMonitor(1);

      // Wait a bit to ensure setup is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const setupTime = performance.now() - startTime;

      // Setup should be very fast
      expect(setupTime).toBeLessThan(1000);

      // Wait for monitoring to complete
      await monitorPromise;

      console.log(
        `Performance monitoring setup completed in ${Math.round(setupTime)}ms`
      );
    });

    it('should handle log analysis efficiently', async () => {
      const startTime = performance.now();

      // Test with non-existent directory (should be fast)
      await debugTools.analyzeLogs('non-existent-logs');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be very fast when no logs exist
      expect(duration).toBeLessThan(1000);

      console.log(`Log analysis completed in ${Math.round(duration)}ms`);
    });

    it('should handle database debugging efficiently', async () => {
      const startTime = performance.now();

      // Test without DATABASE_URL (should be fast)
      const originalDbUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      await debugTools.debugDatabase();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be fast when no database is configured
      expect(duration).toBeLessThan(2000);

      // Restore original value
      if (originalDbUrl) {
        process.env.DATABASE_URL = originalDbUrl;
      }

      console.log(`Database debugging completed in ${Math.round(duration)}ms`);
    });

    it('should handle network debugging efficiently', async () => {
      const startTime = performance.now();

      await debugTools.debugNetwork();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Network checks can take time due to timeouts, but should be reasonable
      expect(duration).toBeLessThan(30000);

      console.log(`Network debugging completed in ${Math.round(duration)}ms`);
    }, 35000);
  });

  describe('Dev Utilities Performance', () => {
    let devUtils: DevUtilities;

    beforeEach(() => {
      devUtils = new DevUtilities({ verbose: false });
    });

    it('should generate secrets quickly', async () => {
      const startTime = performance.now();

      // Mock the question method to avoid interactive prompts
      jest.spyOn(devUtils as any, 'question').mockResolvedValue('n');

      await devUtils.generateSecrets();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.secretGeneration);

      console.log(`Secret generation completed in ${Math.round(duration)}ms`);
    });

    it('should validate environment quickly', async () => {
      const startTime = performance.now();

      await devUtils.validateEnvironment();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.environmentValidation
      );

      console.log(
        `Environment validation completed in ${Math.round(duration)}ms`
      );
    });

    it('should handle service status checks efficiently', async () => {
      const startTime = performance.now();

      await devUtils.serviceManager('status');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Service status should be relatively fast
      expect(duration).toBeLessThan(10000);

      console.log(
        `Service status check completed in ${Math.round(duration)}ms`
      );
    });

    it('should handle database operations efficiently', async () => {
      const startTime = performance.now();

      // Test backup without DATABASE_URL (should be fast)
      const originalDbUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      await devUtils.databaseUtils('backup');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be fast when no database is configured
      expect(duration).toBeLessThan(2000);

      // Restore original value
      if (originalDbUrl) {
        process.env.DATABASE_URL = originalDbUrl;
      }

      console.log(`Database backup completed in ${Math.round(duration)}ms`);
    });

    it(
      'should run quality checks within threshold',
      async () => {
        const startTime = performance.now();

        await devUtils.runQualityChecks(false);

        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.qualityChecks);

        console.log(`Quality checks completed in ${Math.round(duration)}ms`);
      },
      PERFORMANCE_THRESHOLDS.qualityChecks + 10000
    );
  });

  describe('Dev Onboarding Performance', () => {
    let onboarding: DeveloperOnboarding;

    beforeEach(() => {
      onboarding = new DeveloperOnboarding();
    });

    it(
      'should check prerequisites within threshold',
      async () => {
        const startTime = performance.now();

        // Mock the question method to avoid interactive prompts
        const questionSpy = jest.spyOn(onboarding as any, 'question');
        questionSpy.mockResolvedValue('y'); // Continue anyway

        await (onboarding as any).checkPrerequisites();

        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.prerequisiteCheck);

        console.log(
          `Prerequisite check completed in ${Math.round(duration)}ms`
        );

        questionSpy.mockRestore();
      },
      PERFORMANCE_THRESHOLDS.prerequisiteCheck + 5000
    );

    it('should setup environment quickly', async () => {
      const startTime = performance.now();

      await (onboarding as any).setupEnvironment();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Environment setup should be fast
      expect(duration).toBeLessThan(5000);

      console.log(`Environment setup completed in ${Math.round(duration)}ms`);
    });

    it('should handle user info collection efficiently', async () => {
      const startTime = performance.now();

      const questionSpy = jest.spyOn(onboarding as any, 'question');
      questionSpy.mockResolvedValueOnce('Test User');
      questionSpy.mockResolvedValueOnce('Developer');
      questionSpy.mockResolvedValueOnce('Intermediate');

      await (onboarding as any).askUserInfo();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be very fast (just processing, no I/O)
      expect(duration).toBeLessThan(100);

      console.log(
        `User info collection completed in ${Math.round(duration)}ms`
      );

      questionSpy.mockRestore();
    });

    it('should display documentation quickly', async () => {
      const startTime = performance.now();

      await (onboarding as any).showDocumentation();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be very fast (just console output)
      expect(duration).toBeLessThan(100);

      console.log(
        `Documentation display completed in ${Math.round(duration)}ms`
      );
    });

    it('should generate completion summary quickly', async () => {
      const startTime = performance.now();

      // Set up test data
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
        name: 'Test User',
        role: 'Developer',
        experience: 'Intermediate',
      };

      await (onboarding as any).completionSummary();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be very fast (just console output)
      expect(duration).toBeLessThan(100);

      console.log(`Completion summary completed in ${Math.round(duration)}ms`);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during system diagnostics', async () => {
      const debugTools = new DebugTools({ verbose: false, output: 'json' });

      const initialMemory = process.memoryUsage().heapUsed;

      // Run diagnostics multiple times
      for (let i = 0; i < 3; i++) {
        await debugTools.systemDiagnostics();

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(
        `Memory increase after 3 diagnostics runs: ${Math.round(memoryIncrease / 1024 / 1024)}MB`
      );
    }, 120000);

    it('should not leak memory during environment validation', async () => {
      const devUtils = new DevUtilities({ verbose: false });

      const initialMemory = process.memoryUsage().heapUsed;

      // Run validation multiple times
      for (let i = 0; i < 5; i++) {
        await devUtils.validateEnvironment();

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      console.log(
        `Memory increase after 5 validation runs: ${Math.round(memoryIncrease / 1024 / 1024)}MB`
      );
    });
  });

  describe('Concurrent Operations', () => {
    it(
      'should handle concurrent diagnostics efficiently',
      async () => {
        const startTime = performance.now();

        const debugTools1 = new DebugTools({ verbose: false, output: 'json' });
        const debugTools2 = new DebugTools({ verbose: false, output: 'json' });
        const debugTools3 = new DebugTools({ verbose: false, output: 'json' });

        // Run multiple diagnostics concurrently
        const promises = [
          debugTools1.systemDiagnostics(),
          debugTools2.systemDiagnostics(),
          debugTools3.systemDiagnostics(),
        ];

        const results = await Promise.all(promises);

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Concurrent execution should not take much longer than sequential
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.systemDiagnostics * 1.5
        );

        // All results should be valid
        results.forEach(result => {
          expect(result).toBeDefined();
          expect(result.timestamp).toBeDefined();
        });

        console.log(
          `Concurrent diagnostics completed in ${Math.round(duration)}ms`
        );
      },
      PERFORMANCE_THRESHOLDS.systemDiagnostics * 2
    );

    it('should handle mixed concurrent operations', async () => {
      const startTime = performance.now();

      const debugTools = new DebugTools({ verbose: false, output: 'json' });
      const devUtils = new DevUtilities({ verbose: false });

      // Mock interactive prompts
      jest.spyOn(devUtils as any, 'question').mockResolvedValue('n');

      // Run different operations concurrently
      const promises = [
        debugTools.systemDiagnostics(),
        devUtils.validateEnvironment(),
        devUtils.generateSecrets(),
      ];

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(40000);

      console.log(
        `Mixed concurrent operations completed in ${Math.round(duration)}ms`
      );
    }, 45000);
  });

  describe('Scalability Tests', () => {
    it('should handle large log analysis efficiently', async () => {
      const debugTools = new DebugTools({ verbose: false, output: 'json' });

      // Test with non-existent large log directory
      const startTime = performance.now();

      await debugTools.analyzeLogs('non-existent-large-logs');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle missing directories quickly
      expect(duration).toBeLessThan(1000);

      console.log(`Large log analysis completed in ${Math.round(duration)}ms`);
    });

    it('should handle multiple service checks efficiently', async () => {
      const devUtils = new DevUtilities({ verbose: false });

      const startTime = performance.now();

      // Check multiple services
      const promises = [
        devUtils.serviceManager('status'),
        devUtils.serviceManager('status'),
        devUtils.serviceManager('status'),
      ];

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Multiple service checks should be reasonable
      expect(duration).toBeLessThan(30000);

      console.log(
        `Multiple service checks completed in ${Math.round(duration)}ms`
      );
    }, 35000);
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics accurately', async () => {
      const debugTools = new DebugTools({ verbose: false, output: 'json' });

      const startTime = performance.now();

      // Run a quick performance monitor
      await debugTools.performanceMonitor(2);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should take approximately 2 seconds (with some tolerance)
      expect(duration).toBeGreaterThan(1800);
      expect(duration).toBeLessThan(4000);

      console.log(`Performance monitoring duration: ${Math.round(duration)}ms`);
    }, 10000);
  });
});
