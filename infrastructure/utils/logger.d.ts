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
export declare function createLogger(context: string): Logger;
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map