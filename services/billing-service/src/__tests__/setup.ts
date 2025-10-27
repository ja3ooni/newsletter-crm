import { jest } from '@jest/globals';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'test_billing';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    subscriptionItems: {
      createUsageRecord: jest.fn(),
    },
    paymentMethods: {
      attach: jest.fn(),
    },
    invoices: {
      list: jest.fn(),
      pay: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
    products: {
      create: jest.fn(),
    },
    prices: {
      create: jest.fn(),
    },
    coupons: {
      create: jest.fn(),
    },
    promotionCodes: {
      create: jest.fn(),
    },
  }));
});

// Mock database connection
jest.mock('../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  closePool: jest.fn(),
}));

// Mock logger to reduce test output
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Global test timeout
jest.setTimeout(10000);
