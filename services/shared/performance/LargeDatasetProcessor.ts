// @ts-nocheck
import { EventEmitter } from 'events';
import { Readable, Transform, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { logger } from '../utils/logger';
import { resourceCleanupService } from './ResourceCleanupService';

export interface ProcessingOptions {
  chunkSize?: number;
  concurrency?: number;
  maxMemoryUsage?: number; // MB
  enableBackpressure?: boolean;
  retryAttempts?: number;
  retryDelay?: number; // milliseconds
  timeout?: number; // milliseconds
}

export interface ProcessingStats {
  totalItems: number;
  processedItems: number;
  failedItems: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  throughput?: number; // items per second
  memoryUsage: {
    peak: number;
    average: number;
    current: number;
  };
}

export interface ProcessingResult<T> {
  success: boolean;
  stats: ProcessingStats;
  results?: T[];
  errors?: Error[];
}

export class LargeDatasetProcessor<TInput, TOutput> extends EventEmitter {
  private readonly defaultOptions: Required<ProcessingOptions> = {
    chunkSize: 1000,
    concurrency: 5,
    maxMemoryUsage: 512, // 512MB
    enableBackpressure: true,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 300000, // 5 minutes
  };

  private stats: ProcessingStats = {
    totalItems: 0,
    processedItems: 0,
    failedItems: 0,
    startTime: 0,
    memoryUsage: {
      peak: 0,
      average: 0,
      current: 0,
    },
  };

  private memoryMonitorInterval?: NodeJS.Timeout;
  private memoryReadings: number[] = [];
  private isProcessing = false;
  private abortController?: AbortController;

  constructor(private options: ProcessingOptions = {}) {
    super();
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Process array data in chunks with memory optimization
   */
  async processArray<T extends TOutput>(
    data: TInput[],
    processor: (item: TInput) => Promise<T>,
    options?: ProcessingOptions
  ): Promise<ProcessingResult<T>> {
    const opts = { ...this.options, ...options };

    this.initializeStats(data.length);
    this.startMemoryMonitoring();

    const results: T[] = [];
    const errors: Error[] = [];

    try {
      this.isProcessing = true;
      this.abortController = new AbortController();

      // Register cleanup task
      const cleanupTaskId = resourceCleanupService.registerCleanupTask({
        name: 'LargeDatasetProcessor cleanup',
        type: 'custom',
        priority: 'high',
        cleanup: () => this.cleanup(),
      });

      // Process data in chunks
      for (let i = 0; i < data.length; i += opts.chunkSize) {
        if (this.abortController.signal.aborted) {
          throw new Error('Processing aborted');
        }

        const chunk = data.slice(i, i + opts.chunkSize);

        try {
          const chunkResults = await this.processChunkWithConcurrency(
            chunk,
            processor,
            opts
          );

          results.push(...chunkResults);
          this.stats.processedItems += chunkResults.length;

          this.emit('progress', {
            processed: this.stats.processedItems,
            total: this.stats.totalItems,
            percentage:
              (this.stats.processedItems / this.stats.totalItems) * 100,
          });

          // Check memory usage
          await this.checkMemoryPressure(opts);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          errors.push(err);
          this.stats.failedItems += chunk.length;

          logger.error('Chunk processing failed', {
            chunkStart: i,
            chunkSize: chunk.length,
            error: err.message,
          });
        }
      }

      resourceCleanupService.unregisterCleanupTask(cleanupTaskId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      logger.error('Array processing failed', { error: err.message });
    } finally {
      this.finalizeStats();
      this.stopMemoryMonitoring();
      this.isProcessing = false;
    }

    return {
      success: errors.length === 0,
      stats: this.stats,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Process streaming data with memory optimization
   */
  async processStream(
    inputStream: Readable,
    processor: (item: TInput) => Promise<TOutput>,
    options?: ProcessingOptions
  ): Promise<ProcessingResult<TOutput>> {
    const opts = { ...this.options, ...options };

    this.initializeStats(0); // Unknown total for streams
    this.startMemoryMonitoring();

    const results: TOutput[] = [];
    const errors: Error[] = [];

    try {
      this.isProcessing = true;
      this.abortController = new AbortController();

      // Create transform stream for processing
      const transformStream = new Transform({
        objectMode: true,
        highWaterMark: opts.chunkSize,
        transform: async (chunk: TInput, encoding, callback) => {
          try {
            const result = await processor(chunk);
            results.push(result);
            this.stats.processedItems++;

            this.emit('progress', {
              processed: this.stats.processedItems,
              total: this.stats.totalItems || this.stats.processedItems,
            });

            callback(null, result);
          } catch (error) {
            const err =
              error instanceof Error ? error : new Error(String(error));
            errors.push(err);
            this.stats.failedItems++;
            callback(err);
          }
        },
      });

      // Create writable stream to collect results
      const outputStream = new Writable({
        objectMode: true,
        write(chunk, encoding, callback) {
          callback();
        },
      });

      // Register cleanup tasks
      const cleanupTaskId = resourceCleanupService.registerCleanupTask({
        name: 'Stream processing cleanup',
        type: 'stream',
        priority: 'high',
        cleanup: () => {
          inputStream.destroy();
          transformStream.destroy();
          outputStream.destroy();
        },
      });

      // Process stream with pipeline
      await pipeline(inputStream, transformStream, outputStream, {
        signal: this.abortController.signal,
      });

      resourceCleanupService.unregisterCleanupTask(cleanupTaskId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      logger.error('Stream processing failed', { error: err.message });
    } finally {
      this.finalizeStats();
      this.stopMemoryMonitoring();
      this.isProcessing = false;
    }

    return {
      success: errors.length === 0,
      stats: this.stats,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Process data with pagination for database queries
   */
  async processPaginated<T extends TOutput>(
    fetcher: (offset: number, limit: number) => Promise<TInput[]>,
    processor: (item: TInput) => Promise<T>,
    options?: ProcessingOptions & { pageSize?: number }
  ): Promise<ProcessingResult<T>> {
    const opts = { ...this.options, ...options };
    const pageSize = options?.pageSize || opts.chunkSize;

    this.initializeStats(0); // Unknown total for paginated data
    this.startMemoryMonitoring();

    const results: T[] = [];
    const errors: Error[] = [];
    let offset = 0;
    let hasMore = true;

    try {
      this.isProcessing = true;
      this.abortController = new AbortController();

      while (hasMore && !this.abortController.signal.aborted) {
        try {
          // Fetch page
          const page = await fetcher(offset, pageSize);

          if (page.length === 0) {
            hasMore = false;
            break;
          }

          // Process page
          const pageResults = await this.processChunkWithConcurrency(
            page,
            processor,
            opts
          );

          results.push(...pageResults);
          this.stats.processedItems += pageResults.length;
          this.stats.totalItems += page.length;

          this.emit('progress', {
            processed: this.stats.processedItems,
            total: this.stats.totalItems,
            percentage: 100, // Unknown total, so show as ongoing
          });

          // Check if we got a full page
          if (page.length < pageSize) {
            hasMore = false;
          }

          offset += pageSize;

          // Check memory usage
          await this.checkMemoryPressure(opts);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          errors.push(err);
          logger.error('Page processing failed', {
            offset,
            pageSize,
            error: err.message,
          });

          // Continue with next page on error
          offset += pageSize;
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      logger.error('Paginated processing failed', { error: err.message });
    } finally {
      this.finalizeStats();
      this.stopMemoryMonitoring();
      this.isProcessing = false;
    }

    return {
      success: errors.length === 0,
      stats: this.stats,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Abort current processing
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      logger.info('Processing aborted by user');
    }
  }

  /**
   * Get current processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Process chunk with controlled concurrency
   */
  private async processChunkWithConcurrency<T extends TOutput>(
    chunk: TInput[],
    processor: (item: TInput) => Promise<T>,
    options: Required<ProcessingOptions>
  ): Promise<T[]> {
    const results: T[] = [];
    const semaphore = new Semaphore(options.concurrency);

    const promises = chunk.map(async (item, index) => {
      await semaphore.acquire();

      try {
        const result = await this.processWithRetry(item, processor, options);
        results[index] = result;
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);
    return results.filter(result => result !== undefined);
  }

  /**
   * Process single item with retry logic
   */
  private async processWithRetry<T extends TOutput>(
    item: TInput,
    processor: (item: TInput) => Promise<T>,
    options: Required<ProcessingOptions>
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= options.retryAttempts; attempt++) {
      try {
        // Add timeout to processing
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Processing timeout after ${options.timeout}ms`));
          }, options.timeout);
        });

        const result = await Promise.race([processor(item), timeoutPromise]);

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < options.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, options.retryDelay));
          logger.debug('Retrying item processing', {
            attempt: attempt + 1,
            maxAttempts: options.retryAttempts,
            error: lastError.message,
          });
        }
      }
    }

    throw lastError || new Error('Processing failed after all retry attempts');
  }

  /**
   * Check memory pressure and trigger GC if needed
   */
  private async checkMemoryPressure(
    options: Required<ProcessingOptions>
  ): Promise<void> {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / (1024 * 1024);

    this.memoryReadings.push(heapUsedMB);
    this.stats.memoryUsage.current = heapUsedMB;

    if (heapUsedMB > this.stats.memoryUsage.peak) {
      this.stats.memoryUsage.peak = heapUsedMB;
    }

    if (heapUsedMB > options.maxMemoryUsage) {
      logger.warn('Memory usage exceeds threshold, triggering GC', {
        currentMB: heapUsedMB.toFixed(2),
        thresholdMB: options.maxMemoryUsage,
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit for GC to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      this.emit('memoryPressure', {
        currentUsage: heapUsedMB,
        threshold: options.maxMemoryUsage,
      });
    }
  }

  /**
   * Initialize processing statistics
   */
  private initializeStats(totalItems: number): void {
    this.stats = {
      totalItems,
      processedItems: 0,
      failedItems: 0,
      startTime: Date.now(),
      memoryUsage: {
        peak: 0,
        average: 0,
        current: 0,
      },
    };
    this.memoryReadings = [];
  }

  /**
   * Finalize processing statistics
   */
  private finalizeStats(): void {
    this.stats.endTime = Date.now();
    this.stats.duration = this.stats.endTime - this.stats.startTime;

    if (this.stats.duration > 0) {
      this.stats.throughput =
        (this.stats.processedItems / this.stats.duration) * 1000; // per second
    }

    if (this.memoryReadings.length > 0) {
      this.stats.memoryUsage.average =
        this.memoryReadings.reduce((sum, reading) => sum + reading, 0) /
        this.memoryReadings.length;
    }
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitorInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
      this.memoryReadings.push(heapUsedMB);
      this.stats.memoryUsage.current = heapUsedMB;

      if (heapUsedMB > this.stats.memoryUsage.peak) {
        this.stats.memoryUsage.peak = heapUsedMB;
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = undefined;
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.abort();
    this.stopMemoryMonitoring();
    this.removeAllListeners();
  }
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise<void>(resolve => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  release(): void {
    this.permits++;

    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift();
      if (resolve) {
        this.permits--;
        resolve();
      }
    }
  }
}

/**
 * Utility functions for common processing patterns
 */
export class DataProcessingUtils {
  /**
   * Process CSV data in chunks
   */
  static async processCsvData<T>(
    csvData: string,
    processor: (row: Record<string, string>) => Promise<T>,
    options?: ProcessingOptions
  ): Promise<ProcessingResult<T>> {
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    const dataProcessor = new LargeDatasetProcessor<Record<string, string>, T>(
      options
    );
    return dataProcessor.processArray(rows, processor);
  }

  /**
   * Process JSON array data
   */
  static async processJsonArray<TInput, TOutput>(
    jsonArray: TInput[],
    processor: (item: TInput) => Promise<TOutput>,
    options?: ProcessingOptions
  ): Promise<ProcessingResult<TOutput>> {
    const dataProcessor = new LargeDatasetProcessor<TInput, TOutput>(options);
    return dataProcessor.processArray(jsonArray, processor);
  }

  /**
   * Process database results with pagination
   */
  static async processDatabaseResults<TInput, TOutput>(
    query: (offset: number, limit: number) => Promise<TInput[]>,
    processor: (item: TInput) => Promise<TOutput>,
    options?: ProcessingOptions & { pageSize?: number }
  ): Promise<ProcessingResult<TOutput>> {
    const dataProcessor = new LargeDatasetProcessor<TInput, TOutput>(options);
    return dataProcessor.processPaginated(query, processor, options);
  }
}
