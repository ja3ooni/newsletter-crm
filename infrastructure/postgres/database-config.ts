/**
 * Database Configuration and Connection Pooling
 * Provides centralized database configuration with connection pooling and query optimization
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('database');

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  statementTimeout?: number;
  queryTimeout?: number;
}

export interface DatabaseMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalQueries: number;
  averageQueryTime: number;
  slowQueries: number;
}

export class DatabaseManager {
  private pools: Map<string, Pool> = new Map();
  private metrics: Map<string, DatabaseMetrics> = new Map();
  private queryStats: Map<string, { count: number; totalTime: number; slowCount: number }> = new Map();

  /**
   * Create a new database connection pool
   */
  public createPool(name: string, config: DatabaseConfig): Pool {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,
      min: 2,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
      statement_timeout: config.statementTimeout || 30000,
      query_timeout: config.queryTimeout || 30000,
      application_name: `datatechtoncrm-${name}`,
    };

    const pool = new Pool(poolConfig);

    // Set up event handlers
    pool.on('connect', (client: PoolClient) => {
      logger.info(`New client connected to ${name} pool`);
      this.updateMetrics(name);
    });

    pool.on('remove', (client: PoolClient) => {
      logger.info(`Client removed from ${name} pool`);
      this.updateMetrics(name);
    });

    pool.on('error', (err: Error, client: PoolClient) => {
      logger.error(`Database pool error for ${name}:`, err);
    });

    // Initialize metrics
    this.metrics.set(name, {
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      averageQueryTime: 0,
      slowQueries: 0,
    });

    this.queryStats.set(name, {
      count: 0,
      totalTime: 0,
      slowCount: 0,
    });

    this.pools.set(name, pool);
    logger.info(`Database pool '${name}' created successfully`);

    return pool;
  }

  /**
   * Get an existing pool by name
   */
  public getPool(name: string): Pool {
    const pool = this.pools.get(name);
    if (!pool) {
      throw new Error(`Database pool '${name}' not found`);
    }
    return pool;
  }

  /**
   * Execute a query with performance tracking
   */
  public async query<T = any>(
    poolName: string,
    text: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number; duration: number }> {
    const pool = this.getPool(poolName);
    const startTime = Date.now();

    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - startTime;

      // Update query statistics
      this.updateQueryStats(poolName, duration);

      // Log slow queries
      if (duration > 1000) {
        logger.warn(`Slow query detected (${duration}ms) in ${poolName}:`, {
          query: text.substring(0, 200),
          params: params?.length || 0,
          duration,
        });
      }

      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Query error in ${poolName} (${duration}ms):`, {
        error: error instanceof Error ? error.message : error,
        query: text.substring(0, 200),
        params: params?.length || 0,
      });
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(
    poolName: string,
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const pool = this.getPool(poolName);
    const client = await pool.connect();

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

  /**
   * Get pool metrics
   */
  public getMetrics(poolName?: string): DatabaseMetrics | Map<string, DatabaseMetrics> {
    if (poolName) {
      const metrics = this.metrics.get(poolName);
      if (!metrics) {
        throw new Error(`Metrics for pool '${poolName}' not found`);
      }
      return metrics;
    }
    return this.metrics;
  }

  /**
   * Health check for a specific pool
   */
  public async healthCheck(poolName: string): Promise<boolean> {
    try {
      const result = await this.query(poolName, 'SELECT 1 as health');
      return result.rows.length > 0 && result.rows[0].health === 1;
    } catch (error) {
      logger.error(`Health check failed for pool ${poolName}:`, error);
      return false;
    }
  }

  /**
   * Close a specific pool
   */
  public async closePool(poolName: string): Promise<void> {
    const pool = this.pools.get(poolName);
    if (pool) {
      await pool.end();
      this.pools.delete(poolName);
      this.metrics.delete(poolName);
      this.queryStats.delete(poolName);
      logger.info(`Database pool '${poolName}' closed`);
    }
  }

  /**
   * Close all pools
   */
  public async closeAllPools(): Promise<void> {
    const closePromises = Array.from(this.pools.keys()).map(name => this.closePool(name));
    await Promise.all(closePromises);
    logger.info('All database pools closed');
  }

  /**
   * Update pool metrics
   */
  private updateMetrics(poolName: string): void {
    const pool = this.pools.get(poolName);
    const stats = this.queryStats.get(poolName);

    if (pool && stats) {
      const metrics: DatabaseMetrics = {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
        totalQueries: stats.count,
        averageQueryTime: stats.count > 0 ? stats.totalTime / stats.count : 0,
        slowQueries: stats.slowCount,
      };

      this.metrics.set(poolName, metrics);
    }
  }

  /**
   * Update query statistics
   */
  private updateQueryStats(poolName: string, duration: number): void {
    const stats = this.queryStats.get(poolName);
    if (stats) {
      stats.count++;
      stats.totalTime += duration;
      if (duration > 1000) {
        stats.slowCount++;
      }
      this.queryStats.set(poolName, stats);
      this.updateMetrics(poolName);
    }
  }
}

// Singleton instance
export const databaseManager = new DatabaseManager();

/**
 * Database configuration factory
 */
export class DatabaseConfigFactory {
  public static fromEnvironment(serviceName: string): DatabaseConfig {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl) {
      return this.fromUrl(databaseUrl);
    }

    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || `${serviceName}_db`,
      username: process.env.DB_USER || 'datatechtoncrm',
      password: process.env.DB_PASSWORD || 'datatechtoncrm_dev_password',
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
    };
  }

  public static fromUrl(url: string): DatabaseConfig {
    const parsed = new URL(url);

    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432', 10),
      database: parsed.pathname.slice(1),
      username: parsed.username,
      password: parsed.password,
      ssl: parsed.searchParams.get('ssl') === 'true' || parsed.searchParams.get('sslmode') === 'require',
      maxConnections: parseInt(parsed.searchParams.get('max_connections') || '20', 10),
      idleTimeoutMillis: parseInt(parsed.searchParams.get('idle_timeout') || '30000', 10),
      connectionTimeoutMillis: parseInt(parsed.searchParams.get('connection_timeout') || '10000', 10),
      statementTimeout: parseInt(parsed.searchParams.get('statement_timeout') || '30000', 10),
      queryTimeout: parseInt(parsed.searchParams.get('query_timeout') || '30000', 10),
    };
  }
}

/**
 * Query builder for common database operations
 */
export class QueryBuilder {
  private query: string = '';
  private params: any[] = [];
  private paramCount: number = 0;

  public select(columns: string | string[]): QueryBuilder {
    const cols = Array.isArray(columns) ? columns.join(', ') : columns;
    this.query = `SELECT ${cols}`;
    return this;
  }

  public from(table: string): QueryBuilder {
    this.query += ` FROM ${table}`;
    return this;
  }

  public where(condition: string, value?: any): QueryBuilder {
    const whereClause = this.query.includes('WHERE') ? ' AND' : ' WHERE';

    if (value !== undefined) {
      this.paramCount++;
      this.query += `${whereClause} ${condition.replace('?', `$${this.paramCount}`)}`;
      this.params.push(value);
    } else {
      this.query += `${whereClause} ${condition}`;
    }

    return this;
  }

  public orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    this.query += ` ORDER BY ${column} ${direction}`;
    return this;
  }

  public limit(count: number): QueryBuilder {
    this.query += ` LIMIT ${count}`;
    return this;
  }

  public offset(count: number): QueryBuilder {
    this.query += ` OFFSET ${count}`;
    return this;
  }

  public build(): { text: string; params: any[] } {
    return {
      text: this.query,
      params: this.params,
    };
  }

  public static insert(table: string, data: Record<string, any>): { text: string; params: any[] } {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    return {
      text: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      params: values,
    };
  }

  public static update(table: string, data: Record<string, any>, whereClause: string, whereParams: any[]): { text: string; params: any[] } {
    const columns = Object.keys(data);
    const values = Object.values(data);

    const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');
    const whereParamOffset = values.length;
    const adjustedWhereClause = whereClause.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + whereParamOffset}`);

    return {
      text: `UPDATE ${table} SET ${setClause} WHERE ${adjustedWhereClause} RETURNING *`,
      params: [...values, ...whereParams],
    };
  }

  public static delete(table: string, whereClause: string, whereParams: any[]): { text: string; params: any[] } {
    return {
      text: `DELETE FROM ${table} WHERE ${whereClause}`,
      params: whereParams,
    };
  }
}
