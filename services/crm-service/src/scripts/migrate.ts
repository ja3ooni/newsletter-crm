// @ts-nocheck
import config from '@/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

async function runMigrations() {
  const db = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl,
  });

  try {
    console.log('Starting database migrations...');

    // Create migrations table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Get list of executed migrations
    const executedResult = await db.query(
      'SELECT filename FROM migrations ORDER BY id'
    );
    const executedMigrations = new Set(
      executedResult.rows.map(row => row.filename)
    );

    // Migration files to run
    const migrationFiles = [
      '001_create_core_tables.sql',
      '002_create_advanced_crm_tables.sql',
      '003_create_automation_tables.sql',
    ];

    for (const filename of migrationFiles) {
      if (executedMigrations.has(filename)) {
        console.log(`Skipping already executed migration: ${filename}`);
        continue;
      }

      console.log(`Running migration: ${filename}`);

      try {
        const migrationPath = join(__dirname, '..', 'migrations', filename);
        const migrationSQL = readFileSync(migrationPath, 'utf8');

        // Execute migration in a transaction
        await db.query('BEGIN');
        await db.query(migrationSQL);
        await db.query('INSERT INTO migrations (filename) VALUES ($1)', [
          filename,
        ]);
        await db.query('COMMIT');

        console.log(`Successfully executed migration: ${filename}`);
      } catch (error) {
        await db.query('ROLLBACK');
        console.error(`Failed to execute migration ${filename}:`, error);
        throw error;
      }
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

export default runMigrations;
