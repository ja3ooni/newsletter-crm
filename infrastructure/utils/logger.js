"use strict";
/**
 * Centralized Logging Utility
 * Provides structured logging with different levels and contexts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.createLogger = void 0;
class ConsoleLogger {
    context;
    constructor(context) {
        this.context = context;
    }
    debug(message, context) {
        if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
            console.debug(`[DEBUG] [${this.context}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
        }
    }
    info(message, context) {
        console.info(`[INFO] [${this.context}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
    }
    warn(message, context) {
        console.warn(`[WARN] [${this.context}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
    }
    error(message, context) {
        console.error(`[ERROR] [${this.context}] ${message}`, context ? JSON.stringify(context, null, 2) : '');
    }
}
function createLogger(context) {
    return new ConsoleLogger(context);
}
exports.createLogger = createLogger;
// Default logger instance for infrastructure utilities
exports.logger = createLogger('infrastructure');
//# sourceMappingURL=logger.js.map