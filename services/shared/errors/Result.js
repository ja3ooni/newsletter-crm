"use strict";
/**
 * Result/Either pattern implementation for functional error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Failure = exports.Success = void 0;
exports.success = success;
exports.failure = failure;
exports.tryCatch = tryCatch;
exports.tryCatchAsync = tryCatchAsync;
exports.combine = combine;
exports.isSuccess = isSuccess;
exports.isFailure = isFailure;
/**
 * Success result
 */
class Success {
    constructor(value) {
        this.value = value;
        this.isSuccess = true;
        this.isFailure = false;
    }
    /**
     * Map the success value to a new value
     */
    map(fn) {
        return new Success(fn(this.value));
    }
    /**
     * FlatMap for chaining operations that return Results
     */
    flatMap(fn) {
        return fn(this.value);
    }
    /**
     * Get the value or throw if it's a failure (won't happen for Success)
     */
    unwrap() {
        return this.value;
    }
    /**
     * Get the value or return the default
     */
    unwrapOr(_defaultValue) {
        return this.value;
    }
    /**
     * Match pattern for handling both success and failure cases
     */
    match(onSuccess, _onFailure) {
        return onSuccess(this.value);
    }
}
exports.Success = Success;
/**
 * Failure result
 */
class Failure {
    constructor(error) {
        this.error = error;
        this.isSuccess = false;
        this.isFailure = true;
    }
    /**
     * Map does nothing for failures
     */
    map(_fn) {
        return this;
    }
    /**
     * FlatMap does nothing for failures
     */
    flatMap(_fn) {
        return this;
    }
    /**
     * Throw the error
     */
    unwrap() {
        if (this.error instanceof Error) {
            throw this.error;
        }
        throw new Error(String(this.error));
    }
    /**
     * Get the default value
     */
    unwrapOr(defaultValue) {
        return defaultValue;
    }
    /**
     * Match pattern for handling both success and failure cases
     */
    match(_onSuccess, onFailure) {
        return onFailure(this.error);
    }
}
exports.Failure = Failure;
/**
 * Create a successful result
 */
function success(value) {
    return new Success(value);
}
/**
 * Create a failure result
 */
function failure(error) {
    return new Failure(error);
}
/**
 * Wrap a function that might throw in a Result
 */
function tryCatch(fn, errorMapper) {
    try {
        return success(fn());
    }
    catch (error) {
        const mappedError = errorMapper ? errorMapper(error) : error;
        return failure(mappedError);
    }
}
/**
 * Wrap an async function that might throw in a Result
 */
async function tryCatchAsync(fn, errorMapper) {
    try {
        const value = await fn();
        return success(value);
    }
    catch (error) {
        const mappedError = errorMapper ? errorMapper(error) : error;
        return failure(mappedError);
    }
}
/**
 * Combine multiple Results into a single Result
 * If all are successful, returns Success with array of values
 * If any fail, returns the first Failure
 */
function combine(results) {
    const values = [];
    for (const result of results) {
        if (result.isFailure) {
            return result;
        }
        values.push(result.value);
    }
    return success(values);
}
/**
 * Type guard to check if a Result is a Success
 */
function isSuccess(result) {
    return result.isSuccess;
}
/**
 * Type guard to check if a Result is a Failure
 */
function isFailure(result) {
    return result.isFailure;
}
//# sourceMappingURL=Result.js.map