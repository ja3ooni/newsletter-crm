import { RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { ConnectionPoolManager, QueryResult } from './ConnectionPoolManager';

export interface CacheConfig {
  defaultTTL: number; // seconds
  keyPrefix: string;
  enableCompression: boolean;
  maxKeyLength: number;
  cacheableQueryPatterns: string[];
  nonCacheableQueryPatterns: string[];
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  avgResponseTime: number;
  cacheSize: number;
  memoryUsage: number;
}

export interface CacheInvalidationRule {
  pattern: string;
  tables: string[];
  operations: ('INSERT' | 'UPDATE' | 'DELETE')[];
}

export class RedisCacheIntegration {
  private redis: RedisClientType;
  private poolManager: ConnectionPoolManager;
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private invalidationRules: CacheInvalidationRule[];

  constructor(
    redis: RedisClientType,
    poolManager: ConnectionPoolManager,
    config: Partial<CacheConfig> = {}
  ) {
    this.redis = redis;
    this.poolManager = poolManager;
    this.config = {
      defaultTTL: 300, // 5 minutes
      keyPrefix: 'db_cache',
      enableCompression: true,
      maxKeyLength: 250,
      cacheableQueryPatterns: [
        '^SELECT.*FROM users WHERE id = \\$1$',
        '^SELECT.*FROM users WHERE email = \\$1$',
        '^SELECT.*FROM newsletters WHERE status = \\$1',
        '^SELECT.*FROM contacts WHERE user_id = \\$1',
        '^SELECT.*FROM campaigns WHERE user_id = \\$1',
      ],
      nonCacheableQueryPatterns: [
        '^INSERT',
        '^UPDATE',
        '^DELETE',
        '^CREATE',
        '^DROP',
        '^ALTER',
        'NOW\\(\\)',
        'CURRENT_TIMESTAMP',
        'RANDOM\\(\\)',
      ],
      ...config,
    };

    this.metrics = this.initializeMetrics();
    this.invalidationRules = this.setupInvalidationRules();

    logger.info('Redis cache integration initialized', {
      defaultTTL: this.config.defaultTTL,
      keyPrefix: this.config.keyPrefix,
    });
  }

  /**
   * Execute query with intelligent caching
   */
  async cachedQuery<T = any>(
    text: string,
    params?: any[],
    options?: {
      ttl?: number;
      skipCache?: boolean;
      tags?: string[];
      timeout?: number;
    }
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();

    // Skip cache for non-cacheable queries
    if (options?.skipCache || !this.isCacheable(text)) {
      const result = await this.poolManager.query<T>(text, params, {
        timeout: options?.timeout,
      });

      // Invalidate cache if this is a write operation
      if (this.isWriteOperation(text)) {
        await this.invalidateByQuery(text);
      }

      return result;
    }

    const cacheKey = this.generateCacheKey(text, params);

    try {
      // Try to get from cache first
      const cached = await this.getFromCache<QueryResult<T>>(cacheKey);

      if (cached) {
        const responseTime = Date.now() - startTime;
        this.updateMetrics('hit', responseTime);

        return {
          ...cached,
          fromCache: true,
        };
      }

      // Execute query and cache result
      const result = await this.poolManager.query<T>(text, params, {
        timeout: options?.timeout,
      });

      // Cache the result
      const ttl = options?.ttl || this.config.defaultTTL;
      await this.setInCache(cacheKey, result, ttl, options?.tags);

      const responseTime = Date.now() - startTime;
      this.updateMetrics('miss', responseTime);

      return result;
    } catch (error) {
      logger.error('Cached query error', {
        cacheKey,
        query: text.substring(0, 100),
        error,
      });
      throw error;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const fullPattern = `${this.config.keyPrefix}:${pattern}`;
      const keys = await this.redis.keys(fullPattern);

      if (keys.length > 0) {
        await this.redis.del(keys);
        this.metrics.deletes += keys.length;

        logger.info('Cache invalidated by pattern', {
          pattern: fullPattern,
          keysDeleted: keys.length,
        });
      }

      return keys.length;
    } catch (error) {
      logger.error('Cache pattern invalidation error', { pattern, error });
      throw error;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let totalDeleted = 0;

    try {
      for (const tag of tags) {
        const tagKey = `${this.config.keyPrefix}:tag:${tag}`;
        const taggedKeys = await this.redis.sMembers(tagKey);

        if (taggedKeys.length > 0) {
          await this.redis.del(taggedKeys);
          await this.redis.del(tagKey);
          totalDeleted += taggedKeys.length;
        }
      }

      this.metrics.deletes += totalDeleted;

      logger.info('Cache invalidated by tags', {
        tags,
        keysDeleted: totalDeleted,
      });

      return totalDeleted;
    } catch (error) {
      logger.error('Cache tag invalidation error', { tags, error });
      throw error;
    }
  }

  /**
   * Invalidate cache based on table operations
   */
  async invalidateByTable(
    tableName: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
  ): Promise<void> {
    const applicableRules = this.invalidationRules.filter(
      rule =>
        rule.tables.includes(tableName) && rule.operations.includes(operation)
    );

    for (const rule of applicableRules) {
      await this.invalidateByPattern(rule.pattern);
    }

    // Also invalidate by table tag
    await this.invalidateByTags([`table:${tableName}`]);
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(
    warmUpQueries: Array<{
      text: string;
      params?: any[];
      ttl?: number;
      tags?: string[];
    }>
  ): Promise<void> {
    logger.info('Starting cache warm-up', { queryCount: warmUpQueries.length });

    for (const query of warmUpQueries) {
      try {
        await this.cachedQuery(query.text, query.params, {
          ttl: query.ttl,
          tags: query.tags,
        });
      } catch (error) {
        logger.warn('Failed to warm up query', {
          query: query.text.substring(0, 100),
          error,
        });
      }
    }

    logger.info('Cache warm-up completed');
  }

  /**
   * Get cache statistics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      const pattern = `${this.config.keyPrefix}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(keys);
        this.metrics.deletes += keys.length;
      }

      logger.info('Cache cleared', { keysDeleted: keys.length });
    } catch (error) {
      logger.error('Cache clear error', error);
      throw error;
    }
  }

  /**
   * Optimize cache performance
   */
  async optimizeCache(): Promise<{
    expiredKeysRemoved: number;
    memoryFreed: number;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    let expiredKeysRemoved = 0;

    try {
      // Get cache statistics
      const info = await this.redis.info('memory');
      const memoryUsage = this.parseMemoryInfo(info);

      // Check hit rate
      if (this.metrics.hitRate < 70) {
        recommendations.push(
          'Consider increasing TTL for frequently accessed queries'
        );
        recommendations.push(
          'Review caching patterns and add more cacheable queries'
        );
      }

      // Check memory usage
      if (memoryUsage.usedMemory > memoryUsage.maxMemory * 0.8) {
        recommendations.push(
          'Consider increasing Redis memory limit or reducing TTL'
        );
      }

      // Analyze query patterns
      const slowQueries = await this.identifySlowCacheableQueries();
      if (slowQueries.length > 0) {
        recommendations.push(
          `Consider caching ${slowQueries.length} slow queries`
        );
      }

      logger.info('Cache optimization completed', {
        expiredKeysRemoved,
        recommendations,
        hitRate: this.metrics.hitRate,
      });

      return {
        expiredKeysRemoved,
        memoryFreed: 0, // Redis handles this automatically
        recommendations,
      };
    } catch (error) {
      logger.error('Cache optimization error', error);
      throw error;
    }
  }

  /**
   * Health check for cache system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - start;

      const metrics = this.getMetrics();

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (responseTime > 1000 || metrics.hitRate < 30) {
        status = 'unhealthy';
      } else if (responseTime > 500 || metrics.hitRate < 50) {
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

  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);

      if (value) {
        return JSON.parse(value);
      }

      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  private async setInCache<T>(
    key: string,
    value: T,
    ttl: number,
    tags?: string[]
  ): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);

      await this.redis.setEx(key, ttl, serializedValue);
      this.metrics.sets++;

      // Add to tag sets if tags are provided
      if (tags) {
        for (const tag of tags) {
          const tagKey = `${this.config.keyPrefix}:tag:${tag}`;
          await this.redis.sAdd(tagKey, key);
          await this.redis.expire(tagKey, ttl + 60); // Tag expires slightly after data
        }
      }
    } catch (error) {
      logger.error('Cache set error', { key, error });
      throw error;
    }
  }

  private generateCacheKey(text: string, params?: any[]): string {
    const normalizedQuery = text.replace(/\s+/g, ' ').trim();
    const paramsStr = params ? JSON.stringify(params) : '';
    const keyContent = `${normalizedQuery}:${paramsStr}`;

    // Hash long keys to avoid Redis key length limits
    if (keyContent.length > this.config.maxKeyLength) {
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(keyContent).digest('hex');
      return `${this.config.keyPrefix}:${hash}`;
    }

    return `${this.config.keyPrefix}:${keyContent}`;
  }

  private isCacheable(query: string): boolean {
    const normalizedQuery = query.trim().toUpperCase();

    // Check non-cacheable patterns first
    for (const pattern of this.config.nonCacheableQueryPatterns) {
      if (new RegExp(pattern, 'i').test(normalizedQuery)) {
        return false;
      }
    }

    // Check cacheable patterns
    for (const pattern of this.config.cacheableQueryPatterns) {
      if (new RegExp(pattern, 'i').test(normalizedQuery)) {
        return true;
      }
    }

    // Default: cache SELECT queries without non-deterministic functions
    return normalizedQuery.startsWith('SELECT');
  }

  private isWriteOperation(query: string): boolean {
    const writeOperations = [
      'INSERT',
      'UPDATE',
      'DELETE',
      'CREATE',
      'DROP',
      'ALTER',
      'TRUNCATE',
    ];
    const normalizedQuery = query.trim().toUpperCase();

    return writeOperations.some(op => normalizedQuery.startsWith(op));
  }

  private async invalidateByQuery(query: string): Promise<void> {
    const normalizedQuery = query.trim().toUpperCase();

    // Extract table name from query
    const tableMatch = normalizedQuery.match(
      /(?:FROM|INTO|UPDATE|JOIN)\s+(\w+)/i
    );
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase();

      let operation: 'INSERT' | 'UPDATE' | 'DELETE' = 'UPDATE';
      if (normalizedQuery.startsWith('INSERT')) operation = 'INSERT';
      else if (normalizedQuery.startsWith('DELETE')) operation = 'DELETE';

      await this.invalidateByTable(tableName, operation);
    }
  }

  private setupInvalidationRules(): CacheInvalidationRule[] {
    return [
      {
        pattern: '*users*',
        tables: ['users'],
        operations: ['INSERT', 'UPDATE', 'DELETE'],
      },
      {
        pattern: '*newsletters*',
        tables: ['newsletters'],
        operations: ['INSERT', 'UPDATE', 'DELETE'],
      },
      {
        pattern: '*contacts*',
        tables: ['contacts'],
        operations: ['INSERT', 'UPDATE', 'DELETE'],
      },
      {
        pattern: '*campaigns*',
        tables: ['campaigns'],
        operations: ['INSERT', 'UPDATE', 'DELETE'],
      },
      {
        pattern: '*email_deliveries*',
        tables: ['email_deliveries'],
        operations: ['INSERT', 'UPDATE', 'DELETE'],
      },
    ];
  }

  private updateMetrics(type: 'hit' | 'miss', responseTime: number): void {
    if (type === 'hit') {
      this.metrics.hits++;
    } else {
      this.metrics.misses++;
    }

    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    // Update average response time (exponential moving average)
    const alpha = 0.1;
    this.metrics.avgResponseTime =
      this.metrics.avgResponseTime * (1 - alpha) + responseTime * alpha;
  }

  private parseMemoryInfo(info: string): {
    usedMemory: number;
    maxMemory: number;
  } {
    const usedMatch = info.match(/used_memory:(\d+)/);
    const maxMatch = info.match(/maxmemory:(\d+)/);

    return {
      usedMemory: usedMatch ? parseInt(usedMatch[1]) : 0,
      maxMemory: maxMatch ? parseInt(maxMatch[1]) : 0,
    };
  }

  private async identifySlowCacheableQueries(): Promise<string[]> {
    // This would integrate with query performance monitoring
    // For now, return empty array
    return [];
  }

  private initializeMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      avgResponseTime: 0,
      cacheSize: 0,
      memoryUsage: 0,
    };
  }
}
