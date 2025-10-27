"use strict";
/**
 * Circuit Breaker Implementation
 * Provides fault tolerance and resilience for inter-service communication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCircuitBreaker = exports.circuitBreakerManager = exports.CircuitBreakerManager = exports.CircuitBreaker = exports.CircuitBreakerError = exports.CircuitState = void 0;
const events_1 = require("events");
const logger_1 = require("./logger");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreakerError extends Error {
    circuitName;
    state;
    constructor(message, circuitName, state) {
        super(message);
        this.circuitName = circuitName;
        this.state = state;
        this.name = 'CircuitBreakerError';
    }
}
exports.CircuitBreakerError = CircuitBreakerError;
class CircuitBreaker extends events_1.EventEmitter {
    config;
    state = CircuitState.CLOSED;
    failures = 0;
    successes = 0;
    requests = 0;
    lastFailureTime;
    lastSuccessTime;
    nextAttempt;
    monitoringTimer;
    constructor(config) {
        super();
        this.config = config;
        this.startMonitoring();
    }
    /**
     * Execute a function with circuit breaker protection
     */
    async execute(fn) {
        this.requests++;
        if (this.state === CircuitState.OPEN) {
            if (this.nextAttempt && Date.now() < this.nextAttempt.getTime()) {
                const error = new CircuitBreakerError(`Circuit breaker is OPEN for ${this.config.name}`, this.config.name, this.state);
                if (this.config.fallbackFunction) {
                    logger_1.logger.warn('Circuit breaker OPEN, executing fallback', {
                        circuitName: this.config.name,
                        nextAttempt: this.nextAttempt,
                    });
                    return await this.config.fallbackFunction();
                }
                throw error;
            }
            else {
                // Transition to HALF_OPEN
                this.state = CircuitState.HALF_OPEN;
                this.emit('stateChange', this.state);
                logger_1.logger.info('Circuit breaker transitioning to HALF_OPEN', {
                    circuitName: this.config.name,
                });
            }
        }
        try {
            const startTime = Date.now();
            const result = await Promise.race([
                fn(),
                this.createTimeoutPromise(),
            ]);
            const duration = Date.now() - startTime;
            this.onSuccess(duration);
            return result;
        }
        catch (error) {
            this.onFailure(error);
            throw error;
        }
    }
    /**
     * Get current circuit breaker statistics
     */
    getStats() {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            requests: this.requests,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            nextAttempt: this.nextAttempt,
        };
    }
    /**
     * Reset circuit breaker to CLOSED state
     */
    reset() {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.requests = 0;
        this.lastFailureTime = undefined;
        this.lastSuccessTime = undefined;
        this.nextAttempt = undefined;
        this.emit('reset');
        logger_1.logger.info('Circuit breaker reset', { circuitName: this.config.name });
    }
    /**
     * Force circuit breaker to OPEN state
     */
    forceOpen() {
        this.state = CircuitState.OPEN;
        this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
        this.emit('stateChange', this.state);
        logger_1.logger.warn('Circuit breaker forced OPEN', {
            circuitName: this.config.name,
            nextAttempt: this.nextAttempt,
        });
    }
    /**
     * Force circuit breaker to CLOSED state
     */
    forceClosed() {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.nextAttempt = undefined;
        this.emit('stateChange', this.state);
        logger_1.logger.info('Circuit breaker forced CLOSED', { circuitName: this.config.name });
    }
    /**
     * Check if circuit breaker is healthy
     */
    isHealthy() {
        return this.state === CircuitState.CLOSED ||
            (this.state === CircuitState.HALF_OPEN && this.failures < this.config.failureThreshold);
    }
    /**
     * Get failure rate percentage
     */
    getFailureRate() {
        if (this.requests === 0)
            return 0;
        return (this.failures / this.requests) * 100;
    }
    /**
     * Destroy circuit breaker and cleanup resources
     */
    destroy() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = undefined;
        }
        this.removeAllListeners();
    }
    /**
     * Handle successful execution
     */
    onSuccess(duration) {
        this.successes++;
        this.lastSuccessTime = new Date();
        if (this.state === CircuitState.HALF_OPEN) {
            if (this.successes >= this.config.successThreshold) {
                this.state = CircuitState.CLOSED;
                this.failures = 0;
                this.nextAttempt = undefined;
                this.emit('stateChange', this.state);
                logger_1.logger.info('Circuit breaker transitioned to CLOSED', {
                    circuitName: this.config.name,
                    successes: this.successes,
                });
            }
        }
        this.emit('success', { duration, state: this.state });
        logger_1.logger.debug('Circuit breaker success', {
            circuitName: this.config.name,
            duration,
            state: this.state,
            successes: this.successes,
        });
    }
    /**
     * Handle failed execution
     */
    onFailure(error) {
        this.failures++;
        this.lastFailureTime = new Date();
        if (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN) {
            if (this.failures >= this.config.failureThreshold) {
                this.state = CircuitState.OPEN;
                this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
                this.emit('stateChange', this.state);
                logger_1.logger.warn('Circuit breaker transitioned to OPEN', {
                    circuitName: this.config.name,
                    failures: this.failures,
                    threshold: this.config.failureThreshold,
                    nextAttempt: this.nextAttempt,
                });
            }
        }
        this.emit('failure', { error, state: this.state });
        logger_1.logger.error('Circuit breaker failure', {
            circuitName: this.config.name,
            error: error.message,
            state: this.state,
            failures: this.failures,
        });
    }
    /**
     * Create timeout promise
     */
    createTimeoutPromise() {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timed out after ${this.config.timeout}ms`));
            }, this.config.timeout);
        });
    }
    /**
     * Start monitoring and periodic cleanup
     */
    startMonitoring() {
        this.monitoringTimer = setInterval(() => {
            this.emit('stats', this.getStats());
            // Reset counters periodically to prevent memory leaks
            const now = Date.now();
            const monitoringPeriod = this.config.monitoringPeriod;
            if (this.lastFailureTime && (now - this.lastFailureTime.getTime()) > monitoringPeriod) {
                this.failures = Math.max(0, this.failures - 1);
            }
            if (this.lastSuccessTime && (now - this.lastSuccessTime.getTime()) > monitoringPeriod) {
                this.successes = Math.max(0, this.successes - 1);
            }
        }, this.config.monitoringPeriod);
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
class CircuitBreakerManager {
    circuitBreakers = new Map();
    defaultConfig = {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 10000,
        resetTimeout: 60000,
        monitoringPeriod: 30000,
    };
    /**
     * Create or get circuit breaker for a service
     */
    getCircuitBreaker(name, config) {
        if (this.circuitBreakers.has(name)) {
            return this.circuitBreakers.get(name);
        }
        const fullConfig = {
            name,
            ...this.defaultConfig,
            ...config,
        };
        const circuitBreaker = new CircuitBreaker(fullConfig);
        this.circuitBreakers.set(name, circuitBreaker);
        // Set up logging for circuit breaker events
        circuitBreaker.on('stateChange', (state) => {
            logger_1.logger.info('Circuit breaker state changed', { name, state });
        });
        circuitBreaker.on('failure', ({ error, state }) => {
            logger_1.logger.warn('Circuit breaker failure', { name, error: error.message, state });
        });
        return circuitBreaker;
    }
    /**
     * Execute function with circuit breaker protection
     */
    async execute(serviceName, fn, config) {
        const circuitBreaker = this.getCircuitBreaker(serviceName, config);
        return await circuitBreaker.execute(fn);
    }
    /**
     * Get all circuit breaker statistics
     */
    getAllStats() {
        const stats = {};
        for (const [name, circuitBreaker] of this.circuitBreakers) {
            stats[name] = circuitBreaker.getStats();
        }
        return stats;
    }
    /**
     * Reset all circuit breakers
     */
    resetAll() {
        for (const circuitBreaker of this.circuitBreakers.values()) {
            circuitBreaker.reset();
        }
        logger_1.logger.info('All circuit breakers reset');
    }
    /**
     * Get health status of all circuit breakers
     */
    getHealthStatus() {
        const healthy = [];
        const unhealthy = [];
        for (const [name, circuitBreaker] of this.circuitBreakers) {
            if (circuitBreaker.isHealthy()) {
                healthy.push(name);
            }
            else {
                unhealthy.push(name);
            }
        }
        return {
            healthy,
            unhealthy,
            total: this.circuitBreakers.size,
        };
    }
    /**
     * Destroy all circuit breakers
     */
    destroy() {
        for (const circuitBreaker of this.circuitBreakers.values()) {
            circuitBreaker.destroy();
        }
        this.circuitBreakers.clear();
        logger_1.logger.info('Circuit breaker manager destroyed');
    }
}
exports.CircuitBreakerManager = CircuitBreakerManager;
// Global circuit breaker manager instance
exports.circuitBreakerManager = new CircuitBreakerManager();
/**
 * Decorator for automatic circuit breaker protection
 */
function withCircuitBreaker(serviceName, config) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const circuitBreaker = exports.circuitBreakerManager.getCircuitBreaker(serviceName, config);
            return await circuitBreaker.execute(() => method.apply(this, args));
        };
        return descriptor;
    };
}
exports.withCircuitBreaker = withCircuitBreaker;
//# sourceMappingURL=circuit-breaker.js.map