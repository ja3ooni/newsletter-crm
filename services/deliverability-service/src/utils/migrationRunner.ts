import fs from 'fs';
import path from 'path';
import { database } from './database';
import { logger } from './logger';

export class MigrationRunner {
  private migrationsPath: string;

  constructor() {
    this.migrationsPath = path.join(__dirname, '../migrations');
  }

  async runMigrations(): Promise<void> {
    try {
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();

      // Get list of migration files
      const migrationFiles = this.getMigrationFiles();

      // Get already executed migrations
      const executedMigrations = await this.getExecutedMigrations();

      // Execute pending migrations
      for (const migrationFile of migrationFiles) {
        if (!executedMigrations.includes(migrationFile)) {
          await this.executeMigration(migrationFile);
        }
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', { error });
      throw error;
    }
  }

  private async createMigrationsTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await database.query(createTableQuery);
    logger.info('Migrations table created or already exists');
  }

  private getMigrationFiles(): string[] {
    if (!fs.existsSync(this.migrationsPath)) {
      logger.warn('Migrations directory does not exist');
      return [];
    }

    return fs
      .readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();
  }

  private async getExecutedMigrations(): Promise<string[]> {
    try {
      const result = await database.query(
        'SELECT migration_name FROM schema_migrations ORDER BY executed_at'
      );
      return result.rows.map((row: any) => row.migration_name);
    } catch (error) {
      logger.error('Error getting executed migrations', { error });
      return [];
    }
  }

  private async executeMigration(migrationFile: string): Promise<void> {
    const migrationPath = path.join(this.migrationsPath, migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    logger.info(`Executing migration: ${migrationFile}`);

    try {
      // Execute migration in a transaction
      await database.transaction(async client => {
        // Execute the migration SQL
        await client.query(migrationSQL);

        // Record the migration as executed
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [migrationFile]
        );
      });

      logger.info(`Migration completed: ${migrationFile}`);
    } catch (error) {
      logger.error(`Migration failed: ${migrationFile}`, { error });
      throw error;
    }
  }

  async rollbackMigration(migrationFile: string): Promise<void> {
    try {
      // Check if rollback file exists
      const rollbackFile = migrationFile.replace('.sql', '_rollback.sql');
      const rollbackPath = path.join(this.migrationsPath, rollbackFile);

      if (!fs.existsSync(rollbackPath)) {
        throw new Error(`Rollback file not found: ${rollbackFile}`);
      }

      const rollbackSQL = fs.readFileSync(rollbackPath, 'utf8');

      logger.info(`Rolling back migration: ${migrationFile}`);

      await database.transaction(async client => {
        // Execute rollback SQL
        await client.query(rollbackSQL);

        // Remove migration record
        await client.query(
          'DELETE FROM schema_migrations WHERE migration_name = $1',
          [migrationFile]
        );
      });

      logger.info(`Migration rolled back: ${migrationFile}`);
    } catch (error) {
      logger.error(`Rollback failed: ${migrationFile}`, { error });
      throw error;
    }
  }

  async getStatus(): Promise<{ executed: string[]; pending: string[] }> {
    const allMigrations = this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    const pendingMigrations = allMigrations.filter(
      migration => !executedMigrations.includes(migration)
    );

    return {
      executed: executedMigrations,
      pending: pendingMigrations,
    };
  }
}

export const migrationRunner = new MigrationRunner();
