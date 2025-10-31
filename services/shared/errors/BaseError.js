"use strict";
/**
 * Base error classes for consistent error handling across all services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationError = exports.ExternalServiceError = exports.DatabaseError = exports.ServiceUnavailableError = exports.InternalServerError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.BaseError = void 0;
/**
 * Base application error class
 */
class BaseError extends Error {
    constructor(details, isOperational = true) {
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
    toJSON() {
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
    getApiResponse() {
        return {
            error: {
                code: this.code,
                message: this.message,
                ...(this.context && { details: this.context }),
            },
        };
    }
}
exports.BaseError = BaseError;
/**
 * Validation error (400)
 */
class ValidationError extends BaseError {
    constructor(message, context, cause) {
        super({
            code: 'VALIDATION_ERROR',
            message,
            statusCode: 400,
            context,
            cause,
        });
    }
}
exports.ValidationError = ValidationError;
/**
 * Authentication error (401)
 */
class AuthenticationError extends BaseError {
    constructor(message = 'Authentication required', context, cause) {
        super({
            code: 'AUTHENTICATION_ERROR',
            message,
            statusCode: 401,
            context,
            cause,
        });
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Authorization error (403)
 */
class AuthorizationError extends BaseError {
    constructor(message = 'Insufficient permissions', context, cause) {
        super({
            code: 'AUTHORIZATION_ERROR',
            message,
            statusCode: 403,
            context,
            cause,
        });
    }
}
exports.AuthorizationError = AuthorizationError;
/**
 * Not found error (404)
 */
class NotFoundError extends BaseError {
    constructor(resource, context, cause) {
        super({
            code: 'NOT_FOUND_ERROR',
            message: `${resource} not found`,
            statusCode: 404,
            context,
            cause,
        });
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Conflict error (409)
 */
class ConflictError extends BaseError {
    constructor(message, context, cause) {
        super({
            code: 'CONFLICT_ERROR',
            message,
            statusCode: 409,
            context,
            cause,
        });
    }
}
exports.ConflictError = ConflictError;
/**
 * Rate limit error (429)
 */
class RateLimitError extends BaseError {
    constructor(message = 'Too many requests', context, cause) {
        super({
            code: 'RATE_LIMIT_ERROR',
            message,
            statusCode: 429,
            context,
            cause,
        });
    }
}
exports.RateLimitError = RateLimitError;
/**
 * Internal server error (500)
 */
class InternalServerError extends BaseError {
    constructor(message = 'Internal server error', context, cause) {
        super({
            code: 'INTERNAL_SERVER_ERROR',
            message,
            statusCode: 500,
            context,
            cause,
        });
    }
}
exports.InternalServerError = InternalServerError;
/**
 * Service unavailable error (503)
 */
class ServiceUnavailableError extends BaseError {
    constructor(message = 'Service temporarily unavailable', context, cause) {
        super({
            code: 'SERVICE_UNAVAILABLE_ERROR',
            message,
            statusCode: 503,
            context,
            cause,
        });
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
/**
 * Database error
 */
class DatabaseError extends InternalServerError {
    constructor(message, context, cause) {
        super(message, context, cause);
        this.code = 'DATABASE_ERROR';
    }
}
exports.DatabaseError = DatabaseError;
/**
 * External service error
 */
class ExternalServiceError extends InternalServerError {
    constructor(service, message, context, cause) {
        super(`External service error: ${service} - ${message}`, context, cause);
        this.code = 'EXTERNAL_SERVICE_ERROR';
    }
}
exports.ExternalServiceError = ExternalServiceError;
/**
 * Configuration error
 */
class ConfigurationError extends InternalServerError {
    constructor(message, context, cause) {
        super(`Configuration error: ${message}`, context, cause);
        this.code = 'CONFIGURATION_ERROR';
    }
}
exports.ConfigurationError = ConfigurationError;
//# sourceMappingURL=BaseError.js.map