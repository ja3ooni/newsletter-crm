import { isDevelopment, loggingConfig } from '@/config';
import winston from 'winston';

const { combine, timestamp, errors, json, simple, colorize, printf } = winston.format;

// Custom format for development
const developmentFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

// Create logger instance
export const logger = winston.createLogger({
  level: loggingConfig.level,
  format: combine(
    timestamp(),
    errors({ stack: true }),
    isDevelopment
      ? combine(colorize(), developmentFormat)
      : json()
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'test',
    }),
  ],
});

// Add file transport in production
if (loggingConfig.transports.file.enabled) {
  logger.add(
    new winston.transports.File({
      filename: loggingConfig.transports.file.filename,
      maxsize: loggingConfig.transports.file.maxsize,
      maxFiles: loggingConfig.transports.file.maxFiles,
    })
  );
}

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};

// Error logging
export const logError = (error: Error, context?: Record<string, any>): void => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

// Performance logging
export const logPerformance = (operation: string, duration: number, metadata?: Record<string, any>): void => {
  logger.info('Performance Metric', {
    operation,
    duration,
    ...metadata,
  });
};

// Security logging
export const logSecurityEvent = (event: string, details: Record<string, any>): void => {
  logger.warn('Security Event', {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
};
