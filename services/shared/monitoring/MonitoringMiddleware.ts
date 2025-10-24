import axios from 'axios';
import { NextFunction, Request, Response } from 'express';
import { Counter, Gauge, Histogram, register } from 'prom-client';
import { logger } from '../utils/logger';

export interface MonitoringConfig {
  serviceName: string;
  metricsPort?: number;
  jaegerConfig?: {
    agentHost: string;
    agentPort: number;
  };
  monitoringServiceUrl?: string;
}

export class MonitoringMiddleware {
  private httpRequestsTotal: Counter<string>;
  private httpRequestDuration: Histogram<string>;
  private activeConnections: Gauge<string>;
  private serviceName: string;
  private monitoringServiceUrl?: string;

  constructor(config: MonitoringConfig) {
    this.serviceName = config.serviceName;
    this.monitoringServiceUrl = config.monitoringServiceUrl;

    // Initialize Prometheus metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'],
      registers: [register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [register],
    });

    this.activeConnections = new Gauge({
      name: 'active_connections_total',
      help: 'Number of active connections',
      labelNames: ['service'],
      registers: [register],
    });

    // Set service name label
    this.activeConnections.set({ service: this.serviceName }, 0);
  }

  // Express middleware for HTTP request monitoring
  public httpMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Increment active connections
      this.activeConnections.inc({ service: this.serviceName });

      // Extract route pattern (remove IDs and query params)
      const route = this.extractRoute(req.route?.path || req.path);

      res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = res.statusCode.toString();

        // Record metrics
        this.httpRequestsTotal.inc({
          method: req.method,
          route,
          status_code: statusCode,
          service: this.serviceName,
        });

        this.httpRequestDuration.observe(
          {
            method: req.method,
            route,
            status_code: statusCode,
            service: this.serviceName,
          },
          duration
        );

        // Decrement active connections
        this.activeConnections.dec({ service: this.serviceName });

        // Send to monitoring service if configured
        if (this.monitoringServiceUrl) {
          this.sendMetricToMonitoringService('http_request', {
            method: req.method,
            route,
            statusCode: res.statusCode,
            duration,
            service: this.serviceName,
          });
        }

        // Log request
        logger.info('HTTP Request', {
          method: req.method,
          route,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });
      });

      next();
    };
  }

  // Database operation monitoring
  public async monitorDbOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = (Date.now() - startTime) / 1000;

      logger.info('Database Operation', {
        operation: operationName,
        duration,
        success: true,
        service: this.serviceName,
        ...metadata,
      });

      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      logger.error('Database Operation Failed', {
        operation: operationName,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: this.serviceName,
        ...metadata,
      });

      throw error;
    }
  }

  // Queue operation monitoring
  public async monitorQueueOperation<T>(
    queueName: string,
    operation: string,
    handler: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await handler();
      const duration = (Date.now() - startTime) / 1000;

      logger.info('Queue Operation', {
        queue: queueName,
        operation,
        duration,
        success: true,
        service: this.serviceName,
        ...metadata,
      });

      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      logger.error('Queue Operation Failed', {
        queue: queueName,
        operation,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: this.serviceName,
        ...metadata,
      });

      throw error;
    }
  }

  // External API call monitoring
  public async monitorApiCall<T>(
    url: string,
    method: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = (Date.now() - startTime) / 1000;

      logger.info('External API Call', {
        url,
        method,
        duration,
        success: true,
        service: this.serviceName,
        ...metadata,
      });

      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      logger.error('External API Call Failed', {
        url,
        method,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: this.serviceName,
        ...metadata,
      });

      // Send error metric to monitoring service
      if (this.monitoringServiceUrl) {
        this.sendMetricToMonitoringService('api_error', {
          service: this.serviceName,
          endpoint: url,
          errorType:
            error instanceof Error ? error.constructor.name : 'UnknownError',
        });
      }

      throw error;
    }
  }

  // Business metric recording
  public recordBusinessMetric(type: string, data: Record<string, any>): void {
    logger.info('Business Metric', {
      type,
      data,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
    });

    // Send to monitoring service if configured
    if (this.monitoringServiceUrl) {
      this.sendMetricToMonitoringService(type, {
        ...data,
        service: this.serviceName,
      });
    }
  }

  // Error tracking
  public recordError(error: Error, context?: Record<string, any>): void {
    logger.error('Application Error', {
      error: error.message,
      stack: error.stack,
      service: this.serviceName,
      ...context,
    });

    // Send error to monitoring service
    if (this.monitoringServiceUrl) {
      this.sendMetricToMonitoringService('api_error', {
        service: this.serviceName,
        endpoint: context?.endpoint || 'unknown',
        errorType: error.constructor.name,
      });
    }
  }

  // Health check endpoint
  public healthCheck() {
    return (req: Request, res: Response) => {
      const health = {
        status: 'healthy',
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        connections: this.getActiveConnections(),
      };

      res.json(health);
    };
  }

  // Metrics endpoint
  public metricsEndpoint() {
    return async (req: Request, res: Response) => {
      try {
        const metrics = await register.metrics();

        res.set('Content-Type', register.contentType);
        res.send(metrics);
      } catch (error) {
        logger.error('Error generating metrics:', error);
        res.status(500).json({ error: 'Failed to generate metrics' });
      }
    };
  }

  private extractRoute(path: string): string {
    // Remove IDs and UUIDs from route for better grouping
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:uuid'
      )
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token');
  }

  private getActiveConnections(): number {
    const metric = this.activeConnections.get();

    return (
      metric.values.find(v => v.labels.service === this.serviceName)?.value || 0
    );
  }

  private async sendMetricToMonitoringService(
    type: string,
    data: Record<string, any>
  ): Promise<void> {
    if (!this.monitoringServiceUrl) return;

    try {
      await axios.post(
        `${this.monitoringServiceUrl}/metrics/record`,
        {
          type,
          data,
        },
        {
          timeout: 5000,
        }
      );
    } catch (error) {
      // Don't log monitoring service errors to avoid noise
      // Just silently fail to prevent monitoring from affecting the main service
    }
  }
}

// Factory function to create monitoring middleware
export const createMonitoringMiddleware = (
  config: MonitoringConfig
): MonitoringMiddleware => {
  return new MonitoringMiddleware(config);
};
