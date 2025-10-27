import fs from 'fs';
import path from 'path';
import { closePool, query } from '../config/database';
import { logger } from '../utils/logger';

async function runMigrations(): Promise<void> {
  try {
    logger.info('Starting database migrations...');

    // Create migrations table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Get list of executed migrations
    const executedMigrations = await query(
      'SELECT filename FROM migrations ORDER BY id'
    );
    const executedFilenames = new Set(
      executedMigrations.rows.map((row: any) => row.filename)
    );

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    logger.info(`Found ${migrationFiles.length} migration files`);

    // Execute pending migrations
    for (const filename of migrationFiles) {
      if (executedFilenames.has(filename)) {
        logger.info(`Skipping already executed migration: ${filename}`);
        continue;
      }

      logger.info(`Executing migration: ${filename}`);

      const migrationPath = path.join(migrationsDir, filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      // Execute migration in a transaction
      await query('BEGIN');

      try {
        await query(migrationSQL);
        await query('INSERT INTO migrations (filename) VALUES ($1)', [
          filename,
        ]);
        await query('COMMIT');

        logger.info(`Successfully executed migration: ${filename}`);
      } catch (error) {
        await query('ROLLBACK');
        logger.error(`Failed to execute migration: ${filename}`, {
          error: error.message,
        });
        throw error;
      }
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  } finally {
    await closePool();
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Migration process failed', { error: error.message });
      process.exit(1);
    });
}

export { runMigrations };
