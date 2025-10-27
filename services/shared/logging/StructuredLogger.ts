import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

export interface LogContext {
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  service: string;
  environment: string;
  version?: string;
}

export interface LogMetadata {
  [key: string]: any;
}

export interface ErrorContext extends LogContext {
  errorId: string;
  errorType: string;
  stackTrace?: string;
  userAgent?: string;
  ip?: string;
  url?: string;
  method?: string;
}

export class StructuredLogger {
  private logger: winston.Logger;
  private defaultContext: Partial<LogContext>;

  constructor(config: {
    service: string;
    environment?: string;
    version?: string;
    elasticsearchUrl?: string;
    logLevel?: string;
  }) {
    this.defaultContext = {
      service: config.service,
      environment: config.environment || process.env.NODE_ENV || 'development',
      version: config.version || process.env.npm_package_version || '1.0.0',
    };

    const transports: winston.transport[] = [
      // Console transport with colorized output for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(
            ({ timestamp, level, message, service, traceId, ...meta }) => {
              const traceInfo = traceId
                ? `[${String(traceId).substring(0, 8)}]`
                : '';
              const metaStr =
                Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';

              return `${timestamp} ${level} [${service}]${traceInfo}: ${message} ${metaStr}`;
            }
          )
        ),
      }),
    ];

    // Add file transports for production
    if (this.defaultContext.environment === 'production') {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: this.getStructuredFormat(),
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: this.getStructuredFormat(),
          maxsize: 100 * 1024 * 1024, // 100MB
          maxFiles: 10,
        })
      );
    }

    // Add Elasticsearch transport if configured
    if (config.elasticsearchUrl) {
      transports.push(
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: config.elasticsearchUrl,
          },
          index: `ailert-logs-${this.defaultContext.environment}`,
          indexTemplate: {
            name: 'ailert-logs-template',
            body: {
              index_patterns: ['ailert-logs-*'],
              settings: {
                number_of_shards: 1,
                number_of_replicas: 0,
                'index.refresh_interval': '5s',
              },
              mappings: {
                properties: {
                  '@timestamp': { type: 'date' },
                  level: { type: 'keyword' },
                  message: { type: 'text' },
                  service: { type: 'keyword' },
                  environment: { type: 'keyword' },
                  traceId: { type: 'keyword' },
                  spanId: { type: 'keyword' },
                  userId: { type: 'keyword' },
                  errorId: { type: 'keyword' },
                  errorType: { type: 'keyword' },
                  url: { type: 'keyword' },
                  method: { type: 'keyword' },
                  statusCode: { type: 'integer' },
                  duration: { type: 'float' },
                  ip: { type: 'ip' },
                },
              },
            },
          },
        })
      );
    }

    this.logger = winston.createLogger({
      level: config.logLevel || process.env.LOG_LEVEL || 'info',
      format: this.getStructuredFormat(),
      defaultMeta: this.defaultContext,
      transports,
      exitOnError: false,
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new winston.transports.File({ filename: 'logs/exceptions.log' })
    );

    this.logger.rejections.handle(
      new winston.transports.File({ filename: 'logs/rejections.log' })
    );
  }

  private getStructuredFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(info => {
        // Ensure consistent structure
        const { timestamp, level, message, ...otherInfo } = info;
        const logEntry = {
          '@timestamp': timestamp,
          level,
          message,
          service: info.service || this.defaultContext.service,
          environment: info.environment || this.defaultContext.environment,
          version: info.version || this.defaultContext.version,
          ...otherInfo,
        };

        return JSON.stringify(logEntry);
      })
    );
  }

  // Create a child logger with additional context
  public child(context: Partial<LogContext>): StructuredLogger {
    const childLogger = Object.create(this);

    childLogger.defaultContext = { ...this.defaultContext, ...context };
    childLogger.logger = this.logger.child(context);

    return childLogger;
  }

  // Generate correlation ID for request tracking
  public generateCorrelationId(): string {
    return uuidv4();
  }

  // Info level logging
  public info(
    message: string,
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    this.log('info', message, metadata, context);
  }

  // Warning level logging
  public warn(
    message: string,
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    this.log('warn', message, metadata, context);
  }

  // Error level logging
  public error(
    message: string,
    error?: Error,
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    const errorContext: Partial<ErrorContext> = {
      ...context,
      errorId: uuidv4(),
      errorType: error?.constructor.name || 'UnknownError',
      stackTrace: error?.stack,
    };

    this.log(
      'error',
      message,
      { ...metadata, error: error?.message },
      errorContext
    );
  }

  // Debug level logging
  public debug(
    message: string,
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    this.log('debug', message, metadata, context);
  }

  // HTTP request logging
  public httpRequest(
    req: any,
    res: any,
    duration: number,
    context?: Partial<LogContext>
  ): void {
    const requestContext = {
      ...context,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      requestId: req.id || this.generateCorrelationId(),
    };

    const level = res.statusCode >= 400 ? 'warn' : 'info';

    this.log(level, `HTTP ${req.method} ${req.url}`, requestContext);
  }

  // Database operation logging
  public dbOperation(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    const dbContext = {
      ...context,
      operation,
      duration,
      success,
      component: 'database',
    };

    const level = success ? 'info' : 'error';

    this.log(level, `Database operation: ${operation}`, {
      ...metadata,
      ...dbContext,
    });
  }

  // Queue operation logging
  public queueOperation(
    queue: string,
    operation: string,
    duration: number,
    success: boolean,
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    const queueContext = {
      ...context,
      queue,
      operation,
      duration,
      success,
      component: 'queue',
    };

    const level = success ? 'info' : 'error';

    this.log(level, `Queue operation: ${queue}.${operation}`, {
      ...metadata,
      ...queueContext,
    });
  }

  // External API call logging
  public apiCall(
    url: string,
    method: string,
    statusCode: number,
    duration: number,
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    const apiContext = {
      ...context,
      url,
      method,
      statusCode,
      duration,
      component: 'http-client',
    };

    const level = statusCode >= 400 ? 'warn' : 'info';

    this.log(level, `API call: ${method} ${url}`, {
      ...metadata,
      ...apiContext,
    });
  }

  // Business event logging
  public businessEvent(
    event: string,
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    const eventContext = {
      ...context,
      event,
      component: 'business',
    };

    this.log('info', `Business event: ${event}`, {
      ...metadata,
      ...eventContext,
    });
  }

  // Security event logging
  public securityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    const securityContext = {
      ...context,
      event,
      severity,
      component: 'security',
    };

    const level =
      severity === 'critical' || severity === 'high' ? 'error' : 'warn';

    this.log(level, `Security event: ${event}`, {
      ...metadata,
      ...securityContext,
    });
  }

  // Performance logging
  public performance(
    operation: string,
    duration: number,
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    const perfContext = {
      ...context,
      operation,
      duration,
      component: 'performance',
    };

    // Log as warning if operation is slow
    const level = duration > 1000 ? 'warn' : 'info';

    this.log(level, `Performance: ${operation}`, {
      ...metadata,
      ...perfContext,
    });
  }

  // Audit logging for compliance
  public audit(
    action: string,
    resource: string,
    userId?: string,
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    const auditContext = {
      ...context,
      action,
      resource,
      userId,
      component: 'audit',
    };

    this.log('info', `Audit: ${action} on ${resource}`, {
      ...metadata,
      ...auditContext,
    });
  }

  private log(
    level: string,
    message: string,
    metadata?: LogMetadata,
    context?: Partial<LogContext>
  ): void {
    const logData = {
      ...this.defaultContext,
      ...context,
      ...metadata,
    };

    this.logger.log(level, message, logData);
  }

  // Get logger instance for advanced usage
  public getLogger(): winston.Logger {
    return this.logger;
  }

  // Flush logs (useful for testing)
  public async flush(): Promise<void> {
    return new Promise(resolve => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}

// Factory function to create structured logger
export const createStructuredLogger = (config: {
  service: string;
  environment?: string;
  version?: string;
  elasticsearchUrl?: string;
  logLevel?: string;
}): StructuredLogger => {
  return new StructuredLogger(config);
};

// Default logger instance
export const logger = createStructuredLogger({
  service: 'ailert-shared',
  elasticsearchUrl: process.env.ELASTICSEARCH_URL,
});
