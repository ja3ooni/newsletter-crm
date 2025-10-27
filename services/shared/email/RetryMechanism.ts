import { logger } from '../utils/logger';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  jitterRange: number; // 0-1, percentage of delay to add as jitter
  retryableErrors: string[];
  nonRetryableErrors: string[];
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: Date;
  error?: Error;
  delay: number;
  success: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: RetryAttempt[];
  totalTime: number;
  finalAttempt: number;
}

export interface RetryStats {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  avgAttempts: number;
  avgRetryTime: number;
  errorDistribution: Record<string, number>;
}

export class RetryMechanism {
  private config: RetryConfig;
  private stats: RetryStats;
  private activeRetries: Map<string, RetryAttempt[]> = new Map();

  constructor(config: RetryConfig) {
    this.config = config;
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      avgAttempts: 0,
      avgRetryTime: 0,
      errorDistribution: {},
    };
  }

  /**
   * Execute function with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationId?: string,
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const config = { ...this.config, ...customConfig };
    const attempts: RetryAttempt[] = [];
    const startTime = Date.now();
    const id =
      operationId ||
      `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.activeRetries.set(id, attempts);

    try {
      for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        try {
          const result = await operation();

          const attemptRecord: RetryAttempt = {
            attemptNumber: attempt,
            timestamp: new Date(),
            delay: 0,
            success: true,
          };

          attempts.push(attemptRecord);

          const totalTime = Date.now() - startTime;

          this.updateStats(true, attempts.length, totalTime);

          logger.info('Operation succeeded', {
            operationId: id,
            attempt,
            totalTime,
          });

          return {
            success: true,
            result,
            attempts,
            totalTime,
            finalAttempt: attempt,
          };
        } catch (error) {
          const err = error as Error;

          const attemptRecord: RetryAttempt = {
            attemptNumber: attempt,
            timestamp: new Date(),
            error: err,
            delay: 0,
            success: false,
          };

          attempts.push(attemptRecord);

          // Check if error is retryable
          if (!this.isRetryableError(err, config)) {
            logger.error('Non-retryable error encountered', err, {
              operationId: id,
              attempt,
            });

            const totalTime = Date.now() - startTime;

            this.updateStats(false, attempts.length, totalTime, err.message);

            return {
              success: false,
              error: err,
              attempts,
              totalTime,
              finalAttempt: attempt,
            };
          }

          // If this was the last attempt, fail
          if (attempt >= config.maxAttempts) {
            logger.error('Max retry attempts reached', err, {
              operationId: id,
              maxAttempts: config.maxAttempts,
            });

            const totalTime = Date.now() - startTime;

            this.updateStats(false, attempts.length, totalTime, err.message);

            return {
              success: false,
              error: err,
              attempts,
              totalTime,
              finalAttempt: attempt,
            };
          }

          // Calculate delay for next attempt
          const delay = this.calculateDelay(attempt, config);

          attemptRecord.delay = delay;

          logger.warn('Operation failed, retrying', {
            operationId: id,
            attempt,
            nextAttempt: attempt + 1,
            delay,
            error: err.message,
          });

          // Wait before next attempt
          await this.sleep(delay);
        }
      }

      // This should never be reached, but just in case
      throw new Error('Unexpected end of retry loop');
    } finally {
      this.activeRetries.delete(id);
    }
  }

  /**
   * Execute multiple operations with retry, with circuit breaker pattern
   */
  async executeBatchWithRetry<T>(
    operations: Array<{
      operation: () => Promise<T>;
      id?: string;
    }>,
    options?: {
      concurrency?: number;
      failFast?: boolean;
      circuitBreakerThreshold?: number;
    }
  ): Promise<Array<RetryResult<T>>> {
    const concurrency = options?.concurrency || 5;
    const failFast = options?.failFast || false;
    const circuitBreakerThreshold = options?.circuitBreakerThreshold || 0.5;

    const results: Array<RetryResult<T>> = [];
    const failures: number[] = [];

    // Process operations in batches
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);

      // Check circuit breaker
      if (failures.length > 0) {
        const recentFailureRate =
          failures.filter(f => f > Date.now() - 60000).length / Math.min(i, 60);

        if (recentFailureRate > circuitBreakerThreshold) {
          logger.warn('Circuit breaker triggered', {
            failureRate: recentFailureRate,
            threshold: circuitBreakerThreshold,
          });

          // Return failed results for remaining operations
          for (let j = i; j < operations.length; j++) {
            results.push({
              success: false,
              error: new Error('Circuit breaker open'),
              attempts: [],
              totalTime: 0,
              finalAttempt: 0,
            });
          }
          break;
        }
      }

      const batchPromises = batch.map(({ operation, id }) =>
        this.executeWithRetry(operation, id)
      );

      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults);

      // Track failures for circuit breaker
      for (const result of batchResults) {
        if (!result.success) {
          failures.push(Date.now());

          if (failFast) {
            logger.warn('Fail-fast enabled, stopping batch execution');

            // Return failed results for remaining operations
            for (let j = i + batch.length; j < operations.length; j++) {
              results.push({
                success: false,
                error: new Error('Batch execution stopped due to fail-fast'),
                attempts: [],
                totalTime: 0,
                finalAttempt: 0,
              });
            }

            return results;
          }
        }
      }
    }

    return results;
  }

  /**
   * Get retry statistics
   */
  getStats(): RetryStats {
    return { ...this.stats };
  }

  /**
   * Get currently active retries
   */
  getActiveRetries(): Array<{
    id: string;
    attempts: RetryAttempt[];
    currentAttempt: number;
    startTime: Date;
  }> {
    const active: Array<{
      id: string;
      attempts: RetryAttempt[];
      currentAttempt: number;
      startTime: Date;
    }> = [];

    for (const [id, attempts] of this.activeRetries.entries()) {
      if (attempts.length > 0) {
        active.push({
          id,
          attempts: [...attempts],
          currentAttempt: attempts.length,
          startTime: attempts[0]?.timestamp || new Date(),
        });
      }
    }

    return active;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      avgAttempts: 0,
      avgRetryTime: 0,
      errorDistribution: {},
    };
  }

  /**
   * Update retry configuration
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Retry configuration updated', { newConfig });
  }

  /**
   * Create a specialized retry mechanism for email sending
   */
  static createEmailRetryMechanism(): RetryMechanism {
    const emailConfig: RetryConfig = {
      maxAttempts: 5,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      jitterEnabled: true,
      jitterRange: 0.1,
      retryableErrors: [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'EAI_AGAIN',
        'SMTP_TIMEOUT',
        'RATE_LIMIT_EXCEEDED',
        'TEMPORARY_FAILURE',
        '4', // SMTP 4xx errors are generally temporary
      ],
      nonRetryableErrors: [
        'INVALID_EMAIL',
        'BLACKLISTED',
        'SPAM_DETECTED',
        'AUTHENTICATION_FAILED',
        'PERMISSION_DENIED',
        '5', // SMTP 5xx errors are generally permanent
      ],
    };

    return new RetryMechanism(emailConfig);
  }

  /**
   * Create a specialized retry mechanism for API calls
   */
  static createAPIRetryMechanism(): RetryMechanism {
    const apiConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 500,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitterEnabled: true,
      jitterRange: 0.2,
      retryableErrors: [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'EAI_AGAIN',
        'RATE_LIMIT',
        'INTERNAL_SERVER_ERROR',
        'BAD_GATEWAY',
        'SERVICE_UNAVAILABLE',
        'GATEWAY_TIMEOUT',
      ],
      nonRetryableErrors: [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'BAD_REQUEST',
        'UNPROCESSABLE_ENTITY',
        'PAYMENT_REQUIRED',
      ],
    };

    return new RetryMechanism(apiConfig);
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ (attempt - 1))
    let delay =
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);

    // Cap at max delay
    delay = Math.min(delay, config.maxDelay);

    // Add jitter if enabled
    if (config.jitterEnabled) {
      const jitter = delay * config.jitterRange * Math.random();

      delay += jitter;
    }

    return Math.floor(delay);
  }

  private isRetryableError(error: Error, config: RetryConfig): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Check non-retryable errors first
    for (const nonRetryable of config.nonRetryableErrors) {
      if (
        errorMessage.includes(nonRetryable.toLowerCase()) ||
        errorName.includes(nonRetryable.toLowerCase())
      ) {
        return false;
      }
    }

    // Check retryable errors
    for (const retryable of config.retryableErrors) {
      if (
        errorMessage.includes(retryable.toLowerCase()) ||
        errorName.includes(retryable.toLowerCase())
      ) {
        return true;
      }
    }

    // Default to non-retryable for unknown errors
    return false;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateStats(
    success: boolean,
    attempts: number,
    totalTime: number,
    errorType?: string
  ): void {
    this.stats.totalRetries++;

    if (success) {
      this.stats.successfulRetries++;
    } else {
      this.stats.failedRetries++;

      if (errorType) {
        this.stats.errorDistribution[errorType] =
          (this.stats.errorDistribution[errorType] || 0) + 1;
      }
    }

    // Update averages
    const totalOperations = this.stats.totalRetries;

    this.stats.avgAttempts =
      (this.stats.avgAttempts * (totalOperations - 1) + attempts) /
      totalOperations;

    this.stats.avgRetryTime =
      (this.stats.avgRetryTime * (totalOperations - 1) + totalTime) /
      totalOperations;
  }
}

/**
 * Decorator for automatic retry functionality
 */
export function withRetry<T extends any[], R>(
  retryMechanism: RetryMechanism,
  operationName?: string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      const operation = () => originalMethod.apply(this, args);
      const id = operationName || `${target.constructor.name}.${propertyKey}`;

      const result = await retryMechanism.executeWithRetry(operation, id);

      if (result.success) {
        return result.result as R;
      } else {
        throw result.error;
      }
    };

    return descriptor;
  };
}

/**
 * Utility function to create retry-enabled version of any async function
 */
export function createRetryableFunction<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  retryMechanism: RetryMechanism,
  operationName?: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const operation = () => fn(...args);
    const id = operationName || fn.name || 'anonymous';

    const result = await retryMechanism.executeWithRetry(operation, id);

    if (result.success) {
      return result.result!;
    } else {
      throw result.error;
    }
  };
}
