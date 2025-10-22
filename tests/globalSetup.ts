import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

export default async function globalSetup(): Promise<void> {
  console.log('🚀 Starting global test setup...');

  try {
    // Set test environment
    process.env.NODE_ENV = 'test';

    // Start test infrastructure if needed
    if (process.env.START_TEST_INFRASTRUCTURE === 'true') {
      console.log('📦 Starting test infrastructure...');

      // Start Docker Compose for testing
      execSync('docker-compose -f docker-compose.test.yml up -d', {
        stdio: 'inherit',
        timeout: 120000, // 2 minutes timeout
      });

      // Wait for services to be ready
      console.log('⏳ Waiting for services to be ready...');
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds

      // Run database migrations for test
      console.log('🗄️ Running test database migrations...');
      execSync('npm run db:migrate:test', {
        stdio: 'inherit',
        timeout: 60000, // 1 minute timeout
      });

      console.log('✅ Test infrastructure started successfully');
    }

    // Additional global setup tasks
    console.log('🔧 Performing additional setup tasks...');

    // Create test directories
    const fs = require('fs');
    const testDirs = ['test-results', 'coverage', 'logs/test'];

    testDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Set global test timeout
    jest.setTimeout(30000);

    console.log('✅ Global test setup completed');

  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    process.exit(1);
  }
}
