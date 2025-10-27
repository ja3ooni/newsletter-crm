/**
 * Circuit Breaker Implementation
 * Provides fault tolerance and resilience for inter-service communication
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerConfig {
    name: string;
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    resetTimeout: number;
    monitoringPeriod: number;
    fallbackFunction?: () => Promise<any>;
}
export interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    successes: number;
    requests: number;
    lastFailureTime?: Date;
    lastSuccessTime?: Date;
    nextAttempt?: Date;
}
export declare class CircuitBreakerError extends Error {
    circuitName: string;
    state: CircuitState;
    constructor(message: string, circuitName: string, state: CircuitState);
}
export declare class CircuitBreaker extends EventEmitter {
    private config;
    private state;
    private failures;
    private successes;
    private requests;
    private lastFailureTime?;
    private lastSuccessTime?;
    private nextAttempt?;
    private monitoringTimer?;
    constructor(config: CircuitBreakerConfig);
    /**
     * Execute a function with circuit breaker protection
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Get current circuit breaker statistics
     */
    getStats(): CircuitBreakerStats;
    /**
     * Reset circuit breaker to CLOSED state
     */
    reset(): void;
    /**
     * Force circuit breaker to OPEN state
     */
    forceOpen(): void;
    /**
     * Force circuit breaker to CLOSED state
     */
    forceClosed(): void;
    /**
     * Check if circuit breaker is healthy
     */
    isHealthy(): boolean;
    /**
     * Get failure rate percentage
     */
    getFailureRate(): number;
    /**
     * Destroy circuit breaker and cleanup resources
     */
    destroy(): void;
    /**
     * Handle successful execution
     */
    private onSuccess;
    /**
     * Handle failed execution
     */
    private onFailure;
    /**
     * Create timeout promise
     */
    private createTimeoutPromise;
    /**
     * Start monitoring and periodic cleanup
     */
    private startMonitoring;
}
/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
export declare class CircuitBreakerManager {
    private circuitBreakers;
    private defaultConfig;
    /**
     * Create or get circuit breaker for a service
     */
    getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker;
    /**
     * Execute function with circuit breaker protection
     */
    execute<T>(serviceName: string, fn: () => Promise<T>, config?: Partial<CircuitBreakerConfig>): Promise<T>;
    /**
     * Get all circuit breaker statistics
     */
    getAllStats(): Record<string, CircuitBreakerStats>;
    /**
     * Reset all circuit breakers
     */
    resetAll(): void;
    /**
     * Get health status of all circuit breakers
     */
    getHealthStatus(): {
        healthy: string[];
        unhealthy: string[];
        total: number;
    };
    /**
     * Destroy all circuit breakers
     */
    destroy(): void;
}
export declare const circuitBreakerManager: CircuitBreakerManager;
/**
 * Decorator for automatic circuit breaker protection
 */
export declare function withCircuitBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=circuit-breaker.d.ts.map