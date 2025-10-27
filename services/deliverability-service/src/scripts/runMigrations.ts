#!/usr/bin/env ts-node

import { logger } from '../utils/logger';
import { migrationRunner } from '../utils/migrationRunner';

async function main(): Promise<void> {
  try {
    logger.info('Starting database migrations...');

    // Get current status
    const status = await migrationRunner.getStatus();
    logger.info('Migration status', {
      executed: status.executed.length,
      pending: status.pending.length,
      pendingMigrations: status.pending,
    });

    if (status.pending.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    // Run migrations
    await migrationRunner.runMigrations();

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration script failed', { error });
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'status') {
  migrationRunner
    .getStatus()
    .then(status => {
      console.log('Migration Status:');
      console.log(`Executed: ${status.executed.length}`);
      console.log(`Pending: ${status.pending.length}`);
      if (status.pending.length > 0) {
        console.log('Pending migrations:', status.pending);
      }
      process.exit(0);
    })
    .catch(error => {
      logger.error('Error getting migration status', { error });
      process.exit(1);
    });
} else if (command === 'rollback' && args[1]) {
  migrationRunner
    .rollbackMigration(args[1])
    .then(() => {
      logger.info(`Migration ${args[1]} rolled back successfully`);
      process.exit(0);
    })
    .catch(error => {
      logger.error(`Rollback failed for ${args[1]}`, { error });
      process.exit(1);
    });
} else {
  main();
}
