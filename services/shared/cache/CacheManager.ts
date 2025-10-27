import { RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export interface CacheConfig {
  defaultTTL: number;
  keyPrefix: string;
  enableCompression: boolean;
  maxMemoryUsage: number; // in MB
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  compressed?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  memoryUsage: number;
}

export class CacheManager {
  private redis: RedisClientType;
  private config: CacheConfig;
  private stats: CacheStats;
  private memoryCache: Map<string, CacheEntry<any>>;
  private memoryUsage: number = 0;

  constructor(redis: RedisClientType, config: CacheConfig) {
    this.redis = redis;
    this.config = config;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      memoryUsage: 0,
    };
    this.memoryCache = new Map();

    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanupExpiredEntries(), 5 * 60 * 1000);
  }

  /**
   * Get value from cache with multi-level fallback
   * 1. Memory cache (L1)
   * 2. Redis cache (L2)
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);

    try {
      // L1: Check memory cache first
      const memoryEntry = this.memoryCache.get(fullKey);

      if (memoryEntry && !this.isExpired(memoryEntry)) {
        this.stats.hits++;
        this.updateHitRate();
        logger.debug('Cache hit (memory)', { key: fullKey });

        return memoryEntry.data;
      }

      // L2: Check Redis cache
      const redisValue = await this.redis.get(fullKey);

      if (redisValue) {
        const parsedValue = JSON.parse(redisValue);

        // Store in memory cache for faster access
        this.setMemoryCache(fullKey, parsedValue, this.config.defaultTTL);

        this.stats.hits++;
        this.updateHitRate();
        logger.debug('Cache hit (redis)', { key: fullKey });

        return parsedValue;
      }

      // Cache miss
      this.stats.misses++;
      this.updateHitRate();
      logger.debug('Cache miss', { key: fullKey });

      return null;
    } catch (error) {
      logger.error(
        'Cache get error',
        error instanceof Error ? error : new Error(String(error)),
        { key: fullKey }
      );
      this.stats.misses++;
      this.updateHitRate();

      return null;
    }
  }

  /**
   * Set value in both memory and Redis cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const cacheTTL = ttl || this.config.defaultTTL;

    try {
      // Set in Redis (L2)
      const serializedValue = JSON.stringify(value);

      await this.redis.setEx(fullKey, cacheTTL, serializedValue);

      // Set in memory cache (L1)
      this.setMemoryCache(fullKey, value, cacheTTL);

      this.stats.sets++;
      logger.debug('Cache set', { key: fullKey, ttl: cacheTTL });
    } catch (error) {
      logger.error(
        'Cache set error',
        error instanceof Error ? error : new Error(String(error)),
        { key: fullKey }
      );
      throw error;
    }
  }

  /**
   * Delete from both caches
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    try {
      // Delete from Redis
      await this.redis.del(fullKey);

      // Delete from memory cache
      this.memoryCache.delete(fullKey);

      this.stats.deletes++;
      logger.debug('Cache delete', { key: fullKey });
    } catch (error) {
      logger.error(
        'Cache delete error',
        error instanceof Error ? error : new Error(String(error)),
        { key: fullKey }
      );
      throw error;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await fetchFunction();

    await this.set(key, value, ttl);

    return value;
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const fullPattern = this.getFullKey(pattern);

      // Get all keys matching pattern from Redis
      const keys = await this.redis.keys(fullPattern);

      if (keys.length > 0) {
        // Delete from Redis
        await this.redis.del(keys);

        // Delete from memory cache
        for (const key of keys) {
          this.memoryCache.delete(key);
        }

        logger.info('Cache pattern invalidated', {
          pattern: fullPattern,
          keysDeleted: keys.length,
        });
      }
    } catch (error) {
      logger.error(
        'Cache pattern invalidation error',
        error instanceof Error ? error : new Error(String(error)),
        { pattern }
      );
      throw error;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const taggedKeys = await this.redis.sMembers(tagKey);

        if (taggedKeys.length > 0) {
          // Delete tagged keys
          await this.redis.del(taggedKeys);

          // Remove from memory cache
          for (const key of taggedKeys) {
            this.memoryCache.delete(key);
          }

          // Clean up tag set
          await this.redis.del(tagKey);
        }
      }

      logger.info('Cache invalidated by tags', { tags });
    } catch (error) {
      logger.error(
        'Cache tag invalidation error',
        error instanceof Error ? error : new Error(String(error)),
        { tags }
      );
      throw error;
    }
  }

  /**
   * Set cache with tags for intelligent invalidation
   */
  async setWithTags<T>(
    key: string,
    value: T,
    tags: string[],
    ttl?: number
  ): Promise<void> {
    await this.set(key, value, ttl);

    // Add key to tag sets
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;

      await this.redis.sAdd(tagKey, this.getFullKey(key));
      await this.redis.expire(tagKey, (ttl || this.config.defaultTTL) + 60); // Tag expires slightly after data
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(
    warmUpFunction: () => Promise<
      Array<{ key: string; value: any; ttl?: number }>
    >
  ): Promise<void> {
    try {
      const data = await warmUpFunction();

      for (const item of data) {
        await this.set(item.key, item.value, item.ttl);
      }

      logger.info('Cache warmed up', { itemCount: data.length });
    } catch (error) {
      logger.error(
        'Cache warm up error',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.stats.memoryUsage = this.memoryUsage;

    return { ...this.stats };
  }

  /**
   * Clear all cache data
   */
  async clear(): Promise<void> {
    try {
      // Clear Redis keys with our prefix
      const keys = await this.redis.keys(`${this.config.keyPrefix}:*`);

      if (keys.length > 0) {
        await this.redis.del(keys);
      }

      // Clear memory cache
      this.memoryCache.clear();
      this.memoryUsage = 0;

      logger.info('Cache cleared');
    } catch (error) {
      logger.error(
        'Cache clear error',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Optimize cache performance by cleaning up expired entries and managing memory
   */
  async optimizeCache(): Promise<{
    expiredEntriesRemoved: number;
    memoryFreed: number;
    lruEvictionsPerformed: boolean;
  }> {
    try {
      const initialMemoryUsage = this.memoryUsage;
      const initialCacheSize = this.memoryCache.size;

      // Clean up expired entries
      this.cleanupExpiredEntries();

      const expiredEntriesRemoved = initialCacheSize - this.memoryCache.size;
      let lruEvictionsPerformed = false;

      // Perform LRU eviction if memory usage is still high
      if (this.memoryUsage > this.config.maxMemoryUsage * 1024 * 1024 * 0.8) {
        this.evictLRU();
        lruEvictionsPerformed = true;
      }

      const memoryFreed = initialMemoryUsage - this.memoryUsage;

      logger.info('Cache optimization completed', {
        expiredEntriesRemoved,
        memoryFreed,
        lruEvictionsPerformed,
        finalMemoryUsage: this.memoryUsage,
        finalCacheSize: this.memoryCache.size,
      });

      return {
        expiredEntriesRemoved,
        memoryFreed,
        lruEvictionsPerformed,
      };
    } catch (error) {
      logger.error(
        'Cache optimization error',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const start = Date.now();

      await this.redis.ping();
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        details: {
          responseTime,
          memoryUsage: this.memoryUsage,
          memoryCacheSize: this.memoryCache.size,
          stats: this.getStats(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          memoryUsage: this.memoryUsage,
          memoryCacheSize: this.memoryCache.size,
        },
      };
    }
  }

  private getFullKey(key: string): string {
    return `${this.config.keyPrefix}:${key}`;
  }

  private setMemoryCache<T>(key: string, value: T, ttl: number): void {
    // Check memory usage limit
    if (this.memoryUsage > this.config.maxMemoryUsage * 1024 * 1024) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl * 1000, // Convert to milliseconds
    };

    this.memoryCache.set(key, entry);
    this.memoryUsage += this.estimateSize(value);
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    const entries = Array.from(this.memoryCache.entries());

    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        this.memoryUsage -= this.estimateSize(entry.data);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up expired cache entries', { count: cleanedCount });
    }
  }

  private evictLRU(): void {
    // Simple LRU eviction - remove oldest entries
    const entries = Array.from(this.memoryCache.entries());

    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toEvict = Math.ceil(entries.length * 0.1); // Evict 10% of entries

    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const entryPair = entries[i];

      if (entryPair) {
        const [key, entry] = entryPair;

        this.memoryCache.delete(key);
        this.memoryUsage -= this.estimateSize(entry.data);
      }
    }

    logger.debug('LRU eviction completed', { evicted: toEvict });
  }

  private estimateSize(obj: unknown): number {
    // Rough estimation of object size in bytes
    return JSON.stringify(obj).length * 2; // Approximate UTF-16 encoding
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;

    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
}
