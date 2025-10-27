import { config } from '@/config';
import { Pool, PoolClient } from 'pg';
import { logger } from './logger';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', err => {
      logger.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', () => {
      logger.info('Database connected');
    });
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();

    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;

      logger.debug('Executed query', { text, duration, rows: res.rowCount });

      return res;
    } catch (error) {
      logger.error('Database query error', { text, params, error });
      throw error;
    }
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);

      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');

      return true;
    } catch (error) {
      logger.error('Database health check failed', error);

      return false;
    }
  }
}

export const database = new Database();
export default database;
