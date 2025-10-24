// Mock console methods to reduce test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock crypto for consistent testing
const crypto = require('crypto');

// Mock randomBytes to return predictable values in tests
const originalRandomBytes = crypto.randomBytes;

crypto.randomBytes = jest.fn().mockImplementation(size => {
  return Buffer.alloc(size, 'a'); // Fill with 'a' characters for predictable testing
});

// Restore original randomBytes for specific tests that need real randomness
crypto.randomBytes.restore = () => {
  crypto.randomBytes = originalRandomBytes;
};

// Mock timingSafeEqual to always return true for testing
crypto.timingSafeEqual = jest.fn().mockReturnValue(true);

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.SECRET_PROVIDER = 'local';
process.env.ENCRYPTION_PROVIDER = 'local';

// Mock fetch for Vault tests
global.fetch = jest.fn();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  // Reset environment variables
  delete process.env.MASTER_ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY;
});
