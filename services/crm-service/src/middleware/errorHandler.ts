import { CRMError, ValidationError } from '@/types';
import logger from '@/utils/logger';
import { NextFunction, Request, Response } from 'express';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logger.error('Request error:', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    user: req.user?.id,
  });

  // Handle known CRM errors
  if (error instanceof CRMError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.constructor.name,
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
    return;
  }

  // Handle validation errors
  if (error.name === 'ValidationError' || error instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: error.message,
    });
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'UnauthorizedError',
      message: 'Invalid token',
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'UnauthorizedError',
      message: 'Token expired',
    });
    return;
  }

  // Handle database errors
  if (error.name === 'QueryFailedError' || error.message.includes('duplicate key')) {
    res.status(409).json({
      success: false,
      error: 'ConflictError',
      message: 'Resource already exists',
    });
    return;
  }

  // Handle foreign key constraint errors
  if (error.message.includes('foreign key constraint')) {
    res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Invalid reference to related resource',
    });
    return;
  }

  // Handle syntax errors in request body
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Invalid JSON in request body',
    });
    return;
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && {
      originalError: error.message,
      stack: error.stack,
    }),
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: 'NotFoundError',
    message: `Route ${req.method} ${req.path} not found`,
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
