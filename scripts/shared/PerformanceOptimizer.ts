/**
 * Performance Optimizer for Developer Tools
 *
 * Provides caching, parallel execution, progress tracking, and timeout handling
 * to optimize the performance of developer tools operations.
 */

import { EventEmitter } from 'events';
import { log } from './Logger';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

export interface ProgressOptions {
  total: number;
  current: number;
  message?: string;
  showPercentage?: boolean;
  showETA?: boolean;
}

export interface TimeoutOptions {
  timeout: number;
  message?: string;
  onTimeout?: () => void;
}

export interface ParallelExecutionOptions {
  maxConcurrency?: number;
  failFast?: boolean;
  progressCallback?: (completed: number, total: number) => void;
}

export class PerformanceOptimizer extends EventEmitter {
  private cache = new Map<string, CacheEntry<unknown>>();
  private progressBars = new Map<string, ProgressTracker>();
  private static instance: PerformanceOptimizer;

  private constructor() {
    super();
    this.setupCleanupInterval();
  }

  public static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * Cache management
   */
  public async cached<T>(
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

  /**
   * Clear cache entry or all cache
   */
  public clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
      log.debug(`Cleared cache for key: ${key}`);
    } else {
      this.cache.clear();
      log.debug('Cleared all cache');
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: string[]; hitRate?: number } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Progress tracking
   */
  public createProgressTracker(
    id: string,
    total: number,
    message?: string
  ): ProgressTracker {
    const tracker = new ProgressTracker(id, total, message);
    this.progressBars.set(id, tracker);
    return tracker;
  }

  public getProgressTracker(id: string): ProgressTracker | undefined {
    return this.progressBars.get(id);
  }

  public removeProgressTracker(id: string): void {
    const tracker = this.progressBars.get(id);
    if (tracker) {
      tracker.complete();
      this.progressBars.delete(id);
    }
  }

  /**
   * Timeout wrapper
   */
  public async withTimeout<T>(
    operation: () => Promise<T>,
    options: TimeoutOptions
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const message =
          options.message || `Operation timed out after ${options.timeout}ms`;
        log.warning(message);

        if (options.onTimeout) {
          options.onTimeout();
        }

        reject(new Error(message));
      }, options.timeout);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Parallel execution with concurrency control
   */
  public async executeInParallel<T, R>(
    items: T[],
    operation: (item: T, index: number) => Promise<R>,
    options: ParallelExecutionOptions = {}
  ): Promise<(R | undefined)[]> {
    const { maxConcurrency = 5, failFast = false, progressCallback } = options;

    const results: (R | undefined)[] = new Array(items.length);
    const errors: Error[] = [];
    let completed = 0;
    let running = 0;
    let index = 0;

    return new Promise<(R | undefined)[]>((resolve, reject) => {
      const processNext = () => {
        while (running < maxConcurrency && index < items.length) {
          const currentIndex = index++;
          const item = items[currentIndex];
          running++;

          operation(item, currentIndex)
            .then(result => {
              results[currentIndex] = result;
              completed++;
              running--;

              if (progressCallback) {
                progressCallback(completed, items.length);
              }

              if (completed === items.length) {
                if (errors.length > 0 && failFast) {
                  reject(errors[0]);
                } else {
                  resolve(results);
                }
              } else {
                processNext();
              }
            })
            .catch(error => {
              errors.push(error);
              results[currentIndex] = undefined;
              completed++;
              running--;

              if (failFast) {
                reject(error);
                return;
              }

              if (progressCallback) {
                progressCallback(completed, items.length);
              }

              if (completed === items.length) {
                resolve(results);
              } else {
                processNext();
              }
            });
        }
      };

      if (items.length === 0) {
        resolve([]);
        return;
      }

      processNext();
    });
  }

  /**
   * Batch operations with size control
   */
  public async executeBatched<T, R>(
    items: T[],
    operation: (batch: T[]) => Promise<R[]>,
    batchSize: number = 10
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await operation(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Debounced execution
   */
  private debouncedOperations = new Map<string, NodeJS.Timeout>();

  public debounce<T extends unknown[]>(
    key: string,
    operation: (...args: T) => Promise<void>,
    delayMs: number = 1000
  ): (...args: T) => void {
    return (...args: T) => {
      // Clear existing timeout
      const existingTimeout = this.debouncedOperations.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout
      const timeoutId = setTimeout(() => {
        this.debouncedOperations.delete(key);
        operation(...args).catch(error => {
          log.error(`Debounced operation failed for key: ${key}`, { error });
        });
      }, delayMs);

      this.debouncedOperations.set(key, timeoutId);
    };
  }

  /**
   * Memory usage monitoring
   */
  public getMemoryUsage(): NodeJS.MemoryUsage & { cacheSize: number } {
    const memUsage = process.memoryUsage();
    const cacheSize = this.calculateCacheSize();

    return {
      ...memUsage,
      cacheSize,
    };
  }

  private calculateCacheSize(): number {
    let size = 0;
    for (const entry of this.cache.values()) {
      // Rough estimation of cache entry size
      size += JSON.stringify(entry.value).length * 2; // UTF-16 encoding
    }
    return size;
  }

  /**
   * Performance measurement
   */
  public async measurePerformance<T>(
    operation: () => Promise<T>,
    label?: string
  ): Promise<{ result: T; duration: number; memoryDelta: number }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      const memoryDelta = process.memoryUsage().heapUsed - startMemory;

      if (label) {
        log.debug(`Performance measurement for ${label}:`, {
          duration: `${duration}ms`,
          memoryDelta: `${Math.round(memoryDelta / 1024)}KB`,
        });
      }

      return { result, duration, memoryDelta };
    } catch (error) {
      const duration = Date.now() - startTime;
      const memoryDelta = process.memoryUsage().heapUsed - startMemory;

      if (label) {
        log.error(`Performance measurement for ${label} failed:`, {
          duration: `${duration}ms`,
          memoryDelta: `${Math.round(memoryDelta / 1024)}KB`,
          error,
        });
      }

      throw error;
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private setupCleanupInterval(): void {
    setInterval(() => {
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
    }, 60000); // Clean every minute
  }
}

export class ProgressTracker {
  private startTime: number;
  private lastUpdate: number;
  private current: number = 0;
  private completed: boolean = false;

  constructor(
    public readonly id: string,
    public readonly total: number,
    public readonly message?: string
  ) {
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
    this.displayProgress();
  }

  public update(current: number, message?: string): void {
    if (this.completed) return;

    this.current = Math.min(current, this.total);
    this.lastUpdate = Date.now();

    if (message) {
      (this as { message?: string }).message = message;
    }

    this.displayProgress();
  }

  public increment(amount: number = 1, message?: string): void {
    this.update(this.current + amount, message);
  }

  public complete(message?: string): void {
    if (this.completed) return;

    this.current = this.total;
    this.completed = true;
    this.displayProgress(message || 'Complete');
    console.log(); // New line after completion
  }

  public fail(message?: string): void {
    if (this.completed) return;

    this.completed = true;
    this.displayProgress(message || 'Failed');
    console.log(); // New line after failure
  }

  private displayProgress(overrideMessage?: string): void {
    const percentage = Math.round((this.current / this.total) * 100);
    const elapsed = Date.now() - this.startTime;
    const rate = this.current / (elapsed / 1000);
    const eta =
      this.current > 0 ? Math.round((this.total - this.current) / rate) : 0;

    const progressBar = this.createProgressBar(percentage);
    const message = overrideMessage || this.message || '';
    const stats = `${this.current}/${this.total} (${percentage}%) ETA: ${eta}s`;

    // Clear line and write progress
    process.stdout.write(`\r\x1b[K${progressBar} ${stats} ${message}`);
  }

  private createProgressBar(percentage: number, width: number = 30): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }

  public getStats(): {
    percentage: number;
    elapsed: number;
    rate: number;
    eta: number;
  } {
    const elapsed = Date.now() - this.startTime;
    const rate = this.current / (elapsed / 1000);
    const eta =
      this.current > 0 ? Math.round((this.total - this.current) / rate) : 0;
    const percentage = Math.round((this.current / this.total) * 100);

    return { percentage, elapsed, rate, eta };
  }
}

// Singleton instance
export const performanceOptimizer = PerformanceOptimizer.getInstance();
