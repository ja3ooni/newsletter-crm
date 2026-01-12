import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'datatechtoncrm_billing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(
    process.env.DB_CONNECTION_TIMEOUT || '2000'
  ),
};

export const pool = new Pool(dbConfig);

pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', err => {
  logger.error('PostgreSQL pool error:', err);
});

export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database query error:', { text, params, error });
    throw error;
  }
};

export const getClient = async () => {
  return await pool.connect();
};

export const closePool = async (): Promise<void> => {
  await pool.end();
  logger.info('Database pool closed');
};
