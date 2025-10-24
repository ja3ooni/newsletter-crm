import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ErrorTracker } from './ErrorTracker';
import { LogAnalyzer } from './LogAnalyzer';
import { StructuredLogger } from './StructuredLogger';

export interface LoggingConfig {
  serviceName: string;
  environment?: string;
  version?: string;
  elasticsearchUrl?: string;
  logLevel?: string;
  enableErrorTracking?: boolean;
  enableLogAnalysis?: boolean;
  errorNotificationConfig?: {
    webhookUrl?: string;
    slackWebhook?: string;
    emailRecipients?: string[];
    severityThreshold: 'low' | 'medium' | 'high' | 'critical';
  };
}

export class LoggingMiddleware {
  private logger: StructuredLogger;
  private errorTracker?: ErrorTracker;
  private logAnalyzer?: LogAnalyzer;
  private serviceName: string;

  constructor(config: LoggingConfig) {
    this.serviceName = config.serviceName;

    // Initialize structured logger
    this.logger = new StructuredLogger({
      service: config.serviceName,
      environment: config.environment,
      version: config.version,
      elasticsearchUrl: config.elasticsearchUrl,
      logLevel: config.logLevel,
    });

    // Initialize error tracker if enabled
    if (config.enableErrorTracking) {
      this.errorTracker = new ErrorTracker(
        this.logger,
        config.serviceName,
        config.errorNotificationConfig
      );
    }

    // Initialize log analyzer if enabled
    if (config.enableLogAnalysis) {
      this.logAnalyzer = new LogAnalyzer(this.logger, config.elasticsearchUrl);
    }
  }

  // Request logging middleware
  public requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = uuidv4();

      // Add request ID to request object
      (req as any).requestId = requestId;

      // Create child logger with request context
      const requestLogger = this.logger.child({
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
      });

      // Add logger to request for use in route handlers
      (req as any).logger = requestLogger;

      // Set error tracker context if available
      if (this.errorTracker) {
        this.errorTracker.setRequestContext(
          requestId,
          req.method,
          req.url,
          req.ip
        );
        (req as any).errorTracker = this.errorTracker;
      }

      // Log request start
      requestLogger.info('Request started', {
        headers: this.sanitizeHeaders(req.headers),
        query: req.query,
        params: req.params,
      });

      // Log request completion
      res.on('finish', () => {
        const duration = Date.now() - startTime;

        requestLogger.httpRequest(req, res, duration);

        // Add to log analyzer if available
        if (this.logAnalyzer) {
          this.logAnalyzer.addLogEntry({
            timestamp: new Date(),
            level: res.statusCode >= 400 ? 'error' : 'info',
            message: `${req.method} ${req.url}`,
            service: this.serviceName,
            metadata: {
              method: req.method,
              url: req.url,
              statusCode: res.statusCode,
              duration,
              requestId,
            },
          });
        }
      });

      next();
    };
  }

  // Error handling middleware
  public errorHandler() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const requestLogger = (req as any).logger || this.logger;
      const errorTracker = (req as any).errorTracker || this.errorTracker;

      // Capture error with error tracker
      let errorId: string | undefined;

      if (errorTracker) {
        errorId = errorTracker.captureError(error, {
          severity: this.determineSeverityFromStatus(res.statusCode),
          context: {
            requestId: (req as any).requestId,
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: (req as any).user?.id,
          },
          tags: ['http-error', `status-${res.statusCode}`],
          metadata: {
            headers: this.sanitizeHeaders(req.headers),
            query: req.query,
            params: req.params,
            body: this.sanitizeRequestBody(req.body),
          },
        });
      }

      // Log error
      requestLogger.error('Request error', error, {
        errorId,
        statusCode: res.statusCode,
        stack: error.stack,
      });

      // Add error ID to response headers for tracking
      if (errorId) {
        res.set('X-Error-ID', errorId);
      }

      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = {
        error: 'Internal Server Error',
        message: isDevelopment ? error.message : 'Something went wrong',
        ...(isDevelopment && { stack: error.stack }),
        ...(errorId && { errorId }),
      };

      res.status(res.statusCode || 500).json(errorResponse);
    };
  }

  // Database operation logging wrapper
  public async logDbOperation<T>(
    operation: string,
    handler: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await handler();
      const duration = Date.now() - startTime;

      this.logger.dbOperation(operation, duration, true, metadata);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.dbOperation(operation, duration, false, {
        ...metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (this.errorTracker) {
        this.errorTracker.captureError(error as Error, {
          context: { operation, component: 'database' },
          tags: ['database-error'],
          metadata,
        });
      }

      throw error;
    }
  }

  // Queue operation logging wrapper
  public async logQueueOperation<T>(
    queueName: string,
    operation: string,
    handler: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await handler();
      const duration = Date.now() - startTime;

      this.logger.queueOperation(
        queueName,
        operation,
        duration,
        true,
        metadata
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.queueOperation(queueName, operation, duration, false, {
        ...metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (this.errorTracker) {
        this.errorTracker.captureError(error as Error, {
          context: { queueName, operation, component: 'queue' },
          tags: ['queue-error'],
          metadata,
        });
      }

      throw error;
    }
  }

  // External API call logging wrapper
  public async logApiCall<T>(
    url: string,
    method: string,
    handler: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await handler();
      const duration = Date.now() - startTime;

      // Assume success if no error thrown
      this.logger.apiCall(url, method, 200, duration, metadata);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = (error as any).response?.status || 500;

      this.logger.apiCall(url, method, statusCode, duration, {
        ...metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (this.errorTracker) {
        this.errorTracker.captureError(error as Error, {
          context: { url, method, component: 'http-client' },
          tags: ['api-error'],
          metadata: { ...metadata, statusCode },
        });
      }

      throw error;
    }
  }

  // Business event logging
  public logBusinessEvent(
    event: string,
    metadata?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.logger.businessEvent(event, metadata, context);

    // Add to log analyzer if available
    if (this.logAnalyzer) {
      this.logAnalyzer.addLogEntry({
        timestamp: new Date(),
        level: 'info',
        message: `Business event: ${event}`,
        service: this.serviceName,
        metadata: {
          event,
          component: 'business',
          ...metadata,
          ...context,
        },
      });
    }
  }

  // Security event logging
  public logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.logger.securityEvent(event, severity, metadata, context);

    // Always capture security events with error tracker
    if (this.errorTracker && (severity === 'high' || severity === 'critical')) {
      const error = new Error(`Security event: ${event}`);

      this.errorTracker.captureError(error, {
        severity,
        context: { ...context, component: 'security' },
        tags: ['security-event', severity],
        metadata,
      });
    }
  }

  // Performance logging
  public logPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.logger.performance(operation, duration, metadata, context);

    // Add to log analyzer for performance monitoring
    if (this.logAnalyzer) {
      this.logAnalyzer.addLogEntry({
        timestamp: new Date(),
        level: duration > 1000 ? 'warning' : 'info',
        message: `Performance: ${operation}`,
        service: this.serviceName,
        metadata: {
          operation,
          duration,
          component: 'performance',
          ...metadata,
          ...context,
        },
      });
    }
  }

  // Audit logging
  public logAudit(
    action: string,
    resource: string,
    userId?: string,
    metadata?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.logger.audit(action, resource, userId, metadata, context);
  }

  // Get logger instance
  public getLogger(): StructuredLogger {
    return this.logger;
  }

  // Get error tracker instance
  public getErrorTracker(): ErrorTracker | undefined {
    return this.errorTracker;
  }

  // Get log analyzer instance
  public getLogAnalyzer(): LogAnalyzer | undefined {
    return this.logAnalyzer;
  }

  private determineSeverityFromStatus(
    statusCode: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (statusCode >= 400 && statusCode < 500) {
      return statusCode === 404 ? 'low' : 'medium';
    }

    if (statusCode >= 500) {
      return statusCode === 503 ? 'critical' : 'high';
    }

    return 'low';
  }

  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'credit_card',
      'ssn',
    ];

    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

// Factory function
export const createLoggingMiddleware = (
  config: LoggingConfig
): LoggingMiddleware => {
  return new LoggingMiddleware(config);
};
