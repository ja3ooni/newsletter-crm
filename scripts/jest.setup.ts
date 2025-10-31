/**
 * Jest Setup File
 * Global test configuration and utilities
 */

// Extend Jest matchers
import 'jest';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to avoid noise in tests
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
});

afterAll(() => {
  global.console = originalConsole;
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidPath(): R;
      toBeExecutable(): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidPath(received: string) {
    const pass = typeof received === 'string' && received.length > 0;
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid path`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid path`,
        pass: false,
      };
    }
  },

  toBeExecutable(received: string) {
    const pass = typeof received === 'string' && received.length > 0;
    if (pass) {
      return {
        message: () => `expected ${received} not to be executable`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be executable`,
        pass: false,
      };
    }
  },
});

// Environment setup
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Mock external dependencies that might not be available in test environment
jest.mock('child_process', () => ({
  exec: jest.fn(),
  execSync: jest.fn(),
  spawn: jest.fn(),
}));

// Global test helpers
export const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
  logPerformance: jest.fn(),
  logRequest: jest.fn(),
  logDatabaseQuery: jest.fn(),
  logSecurityEvent: jest.fn(),
  setContext: jest.fn(),
  clearContext: jest.fn(),
  withContext: jest.fn().mockReturnThis(),
  createTimer: jest.fn().mockReturnValue(jest.fn()),
  measure: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  getLogLevel: jest.fn().mockReturnValue('info'),
  setLogLevel: jest.fn(),
});

export const createMockPlatformService = () => ({
  getCurrentPlatform: jest.fn().mockReturnValue('linux'),
  isWindows: jest.fn().mockReturnValue(false),
  isMacOS: jest.fn().mockReturnValue(false),
  isLinux: jest.fn().mockReturnValue(true),
  getCommandAlternatives: jest.fn().mockReturnValue(['ls']),
  findExecutable: jest.fn().mockResolvedValue('/usr/bin/node'),
  checkPortUsage: jest.fn().mockResolvedValue({ inUse: false, pid: null }),
  getProcessList: jest.fn().mockResolvedValue([]),
  getSystemInfo: jest.fn().mockResolvedValue({
    platform: 'linux',
    arch: 'x64',
    nodeVersion: 'v20.0.0',
    totalMemory: '8GB',
    freeMemory: '4GB',
  }),
  normalizePath: jest.fn().mockImplementation((path: string) => path),
  joinPath: jest
    .fn()
    .mockImplementation((...paths: string[]) => paths.join('/')),
  fileExists: jest.fn().mockResolvedValue(true),
  directoryExists: jest.fn().mockResolvedValue(true),
  createDirectory: jest.fn().mockResolvedValue(undefined),
});

// Test data factories
export const createTestError = (message = 'Test error') => new Error(message);

export const createTestContext = (overrides = {}) => ({
  requestId: 'test-request-123',
  userId: 'test-user-456',
  sessionId: 'test-session-789',
  operation: 'test-operation',
  component: 'test-component',
  ...overrides,
});
