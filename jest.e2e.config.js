module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Display name for this configuration
  displayName: 'E2E Tests',

  // Root directories for tests
  roots: ['<rootDir>/tests/e2e'],

  // Test file patterns
  testMatch: ['**/tests/e2e/**/*.test.ts', '**/tests/e2e/**/*.test.js'],

  // Transform files
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest',
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',

  // Coverage configuration
  collectCoverage: false, // Disable for E2E tests

  // Test timeout
  testTimeout: 120000, // 2 minutes for E2E tests

  // Verbose output
  verbose: false,

  // Silent mode for CI
  silent: process.env.CI === 'true',

  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/services/shared/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
  },

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/', '/.next/'],

  // Error handling
  errorOnDeprecated: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'e2e-test-results.xml',
      },
    ],
  ],
};
