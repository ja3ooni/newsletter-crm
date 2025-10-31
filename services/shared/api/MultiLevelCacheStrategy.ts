import { NextFunction, Request, Response } from 'express';
import { RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export interface CacheLevel {
  name: string;
  ttl: number;
  enabled: boolean;
  priority: number;
}

export interface CacheStrategy {
  levels: CacheLevel[];
  keyGenerator: (req: Request) => string;
  shouldCache: (req: Request, res: Response) => boolean;
  varyBy?: string[];
  tags?: string[];
}

export interface CacheEntry {
  data: any;
  headers: Record<string, string>;
  statusCode: number;
  timestamp: number;
  ttl: number;
  level: string;
}

export interface CacheMetrics {
  l1Hits: number; // Memory cache
  l2Hits: number; // Redis cache
  l3Hits: number; // CDN cache
  misses: number;
  sets: number;
  invalidations: number;
  totalRequests: number;
  avgResponseTime: number;
  hitRateByLevel: Record<string, number>;
}

export class MultiLevelCacheStrategy {
  private memoryCache: Map<string, CacheEntry>;
  private redis: RedisClientType;
  private config: {
    maxMemoryCacheSize: number;
    memoryTTL: number;
    redisTTL: number;
    cdnTTL: number;
    enableMemoryCache: boolean;
    enableRedisCache: boolean;
    enableCDNCache: boolean;
  };
  private metrics: CacheMetrics;

  constructor(
    redis: RedisClientType,
    config: Partial<{
      maxMemoryCacheSize: number;
      memoryTTL: number;
      redisTTL: number;
      cdnTTL: number;
      enableMemoryCache: boolean;
      enableRedisCache: boolean;
      enableCDNCache: boolean;
    }> = {}
  ) {
    this.redis = redis;
    this.memoryCache = new Map();
    this.config = {
      maxMemoryCacheSize: 1000,
      memoryTTL: 60, // 1 minute
      redisTTL: 300, // 5 minutes
      cdnTTL: 3600, // 1 hour
      enableMemoryCache: true,
      enableRedisCache: true,
      enableCDNCache: true,
      ...config,
    };

    this.metrics = this.initializeMetrics();

    // Cleanup expired memory cache entries every minute
    setInterval(() => this.cleanupMemoryCache(), 60000);

    logger.info('Multi-level cache strategy initialized', {
      memoryCache: this.config.enableMemoryCache,
      redisCache: this.config.enableRedisCache,
      cdnCache: this.config.enableCDNCache,
    });
  }

  /**
   * Create caching middleware with multi-level strategy
   */
  createCacheMiddleware(strategy: CacheStrategy) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      this.metrics.totalRequests++;

      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Check if response should be cached
      if (!strategy.shouldCache(req, res)) {
        return next();
      }

      const cacheKey = strategy.keyGenerator(req);

      try {
        // Try to get from cache (L1 -> L2 -> L3)
        const cached = await this.getFromCache(cacheKey);

        if (cached) {
          const responseTime = Date.now() - startTime;

          this.updateMetrics(cached.level, responseTime, true);

          // Set cache headers
          res.set(cached.headers);
          res.set('X-Cache-Hit', 'true');
          res.set('X-Cache-Level', cached.level);

          return res.status(cached.statusCode).send(cached.data);
        }

        // Cache miss - intercept response to cache it
        const originalSend = res.send;
        const originalJson = res.json;

        const self = this;

        res.send = function (body: any) {
          self.cacheResponse(cacheKey, body, this, strategy);

          return originalSend.call(this, body);
        };

        res.json = function (obj: any) {
          self.cacheResponse(cacheKey, obj, this, strategy);

          return originalJson.call(this, obj);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error', { cacheKey, error });
        next();
      }
    };
  }

  /**
   * Get data from multi-level cache
   */
  private async getFromCache(key: string): Promise<CacheEntry | null> {
    // L1: Memory cache
    if (this.config.enableMemoryCache) {
      const memoryEntry = this.memoryCache.get(key);

      if (memoryEntry && !this.isExpired(memoryEntry)) {
        this.metrics.l1Hits++;
        logger.debug('Cache hit (L1 - Memory)', { key });

        return memoryEntry;
      }
    }

    // L2: Redis cache
    if (this.config.enableRedisCache) {
      try {
        const redisValue = await this.redis.get(`cache:${key}`);

        if (redisValue) {
          const entry: CacheEntry = JSON.parse(redisValue);

          // Store in L1 for faster access
          if (this.config.enableMemoryCache) {
            this.setMemoryCache(key, entry);
          }

          this.metrics.l2Hits++;
          logger.debug('Cache hit (L2 - Redis)', { key });

          return entry;
        }
      } catch (error) {
        logger.error('Redis cache get error', { key, error });
      }
    }

    // L3: CDN cache (handled by CDN headers, not directly accessible)
    // This would be a cache miss that gets handled by CDN on subsequent requests

    this.metrics.misses++;
    logger.debug('Cache miss (all levels)', { key });

    return null;
  }

  /**
   * Cache response in multiple levels
   */
  private async cacheResponse(
    key: string,
    data: any,
    res: Response,
    strategy: CacheStrategy
  ): Promise<void> {
    try {
      const entry: CacheEntry = {
        data,
        headers: this.extractCacheableHeaders(res),
        statusCode: res.statusCode,
        timestamp: Date.now(),
        ttl: this.config.redisTTL,
        level: 'set',
      };

      // L1: Memory cache
      if (this.config.enableMemoryCache) {
        this.setMemoryCache(key, { ...entry, ttl: this.config.memoryTTL });
      }

      // L2: Redis cache
      if (this.config.enableRedisCache) {
        await this.redis.setEx(
          `cache:${key}`,
          this.config.redisTTL,
          JSON.stringify(entry)
        );

        // Add to tag sets for invalidation
        if (strategy.tags) {
          for (const tag of strategy.tags) {
            await this.redis.sAdd(`cache:tag:${tag}`, key);
            await this.redis.expire(
              `cache:tag:${tag}`,
              this.config.redisTTL + 60
            );
          }
        }
      }

      // L3: CDN cache (set headers for CDN)
      if (this.config.enableCDNCache) {
        res.set({
          'Cache-Control': `public, max-age=${this.config.cdnTTL}`,
          Vary: strategy.varyBy?.join(', ') || 'Accept-Encoding',
          'X-Cache-Level': 'L3-CDN',
        });
      }

      this.metrics.sets++;
      logger.debug('Response cached in multiple levels', { key });
    } catch (error) {
      logger.error('Cache set error', { key, error });
    }
  }

  /**
   * Invalidate cache by key
   */
  async invalidateByKey(key: string): Promise<void> {
    try {
      // L1: Memory cache
      this.memoryCache.delete(key);

      // L2: Redis cache
      await this.redis.del(`cache:${key}`);

      this.metrics.invalidations++;
      logger.debug('Cache invalidated by key', { key });
    } catch (error) {
      logger.error('Cache invalidation error', { key, error });
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    let invalidated = 0;

    try {
      // L1: Memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.includes(pattern)) {
          this.memoryCache.delete(key);
          invalidated++;
        }
      }

      // L2: Redis cache
      const keys = await this.redis.keys(`cache:*${pattern}*`);

      if (keys.length > 0) {
        await this.redis.del(keys);
        invalidated += keys.length;
      }

      this.metrics.invalidations += invalidated;
      logger.info('Cache invalidated by pattern', { pattern, invalidated });
    } catch (error) {
      logger.error('Cache pattern invalidation error', { pattern, error });
    }

    return invalidated;
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;

    try {
      for (const tag of tags) {
        const tagKey = `cache:tag:${tag}`;
        const keys = await this.redis.sMembers(tagKey);

        if (keys.length > 0) {
          // Remove from memory cache
          for (const key of keys) {
            this.memoryCache.delete(key);
          }

          // Remove from Redis cache
          const fullKeys = keys.map(key => `cache:${key}`);

          await this.redis.del(fullKeys);
          await this.redis.del(tagKey);

          invalidated += keys.length;
        }
      }

      this.metrics.invalidations += invalidated;
      logger.info('Cache invalidated by tags', { tags, invalidated });
    } catch (error) {
      logger.error('Cache tag invalidation error', { tags, error });
    }

    return invalidated;
  }

  /**
   * Warm up cache with predefined data
   */
  async warmUpCache(
    warmUpData: Array<{
      key: string;
      data: any;
      headers?: Record<string, string>;
      statusCode?: number;
      tags?: string[];
    }>
  ): Promise<void> {
    logger.info('Starting cache warm-up', { itemCount: warmUpData.length });

    for (const item of warmUpData) {
      try {
        const entry: CacheEntry = {
          data: item.data,
          headers: item.headers || {},
          statusCode: item.statusCode || 200,
          timestamp: Date.now(),
          ttl: this.config.redisTTL,
          level: 'warmup',
        };

        // Store in all cache levels
        if (this.config.enableMemoryCache) {
          this.setMemoryCache(item.key, entry);
        }

        if (this.config.enableRedisCache) {
          await this.redis.setEx(
            `cache:${item.key}`,
            this.config.redisTTL,
            JSON.stringify(entry)
          );

          // Add tags
          if (item.tags) {
            for (const tag of item.tags) {
              await this.redis.sAdd(`cache:tag:${tag}`, item.key);
              await this.redis.expire(
                `cache:tag:${tag}`,
                this.config.redisTTL + 60
              );
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to warm up cache item', { key: item.key, error });
      }
    }

    logger.info('Cache warm-up completed');
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateHitRates();

    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memoryCache: { size: number; maxSize: number };
    redisCache: { connected: boolean };
    hitRates: Record<string, number>;
    performance: { avgResponseTime: number };
  } {
    return {
      memoryCache: {
        size: this.memoryCache.size,
        maxSize: this.config.maxMemoryCacheSize,
      },
      redisCache: {
        connected: this.redis.isReady,
      },
      hitRates: this.metrics.hitRateByLevel,
      performance: {
        avgResponseTime: this.metrics.avgResponseTime,
      },
    };
  }

  /**
   * Optimize cache performance
   */
  async optimizeCache(): Promise<{
    memoryOptimized: boolean;
    redisOptimized: boolean;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    let memoryOptimized = false;
    const redisOptimized = false;

    // Optimize memory cache
    if (this.memoryCache.size > this.config.maxMemoryCacheSize * 0.8) {
      this.evictLRU();
      memoryOptimized = true;
      recommendations.push('Performed LRU eviction on memory cache');
    }

    // Analyze hit rates
    const metrics = this.getMetrics();

    if (metrics.hitRateByLevel.L1 < 30) {
      recommendations.push('Consider increasing memory cache size or TTL');
    }

    if (metrics.hitRateByLevel.L2 < 50) {
      recommendations.push(
        'Consider increasing Redis cache TTL or optimizing cache keys'
      );
    }

    if (metrics.avgResponseTime > 100) {
      recommendations.push(
        'Consider implementing more aggressive caching strategies'
      );
    }

    logger.info('Cache optimization completed', {
      memoryOptimized,
      redisOptimized,
      recommendations,
    });

    return { memoryOptimized, redisOptimized, recommendations };
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

      // Test Redis connection
      await this.redis.ping();
      const redisResponseTime = Date.now() - start;

      const metrics = this.getMetrics();
      const stats = this.getCacheStats();

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (
        !stats.redisCache.connected ||
        redisResponseTime > 1000 ||
        metrics.hitRateByLevel.L1 + metrics.hitRateByLevel.L2 < 30
      ) {
        status = 'unhealthy';
      } else if (
        redisResponseTime > 500 ||
        metrics.hitRateByLevel.L1 + metrics.hitRateByLevel.L2 < 50
      ) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          redisResponseTime,
          metrics,
          stats,
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

  private setMemoryCache(key: string, entry: CacheEntry): void {
    // Check size limit
    if (this.memoryCache.size >= this.config.maxMemoryCacheSize) {
      this.evictLRU();
    }

    this.memoryCache.set(key, entry);
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl * 1000;
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up expired memory cache entries', {
        count: cleaned,
      });
    }
  }

  private evictLRU(): void {
    const entries = Array.from(this.memoryCache.entries());

    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toEvict = Math.ceil(entries.length * 0.1); // Evict 10%

    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const [key] = entries[i];

      this.memoryCache.delete(key);
    }

    logger.debug('LRU eviction completed', { evicted: toEvict });
  }

  private extractCacheableHeaders(res: Response): Record<string, string> {
    const cacheableHeaders = [
      'content-type',
      'content-encoding',
      'content-length',
      'etag',
      'last-modified',
    ];

    const headers: Record<string, string> = {};

    for (const header of cacheableHeaders) {
      const value = res.getHeader(header);

      if (value) {
        headers[header] = String(value);
      }
    }

    return headers;
  }

  private updateMetrics(
    level: string,
    responseTime: number,
    isHit: boolean
  ): void {
    // Update average response time
    const alpha = 0.1;

    this.metrics.avgResponseTime =
      this.metrics.avgResponseTime * (1 - alpha) + responseTime * alpha;
  }

  private updateHitRates(): void {
    const total =
      this.metrics.l1Hits +
      this.metrics.l2Hits +
      this.metrics.l3Hits +
      this.metrics.misses;

    if (total > 0) {
      this.metrics.hitRateByLevel = {
        L1: (this.metrics.l1Hits / total) * 100,
        L2: (this.metrics.l2Hits / total) * 100,
        L3: (this.metrics.l3Hits / total) * 100,
        Overall:
          ((this.metrics.l1Hits + this.metrics.l2Hits + this.metrics.l3Hits) /
            total) *
          100,
      };
    }
  }

  private initializeMetrics(): CacheMetrics {
    return {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      totalRequests: 0,
      avgResponseTime: 0,
      hitRateByLevel: {
        L1: 0,
        L2: 0,
        L3: 0,
        Overall: 0,
      },
    };
  }
}
