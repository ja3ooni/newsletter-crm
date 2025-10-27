// Test setup file for deliverability service

// Mock external dependencies
jest.mock('dns', () => ({
  resolveTxt: jest.fn(),
  resolve4: jest.fn(),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

// Mock database
jest.mock('./utils/database', () => ({
  database: {
    query: jest.fn(),
    transaction: jest.fn(),
    getClient: jest.fn(),
    close: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
  },
}));

// Mock Redis
jest.mock('./utils/redis', () => ({
  redis: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    hGet: jest.fn(),
    hSet: jest.fn(),
    hGetAll: jest.fn(),
    sadd: jest.fn(),
    sismember: jest.fn(),
    smembers: jest.fn(),
    zadd: jest.fn(),
    zrange: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
  },
}));

// Mock logger
jest.mock('./utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Global test timeout
jest.setTimeout(10000);

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
