/**
 * Service Discovery and Health Checking
 * Provides service registration, discovery, and health monitoring
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { logger } from './logger';

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

export class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceInstance[]> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private httpClient: AxiosInstance;

  constructor() {
    super();
    this.httpClient = axios.create({
      timeout: 5000,
      validateStatus: (status) => status >= 200 && status < 300,
    });
  }

  /**
   * Register a service instance
   */
  registerService(config: ServiceDiscoveryConfig): ServiceInstance {
    const instance: ServiceInstance = {
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
    this.services.get(config.serviceName)!.push(instance);

    // Start health checking
    this.startHealthCheck(instance, config);

    logger.info('Service registered', {
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
  deregisterService(serviceName: string, instanceId: string): boolean {
    const instances = this.services.get(serviceName);
    if (!instances) return false;

    const index = instances.findIndex(instance => instance.id === instanceId);
    if (index === -1) return false;

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

    logger.info('Service deregistered', {
      serviceName,
      instanceId,
    });

    this.emit('serviceDeregistered', instance);
    return true;
  }

  /**
   * Discover service instances
   */
  discoverService(serviceName: string, options?: {
    healthyOnly?: boolean;
    tags?: string[];
    version?: string;
  }): ServiceInstance[] {
    const instances = this.services.get(serviceName) || [];
    let filtered = instances;

    if (options?.healthyOnly !== false) {
      filtered = filtered.filter(instance => instance.healthy);
    }

    if (options?.tags && options.tags.length > 0) {
      filtered = filtered.filter(instance =>
        options.tags!.every(tag => instance.tags.includes(tag))
      );
    }

    if (options?.version) {
      filtered = filtered.filter(instance => instance.version === options.version);
    }

    return filtered;
  }

  /**
   * Get a service instance using load balancing
   */
  getServiceInstance(
    serviceName: string,
    strategy: 'round-robin' | 'random' | 'least-connections' = 'round-robin',
    options?: {
      healthyOnly?: boolean;
      tags?: string[];
      version?: string;
    }
  ): ServiceInstance | null {
    const instances = this.discoverService(serviceName, options);
    if (instances.length === 0) return null;

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
  getServiceUrl(serviceName: string, path: string = '', options?: {
    healthyOnly?: boolean;
    tags?: string[];
    version?: string;
  }): string | null {
    const instance = this.getServiceInstance(serviceName, 'round-robin', options);
    if (!instance) return null;

    const basePath = path.startsWith('/') ? path : `/${path}`;
    return `${instance.protocol}://${instance.host}:${instance.port}${basePath}`;
  }

  /**
   * Get all registered services
   */
  getAllServices(): Record<string, ServiceInstance[]> {
    const result: Record<string, ServiceInstance[]> = {};
    for (const [serviceName, instances] of this.services) {
      result[serviceName] = [...instances];
    }
    return result;
  }

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
  } {
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
  async performHealthCheck(instance: ServiceInstance): Promise<HealthCheckResult> {
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

    } catch (error) {
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
  private startHealthCheck(instance: ServiceInstance, config: ServiceDiscoveryConfig): void {
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
            logger.info('Service instance recovered', {
              serviceName: instance.name,
              instanceId: instance.id,
              responseTime: result.responseTime,
            });
            this.emit('serviceHealthy', instance);
          }
        } else {
          consecutiveFailures++;
          if (instance.healthy && consecutiveFailures >= config.unhealthyThreshold) {
            instance.healthy = false;
            logger.warn('Service instance unhealthy', {
              serviceName: instance.name,
              instanceId: instance.id,
              error: result.error,
              consecutiveFailures,
            });
            this.emit('serviceUnhealthy', instance);
          }
        }

        this.emit('healthCheckResult', instance, result);

      } catch (error) {
        logger.error('Health check failed', {
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
  private generateInstanceId(serviceName: string): string {
    return `${serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup and stop all health checks
   */
  destroy(): void {
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
    this.services.clear();
    this.removeAllListeners();
    logger.info('Service registry destroyed');
  }
}

/**
 * Service Discovery Client
 * Provides client-side service discovery functionality
 */
export class ServiceDiscoveryClient {
  private registry: ServiceRegistry;
  private httpClient: AxiosInstance;

  constructor(registry: ServiceRegistry) {
    this.registry = registry;
    this.httpClient = axios.create({
      timeout: 10000,
    });
  }

  /**
   * Make HTTP request to a service
   */
  async request<T = any>(
    serviceName: string,
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      data?: any;
      headers?: Record<string, string>;
      timeout?: number;
      retries?: number;
      tags?: string[];
      version?: string;
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      data,
      headers = {},
      timeout = 10000,
      retries = 3,
      tags,
      version,
    } = options;

    let lastError: Error | null = null;

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

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < retries) {
          logger.warn('Service request failed, retrying', {
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
  getService(serviceName: string, options?: {
    tags?: string[];
    version?: string;
  }): ServiceInstance | null {
    return this.registry.getServiceInstance(serviceName, 'round-robin', {
      healthyOnly: true,
      ...options,
    });
  }
}

// Global service registry instance
export const serviceRegistry = new ServiceRegistry();

// Global service discovery client
export const serviceDiscoveryClient = new ServiceDiscoveryClient(serviceRegistry);

/**
 * Initialize service discovery for a service
 */
export function initializeServiceDiscovery(config: ServiceDiscoveryConfig): ServiceInstance {
  return serviceRegistry.registerService(config);
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown(serviceName: string, instanceId: string): void {
  const shutdown = () => {
    logger.info('Graceful shutdown initiated');
    serviceRegistry.deregisterService(serviceName, instanceId);
    serviceRegistry.destroy();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGUSR2', shutdown); // For nodemon
}
