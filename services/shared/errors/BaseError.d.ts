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
export declare abstract class BaseError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly context?: ErrorContext;
    readonly cause?: Error;
    readonly timestamp: Date;
    constructor(details: ErrorDetails, isOperational?: boolean);
    /**
     * Convert error to JSON for logging and API responses
     */
    toJSON(): Record<string, any>;
    /**
     * Get error details for API response
     */
    getApiResponse(): Record<string, any>;
}
/**
 * Validation error (400)
 */
export declare class ValidationError extends BaseError {
    constructor(message: string, context?: ErrorContext, cause?: Error);
}
/**
 * Authentication error (401)
 */
export declare class AuthenticationError extends BaseError {
    constructor(message?: string, context?: ErrorContext, cause?: Error);
}
/**
 * Authorization error (403)
 */
export declare class AuthorizationError extends BaseError {
    constructor(message?: string, context?: ErrorContext, cause?: Error);
}
/**
 * Not found error (404)
 */
export declare class NotFoundError extends BaseError {
    constructor(resource: string, context?: ErrorContext, cause?: Error);
}
/**
 * Conflict error (409)
 */
export declare class ConflictError extends BaseError {
    constructor(message: string, context?: ErrorContext, cause?: Error);
}
/**
 * Rate limit error (429)
 */
export declare class RateLimitError extends BaseError {
    constructor(message?: string, context?: ErrorContext, cause?: Error);
}
/**
 * Internal server error (500)
 */
export declare class InternalServerError extends BaseError {
    constructor(message?: string, context?: ErrorContext, cause?: Error);
}
/**
 * Service unavailable error (503)
 */
export declare class ServiceUnavailableError extends BaseError {
    constructor(message?: string, context?: ErrorContext, cause?: Error);
}
/**
 * Database error
 */
export declare class DatabaseError extends InternalServerError {
    constructor(message: string, context?: ErrorContext, cause?: Error);
}
/**
 * External service error
 */
export declare class ExternalServiceError extends InternalServerError {
    constructor(service: string, message: string, context?: ErrorContext, cause?: Error);
}
/**
 * Configuration error
 */
export declare class ConfigurationError extends InternalServerError {
    constructor(message: string, context?: ErrorContext, cause?: Error);
}
//# sourceMappingURL=BaseError.d.ts.map