/**
 * Enhanced Error Handler for Developer Tools
 * Local implementation for scripts directory
 */

import { log, LogContext } from './Logger';

// Local error interfaces and types
export interface ErrorContext {
  [key: string]: unknown;
}

export interface ErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  context?: ErrorContext | undefined;
  cause?: Error | undefined;
}

// Result pattern implementation
export type Result<T, E = DevToolsError> = Success<T> | Failure<E>;

export class Success<T> {
  readonly isSuccess = true;
  readonly isFailure = false;

  constructor(public readonly value: T) {}

  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Success(fn(this.value));
  }

  flatMap<U, E>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr(_defaultValue: T): T {
    return this.value;
  }
}

export class Failure<E> {
  readonly isSuccess = false;
  readonly isFailure = true;

  constructor(public readonly error: E) {}

  map<U>(_fn: (value: any) => U): Result<U, E> {
    return this as any;
  }

  flatMap<U>(_fn: (value: any) => Result<U, E>): Result<U, E> {
    return this as any;
  }

  unwrap(): never {
    if (this.error instanceof Error) {
      throw this.error;
    }
    throw new Error(String(this.error));
  }

  unwrapOr<T>(defaultValue: T): T {
    return defaultValue;
  }
}

export function success<T>(value: T): Success<T> {
  return new Success(value);
}

export function failure<E>(error: E): Failure<E> {
  return new Failure(error);
}

// Base error class for developer tools
export abstract class DevToolsError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: ErrorContext | undefined;
  public readonly cause?: Error | undefined;
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

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
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
}

// Developer tools specific error types
export class PlatformNotSupportedError extends DevToolsError {
  constructor(platform: string, context?: ErrorContext) {
    super({
      code: 'PLATFORM_NOT_SUPPORTED',
      message: `Platform '${platform}' is not supported`,
      statusCode: 400,
      context: { platform, ...context },
    });
  }
}

export class CommandExecutionError extends DevToolsError {
  constructor(command: string, exitCode?: number, context?: ErrorContext) {
    super({
      code: 'COMMAND_EXECUTION_FAILED',
      message: `Command execution failed: ${command}`,
      statusCode: 500,
      context: { command, exitCode, ...context },
    });
  }
}

export class DependencyNotFoundError extends DevToolsError {
  constructor(dependency: string, context?: ErrorContext) {
    super({
      code: 'DEPENDENCY_NOT_FOUND',
      message: `Required dependency not found: ${dependency}`,
      statusCode: 404,
      context: { dependency, ...context },
    });
  }
}

export class EnvironmentValidationError extends DevToolsError {
  constructor(variable: string, context?: ErrorContext) {
    super({
      code: 'ENVIRONMENT_VALIDATION_ERROR',
      message: `Environment variable validation failed: ${variable}`,
      statusCode: 400,
      context: { variable, ...context },
    });
  }
}

export class ServiceConnectionError extends DevToolsError {
  constructor(service: string, context?: ErrorContext) {
    super({
      code: 'SERVICE_CONNECTION_ERROR',
      message: `Failed to connect to service: ${service}`,
      statusCode: 503,
      context: { service, ...context },
    });
  }
}

export class ConfigurationError extends DevToolsError {
  constructor(message: string, context?: ErrorContext) {
    super({
      code: 'CONFIGURATION_ERROR',
      message: `Configuration error: ${message}`,
      statusCode: 500,
      context,
    });
  }
}

// Error recovery strategies
export interface ErrorRecoveryStrategy<T = unknown> {
  canRecover(error: DevToolsError): boolean;
  recover(
    error: DevToolsError,
    context?: LogContext
  ): Promise<Result<T, DevToolsError>>;
}

export class CommandNotFoundRecovery
  implements ErrorRecoveryStrategy<string[]>
{
  canRecover(error: DevToolsError): boolean {
    return (
      error instanceof DependencyNotFoundError ||
      error instanceof CommandExecutionError
    );
  }

  async recover(
    error: DevToolsError,
    context?: LogContext
  ): Promise<Result<string[], DevToolsError>> {
    log.debug('Attempting command recovery', {
      ...context,
      errorCode: error.code,
      errorMessage: error.message,
    });

    if (error instanceof DependencyNotFoundError) {
      const alternatives = this.findAlternativeCommands(
        error.context?.dependency as string
      );

      if (alternatives.length > 0) {
        log.info(
          `Found alternative commands for ${error.context?.dependency}`,
          {
            ...context,
            alternatives,
          }
        );

        return success(alternatives);
      }
    }

    return failure(error);
  }

  private findAlternativeCommands(command: string): string[] {
    const alternatives: Record<string, string[]> = {
      'docker-compose': ['docker compose', 'podman-compose'],
      psql: ['postgresql-client', 'pg_dump'],
      'redis-cli': ['redis-tools'],
      git: ['git-scm'],
      node: ['nodejs'],
      npm: ['yarn', 'pnpm'],
    };

    return alternatives[command] || [];
  }
}

export class ServiceConnectionRecovery
  implements ErrorRecoveryStrategy<boolean>
{
  canRecover(error: DevToolsError): boolean {
    return error instanceof ServiceConnectionError;
  }

  async recover(
    error: DevToolsError,
    context?: LogContext
  ): Promise<Result<boolean, DevToolsError>> {
    log.debug('Attempting service connection recovery', {
      ...context,
      service: error.context?.service,
    });

    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.delay(baseDelay * Math.pow(2, attempt - 1));

        log.debug(`Recovery attempt ${attempt}/${maxRetries}`, {
          ...context,
          attempt,
          service: error.context?.service,
        });

        // Simulate success after 2 attempts
        if (attempt >= 2) {
          log.success('Service connection recovered', {
            ...context,
            service: error.context?.service,
            attempts: attempt,
          });

          return success(true);
        }
      } catch (recoveryError) {
        log.warning(`Recovery attempt ${attempt} failed`, {
          ...context,
          attempt,
          error: recoveryError,
        });
      }
    }

    log.error('Service connection recovery failed after all attempts', {
      ...context,
      maxRetries,
      service: error.context?.service,
    });

    return failure(error);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Enhanced error handler class
export class DeveloperToolsErrorHandler {
  private recoveryStrategies: ErrorRecoveryStrategy[] = [
    new CommandNotFoundRecovery(),
    new ServiceConnectionRecovery(),
  ];

  /**
   * Handle error with logging and optional recovery
   */
  async handleError(
    error: unknown,
    context?: LogContext,
    attemptRecovery = false
  ): Promise<Result<unknown, DevToolsError>> {
    const devError = this.normalizeError(error);

    this.logError(devError, context);

    if (attemptRecovery) {
      const recoveryResult = await this.attemptRecovery(devError, context);

      if (recoveryResult.isSuccess) {
        return recoveryResult;
      }
    }

    return failure(devError);
  }

  /**
   * Wrap a function with error handling
   */
  wrapSync<T>(
    fn: () => T,
    context?: LogContext,
    attemptRecovery = false
  ): Result<T, DevToolsError> {
    try {
      return success(fn());
    } catch (error) {
      const devError = this.normalizeError(error);

      this.logError(devError, context);

      return failure(devError);
    }
  }

  /**
   * Wrap an async function with error handling
   */
  async wrapAsync<T>(
    fn: () => Promise<T>,
    context?: LogContext,
    attemptRecovery = false
  ): Promise<Result<T, DevToolsError>> {
    try {
      const value = await fn();

      return success(value);
    } catch (error) {
      const devError = this.normalizeError(error);

      this.logError(devError, context);

      if (attemptRecovery) {
        const recoveryResult = await this.attemptRecovery(devError, context);

        if (recoveryResult.isSuccess) {
          try {
            const value = await fn();

            return success(value);
          } catch (retryError) {
            return failure(this.normalizeError(retryError));
          }
        }
      }

      return failure(devError);
    }
  }

  /**
   * Create a safe version of a function that logs errors but doesn't throw
   */
  makeSafe<T extends any[], R>(
    fn: (...args: T) => R,
    defaultValue: R,
    context?: LogContext
  ): (...args: T) => R {
    return (...args: T): R => {
      try {
        return fn(...args);
      } catch (error) {
        this.logError(this.normalizeError(error), {
          ...context,
          functionName: fn.name,
          arguments: args,
        });

        return defaultValue;
      }
    };
  }

  /**
   * Create a safe async version of a function
   */
  makeSafeAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    defaultValue: R,
    context?: LogContext
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        this.logError(this.normalizeError(error), {
          ...context,
          functionName: fn.name,
          arguments: args,
        });

        return defaultValue;
      }
    };
  }

  /**
   * Validate environment configuration
   */
  validateEnvironment(
    requiredVars: string[],
    context?: LogContext
  ): Result<Record<string, string>, DevToolsError> {
    const missing: string[] = [];
    const values: Record<string, string> = {};

    for (const varName of requiredVars) {
      const value = process.env[varName];

      if (!value) {
        missing.push(varName);
      } else {
        values[varName] = value;
      }
    }

    if (missing.length > 0) {
      const error = new EnvironmentValidationError(
        `Missing required environment variables: ${missing.join(', ')}`,
        { missing, ...context }
      );

      this.logError(error, context);

      return failure(error);
    }

    log.success('Environment validation passed', {
      ...context,
      validatedVars: requiredVars,
    });

    return success(values);
  }

  /**
   * Normalize any error to DevToolsError
   */
  private normalizeError(error: unknown): DevToolsError {
    if (error instanceof DevToolsError) {
      return error;
    }

    if (error instanceof Error) {
      return new ConfigurationError(error.message, {
        originalError: error.name,
      });
    }

    return new ConfigurationError(String(error));
  }

  /**
   * Log error with structured logging
   */
  private logError(error: DevToolsError, context?: LogContext): void {
    const errorContext = {
      ...context,
      errorCode: error.code,
      errorName: error.name,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      timestamp: error.timestamp,
      ...(error.context && { errorContext: error.context }),
    };

    log.error(error.message, error, errorContext);

    // Log security events separately
    if (error.code.includes('SECURITY') || error.code.includes('AUTH')) {
      log.security(`Security-related error: ${error.message}`, errorContext);
    }

    // Log audit events for configuration errors
    if (
      error instanceof ConfigurationError ||
      error instanceof EnvironmentValidationError
    ) {
      log.audit(`Configuration error detected: ${error.message}`, errorContext);
    }
  }

  /**
   * Attempt error recovery using registered strategies
   */
  private async attemptRecovery(
    error: DevToolsError,
    context?: LogContext
  ): Promise<Result<unknown, DevToolsError>> {
    for (const strategy of this.recoveryStrategies) {
      if (strategy.canRecover(error)) {
        log.debug('Attempting error recovery', {
          ...context,
          strategy: strategy.constructor.name,
          errorCode: error.code,
        });

        const result = await strategy.recover(error, context);

        if (result.isSuccess) {
          log.success('Error recovery successful', {
            ...context,
            strategy: strategy.constructor.name,
            errorCode: error.code,
          });

          return result;
        }
      }
    }

    log.debug('No recovery strategy available', {
      ...context,
      errorCode: error.code,
      availableStrategies: this.recoveryStrategies.length,
    });

    return failure(error);
  }

  /**
   * Add a custom recovery strategy
   */
  addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    log.debug('Added recovery strategy', {
      strategy: strategy.constructor.name,
      totalStrategies: this.recoveryStrategies.length,
    });
  }
}

// Global error handler instance
export const errorHandler = new DeveloperToolsErrorHandler();

// Setup global error handlers for unhandled errors
export function setupGlobalErrorHandlers(): void {
  process.on(
    'unhandledRejection',
    (reason: unknown, promise: Promise<unknown>) => {
      log.error('Unhandled promise rejection', reason, {
        type: 'unhandledRejection',
        promise: promise.toString(),
      });

      // Don't exit in development tools, just log
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  );

  process.on('uncaughtException', (error: Error) => {
    log.error('Uncaught exception', error, {
      type: 'uncaughtException',
    });

    // Don't exit in development tools, just log
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  log.system('Global error handlers initialized');
}

// Utility functions
export function createError(
  code: string,
  message: string,
  statusCode = 500,
  context?: ErrorContext
): DevToolsError {
  return new (class extends DevToolsError {})({
    code,
    message,
    statusCode,
    context,
  });
}

export function isRecoverableError(error: DevToolsError): boolean {
  return error.isOperational && error.statusCode < 500;
}

export function getErrorSeverity(
  error: DevToolsError
): 'low' | 'medium' | 'high' | 'critical' {
  if (error.statusCode >= 500) return 'critical';
  if (error.statusCode >= 400) return 'high';
  if (error.code.includes('WARNING')) return 'medium';

  return 'low';
}

// Try-catch utilities
export function tryCatch<T>(
  fn: () => T,
  errorMapper?: (error: unknown) => DevToolsError
): Result<T, DevToolsError> {
  try {
    return success(fn());
  } catch (error) {
    const mappedError = errorMapper
      ? errorMapper(error)
      : errorHandler['normalizeError'](error);

    return failure(mappedError);
  }
}

export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  errorMapper?: (error: unknown) => DevToolsError
): Promise<Result<T, DevToolsError>> {
  try {
    const value = await fn();

    return success(value);
  } catch (error) {
    const mappedError = errorMapper
      ? errorMapper(error)
      : errorHandler['normalizeError'](error);

    return failure(mappedError);
  }
}
