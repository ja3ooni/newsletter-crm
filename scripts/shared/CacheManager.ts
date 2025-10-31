/**
 * Simple Cache Manager for Developer Tools
 *
 * Provides basic caching functionality to improve performance
 */

import { log } from './Logger';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

export class CacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private static instance: CacheManager;

  private constructor() {
    // Setup cleanup interval
    setInterval(() => this.cleanup(), 60000); // Clean every minute
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }

    return CacheManager.instance;
  }

  public async get<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs: number = 300000 // 5 minutes default
  ): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();

    // Return cached value if still valid
    if (entry && now - entry.timestamp < entry.ttl) {
      log.debug(`Cache hit for key: ${key}`);

      return entry.value as T;
    }

    // Generate new value
    log.debug(`Cache miss for key: ${key}, generating new value`);
    const startTime = Date.now();

    try {
      const value = await factory();

      // Store in cache
      this.cache.set(key, {
        value,
        timestamp: now,
        ttl: ttlMs,
      });

      const duration = Date.now() - startTime;

      log.debug(`Cached value generated for key: ${key} in ${duration}ms`);

      return value;
    } catch (error) {
      log.error(`Failed to generate cached value for key: ${key}`, { error });
      throw error;
    }
  }

  public clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
      log.debug(`Cleared cache for key: ${key}`);
    } else {
      this.cache.clear();
      log.debug('Cleared all cache');
    }
  }

  public getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }
}

export const cacheManager = CacheManager.getInstance();
