// @ts-nocheck
import { logger } from '@/utils/logger';
import { NextFunction, Request, Response } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class ValidationError extends Error {
  statusCode = 400;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  isOperational = true;

  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  isOperational = true;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  isOperational = true;

  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error details
  logger.error('Request error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
    },
  });

  // Handle known operational errors
  if (error.isOperational && error.statusCode) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });

    return;
  }

  // Handle validation errors from express-validator
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: error.message,
      type: 'validation_error',
    });

    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      message: 'Invalid token',
    });

    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Token expired',
    });

    return;
  }

  // Handle database errors
  if (error.message?.includes('duplicate key')) {
    res.status(409).json({
      success: false,
      message: 'Resource already exists',
    });

    return;
  }

  if (error.message?.includes('foreign key constraint')) {
    res.status(400).json({
      success: false,
      message: 'Invalid reference to related resource',
    });

    return;
  }

  // Handle unexpected errors
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      error: error.message,
      stack: error.stack,
    }),
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
