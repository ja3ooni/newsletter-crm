// @ts-nocheck
import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

export interface ConnectionPoolConfig extends PoolConfig {
  // Enhanced configuration options
  healthCheckInterval?: number; // milliseconds
  connectionTimeout?: number; // milliseconds
  queryTimeout?: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  enableMetrics?: boolean;
  slowQueryThreshold?: number; // milliseconds
}

export interface ConnectionPoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  avgQueryTime: number;
  slowQueries: number;
  connectionErrors: number;
  poolUtilization: number;
  uptime: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  executionTime: number;
  fromCache?: boolean;
}

export class ConnectionPoolManager {
  private pool: Pool;
  private config: ConnectionPoolConfig;
  private metrics: ConnectionPoolMetrics;
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime: number;

  constructor(config: ConnectionPoolConfig) {
    this.config = {
      // Default optimized settings
      min: 5,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      healthCheckInterval: 30000,
      queryTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      enableMetrics: true,
      slowQueryThreshold: 1000,
      ...config,
    };

    this.pool = new Pool(this.config);
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();

    this.setupEventHandlers();

    if (this.config.enableMetrics && this.config.healthCheckInterval) {
      this.startHealthChecks();
    }

    logger.info('Connection pool manager initialized', {
      min: this.config.min,
      max: this.config.max,
      enableMetrics: this.config.enableMetrics,
    });
  }

  /**
   * Execute a query with enhanced error handling and metrics
   */
  async query<T = any>(
    text: string,
    params?: any[],
    options?: {
      timeout?: number;
      retries?: number;
      skipMetrics?: boolean;
    }
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const maxRetries = options?.retries ?? this.config.maxRetries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const client = await this.acquireClient(options?.timeout);

        try {
          // Set query timeout if specified
          if (options?.timeout || this.config.queryTimeout) {
            const timeout = options?.timeout || this.config.queryTimeout!;

            await client.query(`SET statement_timeout = ${timeout}`);
          }

          const result = await client.query(text, params);
          const executionTime = Date.now() - startTime;

          // Update metrics
          if (!options?.skipMetrics && this.config.enableMetrics) {
            this.updateQueryMetrics(executionTime, true);
          }

          // Log slow queries
          if (executionTime > (this.config.slowQueryThreshold ?? 1000)) {
            logger.warn('Slow query detected', {
              executionTime,
              query: text.substring(0, 100),
              params: params?.length,
            });
            this.metrics.slowQueries++;
          }

          return {
            rows: result.rows,
            rowCount: result.rowCount || 0,
            executionTime,
          };
        } finally {
          client.release();
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!options?.skipMetrics && this.config.enableMetrics) {
          this.updateQueryMetrics(Date.now() - startTime, false);
        }

        // Don't retry on certain types of errors
        if (this.isNonRetryableError(lastError) || attempt === maxRetries) {
          break;
        }

        // Wait before retrying
        if (attempt < maxRetries) {
          await this.delay(
            (this.config.retryDelay ?? 1000) * Math.pow(2, attempt)
          );
        }
      }
    }

    logger.error('Query failed after all retries', {
      query: text.substring(0, 100),
      attempts: maxRetries + 1,
      error: lastError,
    });

    throw lastError;
  }

  /**
   * Execute a query and return only the first row
   */
  async queryOne<T = any>(
    text: string,
    params?: any[],
    options?: {
      timeout?: number;
      retries?: number;
    }
  ): Promise<T | null> {
    const result = await this.query<T>(text, params, options);

    return result.rows[0] || null;
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    options?: {
      timeout?: number;
      retries?: number;
    }
  ): Promise<T> {
    const startTime = Date.now();
    const maxRetries = options?.retries ?? this.config.maxRetries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const client = await this.acquireClient(options?.timeout);

      try {
        await client.query('BEGIN');

        const result = await callback(client);

        await client.query('COMMIT');

        // Update metrics
        if (this.config.enableMetrics) {
          this.updateQueryMetrics(Date.now() - startTime, true);
        }

        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        lastError = error instanceof Error ? error : new Error(String(error));

        if (this.config.enableMetrics) {
          this.updateQueryMetrics(Date.now() - startTime, false);
        }

        // Don't retry on certain types of errors
        if (this.isNonRetryableError(lastError) || attempt === maxRetries) {
          break;
        }

        // Wait before retrying
        if (attempt < maxRetries) {
          await this.delay(
            (this.config.retryDelay ?? 1000) * Math.pow(2, attempt)
          );
        }
      } finally {
        client.release();
      }
    }

    logger.error('Transaction failed after all retries', {
      attempts: maxRetries + 1,
      error: lastError,
    });

    throw lastError;
  }

  /**
   * Execute queries in batch for better performance
   */
  async batchQuery<T = any>(
    queries: Array<{ text: string; params?: any[] }>,
    options?: {
      timeout?: number;
      useTransaction?: boolean;
    }
  ): Promise<QueryResult<T>[]> {
    if (options?.useTransaction) {
      return this.transaction(async client => {
        const results: QueryResult<T>[] = [];

        for (const query of queries) {
          const startTime = Date.now();
          const result = await client.query(query.text, query.params);
          const executionTime = Date.now() - startTime;

          results.push({
            rows: result.rows,
            rowCount: result.rowCount || 0,
            executionTime,
          });
        }

        return results;
      });
    } else {
      const results: QueryResult<T>[] = [];

      for (const query of queries) {
        const result = await this.query<T>(query.text, query.params, {
          timeout: options?.timeout,
        });

        results.push(result);
      }

      return results;
    }
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): ConnectionPoolMetrics {
    this.updatePoolMetrics();

    return { ...this.metrics };
  }

  /**
   * Get pool health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const start = Date.now();

      await this.query('SELECT 1', [], { skipMetrics: true });
      const responseTime = Date.now() - start;

      const metrics = this.getMetrics();

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Determine health based on various factors
      if (
        metrics.poolUtilization > 90 ||
        metrics.avgQueryTime > 2000 ||
        responseTime > 5000 ||
        metrics.connectionErrors > 10
      ) {
        status = 'unhealthy';
      } else if (
        metrics.poolUtilization > 75 ||
        metrics.avgQueryTime > 1000 ||
        responseTime > 2000 ||
        metrics.connectionErrors > 5
      ) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          responseTime,
          metrics,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Optimize pool configuration based on current usage patterns
   */
  async optimizePool(): Promise<{
    recommendations: string[];
    currentConfig: any;
    suggestedConfig: any;
  }> {
    const metrics = this.getMetrics();
    const recommendations: string[] = [];
    const currentConfig = {
      min: this.config.min,
      max: this.config.max,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
    };
    const suggestedConfig = { ...currentConfig };

    // Analyze pool utilization
    if (metrics.poolUtilization > 80) {
      recommendations.push('Consider increasing max pool size');
      suggestedConfig.max = (this.config.max || 20) + 5;
    }

    if (metrics.poolUtilization < 30 && (this.config.max || 20) > 10) {
      recommendations.push('Consider decreasing max pool size');
      suggestedConfig.max = Math.max(10, (this.config.max || 20) - 5);
    }

    // Analyze idle connections
    if (metrics.idleConnections > metrics.totalConnections * 0.6) {
      recommendations.push('Consider decreasing min pool size');
      suggestedConfig.min = Math.max(2, (this.config.min || 5) - 2);
    }

    if (metrics.waitingClients > 0) {
      recommendations.push('Consider increasing min pool size');
      suggestedConfig.min = (this.config.min || 5) + 2;
    }

    // Analyze query performance
    if (metrics.avgQueryTime > 1000) {
      recommendations.push(
        'Consider optimizing slow queries or increasing connection timeout'
      );
    }

    if (metrics.connectionErrors > 5) {
      recommendations.push(
        'Consider increasing connection timeout and retry settings'
      );
    }

    return {
      recommendations,
      currentConfig,
      suggestedConfig,
    };
  }

  /**
   * Gracefully shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down connection pool manager');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    try {
      await this.pool.end();
      logger.info('Connection pool shutdown completed');
    } catch (error) {
      logger.error('Error during connection pool shutdown', error);
      throw error;
    }
  }

  /**
   * Get the underlying pool instance
   */
  getPool(): Pool {
    return this.pool;
  }

  private async acquireClient(timeout?: number): Promise<PoolClient> {
    const connectionTimeout =
      timeout || this.config.connectionTimeoutMillis || 2000;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timeout after ${connectionTimeout}ms`));
      }, connectionTimeout);

      this.pool
        .connect()
        .then(client => {
          clearTimeout(timeoutId);
          resolve(client);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          this.metrics.connectionErrors++;
          reject(error);
        });
    });
  }

  private setupEventHandlers(): void {
    this.pool.on('error', err => {
      logger.error('Unexpected error on idle client', err);
      this.metrics.connectionErrors++;
    });

    this.pool.on('connect', client => {
      logger.debug('Database client connected');
    });

    this.pool.on('acquire', client => {
      logger.debug('Database client acquired');
    });

    this.pool.on('remove', client => {
      logger.debug('Database client removed');
    });
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.getHealthStatus();
      } catch (error) {
        logger.error('Health check failed', error);
      }
    }, this.config.healthCheckInterval);

    logger.info('Health checks started', {
      interval: this.config.healthCheckInterval,
    });
  }

  private updateQueryMetrics(executionTime: number, success: boolean): void {
    this.metrics.totalQueries++;

    if (success) {
      this.metrics.successfulQueries++;
    } else {
      this.metrics.failedQueries++;
    }

    // Update average query time (exponential moving average)
    const alpha = 0.1; // Smoothing factor

    this.metrics.avgQueryTime =
      this.metrics.avgQueryTime * (1 - alpha) + executionTime * alpha;
  }

  private updatePoolMetrics(): void {
    this.metrics.totalConnections = this.pool.totalCount;
    this.metrics.idleConnections = this.pool.idleCount;
    this.metrics.waitingClients = this.pool.waitingCount;
    this.metrics.activeConnections =
      this.metrics.totalConnections - this.metrics.idleConnections;
    this.metrics.poolUtilization =
      (this.metrics.totalConnections / (this.config.max || 20)) * 100;
    this.metrics.uptime = Date.now() - this.startTime;
  }

  private isNonRetryableError(error: Error): boolean {
    const nonRetryableErrors = [
      'syntax error',
      'permission denied',
      'relation does not exist',
      'column does not exist',
      'duplicate key value',
      'violates foreign key constraint',
      'violates check constraint',
      'violates unique constraint',
    ];

    const errorMessage = error.message.toLowerCase();

    return nonRetryableErrors.some(pattern => errorMessage.includes(pattern));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeMetrics(): ConnectionPoolMetrics {
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      avgQueryTime: 0,
      slowQueries: 0,
      connectionErrors: 0,
      poolUtilization: 0,
      uptime: 0,
    };
  }
}
