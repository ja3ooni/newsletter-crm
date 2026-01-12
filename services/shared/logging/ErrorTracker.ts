import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { StructuredLogger } from './StructuredLogger';

export interface ErrorReport {
  id: string;
  timestamp: Date;
  service: string;
  environment: string;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  context: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    traceId?: string;
    spanId?: string;
    url?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
    [key: string]: any;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  fingerprint: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface ErrorPattern {
  fingerprint: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  resolved: boolean;
  assignee?: string;
  notes?: string;
}

export interface ErrorNotificationConfig {
  webhookUrl?: string;
  slackWebhook?: string;
  emailRecipients?: string[];
  severityThreshold: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorTracker {
  private logger: StructuredLogger;
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private notificationConfig?: ErrorNotificationConfig;
  private serviceName: string;

  constructor(
    logger: StructuredLogger,
    serviceName: string,
    notificationConfig?: ErrorNotificationConfig
  ) {
    this.logger = logger;
    this.serviceName = serviceName;
    this.notificationConfig = notificationConfig;

    // Set up global error handlers
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.captureError(error, {
        severity: 'critical',
        context: { source: 'uncaughtException' },
        tags: ['uncaught-exception', 'critical'],
      });

      // Give time for error to be logged before exiting
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));

      this.captureError(error, {
        severity: 'high',
        context: {
          source: 'unhandledRejection',
          promise: promise.toString(),
        },
        tags: ['unhandled-rejection', 'promise'],
      });
    });

    // Handle warning events
    process.on('warning', (warning: Error) => {
      this.captureError(warning, {
        severity: 'low',
        context: { source: 'warning' },
        tags: ['warning'],
      });
    });
  }

  public captureError(
    error: Error,
    options: {
      severity?: 'low' | 'medium' | 'high' | 'critical';
      context?: Record<string, any>;
      tags?: string[];
      metadata?: Record<string, any>;
      fingerprint?: string;
    } = {}
  ): string {
    const errorId = uuidv4();
    const timestamp = new Date();

    // Generate fingerprint for error grouping
    const fingerprint = options.fingerprint || this.generateFingerprint(error);

    // Determine severity
    const severity = options.severity || this.determineSeverity(error);

    // Create error report
    const errorReport: ErrorReport = {
      id: errorId,
      timestamp,
      service: this.serviceName,
      environment: process.env.NODE_ENV || 'development',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      },
      context: {
        ...options.context,
      },
      severity,
      fingerprint,
      tags: options.tags || [],
      metadata: options.metadata || {},
    };

    // Update error patterns
    this.updateErrorPattern(fingerprint, timestamp);

    // Log the error
    this.logger.error(
      `Error captured: ${error.message}`,
      error,
      {
        errorId,
        fingerprint,
        severity,
        ...options.metadata,
      },
      options.context
    );

    // Send notifications if configured
    if (this.shouldNotify(severity)) {
      this.sendNotification(errorReport);
    }

    // Store error report (in a real implementation, this would go to a database)
    this.storeErrorReport(errorReport);

    return errorId;
  }

  public captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: Record<string, any>,
    tags?: string[]
  ): string {
    const messageId = uuidv4();

    this.logger.info(
      message,
      {
        messageId,
        level,
        tags,
      },
      context
    );

    return messageId;
  }

  public addBreadcrumb(
    message: string,
    category: string = 'default',
    level: 'info' | 'warning' | 'error' = 'info',
    data?: Record<string, any>
  ): void {
    this.logger.debug('Breadcrumb', {
      breadcrumb: {
        message,
        category,
        level,
        timestamp: new Date().toISOString(),
        data,
      },
    });
  }

  public setUserContext(
    userId: string,
    email?: string,
    username?: string
  ): void {
    this.logger = this.logger.child({
      userId,
      userEmail: email,
      username,
    });
  }

  public setRequestContext(
    requestId: string,
    method: string,
    url: string,
    ip?: string
  ): void {
    this.logger = this.logger.child({
      requestId,
      method,
      url,
      ip,
    });
  }

  public setTraceContext(traceId: string, spanId: string): void {
    this.logger = this.logger.child({
      traceId,
      spanId,
    });
  }

  public addTag(key: string, value: string): void {
    this.logger = this.logger.child({
      [key]: value,
    });
  }

  public addExtra(key: string, value: any): void {
    this.logger = this.logger.child({
      [key]: value,
    });
  }

  // Express middleware for automatic error tracking
  public expressMiddleware() {
    return (error: Error, req: any, res: any, next: any) => {
      const errorId = this.captureError(error, {
        severity: this.determineSeverityFromHttpError(error, res.statusCode),
        context: {
          requestId: req.id,
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: req.user?.id,
          sessionId: req.sessionID,
        },
        tags: ['http-error', `status-${res.statusCode}`],
        metadata: {
          headers: req.headers,
          query: req.query,
          params: req.params,
          body: this.sanitizeRequestBody(req.body),
        },
      });

      // Add error ID to response for tracking
      res.set('X-Error-ID', errorId);

      next(error);
    };
  }

  // Get error statistics
  public getErrorStats(timeRange: { start: Date; end: Date }): {
    total: number;
    bySeverity: Record<string, number>;
    byFingerprint: Record<string, number>;
    topErrors: ErrorPattern[];
  } {
    const patterns = Array.from(this.errorPatterns.values());
    const filteredPatterns = patterns.filter(
      p => p.lastSeen >= timeRange.start && p.lastSeen <= timeRange.end
    );

    const bySeverity: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const byFingerprint: Record<string, number> = {};
    let total = 0;

    filteredPatterns.forEach(pattern => {
      total += pattern.count;
      byFingerprint[pattern.fingerprint] = pattern.count;
    });

    const topErrors = filteredPatterns
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total,
      bySeverity,
      byFingerprint,
      topErrors,
    };
  }

  private generateFingerprint(error: Error): string {
    // Create a fingerprint based on error type and stack trace
    const stackLines = error.stack?.split('\n').slice(0, 3) || [];
    const key = `${error.name}:${error.message}:${stackLines.join(':')}`;

    // Simple hash function
    let hash = 0;

    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);

      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  private determineSeverity(
    error: Error
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Determine severity based on error type and properties
    if (error.name === 'ValidationError' || error.name === 'BadRequestError') {
      return 'low';
    }

    if (error.name === 'UnauthorizedError' || error.name === 'ForbiddenError') {
      return 'medium';
    }

    if (error.name === 'DatabaseError' || error.name === 'TimeoutError') {
      return 'high';
    }

    if (
      error.name === 'SystemError' ||
      error.message.includes('ECONNREFUSED')
    ) {
      return 'critical';
    }

    return 'medium';
  }

  private determineSeverityFromHttpError(
    error: Error,
    statusCode: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (statusCode >= 400 && statusCode < 500) {
      return statusCode === 404 ? 'low' : 'medium';
    }

    if (statusCode >= 500) {
      return statusCode === 503 ? 'critical' : 'high';
    }

    return this.determineSeverity(error);
  }

  private updateErrorPattern(fingerprint: string, timestamp: Date): void {
    const existing = this.errorPatterns.get(fingerprint);

    if (existing) {
      existing.count++;
      existing.lastSeen = timestamp;
    } else {
      this.errorPatterns.set(fingerprint, {
        fingerprint,
        count: 1,
        firstSeen: timestamp,
        lastSeen: timestamp,
        resolved: false,
      });
    }
  }

  private shouldNotify(
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): boolean {
    if (!this.notificationConfig) return false;

    const severityLevels = ['low', 'medium', 'high', 'critical'];
    const thresholdIndex = severityLevels.indexOf(
      this.notificationConfig.severityThreshold
    );
    const errorIndex = severityLevels.indexOf(severity);

    return errorIndex >= thresholdIndex;
  }

  private async sendNotification(errorReport: ErrorReport): Promise<void> {
    if (!this.notificationConfig) return;

    try {
      // Send to webhook
      if (this.notificationConfig.webhookUrl) {
        await axios.post(this.notificationConfig.webhookUrl, errorReport, {
          timeout: 5000,
        });
      }

      // Send to Slack
      if (this.notificationConfig.slackWebhook) {
        await this.sendSlackNotification(errorReport);
      }

      // Send email notifications would be implemented here
    } catch (error) {
      this.logger.warn('Failed to send error notification', error);
    }
  }

  private async sendSlackNotification(errorReport: ErrorReport): Promise<void> {
    if (!this.notificationConfig?.slackWebhook) return;

    const color = {
      low: 'good',
      medium: 'warning',
      high: 'danger',
      critical: '#ff0000',
    }[errorReport.severity];

    const payload = {
      attachments: [
        {
          color,
          title: `🚨 ${errorReport.severity.toUpperCase()} Error in ${errorReport.service}`,
          text: errorReport.error.message,
          fields: [
            {
              title: 'Error Type',
              value: errorReport.error.name,
              short: true,
            },
            {
              title: 'Environment',
              value: errorReport.environment,
              short: true,
            },
            {
              title: 'Error ID',
              value: errorReport.id,
              short: true,
            },
            {
              title: 'Timestamp',
              value: errorReport.timestamp.toISOString(),
              short: true,
            },
          ],
          footer: 'DatatechtonCRM Error Tracking',
          ts: Math.floor(errorReport.timestamp.getTime() / 1000),
        },
      ],
    };

    await axios.post(this.notificationConfig.slackWebhook, payload);
  }

  private sanitizeRequestBody(body: any): any {
    if (!body) return body;

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = { ...body };

    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private storeErrorReport(errorReport: ErrorReport): void {
    // In a real implementation, this would store to a database
    // For now, we'll just log it
    this.logger.info('Error report stored', {
      errorId: errorReport.id,
      fingerprint: errorReport.fingerprint,
      severity: errorReport.severity,
    });
  }
}

// Factory function
export const createErrorTracker = (
  logger: StructuredLogger,
  serviceName: string,
  notificationConfig?: ErrorNotificationConfig
): ErrorTracker => {
  return new ErrorTracker(logger, serviceName, notificationConfig);
};
