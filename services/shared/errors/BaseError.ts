/**
 * Base error classes for consistent error handling across all services
 */

export interface ErrorContext {
  [key: string]: any;
}

export interface ErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  context?: ErrorContext;
  cause?: Error;
}

/**
 * Base application error class
 */
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: ErrorContext;
  public readonly cause?: Error;
  public readonly timestamp: Date;

  constructor(details: ErrorDetails, isOperational = true) {
    super(details.message);

    this.name = this.constructor.name;
    this.code = details.code;
    this.statusCode = details.statusCode;
    this.isOperational = isOperational;
    this.context = details.context;
    this.cause = details.cause;
    this.timestamp = new Date();

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging and API responses
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      ...(this.cause && { cause: this.cause.message }),
    };
  }

  /**
   * Get error details for API response
   */
  getApiResponse(): Record<string, any> {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.context && { details: this.context }),
      },
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends BaseError {
  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super({
      code: 'VALIDATION_ERROR',
      message,
      statusCode: 400,
      context,
      cause,
    });
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends BaseError {
  constructor(
    message = 'Authentication required',
    context?: ErrorContext,
    cause?: Error
  ) {
    super({
      code: 'AUTHENTICATION_ERROR',
      message,
      statusCode: 401,
      context,
      cause,
    });
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends BaseError {
  constructor(
    message = 'Insufficient permissions',
    context?: ErrorContext,
    cause?: Error
  ) {
    super({
      code: 'AUTHORIZATION_ERROR',
      message,
      statusCode: 403,
      context,
      cause,
    });
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends BaseError {
  constructor(resource: string, context?: ErrorContext, cause?: Error) {
    super({
      code: 'NOT_FOUND_ERROR',
      message: `${resource} not found`,
      statusCode: 404,
      context,
      cause,
    });
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends BaseError {
  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super({
      code: 'CONFLICT_ERROR',
      message,
      statusCode: 409,
      context,
      cause,
    });
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends BaseError {
  constructor(
    message = 'Too many requests',
    context?: ErrorContext,
    cause?: Error
  ) {
    super({
      code: 'RATE_LIMIT_ERROR',
      message,
      statusCode: 429,
      context,
      cause,
    });
  }
}

/**
 * Internal server error (500)
 */
export class InternalServerError extends BaseError {
  constructor(
    message = 'Internal server error',
    context?: ErrorContext,
    cause?: Error
  ) {
    super({
      code: 'INTERNAL_SERVER_ERROR',
      message,
      statusCode: 500,
      context,
      cause,
    });
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends BaseError {
  constructor(
    message = 'Service temporarily unavailable',
    context?: ErrorContext,
    cause?: Error
  ) {
    super({
      code: 'SERVICE_UNAVAILABLE_ERROR',
      message,
      statusCode: 503,
      context,
      cause,
    });
  }
}

/**
 * Database error
 */
export class DatabaseError extends InternalServerError {
  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(message, context, cause);
    this.code = 'DATABASE_ERROR';
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends InternalServerError {
  constructor(
    service: string,
    message: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(`External service error: ${service} - ${message}`, context, cause);
    this.code = 'EXTERNAL_SERVICE_ERROR';
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends InternalServerError {
  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(`Configuration error: ${message}`, context, cause);
    this.code = 'CONFIGURATION_ERROR';
  }
}
