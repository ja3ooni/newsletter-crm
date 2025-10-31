/**
 * Global Jest Setup
 *
 * Runs once before all tests start
 */

import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  console.log('🚀 Setting up global test environment...');

  // Create necessary directories
  const directories = [
    'test-results',
    'coverage',
    '__tests__/reports',
    '__tests__/performance-results',
    'quality-report',
    '.jest-cache',
  ];

  for (const dir of directories) {
    const dirPath = path.join(__dirname, '../../', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

  // Initialize test database connections if needed
  if (process.env.DATABASE_URL) {
    console.log('📊 Database connection available for testing');
  }

  if (process.env.REDIS_URL) {
    console.log('🔴 Redis connection available for testing');
  }

  // Record test start time
  const testStartTime = new Date().toISOString();
  fs.writeFileSync(
    path.join(__dirname, '../../test-results/test-start-time.txt'),
    testStartTime
  );

  // Log system information
  const systemInfo = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    memory: process.memoryUsage(),
    cpus: require('os').cpus().length,
    timestamp: testStartTime,
  };

  fs.writeFileSync(
    path.join(__dirname, '../../test-results/system-info.json'),
    JSON.stringify(systemInfo, null, 2)
  );

  console.log('✅ Global test setup completed');
}
