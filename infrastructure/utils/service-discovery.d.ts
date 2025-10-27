/**
 * Service Discovery and Health Checking
 * Provides service registration, discovery, and health monitoring
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
export interface ServiceInstance {
    id: string;
    name: string;
    version: string;
    host: string;
    port: number;
    protocol: 'http' | 'https';
    healthCheckPath: string;
    metadata: Record<string, any>;
    registeredAt: Date;
    lastHealthCheck?: Date;
    healthy: boolean;
    tags: string[];
}
export interface ServiceDiscoveryConfig {
    serviceName: string;
    version: string;
    host: string;
    port: number;
    protocol: 'http' | 'https';
    healthCheckPath: string;
    healthCheckInterval: number;
    healthCheckTimeout: number;
    unhealthyThreshold: number;
    metadata?: Record<string, any>;
    tags?: string[];
}
export interface HealthCheckResult {
    healthy: boolean;
    responseTime: number;
    error?: string;
    timestamp: Date;
}
export declare class ServiceRegistry extends EventEmitter {
    private services;
    private healthCheckIntervals;
    private httpClient;
    constructor();
    /**
     * Register a service instance
     */
    registerService(config: ServiceDiscoveryConfig): ServiceInstance;
    /**
     * Deregister a service instance
     */
    deregisterService(serviceName: string, instanceId: string): boolean;
    /**
     * Discover service instances
     */
    discoverService(serviceName: string, options?: {
        healthyOnly?: boolean;
        tags?: string[];
        version?: string;
    }): ServiceInstance[];
    /**
     * Get a service instance using load balancing
     */
    getServiceInstance(serviceName: string, strategy?: 'round-robin' | 'random' | 'least-connections', options?: {
        healthyOnly?: boolean;
        tags?: string[];
        version?: string;
    }): ServiceInstance | null;
    /**
     * Get service URL
     */
    getServiceUrl(serviceName: string, path?: string, options?: {
        healthyOnly?: boolean;
        tags?: string[];
        version?: string;
    }): string | null;
    /**
     * Get all registered services
     */
    getAllServices(): Record<string, ServiceInstance[]>;
    /**
     * Get service health status
     */
    getServiceHealth(serviceName: string): {
        totalInstances: number;
        healthyInstances: number;
        unhealthyInstances: number;
        instances: Array<{
            id: string;
            healthy: boolean;
            lastHealthCheck?: Date;
        }>;
    };
    /**
     * Perform health check on service instance
     */
    performHealthCheck(instance: ServiceInstance): Promise<HealthCheckResult>;
    /**
     * Start health checking for an instance
     */
    private startHealthCheck;
    /**
     * Generate unique instance ID
     */
    private generateInstanceId;
    /**
     * Cleanup and stop all health checks
     */
    destroy(): void;
}
/**
 * Service Discovery Client
 * Provides client-side service discovery functionality
 */
export declare class ServiceDiscoveryClient {
    private registry;
    private httpClient;
    constructor(registry: ServiceRegistry);
    /**
     * Make HTTP request to a service
     */
    request<T = any>(serviceName: string, path: string, options?: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
        data?: any;
        headers?: Record<string, string>;
        timeout?: number;
        retries?: number;
        tags?: string[];
        version?: string;
    }): Promise<T>;
    /**
     * Get service instance for manual requests
     */
    getService(serviceName: string, options?: {
        tags?: string[];
        version?: string;
    }): ServiceInstance | null;
}
export declare const serviceRegistry: ServiceRegistry;
export declare const serviceDiscoveryClient: ServiceDiscoveryClient;
/**
 * Initialize service discovery for a service
 */
export declare function initializeServiceDiscovery(config: ServiceDiscoveryConfig): ServiceInstance;
/**
 * Graceful shutdown handler
 */
export declare function setupGracefulShutdown(serviceName: string, instanceId: string): void;
//# sourceMappingURL=service-discovery.d.ts.map