// @ts-nocheck
import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { CacheManager } from './CacheManager';

export interface QueryCacheConfig {
  defaultTTL: number;
  enableQueryAnalysis: boolean;
  slowQueryThreshold: number; // milliseconds
  maxCacheSize: number; // number of queries to cache
}

export interface QueryMetrics {
  executionTime: number;
  cacheHit: boolean;
  queryHash: string;
  timestamp: number;
}

export interface QueryAnalysis {
  avgExecutionTime: number;
  executionCount: number;
  cacheHitRate: number;
  lastExecuted: Date;
}

export class QueryCache {
  private pool: Pool;
  private cacheManager: CacheManager;
  private config: QueryCacheConfig;
  private queryMetrics: Map<string, QueryAnalysis> = new Map();
  private preparedStatements: Map<string, string> = new Map();

  constructor(
    pool: Pool,
    cacheManager: CacheManager,
    config: QueryCacheConfig
  ) {
    this.pool = pool;
    this.cacheManager = cacheManager;
    this.config = config;

    // Cleanup old metrics every hour
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000);
  }

  /**
   * Execute query with intelligent caching
   */
  async query<T = any>(
    text: string,
    params?: any[],
    options?: {
      ttl?: number;
      tags?: string[];
      skipCache?: boolean;
      useTransaction?: boolean;
    }
  ): Promise<{ rows: T[]; rowCount: number; metrics: QueryMetrics }> {
    const queryHash = this.generateQueryHash(text, params);
    const cacheKey = `query:${queryHash}`;
    const startTime = Date.now();

    // Check if we should skip cache
    if (options?.skipCache || this.isWriteQuery(text)) {
      return this.executeQuery(
        text,
        params,
        queryHash,
        startTime,
        options?.useTransaction
      );
    }

    try {
      // Try to get from cache first
      const cached = await this.cacheManager.get<{
        rows: T[];
        rowCount: number;
      }>(cacheKey);

      if (cached) {
        const executionTime = Date.now() - startTime;

        this.updateQueryMetrics(queryHash, executionTime, true);

        return {
          ...cached,
          metrics: {
            executionTime,
            cacheHit: true,
            queryHash,
            timestamp: Date.now(),
          },
        };
      }

      // Execute query and cache result
      const result = await this.executeQuery(
        text,
        params,
        queryHash,
        startTime,
        options?.useTransaction
      );

      // Cache the result if it's a read query
      if (!this.isWriteQuery(text)) {
        const ttl = options?.ttl || this.config.defaultTTL;

        if (options?.tags) {
          await this.cacheManager.setWithTags(
            cacheKey,
            {
              rows: result.rows,
              rowCount: result.rowCount,
            },
            options.tags,
            ttl
          );
        } else {
          await this.cacheManager.set(
            cacheKey,
            {
              rows: result.rows,
              rowCount: result.rowCount,
            },
            ttl
          );
        }
      }

      return result;
    } catch (error) {
      logger.error('Query cache error', { queryHash, error });
      throw error;
    }
  }

  /**
   * Execute prepared statement with caching
   */
  async executePrepared<T = any>(
    name: string,
    text: string,
    params?: any[],
    options?: {
      ttl?: number;
      tags?: string[];
      skipCache?: boolean;
    }
  ): Promise<{ rows: T[]; rowCount: number; metrics: QueryMetrics }> {
    // Prepare statement if not already prepared
    if (!this.preparedStatements.has(name)) {
      const client = await this.pool.connect();

      try {
        await client.query(`PREPARE ${name} AS ${text}`);
        this.preparedStatements.set(name, text);
      } finally {
        client.release();
      }
    }

    // Execute prepared statement
    const executeText = `EXECUTE ${name}${params ? `(${params.map(() => '$1').join(',')})` : ''}`;

    return this.query<T>(executeText, params, options);
  }

  /**
   * Execute transaction with caching for read queries
   */
  async transaction<T>(
    callback: (client: PoolClient, queryCache: QueryCache) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Create a transaction-scoped query cache
      const transactionCache = new QueryCache(
        this.pool,
        this.cacheManager,
        { ...this.config, defaultTTL: 0 } // No caching in transactions by default
      );

      const result = await callback(client, transactionCache);

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
   * Invalidate cache for specific tables
   */
  async invalidateTable(tableName: string): Promise<void> {
    await this.cacheManager.invalidateByTags([`table:${tableName}`]);
    logger.info('Table cache invalidated', { tableName });
  }

  /**
   * Invalidate cache for multiple tables
   */
  async invalidateTables(tableNames: string[]): Promise<void> {
    const tags = tableNames.map(name => `table:${name}`);

    await this.cacheManager.invalidateByTags(tags);
    logger.info('Multiple table caches invalidated', { tableNames });
  }

  /**
   * Get query performance analytics
   */
  getQueryAnalytics(): Map<string, QueryAnalysis> {
    return new Map(this.queryMetrics);
  }

  /**
   * Get slow queries report
   */
  getSlowQueries(): Array<{ queryHash: string; analysis: QueryAnalysis }> {
    const slowQueries: Array<{ queryHash: string; analysis: QueryAnalysis }> =
      [];

    for (const [queryHash, analysis] of this.queryMetrics.entries()) {
      if (analysis.avgExecutionTime > this.config.slowQueryThreshold) {
        slowQueries.push({ queryHash, analysis });
      }
    }

    return slowQueries.sort(
      (a, b) => b.analysis.avgExecutionTime - a.analysis.avgExecutionTime
    );
  }

  /**
   * Optimize query cache based on usage patterns
   */
  async optimizeCache(): Promise<void> {
    const analytics = this.getQueryAnalytics();
    const optimizations: string[] = [];

    for (const [queryHash, analysis] of analytics.entries()) {
      // Increase TTL for frequently accessed queries with high cache hit rate
      if (analysis.executionCount > 100 && analysis.cacheHitRate > 80) {
        const cacheKey = `query:${queryHash}`;
        // Extend TTL by 50%
        const newTTL = Math.floor(this.config.defaultTTL * 1.5);

        optimizations.push(`Extended TTL for query ${queryHash} to ${newTTL}s`);
      }

      // Suggest indexing for slow queries
      if (
        analysis.avgExecutionTime > this.config.slowQueryThreshold &&
        analysis.executionCount > 10
      ) {
        optimizations.push(
          `Consider indexing for slow query ${queryHash} (avg: ${analysis.avgExecutionTime}ms)`
        );
      }
    }

    if (optimizations.length > 0) {
      logger.info('Cache optimization suggestions', { optimizations });
    }
  }

  /**
   * Warm up cache with common queries
   */
  async warmUpCommonQueries(): Promise<void> {
    const commonQueries = [
      // User queries
      { query: 'SELECT * FROM users WHERE id = $1', params: ['1'], ttl: 300 },
      {
        query: 'SELECT * FROM users WHERE email = $1',
        params: ['test@example.com'],
        ttl: 300,
      },

      // Newsletter queries
      {
        query:
          'SELECT * FROM newsletters WHERE status = $1 ORDER BY created_at DESC LIMIT 10',
        params: ['published'],
        ttl: 600,
      },

      // Contact queries
      {
        query: 'SELECT * FROM contacts WHERE lifecycle = $1 LIMIT 100',
        params: ['lead'],
        ttl: 300,
      },
    ];

    for (const { query, params, ttl } of commonQueries) {
      try {
        await this.query(query, params, { ttl });
      } catch (error) {
        logger.warn('Failed to warm up query', { query, error });
      }
    }

    logger.info('Cache warm-up completed', {
      queryCount: commonQueries.length,
    });
  }

  private async executeQuery<T = any>(
    text: string,
    params?: any[],
    queryHash?: string,
    startTime?: number,
    useTransaction?: boolean
  ): Promise<{ rows: T[]; rowCount: number; metrics: QueryMetrics }> {
    const hash = queryHash || this.generateQueryHash(text, params);
    const start = startTime || Date.now();

    try {
      let result;

      if (useTransaction) {
        const client = await this.pool.connect();

        try {
          result = await client.query(text, params);
        } finally {
          client.release();
        }
      } else {
        result = await this.pool.query(text, params);
      }

      const executionTime = Date.now() - start;

      this.updateQueryMetrics(hash, executionTime, false);

      // Log slow queries
      if (executionTime > this.config.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          queryHash: hash,
          executionTime,
          text: text.substring(0, 100),
        });
      }

      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        metrics: {
          executionTime,
          cacheHit: false,
          queryHash: hash,
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      const executionTime = Date.now() - start;

      logger.error('Query execution error', {
        queryHash: hash,
        executionTime,
        error,
        text: text.substring(0, 100),
      });
      throw error;
    }
  }

  private generateQueryHash(text: string, params?: any[]): string {
    const normalizedQuery = text.replace(/\s+/g, ' ').trim().toLowerCase();
    const queryWithParams =
      normalizedQuery + (params ? JSON.stringify(params) : '');

    return crypto.createHash('md5').update(queryWithParams).digest('hex');
  }

  private isWriteQuery(text: string): boolean {
    const writeKeywords = [
      'INSERT',
      'UPDATE',
      'DELETE',
      'CREATE',
      'DROP',
      'ALTER',
      'TRUNCATE',
    ];
    const normalizedText = text.trim().toUpperCase();

    return writeKeywords.some(keyword => normalizedText.startsWith(keyword));
  }

  private updateQueryMetrics(
    queryHash: string,
    executionTime: number,
    cacheHit: boolean
  ): void {
    const existing = this.queryMetrics.get(queryHash);

    if (existing) {
      const totalTime =
        existing.avgExecutionTime * existing.executionCount + executionTime;
      const newCount = existing.executionCount + 1;
      const totalHits =
        existing.cacheHitRate * existing.executionCount + (cacheHit ? 1 : 0);

      existing.avgExecutionTime = totalTime / newCount;
      existing.executionCount = newCount;
      existing.cacheHitRate = (totalHits / newCount) * 100;
      existing.lastExecuted = new Date();
    } else {
      this.queryMetrics.set(queryHash, {
        avgExecutionTime: executionTime,
        executionCount: 1,
        cacheHitRate: cacheHit ? 100 : 0,
        lastExecuted: new Date(),
      });
    }
  }

  private cleanupOldMetrics(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [queryHash, analysis] of this.queryMetrics.entries()) {
      if (analysis.lastExecuted < oneWeekAgo) {
        this.queryMetrics.delete(queryHash);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up old query metrics', { count: cleanedCount });
    }
  }
}
