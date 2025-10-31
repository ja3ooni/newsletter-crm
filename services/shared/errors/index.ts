/**
 * Shared error handling utilities
 *
 * This module provides consistent error handling across all services:
 * - Typed error classes with proper HTTP status codes
 * - Result/Either pattern for functional error handling
 * - Express middleware for error handling
 * - Utilities for error logging and processing
 */

// Base error classes
export {
  AuthenticationError,
  AuthorizationError,
  BaseError,
  ConfigurationError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  InternalServerError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
  type ErrorContext,
  type ErrorDetails,
} from './BaseError';

// Result/Either pattern
export {
  Failure,
  Result,
  Success,
  combine,
  failure,
  isFailure,
  isSuccess,
  success,
  tryCatch,
  tryCatchAsync,
} from './Result';

// Error handling utilities
export {
  asyncHandler,
  createErrorFromUnknown,
  errorHandler,
  getErrorMessage,
  getErrorStack,
  handleUncaughtException,
  handleUnhandledRejection,
  logError,
  setupGlobalErrorHandlers,
} from './ErrorHandler';
