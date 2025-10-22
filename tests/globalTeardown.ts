import { execSync } from 'child_process';

export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Starting global test teardown...');

  try {
    // Stop test infrastructure if it was started
    if (process.env.START_TEST_INFRASTRUCTURE === 'true') {
      console.log('🛑 Stopping test infrastructure...');

      // Stop Docker Compose for testing
      execSync('docker-compose -f docker-compose.test.yml down -v', {
        stdio: 'inherit',
        timeout: 60000, // 1 minute timeout
      });

      console.log('✅ Test infrastructure stopped successfully');
    }

    // Additional cleanup tasks
    console.log('🔧 Performing cleanup tasks...');

    // Clean up temporary test files
    const fs = require('fs');
    const path = require('path');

    const tempDirs = ['tmp/test', 'logs/test'];

    tempDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (error) {
          console.warn(`Warning: Could not clean up ${dir}:`, error);
        }
      }
    });

    // Generate test summary
    console.log('📊 Generating test summary...');

    const testResults = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      duration: process.hrtime.bigint(),
    };

    const summaryPath = 'test-results/test-summary.json';
    if (fs.existsSync('test-results')) {
      fs.writeFileSync(summaryPath, JSON.stringify(testResults, null, 2));
    }

    console.log('✅ Global test teardown completed');

  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
    // Don't exit with error code in teardown to avoid masking test failures
  }
}
