// @ts-nocheck
/**
 * Centralized error handling utilities
 */

import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { BaseError, InternalServerError } from './BaseError';

/**
 * Express error handling middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logError(error, {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
  });

  // Handle known application errors
  if (error instanceof BaseError) {
    res.status(error.statusCode).json(error.getApiResponse());
    return;
  }

  // Handle unknown errors
  const internalError = new InternalServerError('An unexpected error occurred');
  res.status(500).json(internalError.getApiResponse());
}

/**
 * Async error wrapper for Express routes
 */
export function asyncHandler<T extends any[]>(
  fn: (
    req: Request,
    res: Response,
    next: NextFunction,
    ...args: T
  ) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction, ...args: T) => {
    Promise.resolve(fn(req, res, next, ...args)).catch(next);
  };
}

/**
 * Log error with structured logging
 */
export function logError(error: Error, context?: Record<string, any>): void {
  const errorInfo = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context,
  };

  if (error instanceof BaseError) {
    errorInfo.code = error.code;
    errorInfo.statusCode = error.statusCode;
    errorInfo.context = error.context;
    errorInfo.timestamp = error.timestamp;
  }

  logger.error('Application error occurred', errorInfo);
}

/**
 * Handle unhandled promise rejections
 */
export function handleUnhandledRejection(): void {
  process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString(),
    });

    // Graceful shutdown
    process.exit(1);
  });
}

/**
 * Handle uncaught exceptions
 */
export function handleUncaughtException(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    // Graceful shutdown
    process.exit(1);
  });
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  handleUnhandledRejection();
  handleUncaughtException();
}

/**
 * Create error from unknown value
 */
export function createErrorFromUnknown(error: unknown): BaseError {
  if (error instanceof BaseError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message, undefined, error);
  }

  return new InternalServerError(String(error));
}

/**
 * Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Safe error stack extraction
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}
