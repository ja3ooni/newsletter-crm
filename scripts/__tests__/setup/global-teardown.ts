/**
 * Global Jest Teardown
 *
 * Runs once after all tests complete
 */

import * as fs from 'fs';
import * as path from 'path';

export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Cleaning up global test environment...');

  try {
    // Record test end time
    const testEndTime = new Date().toISOString();
    const testResultsDir = path.join(__dirname, '../../test-results');

    if (fs.existsSync(testResultsDir)) {
      fs.writeFileSync(
        path.join(testResultsDir, 'test-end-time.txt'),
        testEndTime
      );

      // Calculate total test duration
      const startTimeFile = path.join(testResultsDir, 'test-start-time.txt');
      if (fs.existsSync(startTimeFile)) {
        const startTime = fs.readFileSync(startTimeFile, 'utf8').trim();
        const duration =
          new Date(testEndTime).getTime() - new Date(startTime).getTime();

        fs.writeFileSync(
          path.join(testResultsDir, 'test-duration.json'),
          JSON.stringify(
            {
              startTime,
              endTime: testEndTime,
              duration,
              durationFormatted: formatDuration(duration),
            },
            null,
            2
          )
        );
      }
    }

    // Clean up temporary test files
    const tempFiles = [
      path.join(__dirname, '../../temp-test-data.json'),
      path.join(__dirname, '../../test-lock.tmp'),
    ];

    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }

    // Log final memory usage
    const finalMemory = process.memoryUsage();
    if (fs.existsSync(testResultsDir)) {
      fs.writeFileSync(
        path.join(testResultsDir, 'final-memory-usage.json'),
        JSON.stringify(finalMemory, null, 2)
      );
    }

    // Close any remaining connections
    await closeConnections();

    console.log('✅ Global test cleanup completed');
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
    // Don't throw - we don't want to fail tests due to cleanup issues
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

async function closeConnections(): Promise<void> {
  // Close database connections if any
  try {
    // Add any specific connection cleanup here
    // For example, if using a database connection pool:
    // await dbPool.end();

    // Close Redis connections if any
    // await redisClient.quit();

    console.log('🔌 All connections closed');
  } catch (error) {
    console.warn(
      '⚠️  Warning: Some connections may not have closed properly:',
      error
    );
  }
}
