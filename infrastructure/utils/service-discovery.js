"use strict";
/**
 * Service Discovery and Health Checking
 * Provides service registration, discovery, and health monitoring
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGracefulShutdown = exports.initializeServiceDiscovery = exports.serviceDiscoveryClient = exports.serviceRegistry = exports.ServiceDiscoveryClient = exports.ServiceRegistry = void 0;
const axios_1 = __importDefault(require("axios"));
const events_1 = require("events");
const logger_1 = require("./logger");
class ServiceRegistry extends events_1.EventEmitter {
    services = new Map();
    healthCheckIntervals = new Map();
    httpClient;
    constructor() {
        super();
        this.httpClient = axios_1.default.create({
            timeout: 5000,
            validateStatus: (status) => status >= 200 && status < 300,
        });
    }
    /**
     * Register a service instance
     */
    registerService(config) {
        const instance = {
            id: this.generateInstanceId(config.serviceName),
            name: config.serviceName,
            version: config.version,
            host: config.host,
            port: config.port,
            protocol: config.protocol,
            healthCheckPath: config.healthCheckPath,
            metadata: config.metadata || {},
            registeredAt: new Date(),
            healthy: true,
            tags: config.tags || [],
        };
        // Add to registry
        if (!this.services.has(config.serviceName)) {
            this.services.set(config.serviceName, []);
        }
        this.services.get(config.serviceName).push(instance);
        // Start health checking
        this.startHealthCheck(instance, config);
        logger_1.logger.info('Service registered', {
            serviceName: config.serviceName,
            instanceId: instance.id,
            endpoint: `${config.protocol}://${config.host}:${config.port}`,
        });
        this.emit('serviceRegistered', instance);
        return instance;
    }
    /**
     * Deregister a service instance
     */
    deregisterService(serviceName, instanceId) {
        const instances = this.services.get(serviceName);
        if (!instances)
            return false;
        const index = instances.findIndex(instance => instance.id === instanceId);
        if (index === -1)
            return false;
        const instance = instances[index];
        instances.splice(index, 1);
        // Stop health checking
        const healthCheckKey = `${serviceName}:${instanceId}`;
        const interval = this.healthCheckIntervals.get(healthCheckKey);
        if (interval) {
            clearInterval(interval);
            this.healthCheckIntervals.delete(healthCheckKey);
        }
        // Remove service if no instances left
        if (instances.length === 0) {
            this.services.delete(serviceName);
        }
        logger_1.logger.info('Service deregistered', {
            serviceName,
            instanceId,
        });
        this.emit('serviceDeregistered', instance);
        return true;
    }
    /**
     * Discover service instances
     */
    discoverService(serviceName, options) {
        const instances = this.services.get(serviceName) || [];
        let filtered = instances;
        if (options?.healthyOnly !== false) {
            filtered = filtered.filter(instance => instance.healthy);
        }
        if (options?.tags && options.tags.length > 0) {
            filtered = filtered.filter(instance => options.tags.every(tag => instance.tags.includes(tag)));
        }
        if (options?.version) {
            filtered = filtered.filter(instance => instance.version === options.version);
        }
        return filtered;
    }
    /**
     * Get a service instance using load balancing
     */
    getServiceInstance(serviceName, strategy = 'round-robin', options) {
        const instances = this.discoverService(serviceName, options);
        if (instances.length === 0)
            return null;
        switch (strategy) {
            case 'random':
                return instances[Math.floor(Math.random() * instances.length)];
            case 'round-robin':
                // Simple round-robin based on timestamp
                const index = Date.now() % instances.length;
                return instances[index];
            case 'least-connections':
                // For now, just return the first instance
                // In a real implementation, this would track active connections
                return instances[0];
            default:
                return instances[0];
        }
    }
    /**
     * Get service URL
     */
    getServiceUrl(serviceName, path = '', options) {
        const instance = this.getServiceInstance(serviceName, 'round-robin', options);
        if (!instance)
            return null;
        const basePath = path.startsWith('/') ? path : `/${path}`;
        return `${instance.protocol}://${instance.host}:${instance.port}${basePath}`;
    }
    /**
     * Get all registered services
     */
    getAllServices() {
        const result = {};
        for (const [serviceName, instances] of this.services) {
            result[serviceName] = [...instances];
        }
        return result;
    }
    /**
     * Get service health status
     */
    getServiceHealth(serviceName) {
        const instances = this.services.get(serviceName) || [];
        const healthyInstances = instances.filter(i => i.healthy).length;
        return {
            totalInstances: instances.length,
            healthyInstances,
            unhealthyInstances: instances.length - healthyInstances,
            instances: instances.map(i => ({
                id: i.id,
                healthy: i.healthy,
                lastHealthCheck: i.lastHealthCheck,
            })),
        };
    }
    /**
     * Perform health check on service instance
     */
    async performHealthCheck(instance) {
        const startTime = Date.now();
        const url = `${instance.protocol}://${instance.host}:${instance.port}${instance.healthCheckPath}`;
        try {
            await this.httpClient.get(url);
            const responseTime = Date.now() - startTime;
            return {
                healthy: true,
                responseTime,
                timestamp: new Date(),
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                healthy: false,
                responseTime,
                error: errorMessage,
                timestamp: new Date(),
            };
        }
    }
    /**
     * Start health checking for an instance
     */
    startHealthCheck(instance, config) {
        const healthCheckKey = `${instance.name}:${instance.id}`;
        let consecutiveFailures = 0;
        const interval = setInterval(async () => {
            try {
                const result = await this.performHealthCheck(instance);
                instance.lastHealthCheck = result.timestamp;
                if (result.healthy) {
                    consecutiveFailures = 0;
                    if (!instance.healthy) {
                        instance.healthy = true;
                        logger_1.logger.info('Service instance recovered', {
                            serviceName: instance.name,
                            instanceId: instance.id,
                            responseTime: result.responseTime,
                        });
                        this.emit('serviceHealthy', instance);
                    }
                }
                else {
                    consecutiveFailures++;
                    if (instance.healthy && consecutiveFailures >= config.unhealthyThreshold) {
                        instance.healthy = false;
                        logger_1.logger.warn('Service instance unhealthy', {
                            serviceName: instance.name,
                            instanceId: instance.id,
                            error: result.error,
                            consecutiveFailures,
                        });
                        this.emit('serviceUnhealthy', instance);
                    }
                }
                this.emit('healthCheckResult', instance, result);
            }
            catch (error) {
                logger_1.logger.error('Health check failed', {
                    serviceName: instance.name,
                    instanceId: instance.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }, config.healthCheckInterval);
        this.healthCheckIntervals.set(healthCheckKey, interval);
    }
    /**
     * Generate unique instance ID
     */
    generateInstanceId(serviceName) {
        return `${serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Cleanup and stop all health checks
     */
    destroy() {
        for (const interval of this.healthCheckIntervals.values()) {
            clearInterval(interval);
        }
        this.healthCheckIntervals.clear();
        this.services.clear();
        this.removeAllListeners();
        logger_1.logger.info('Service registry destroyed');
    }
}
exports.ServiceRegistry = ServiceRegistry;
/**
 * Service Discovery Client
 * Provides client-side service discovery functionality
 */
class ServiceDiscoveryClient {
    registry;
    httpClient;
    constructor(registry) {
        this.registry = registry;
        this.httpClient = axios_1.default.create({
            timeout: 10000,
        });
    }
    /**
     * Make HTTP request to a service
     */
    async request(serviceName, path, options = {}) {
        const { method = 'GET', data, headers = {}, timeout = 10000, retries = 3, tags, version, } = options;
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            const serviceUrl = this.registry.getServiceUrl(serviceName, path, {
                healthyOnly: true,
                tags,
                version,
            });
            if (!serviceUrl) {
                throw new Error(`No healthy instances found for service: ${serviceName}`);
            }
            try {
                const response = await this.httpClient.request({
                    method,
                    url: serviceUrl,
                    data,
                    headers,
                    timeout,
                });
                return response.data;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
                if (attempt < retries) {
                    logger_1.logger.warn('Service request failed, retrying', {
                        serviceName,
                        path,
                        attempt: attempt + 1,
                        error: lastError.message,
                    });
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
        throw lastError || new Error('All retry attempts failed');
    }
    /**
     * Get service instance for manual requests
     */
    getService(serviceName, options) {
        return this.registry.getServiceInstance(serviceName, 'round-robin', {
            healthyOnly: true,
            ...options,
        });
    }
}
exports.ServiceDiscoveryClient = ServiceDiscoveryClient;
// Global service registry instance
exports.serviceRegistry = new ServiceRegistry();
// Global service discovery client
exports.serviceDiscoveryClient = new ServiceDiscoveryClient(exports.serviceRegistry);
/**
 * Initialize service discovery for a service
 */
function initializeServiceDiscovery(config) {
    return exports.serviceRegistry.registerService(config);
}
exports.initializeServiceDiscovery = initializeServiceDiscovery;
/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(serviceName, instanceId) {
    const shutdown = () => {
        logger_1.logger.info('Graceful shutdown initiated');
        exports.serviceRegistry.deregisterService(serviceName, instanceId);
        exports.serviceRegistry.destroy();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGUSR2', shutdown); // For nodemon
}
exports.setupGracefulShutdown = setupGracefulShutdown;
//# sourceMappingURL=service-discovery.js.map