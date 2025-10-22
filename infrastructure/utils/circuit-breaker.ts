/**
 * Circuit Breaker Implementation
 * Provides fault tolerance and resilience for inter-service communication
 */

import { EventEmitter } from 'events';
import { logger } from './logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitoringPeriod: number;
  fallbackFunction?: () => Promise<any>;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  requests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttempt?: Date;
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public circuitName: string, public state: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private requests = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttempt?: Date;
  private monitoringTimer?: NodeJS.Timeout;

  constructor(private config: CircuitBreakerConfig) {
    super();
    this.startMonitoring();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.requests++;

    if (this.state === CircuitState.OPEN) {
      if (this.nextAttempt && Date.now() < this.nextAttempt.getTime()) {
        const error = new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.config.name}`,
          this.config.name,
          this.state
        );

        if (this.config.fallbackFunction) {
          logger.warn('Circuit breaker OPEN, executing fallback', {
            circuitName: this.config.name,
            nextAttempt: this.nextAttempt,
          });
          return await this.config.fallbackFunction();
        }

        throw error;
      } else {
        // Transition to HALF_OPEN
        this.state = CircuitState.HALF_OPEN;
        this.emit('stateChange', this.state);
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          circuitName: this.config.name,
        });
      }
    }

    try {
      const startTime = Date.now();
      const result = await Promise.race([
        fn(),
        this.createTimeoutPromise(),
      ]);

      const duration = Date.now() - startTime;
      this.onSuccess(duration);
      return result;

    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttempt: this.nextAttempt,
    };
  }

  /**
   * Reset circuit breaker to CLOSED state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttempt = undefined;

    this.emit('reset');
    logger.info('Circuit breaker reset', { circuitName: this.config.name });
  }

  /**
   * Force circuit breaker to OPEN state
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);

    this.emit('stateChange', this.state);
    logger.warn('Circuit breaker forced OPEN', {
      circuitName: this.config.name,
      nextAttempt: this.nextAttempt,
    });
  }

  /**
   * Force circuit breaker to CLOSED state
   */
  forceClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.nextAttempt = undefined;

    this.emit('stateChange', this.state);
    logger.info('Circuit breaker forced CLOSED', { circuitName: this.config.name });
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED ||
           (this.state === CircuitState.HALF_OPEN && this.failures < this.config.failureThreshold);
  }

  /**
   * Get failure rate percentage
   */
  getFailureRate(): number {
    if (this.requests === 0) return 0;
    return (this.failures / this.requests) * 100;
  }

  /**
   * Destroy circuit breaker and cleanup resources
   */
  destroy(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
    this.removeAllListeners();
  }

  /**
   * Handle successful execution
   */
  private onSuccess(duration: number): void {
    this.successes++;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.nextAttempt = undefined;

        this.emit('stateChange', this.state);
        logger.info('Circuit breaker transitioned to CLOSED', {
          circuitName: this.config.name,
          successes: this.successes,
        });
      }
    }

    this.emit('success', { duration, state: this.state });
    logger.debug('Circuit breaker success', {
      circuitName: this.config.name,
      duration,
      state: this.state,
      successes: this.successes,
    });
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: any): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN) {
      if (this.failures >= this.config.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);

        this.emit('stateChange', this.state);
        logger.warn('Circuit breaker transitioned to OPEN', {
          circuitName: this.config.name,
          failures: this.failures,
          threshold: this.config.failureThreshold,
          nextAttempt: this.nextAttempt,
        });
      }
    }

    this.emit('failure', { error, state: this.state });
    logger.error('Circuit breaker failure', {
      circuitName: this.config.name,
      error: error.message,
      state: this.state,
      failures: this.failures,
    });
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  /**
   * Start monitoring and periodic cleanup
   */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.emit('stats', this.getStats());

      // Reset counters periodically to prevent memory leaks
      const now = Date.now();
      const monitoringPeriod = this.config.monitoringPeriod;

      if (this.lastFailureTime && (now - this.lastFailureTime.getTime()) > monitoringPeriod) {
        this.failures = Math.max(0, this.failures - 1);
      }

      if (this.lastSuccessTime && (now - this.lastSuccessTime.getTime()) > monitoringPeriod) {
        this.successes = Math.max(0, this.successes - 1);
      }

    }, this.config.monitoringPeriod);
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private defaultConfig: Partial<CircuitBreakerConfig> = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 10000,
    resetTimeout: 60000,
    monitoringPeriod: 30000,
  };

  /**
   * Create or get circuit breaker for a service
   */
  getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (this.circuitBreakers.has(name)) {
      return this.circuitBreakers.get(name)!;
    }

    const fullConfig: CircuitBreakerConfig = {
      name,
      ...this.defaultConfig,
      ...config,
    } as CircuitBreakerConfig;

    const circuitBreaker = new CircuitBreaker(fullConfig);
    this.circuitBreakers.set(name, circuitBreaker);

    // Set up logging for circuit breaker events
    circuitBreaker.on('stateChange', (state) => {
      logger.info('Circuit breaker state changed', { name, state });
    });

    circuitBreaker.on('failure', ({ error, state }) => {
      logger.warn('Circuit breaker failure', { name, error: error.message, state });
    });

    return circuitBreaker;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    fn: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(serviceName, config);
    return await circuitBreaker.execute(fn);
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [name, circuitBreaker] of this.circuitBreakers) {
      stats[name] = circuitBreaker.getStats();
    }

    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): {
    healthy: string[];
    unhealthy: string[];
    total: number;
  } {
    const healthy: string[] = [];
    const unhealthy: string[] = [];

    for (const [name, circuitBreaker] of this.circuitBreakers) {
      if (circuitBreaker.isHealthy()) {
        healthy.push(name);
      } else {
        unhealthy.push(name);
      }
    }

    return {
      healthy,
      unhealthy,
      total: this.circuitBreakers.size,
    };
  }

  /**
   * Destroy all circuit breakers
   */
  destroy(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.destroy();
    }
    this.circuitBreakers.clear();
    logger.info('Circuit breaker manager destroyed');
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager();

/**
 * Decorator for automatic circuit breaker protection
 */
export function withCircuitBreaker(
  serviceName: string,
  config?: Partial<CircuitBreakerConfig>
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const circuitBreaker = circuitBreakerManager.getCircuitBreaker(serviceName, config);
      return await circuitBreaker.execute(() => method.apply(this, args));
    };

    return descriptor;
  };
}
