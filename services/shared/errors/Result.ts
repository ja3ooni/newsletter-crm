/**
 * Result/Either pattern implementation for functional error handling
 */

import { BaseError } from './BaseError';

/**
 * Result type that can be either Success or Failure
 */
export type Result<T, E = BaseError> = Success<T> | Failure<E>;

/**
 * Success result
 */
export class Success<T> {
  readonly isSuccess = true;
  readonly isFailure = false;

  constructor(public readonly value: T) {}

  /**
   * Map the success value to a new value
   */
  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Success(fn(this.value));
  }

  /**
   * FlatMap for chaining operations that return Results
   */
  flatMap<U, E>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  /**
   * Get the value or throw if it's a failure (won't happen for Success)
   */
  unwrap(): T {
    return this.value;
  }

  /**
   * Get the value or return the default
   */
  unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  /**
   * Match pattern for handling both success and failure cases
   */
  match<U>(onSuccess: (value: T) => U, _onFailure: (error: any) => U): U {
    return onSuccess(this.value);
  }
}

/**
 * Failure result
 */
export class Failure<E> {
  readonly isSuccess = false;
  readonly isFailure = true;

  constructor(public readonly error: E) {}

  /**
   * Map does nothing for failures
   */
  map<U>(_fn: (value: any) => U): Result<U, E> {
    return this as any;
  }

  /**
   * FlatMap does nothing for failures
   */
  flatMap<U>(_fn: (value: any) => Result<U, E>): Result<U, E> {
    return this as any;
  }

  /**
   * Throw the error
   */
  unwrap(): never {
    if (this.error instanceof Error) {
      throw this.error;
    }
    throw new Error(String(this.error));
  }

  /**
   * Get the default value
   */
  unwrapOr<T>(defaultValue: T): T {
    return defaultValue;
  }

  /**
   * Match pattern for handling both success and failure cases
   */
  match<U>(_onSuccess: (value: any) => U, onFailure: (error: E) => U): U {
    return onFailure(this.error);
  }
}

/**
 * Create a successful result
 */
export function success<T>(value: T): Success<T> {
  return new Success(value);
}

/**
 * Create a failure result
 */
export function failure<E>(error: E): Failure<E> {
  return new Failure(error);
}

/**
 * Wrap a function that might throw in a Result
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  errorMapper?: (error: unknown) => E
): Result<T, E> {
  try {
    return success(fn());
  } catch (error) {
    const mappedError = errorMapper ? errorMapper(error) : (error as E);
    return failure(mappedError);
  }
}

/**
 * Wrap an async function that might throw in a Result
 */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  errorMapper?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return success(value);
  } catch (error) {
    const mappedError = errorMapper ? errorMapper(error) : (error as E);
    return failure(mappedError);
  }
}

/**
 * Combine multiple Results into a single Result
 * If all are successful, returns Success with array of values
 * If any fail, returns the first Failure
 */
export function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (result.isFailure) {
      return result as any;
    }
    values.push(result.value);
  }

  return success(values);
}

/**
 * Type guard to check if a Result is a Success
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.isSuccess;
}

/**
 * Type guard to check if a Result is a Failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.isFailure;
}
