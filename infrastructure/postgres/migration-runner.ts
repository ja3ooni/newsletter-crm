/**
 * Database Migration Runner
 * Handles running and tracking database migrations
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('migration-runner');

export interface Migration {
  id: string;
  name: string;
  sql: string;
  checksum: string;
}

export interface MigrationRecord {
  id: string;
  name: string;
  checksum: string;
  executed_at: Date;
  execution_time_ms: number;
}

export class MigrationRunner {
  private pool: Pool;
  private migrationsPath: string;

  constructor(pool: Pool, migrationsPath: string = join(__dirname, 'migrations')) {
    this.pool = pool;
    this.migrationsPath = migrationsPath;
  }

  /**
   * Initialize migration tracking table
   */
  private async initializeMigrationTable(): Promise<void> {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        execution_time_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at
      ON schema_migrations(executed_at DESC);
    `;

    await this.pool.query(createTableSql);
    logger.info('Migration tracking table initialized');
  }

  /**
   * Load migration files from directory
   */
  private loadMigrations(): Migration[] {
    try {
      const files = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      return files.map(file => {
        const filePath = join(this.migrationsPath, file);
        const sql = readFileSync(filePath, 'utf-8');
        const id = file.replace('.sql', '');

        return {
          id,
          name: file,
          sql,
          checksum: this.calculateChecksum(sql),
        };
      });
    } catch (error) {
      logger.error('Failed to load migration files:', { error });
      throw new Error(`Failed to load migrations from ${this.migrationsPath}`);
    }
  }

  /**
   * Get executed migrations from database
   */
  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.pool.query(`
      SELECT id, name, checksum, executed_at, execution_time_ms
      FROM schema_migrations
      ORDER BY executed_at ASC
    `);

    return result.rows;
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(migration: Migration): Promise<number> {
    const startTime = Date.now();

    try {
      // Execute migration in a transaction
      await this.pool.query('BEGIN');

      // Run the migration SQL
      await this.pool.query(migration.sql);

      // Record the migration
      await this.pool.query(`
        INSERT INTO schema_migrations (id, name, checksum, execution_time_ms)
        VALUES ($1, $2, $3, $4)
      `, [
        migration.id,
        migration.name,
        migration.checksum,
        Date.now() - startTime
      ]);

      await this.pool.query('COMMIT');

      const executionTime = Date.now() - startTime;
      logger.info(`Migration ${migration.id} executed successfully`, {
        name: migration.name,
        executionTime: `${executionTime}ms`
      });

      return executionTime;
    } catch (error) {
      await this.pool.query('ROLLBACK');
      logger.error(`Migration ${migration.id} failed:`, { error });
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  public async runMigrations(): Promise<void> {
    logger.info('Starting database migrations...');

    try {
      // Initialize migration tracking
      await this.initializeMigrationTable();

      // Load available migrations
      const availableMigrations = this.loadMigrations();
      logger.info(`Found ${availableMigrations.length} migration files`);

      // Get executed migrations
      const executedMigrations = await this.getExecutedMigrations();
      const executedIds = new Set(executedMigrations.map(m => m.id));

      // Validate executed migrations
      for (const executed of executedMigrations) {
        const available = availableMigrations.find(m => m.id === executed.id);
        if (!available) {
          throw new Error(`Executed migration ${executed.id} not found in migration files`);
        }
        if (available.checksum !== executed.checksum) {
          throw new Error(`Migration ${executed.id} checksum mismatch. Migration file may have been modified after execution.`);
        }
      }

      // Find pending migrations
      const pendingMigrations = availableMigrations.filter(m => !executedIds.has(m.id));

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations found');
        return;
      }

      logger.info(`Running ${pendingMigrations.length} pending migrations...`);

      // Execute pending migrations
      let totalExecutionTime = 0;
      for (const migration of pendingMigrations) {
        const executionTime = await this.executeMigration(migration);
        totalExecutionTime += executionTime;
      }

      logger.info('All migrations completed successfully', {
        executedCount: pendingMigrations.length,
        totalExecutionTime: `${totalExecutionTime}ms`
      });

    } catch (error) {
      logger.error('Migration failed:', { error });
      throw error;
    }
  }

  /**
   * Get migration status
   */
  public async getMigrationStatus(): Promise<{
    total: number;
    executed: number;
    pending: number;
    lastExecuted?: MigrationRecord;
  }> {
    await this.initializeMigrationTable();

    const availableMigrations = this.loadMigrations();
    const executedMigrations = await this.getExecutedMigrations();

    return {
      total: availableMigrations.length,
      executed: executedMigrations.length,
      pending: availableMigrations.length - executedMigrations.length,
      lastExecuted: executedMigrations[executedMigrations.length - 1],
    };
  }

  /**
   * Validate migration integrity
   */
  public async validateMigrations(): Promise<boolean> {
    try {
      await this.initializeMigrationTable();

      const availableMigrations = this.loadMigrations();
      const executedMigrations = await this.getExecutedMigrations();

      // Check for missing migration files
      for (const executed of executedMigrations) {
        const available = availableMigrations.find(m => m.id === executed.id);
        if (!available) {
          logger.error(`Executed migration ${executed.id} not found in migration files`);
          return false;
        }

        // Check checksum
        if (available.checksum !== executed.checksum) {
          logger.error(`Migration ${executed.id} checksum mismatch`);
          return false;
        }
      }

      logger.info('Migration validation passed');
      return true;
    } catch (error) {
      logger.error('Migration validation failed:', { error });
      return false;
    }
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Create a new migration file template
   */
  public static createMigrationTemplate(name: string): string {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    const filename = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;

    const template = `-- Migration: ${filename}
-- Description: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Remember to:
-- 1. Use transactions for complex migrations
-- 2. Add proper indexes
-- 3. Include rollback instructions in comments if needed
-- 4. Test migrations on a copy of production data

`;

    return template;
  }
}

/**
 * CLI utility for running migrations
 */
export class MigrationCLI {
  private runner: MigrationRunner;

  constructor(pool: Pool, migrationsPath?: string) {
    this.runner = new MigrationRunner(pool, migrationsPath);
  }

  public async run(command: string): Promise<void> {
    switch (command) {
      case 'migrate':
        await this.runner.runMigrations();
        break;

      case 'status':
        const status = await this.runner.getMigrationStatus();
        console.log('Migration Status:');
        console.log(`  Total migrations: ${status.total}`);
        console.log(`  Executed: ${status.executed}`);
        console.log(`  Pending: ${status.pending}`);
        if (status.lastExecuted) {
          console.log(`  Last executed: ${status.lastExecuted.name} (${status.lastExecuted.executed_at})`);
        }
        break;

      case 'validate':
        const isValid = await this.runner.validateMigrations();
        console.log(`Migration validation: ${isValid ? 'PASSED' : 'FAILED'}`);
        if (!isValid) {
          process.exit(1);
        }
        break;

      default:
        console.log('Available commands: migrate, status, validate');
        break;
    }
  }
}
