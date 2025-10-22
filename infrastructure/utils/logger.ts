/**
 * Centralized Logging Utility
 * Provides structured logging with different levels and contexts
 */

export interface LogContext {
  [key: string]: any;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

class ConsoleLogger implements Logger {
  constructor(private context: string) {}

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.debug(`[DEBUG] [${this.context}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
    }
  }

  info(message: string, context?: LogContext): void {
    console.info(`[INFO] [${this.context}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
  }

  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] [${this.context}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
  }

  error(message: string, context?: LogContext): void {
    console.error(`[ERROR] [${this.context}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
  }
}

export function createLogger(context: string): Logger {
  return new ConsoleLogger(context);
}

// Default logger instance for infrastructure utilities
export const logger = createLogger('infrastructure');
