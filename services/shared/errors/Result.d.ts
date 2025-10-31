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
export declare class Success<T> {
    readonly value: T;
    readonly isSuccess = true;
    readonly isFailure = false;
    constructor(value: T);
    /**
     * Map the success value to a new value
     */
    map<U>(fn: (value: T) => U): Result<U, never>;
    /**
     * FlatMap for chaining operations that return Results
     */
    flatMap<U, E>(fn: (value: T) => Result<U, E>): Result<U, E>;
    /**
     * Get the value or throw if it's a failure (won't happen for Success)
     */
    unwrap(): T;
    /**
     * Get the value or return the default
     */
    unwrapOr(_defaultValue: T): T;
    /**
     * Match pattern for handling both success and failure cases
     */
    match<U>(onSuccess: (value: T) => U, _onFailure: (error: any) => U): U;
}
/**
 * Failure result
 */
export declare class Failure<E> {
    readonly error: E;
    readonly isSuccess = false;
    readonly isFailure = true;
    constructor(error: E);
    /**
     * Map does nothing for failures
     */
    map<U>(_fn: (value: any) => U): Result<U, E>;
    /**
     * FlatMap does nothing for failures
     */
    flatMap<U>(_fn: (value: any) => Result<U, E>): Result<U, E>;
    /**
     * Throw the error
     */
    unwrap(): never;
    /**
     * Get the default value
     */
    unwrapOr<T>(defaultValue: T): T;
    /**
     * Match pattern for handling both success and failure cases
     */
    match<U>(_onSuccess: (value: any) => U, onFailure: (error: E) => U): U;
}
/**
 * Create a successful result
 */
export declare function success<T>(value: T): Success<T>;
/**
 * Create a failure result
 */
export declare function failure<E>(error: E): Failure<E>;
/**
 * Wrap a function that might throw in a Result
 */
export declare function tryCatch<T, E = Error>(fn: () => T, errorMapper?: (error: unknown) => E): Result<T, E>;
/**
 * Wrap an async function that might throw in a Result
 */
export declare function tryCatchAsync<T, E = Error>(fn: () => Promise<T>, errorMapper?: (error: unknown) => E): Promise<Result<T, E>>;
/**
 * Combine multiple Results into a single Result
 * If all are successful, returns Success with array of values
 * If any fail, returns the first Failure
 */
export declare function combine<T, E>(results: Result<T, E>[]): Result<T[], E>;
/**
 * Type guard to check if a Result is a Success
 */
export declare function isSuccess<T, E>(result: Result<T, E>): result is Success<T>;
/**
 * Type guard to check if a Result is a Failure
 */
export declare function isFailure<T, E>(result: Result<T, E>): result is Failure<E>;
//# sourceMappingURL=Result.d.ts.map