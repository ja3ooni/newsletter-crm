import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { logger } from '../utils/logger';

export interface ServiceConfig {
  baseURL: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  poolConfig: {
    maxSockets: number;
    maxFreeSockets: number;
    keepAlive: boolean;
    keepAliveMsecs: number;
    timeout: number;
  };
}

export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  activeConnections: number;
  poolUtilization: number;
  errorRate: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export class ExternalServicePoolManager {
  private services: Map<
    string,
    {
      client: AxiosInstance;
      config: ServiceConfig;
      metrics: ServiceMetrics;
      circuitBreaker: CircuitBreakerState;
      httpAgent: HttpAgent;
      httpsAgent: HttpsAgent;
    }
  >;

  constructor() {
    this.services = new Map();

    logger.info('External service pool manager initialized');
  }

  /**
   * Register a new external service
   */
  registerService(
    serviceName: string,
    config: Partial<ServiceConfig> = {}
  ): void {
    const fullConfig: ServiceConfig = {
      baseURL: '',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      poolConfig: {
        maxSockets: 50,
        maxFreeSockets: 10,
        keepAlive: true,
        keepAliveMsecs: 30000,
        timeout: 30000,
      },
      ...config,
    };

    // Create HTTP agents with connection pooling
    const httpAgent = new HttpAgent({
      maxSockets: fullConfig.poolConfig.maxSockets,
      maxFreeSockets: fullConfig.poolConfig.maxFreeSockets,
      keepAlive: fullConfig.poolConfig.keepAlive,
      keepAliveMsecs: fullConfig.poolConfig.keepAliveMsecs,
      timeout: fullConfig.poolConfig.timeout,
    });

    const httpsAgent = new HttpsAgent({
      maxSockets: fullConfig.poolConfig.maxSockets,
      maxFreeSockets: fullConfig.poolConfig.maxFreeSockets,
      keepAlive: fullConfig.poolConfig.keepAlive,
      keepAliveMsecs: fullConfig.poolConfig.keepAliveMsecs,
      timeout: fullConfig.poolConfig.timeout,
    });

    // Create axios instance with optimized configuration
    const client = axios.create({
      baseURL: fullConfig.baseURL,
      timeout: fullConfig.timeout,
      httpAgent,
      httpsAgent,
      headers: {
        Connection: 'keep-alive',
        'Keep-Alive': `timeout=${Math.floor(fullConfig.poolConfig.keepAliveMsecs / 1000)}`,
      },
    });

    // Add request interceptor for metrics and circuit breaker
    client.interceptors.request.use(
      config => {
        const service = this.services.get(serviceName);
        if (service) {
          // Check circuit breaker
          if (!this.isCircuitBreakerOpen(service.circuitBreaker)) {
            service.metrics.totalRequests++;
            return config;
          } else {
            throw new Error(
              `Circuit breaker is open for service: ${serviceName}`
            );
          }
        }
        return config;
      },
      error => {
        logger.error('Request interceptor error', { serviceName, error });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for metrics and circuit breaker
    client.interceptors.response.use(
      response => {
        const service = this.services.get(serviceName);
        if (service) {
          this.updateMetrics(
            serviceName,
            response.config.metadata?.startTime,
            true
          );
          this.updateCircuitBreaker(serviceName, true);
        }
        return response;
      },
      error => {
        const service = this.services.get(serviceName);
        if (service) {
          this.updateMetrics(
            serviceName,
            error.config?.metadata?.startTime,
            false
          );
          this.updateCircuitBreaker(serviceName, false);
        }
        return Promise.reject(error);
      }
    );

    this.services.set(serviceName, {
      client,
      config: fullConfig,
      metrics: this.initializeMetrics(),
      circuitBreaker: this.initializeCircuitBreaker(),
      httpAgent,
      httpsAgent,
    });

    logger.info('External service registered', {
      serviceName,
      baseURL: fullConfig.baseURL,
      maxSockets: fullConfig.poolConfig.maxSockets,
    });
  }

  /**
   * Make HTTP request with retry logic and circuit breaker
   */
  async request<T = any>(
    serviceName: string,
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not registered: ${serviceName}`);
    }

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(service.circuitBreaker)) {
      throw new Error(`Circuit breaker is open for service: ${serviceName}`);
    }

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= service.config.maxRetries; attempt++) {
      try {
        // Add metadata for metrics
        const requestConfig = {
          ...config,
          metadata: { startTime },
        };

        const response = await service.client.request<T>(requestConfig);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain HTTP status codes
        if (axios.isAxiosError(error) && error.response) {
          const status = error.response.status;
          if (status >= 400 && status < 500 && status !== 429) {
            // Client errors (except rate limiting) shouldn't be retried
            break;
          }
        }

        // Wait before retrying
        if (attempt < service.config.maxRetries) {
          const delay = service.config.retryDelay * Math.pow(2, attempt);
          await this.delay(delay);
        }
      }
    }

    logger.error('Request failed after all retries', {
      serviceName,
      attempts: service.config.maxRetries + 1,
      error: lastError,
    });

    throw lastError;
  }

  /**
   * Make GET request
   */
  async get<T = any>(
    serviceName: string,
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>(serviceName, { ...config, method: 'GET', url });
  }

  /**
   * Make POST request
   */
  async post<T = any>(
    serviceName: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>(serviceName, {
      ...config,
      method: 'POST',
      url,
      data,
    });
  }

  /**
   * Make PUT request
   */
  async put<T = any>(
    serviceName: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>(serviceName, {
      ...config,
      method: 'PUT',
      url,
      data,
    });
  }

  /**
   * Make DELETE request
   */
  async delete<T = any>(
    serviceName: string,
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>(serviceName, { ...config, method: 'DELETE', url });
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(serviceName: string): ServiceMetrics | null {
    const service = this.services.get(serviceName);
    if (!service) return null;

    // Update pool utilization
    const sockets = service.httpAgent.getCurrentConnections?.() || 0;
    service.metrics.poolUtilization =
      (sockets / service.config.poolConfig.maxSockets) * 100;

    return { ...service.metrics };
  }

  /**
   * Get all services metrics
   */
  getAllMetrics(): Record<string, ServiceMetrics> {
    const metrics: Record<string, ServiceMetrics> = {};

    for (const [serviceName] of this.services) {
      const serviceMetrics = this.getServiceMetrics(serviceName);
      if (serviceMetrics) {
        metrics[serviceName] = serviceMetrics;
      }
    }

    return metrics;
  }

  /**
   * Reset circuit breaker for a service
   */
  resetCircuitBreaker(serviceName: string): void {
    const service = this.services.get(serviceName);
    if (service) {
      service.circuitBreaker = this.initializeCircuitBreaker();
      logger.info('Circuit breaker reset', { serviceName });
    }
  }

  /**
   * Get service health status
   */
  async getServiceHealth(serviceName: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const service = this.services.get(serviceName);
    if (!service) {
      return {
        status: 'unhealthy',
        details: { error: 'Service not registered' },
      };
    }

    try {
      const start = Date.now();
      await this.get(serviceName, '/health', { timeout: 5000 });
      const responseTime = Date.now() - start;

      const metrics = this.getServiceMetrics(serviceName)!;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (
        metrics.circuitBreakerState === 'open' ||
        metrics.errorRate > 20 ||
        responseTime > 5000
      ) {
        status = 'unhealthy';
      } else if (
        metrics.circuitBreakerState === 'half-open' ||
        metrics.errorRate > 10 ||
        responseTime > 2000
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
   * Optimize connection pools
   */
  async optimizeConnectionPools(): Promise<{
    optimizations: Record<string, string[]>;
    recommendations: string[];
  }> {
    const optimizations: Record<string, string[]> = {};
    const recommendations: string[] = [];

    for (const [serviceName, service] of this.services) {
      const serviceOptimizations: string[] = [];
      const metrics = this.getServiceMetrics(serviceName)!;

      // Optimize pool size based on utilization
      if (metrics.poolUtilization > 80) {
        const newMaxSockets = Math.min(
          service.config.poolConfig.maxSockets * 1.5,
          100
        );
        service.httpAgent.maxSockets = newMaxSockets;
        service.httpsAgent.maxSockets = newMaxSockets;
        serviceOptimizations.push(`Increased max sockets to ${newMaxSockets}`);
      }

      if (
        metrics.poolUtilization < 30 &&
        service.config.poolConfig.maxSockets > 20
      ) {
        const newMaxSockets = Math.max(
          service.config.poolConfig.maxSockets * 0.8,
          20
        );
        service.httpAgent.maxSockets = newMaxSockets;
        service.httpsAgent.maxSockets = newMaxSockets;
        serviceOptimizations.push(`Decreased max sockets to ${newMaxSockets}`);
      }

      // Optimize timeouts based on response times
      if (metrics.avgResponseTime > service.config.timeout * 0.8) {
        recommendations.push(`Consider increasing timeout for ${serviceName}`);
      }

      if (metrics.errorRate > 10) {
        recommendations.push(
          `High error rate for ${serviceName} - check service health`
        );
      }

      if (serviceOptimizations.length > 0) {
        optimizations[serviceName] = serviceOptimizations;
      }
    }

    logger.info('Connection pool optimization completed', {
      optimizations,
      recommendations,
    });

    return { optimizations, recommendations };
  }

  /**
   * Shutdown all connection pools
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down external service pool manager');

    for (const [serviceName, service] of this.services) {
      try {
        service.httpAgent.destroy();
        service.httpsAgent.destroy();
        logger.debug('Service connection pool destroyed', { serviceName });
      } catch (error) {
        logger.error('Error destroying service pool', { serviceName, error });
      }
    }

    this.services.clear();
    logger.info('External service pool manager shutdown completed');
  }

  private isCircuitBreakerOpen(circuitBreaker: CircuitBreakerState): boolean {
    const now = Date.now();

    if (circuitBreaker.state === 'open') {
      if (now >= circuitBreaker.nextAttemptTime) {
        circuitBreaker.state = 'half-open';
        return false;
      }
      return true;
    }

    return false;
  }

  private updateCircuitBreaker(serviceName: string, success: boolean): void {
    const service = this.services.get(serviceName);
    if (!service) return;

    const circuitBreaker = service.circuitBreaker;
    const now = Date.now();

    if (success) {
      if (circuitBreaker.state === 'half-open') {
        circuitBreaker.state = 'closed';
        circuitBreaker.failureCount = 0;
      }
    } else {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = now;

      if (
        circuitBreaker.failureCount >= service.config.circuitBreakerThreshold
      ) {
        circuitBreaker.state = 'open';
        circuitBreaker.nextAttemptTime =
          now + service.config.circuitBreakerTimeout;

        logger.warn('Circuit breaker opened', {
          serviceName,
          failureCount: circuitBreaker.failureCount,
          nextAttemptTime: new Date(
            circuitBreaker.nextAttemptTime
          ).toISOString(),
        });
      }
    }

    service.metrics.circuitBreakerState = circuitBreaker.state;
  }

  private updateMetrics(
    serviceName: string,
    startTime: number | undefined,
    success: boolean
  ): void {
    const service = this.services.get(serviceName);
    if (!service || !startTime) return;

    const responseTime = Date.now() - startTime;

    if (success) {
      service.metrics.successfulRequests++;
    } else {
      service.metrics.failedRequests++;
    }

    // Update average response time (exponential moving average)
    const alpha = 0.1;
    service.metrics.avgResponseTime =
      service.metrics.avgResponseTime * (1 - alpha) + responseTime * alpha;

    // Update error rate
    const total =
      service.metrics.successfulRequests + service.metrics.failedRequests;
    service.metrics.errorRate =
      total > 0 ? (service.metrics.failedRequests / total) * 100 : 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeMetrics(): ServiceMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      circuitBreakerState: 'closed',
      activeConnections: 0,
      poolUtilization: 0,
      errorRate: 0,
    };
  }

  private initializeCircuitBreaker(): CircuitBreakerState {
    return {
      state: 'closed',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
    };
  }
}
