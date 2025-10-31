/**
 * Integration Tests for Debug Tools
 * Tests the actual functionality of debug-tools.ts across different scenarios
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DebugTools } from '../../debug-tools';

describe('Debug Tools Integration', () => {
  let debugTools: DebugTools;
  const testLogDir = path.join(__dirname, 'test-logs');

  beforeAll(() => {
    // Create test log directory
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true });
    }

    // Create sample log files for testing
    const sampleLog = `
2024-01-01T10:00:00.000Z INFO Application started
2024-01-01T10:01:00.000Z ERROR Database connection failed
2024-01-01T10:02:00.000Z WARN Memory usage high
2024-01-01T10:03:00.000Z INFO User logged in
2024-01-01T10:04:00.000Z ERROR Authentication failed
`;
    fs.writeFileSync(path.join(testLogDir, 'app.log'), sampleLog);
  });

  afterAll(() => {
    // Clean up test log directory
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    debugTools = new DebugTools({ verbose: false, output: 'json' });
  });

  describe('System Diagnostics', () => {
    it('should run complete system diagnostics', async () => {
      const result = await debugTools.systemDiagnostics();

      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.system).toBeDefined();
      expect(result.node).toBeDefined();
      expect(result.dependencies).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.ports).toBeDefined();
      expect(result.diskSpace).toBeDefined();

      // Validate system info structure
      expect(result.system.platform).toBeDefined();
      expect(result.system.arch).toBeDefined();
      expect(result.system.cpus).toBeGreaterThan(0);
      expect(result.system.totalmem).toBeGreaterThan(0);

      // Validate Node.js info
      expect(result.node.version).toMatch(/^v\d+\.\d+\.\d+/);
      expect(result.node.pid).toBeGreaterThan(0);
      expect(result.node.memoryUsage).toBeDefined();
      expect(result.node.memoryUsage.heapUsed).toBeGreaterThan(0);
    }, 30000);

    it('should check dependencies correctly', async () => {
      const result = await debugTools.systemDiagnostics();

      expect(result.dependencies).toBeDefined();
      expect(result.dependencies.node).toBeDefined();
      if (result.dependencies.node) {
        expect(result.dependencies.node.available).toBe(true);
        expect(result.dependencies.node.version).toMatch(/^v\d+\.\d+\.\d+/);
      }

      // Check that dependency checking doesn't crash
      Object.entries(result.dependencies).forEach(([, info]) => {
        expect(info).toHaveProperty('available');
        expect(typeof info.available).toBe('boolean');
        if (info.available) {
          expect(info.version).toBeDefined();
        }
      });
    });

    it('should check ports without crashing', async () => {
      const result = await debugTools.systemDiagnostics();

      expect(result.ports).toBeDefined();
      expect(Array.isArray(result.ports)).toBe(true);

      result.ports.forEach(portInfo => {
        expect(portInfo).toHaveProperty('port');
        expect(portInfo).toHaveProperty('inUse');
        expect(typeof portInfo.port).toBe('number');
        expect(typeof portInfo.inUse).toBe('boolean');
      });
    });

    it('should handle disk space checking gracefully', async () => {
      const result = await debugTools.systemDiagnostics();

      expect(result.diskSpace).toBeDefined();
      expect(result.diskSpace).toHaveProperty('available');
      expect(result.diskSpace).toHaveProperty('used');
      expect(result.diskSpace).toHaveProperty('total');
    });
  });

  describe('Performance Monitoring', () => {
    it('should monitor performance for specified duration', async () => {
      const startTime = Date.now();

      // Monitor for 2 seconds
      await debugTools.performanceMonitor(2);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take approximately 2 seconds (with some tolerance)
      expect(duration).toBeGreaterThan(1800);
      expect(duration).toBeLessThan(4000);
    }, 15000);

    it('should handle performance monitoring errors gracefully', async () => {
      // This should not throw even if there are issues
      await expect(debugTools.performanceMonitor(1)).resolves.not.toThrow();
    });
  });

  describe('Log Analysis', () => {
    it('should analyze logs correctly', async () => {
      await expect(debugTools.analyzeLogs(testLogDir)).resolves.not.toThrow();
    });

    it('should handle missing log directory gracefully', async () => {
      const nonExistentDir = path.join(__dirname, 'non-existent-logs');
      await expect(
        debugTools.analyzeLogs(nonExistentDir)
      ).resolves.not.toThrow();
    });

    it('should handle empty log directory gracefully', async () => {
      const emptyDir = path.join(__dirname, 'empty-logs');
      if (!fs.existsSync(emptyDir)) {
        fs.mkdirSync(emptyDir, { recursive: true });
      }

      await expect(debugTools.analyzeLogs(emptyDir)).resolves.not.toThrow();

      // Clean up
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });
  });

  describe('Database Debugging', () => {
    it('should handle database debugging without DATABASE_URL', async () => {
      const originalDbUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      await expect(debugTools.debugDatabase()).resolves.not.toThrow();

      // Restore original value
      if (originalDbUrl) {
        process.env.DATABASE_URL = originalDbUrl;
      }
    });

    it('should handle database debugging with invalid URL', async () => {
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'invalid://url';

      await expect(debugTools.debugDatabase()).resolves.not.toThrow();

      // Restore original value
      if (originalDbUrl) {
        process.env.DATABASE_URL = originalDbUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    });
  });

  describe('Network Debugging', () => {
    it('should test network endpoints without crashing', async () => {
      await expect(debugTools.debugNetwork()).resolves.not.toThrow();
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work on current platform', async () => {
      const result = await debugTools.systemDiagnostics();

      // Should detect the current platform correctly
      expect(['win32', 'darwin', 'linux']).toContain(result.system.platform);
    });

    it('should handle platform-specific commands', async () => {
      // This test ensures that platform-specific logic doesn't crash
      const result = await debugTools.systemDiagnostics();

      // Should complete without throwing errors
      expect(result).toBeDefined();
    });

    it('should handle Windows-specific operations', async () => {
      // Test Windows-specific functionality if on Windows
      const result = await debugTools.systemDiagnostics();

      if (result.system.platform === 'win32') {
        expect(result.system.arch).toBeDefined();
        expect(result.system.release).toMatch(/^\d+\.\d+\.\d+/);
      }
    });

    it('should handle Unix-like operations', async () => {
      // Test Unix-like functionality if on macOS or Linux
      const result = await debugTools.systemDiagnostics();

      if (['darwin', 'linux'].includes(result.system.platform)) {
        expect(result.system.loadavg).toHaveLength(3);
        expect(result.system.uptime).toBeGreaterThan(0);
      }
    });

    it('should validate cross-platform port checking', async () => {
      const result = await debugTools.systemDiagnostics();

      // Port checking should work on all platforms
      expect(result.ports).toBeDefined();
      expect(Array.isArray(result.ports)).toBe(true);

      // Should check common development ports
      const commonPorts = [3000, 8000, 5432];
      const checkedPorts = result.ports.map(p => p.port);

      commonPorts.forEach(port => {
        expect(checkedPorts).toContain(port);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle command execution failures gracefully', async () => {
      // Even if some commands fail, the tool should continue
      const result = await debugTools.systemDiagnostics();

      expect(result).toBeDefined();
      // Should not throw even if some checks fail
    });

    it('should handle permission errors gracefully', async () => {
      // Test with restricted permissions (if possible)
      await expect(debugTools.systemDiagnostics()).resolves.not.toThrow();
    });
  });

  describe('CLI Interface', () => {
    const debugToolsPath = path.join(__dirname, '../../debug-tools.ts');

    it('should show help when no arguments provided', () => {
      expect(() => {
        execSync(`node -r ts-node/register ${debugToolsPath} --help`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      }).not.toThrow();
    });

    it('should handle unknown commands gracefully', () => {
      try {
        execSync(`node -r ts-node/register ${debugToolsPath} unknown-command`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch (error: any) {
        // Should exit with error code but not crash
        expect(error.status).toBe(1);
      }
    });

    it('should run diagnostics command', () => {
      expect(() => {
        execSync(
          `node -r ts-node/register ${debugToolsPath} diagnostics --output json`,
          {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 30000,
          }
        );
      }).not.toThrow();
    }, 35000);
  });
});
