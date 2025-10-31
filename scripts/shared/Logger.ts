import * as fs from 'fs';
import * as path from 'path';
import { createLogger, format, transports } from 'winston';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

// Log context interface
export interface LogContext {
  [key: string]: unknown;
  tool?: string;
  operation?: string;
  duration?: number;
  platform?: string;
  userId?: string;
  sessionId?: string;
}

// Performance tracking interface
export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  operation: string;
}

// Enhanced logger configuration
const logDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create enhanced logger instance
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    format.json()
  ),
  defaultMeta: {
    service: 'developer-tools',
    pid: process.pid,
    hostname: require('os').hostname(),
  },
  transports: [
    // Console transport with colors
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, metadata }) => {
          const meta =
            metadata && Object.keys(metadata).length > 0
              ? ` ${JSON.stringify(metadata)}`
              : '';

          return `${timestamp} [${level}] ${message}${meta}`;
        })
      ),
    }),
    // File transport for all logs
    new transports.File({
      filename: path.join(logDir, 'developer-tools.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    // Error-only file transport
    new transports.File({
      filename: path.join(logDir, 'errors.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

// Performance tracking storage
const performanceMetrics = new Map<string, PerformanceMetrics>();

// Enhanced structured logging interface
export const log = {
  /**
   * Log info message with context
   */
  info: (msg: string, context?: LogContext) => {
    console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`);
    logger.info(msg, context);
  },

  /**
   * Log success message with context
   */
  success: (msg: string, context?: LogContext) => {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`);
    logger.info(msg, { ...context, level: 'success' });
  },

  /**
   * Log warning message with context
   */
  warning: (msg: string, context?: LogContext) => {
    console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`);
    logger.warn(msg, context);
  },

  /**
   * Log error message with enhanced error handling
   */
  error: (msg: string, error?: Error | unknown, context?: LogContext) => {
    console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`);

    const errorContext: LogContext = {
      ...context,
    };

    if (error instanceof Error) {
      errorContext.errorName = error.name;
      errorContext.errorMessage = error.message;
      errorContext.errorStack = error.stack;
    }

    if (
      error &&
      typeof error === 'object' &&
      error !== null &&
      'code' in error
    ) {
      errorContext.errorCode = (error as { code: unknown }).code;
    }

    logger.error(msg, errorContext);
  },

  /**
   * Log debug message (only when DEBUG is enabled)
   */
  debug: (msg: string, context?: LogContext) => {
    if (process.env.DEBUG || process.env.LOG_LEVEL === 'debug') {
      console.log(`${colors.magenta}[DEBUG]${colors.reset} ${msg}`);
    }
    logger.debug(msg, context);
  },

  /**
   * Log step in a process
   */
  step: (msg: string, context?: LogContext) => {
    console.log(`${colors.cyan}[STEP]${colors.reset} ${msg}`);
    logger.info(msg, { ...context, level: 'step' });
  },

  /**
   * Log trace information (most verbose)
   */
  trace: (msg: string, context?: LogContext) => {
    if (process.env.LOG_LEVEL === 'trace') {
      console.log(`${colors.gray}[TRACE]${colors.reset} ${msg}`);
    }
    logger.debug(msg, { ...context, level: 'trace' });
  },

  /**
   * Start performance tracking for an operation
   */
  startTimer: (operation: string, context?: LogContext): string => {
    const timerId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const metrics: PerformanceMetrics = {
      startTime: Date.now(),
      operation,
    };

    performanceMetrics.set(timerId, metrics);

    log.debug(`Started timer for operation: ${operation}`, {
      ...context,
      timerId,
      operation,
    });

    return timerId;
  },

  /**
   * End performance tracking and log results
   */
  endTimer: (timerId: string, context?: LogContext) => {
    const metrics = performanceMetrics.get(timerId);

    if (!metrics) {
      log.warning(`Timer not found: ${timerId}`);

      return;
    }

    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.memoryUsage = process.memoryUsage();

    log.info(`Operation completed: ${metrics.operation}`, {
      ...context,
      timerId,
      operation: metrics.operation,
      duration: metrics.duration,
      memoryUsage: {
        rss: Math.round(metrics.memoryUsage.rss / 1024 / 1024),
        heapUsed: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024),
      },
    });

    performanceMetrics.delete(timerId);
  },

  /**
   * Log with custom level and context
   */
  log: (level: keyof typeof LogLevel, msg: string, context?: LogContext) => {
    const levelColor =
      {
        ERROR: colors.red,
        WARN: colors.yellow,
        INFO: colors.blue,
        DEBUG: colors.magenta,
        TRACE: colors.gray,
      }[level] || colors.white;

    console.log(`${levelColor}[${level}]${colors.reset} ${msg}`);
    logger.log(level.toLowerCase(), msg, context);
  },

  /**
   * Create a child logger with additional context
   */
  child: (defaultContext: LogContext) => ({
    info: (msg: string, context?: LogContext) =>
      log.info(msg, { ...defaultContext, ...context }),
    success: (msg: string, context?: LogContext) =>
      log.success(msg, { ...defaultContext, ...context }),
    warning: (msg: string, context?: LogContext) =>
      log.warning(msg, { ...defaultContext, ...context }),
    error: (msg: string, error?: Error | unknown, context?: LogContext) =>
      log.error(msg, error, { ...defaultContext, ...context }),
    debug: (msg: string, context?: LogContext) =>
      log.debug(msg, { ...defaultContext, ...context }),
    step: (msg: string, context?: LogContext) =>
      log.step(msg, { ...defaultContext, ...context }),
    trace: (msg: string, context?: LogContext) =>
      log.trace(msg, { ...defaultContext, ...context }),
  }),

  /**
   * Log system information
   */
  system: (msg: string, systemInfo?: Record<string, unknown>) => {
    log.info(msg, {
      ...systemInfo,
      level: 'system',
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime(),
    });
  },

  /**
   * Log security-related events
   */
  security: (msg: string, context?: LogContext) => {
    console.log(
      `${colors.red}${colors.bright}[SECURITY]${colors.reset} ${msg}`
    );
    logger.warn(msg, { ...context, level: 'security', security: true });
  },

  /**
   * Log audit events
   */
  audit: (action: string, context?: LogContext) => {
    console.log(
      `${colors.cyan}${colors.bright}[AUDIT]${colors.reset} ${action}`
    );
    logger.info(action, {
      ...context,
      level: 'audit',
      audit: true,
      timestamp: new Date().toISOString(),
    });
  },
};

// Export the winston logger instance for advanced usage
export { logger };
export default logger;
