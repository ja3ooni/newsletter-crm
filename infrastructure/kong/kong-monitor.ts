/**
 * Kong API Gateway Monitoring and Management Utility
 * Provides monitoring, health checks, and management functions for Kong
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface KongService {
  id: string;
  name: string;
  protocol: string;
  host: string;
  port: number;
  path?: string;
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface KongRoute {
  id: string;
  name: string;
  protocols: string[];
  methods?: string[];
  hosts?: string[];
  paths?: string[];
  service: { id: string };
  created_at: number;
  updated_at: number;
}

export interface KongConsumer {
  id: string;
  username: string;
  custom_id?: string;
  tags?: string[];
  created_at: number;
}

export interface KongPlugin {
  id: string;
  name: string;
  service?: { id: string };
  route?: { id: string };
  consumer?: { id: string };
  config: Record<string, any>;
  enabled: boolean;
  created_at: number;
}

export interface KongHealthStatus {
  database: {
    reachable: boolean;
  };
  memory: {
    workers_lua_vms: Array<{
      http_allocated_gc: string;
      pid: number;
    }>;
  };
  server: {
    connections_accepted: number;
    connections_active: number;
    connections_handled: number;
    connections_reading: number;
    connections_waiting: number;
    connections_writing: number;
    total_requests: number;
  };
}

export interface RateLimitMetrics {
  consumer: string;
  service: string;
  route: string;
  requests_per_minute: number;
  requests_remaining: number;
  reset_time: number;
}

export interface ServiceMetrics {
  service_name: string;
  total_requests: number;
  success_rate: number;
  avg_response_time: number;
  error_rate: number;
  last_24h_requests: number;
}

export class KongMonitor {
  private client: AxiosInstance;
  private adminUrl: string;

  constructor(adminUrl: string = 'http://localhost:8001') {
    this.adminUrl = adminUrl;
    this.client = axios.create({
      baseURL: adminUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check Kong health status
   */
  async getHealthStatus(): Promise<KongHealthStatus> {
    try {
      const response = await this.client.get('/status');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Kong health status:', error);
      throw new Error('Kong health check failed');
    }
  }

  /**
   * Get all services
   */
  async getServices(): Promise<KongService[]> {
    try {
      const response = await this.client.get('/services');
      return response.data.data || [];
    } catch (error) {
      logger.error('Failed to get Kong services:', error);
      throw error;
    }
  }

  /**
   * Get all routes
   */
  async getRoutes(): Promise<KongRoute[]> {
    try {
      const response = await this.client.get('/routes');
      return response.data.data || [];
    } catch (error) {
      logger.error('Failed to get Kong routes:', error);
      throw error;
    }
  }

  /**
   * Get all consumers
   */
  async getConsumers(): Promise<KongConsumer[]> {
    try {
      const response = await this.client.get('/consumers');
      return response.data.data || [];
    } catch (error) {
      logger.error('Failed to get Kong consumers:', error);
      throw error;
    }
  }

  /**
   * Get all plugins
   */
  async getPlugins(): Promise<KongPlugin[]> {
    try {
      const response = await this.client.get('/plugins');
      return response.data.data || [];
    } catch (error) {
      logger.error('Failed to get Kong plugins:', error);
      throw error;
    }
  }

  /**
   * Get rate limiting metrics for a consumer
   */
  async getRateLimitMetrics(consumerId: string): Promise<RateLimitMetrics[]> {
    try {
      // This would typically come from Redis or Kong's rate limiting plugin
      // For now, we'll simulate the data structure
      const plugins = await this.getPlugins();
      const rateLimitPlugins = plugins.filter(p => p.name === 'rate-limiting-advanced');

      return rateLimitPlugins.map(plugin => ({
        consumer: consumerId,
        service: plugin.service?.id || 'global',
        route: plugin.route?.id || 'global',
        requests_per_minute: plugin.config.limit?.[0] || 0,
        requests_remaining: Math.floor(Math.random() * (plugin.config.limit?.[0] || 100)),
        reset_time: Date.now() + 60000, // 1 minute from now
      }));
    } catch (error) {
      logger.error('Failed to get rate limit metrics:', error);
      throw error;
    }
  }

  /**
   * Get service performance metrics
   */
  async getServiceMetrics(): Promise<ServiceMetrics[]> {
    try {
      const services = await this.getServices();

      // In a real implementation, this would come from Prometheus or Kong's metrics
      return services.map(service => ({
        service_name: service.name,
        total_requests: Math.floor(Math.random() * 10000),
        success_rate: 95 + Math.random() * 5, // 95-100%
        avg_response_time: 50 + Math.random() * 200, // 50-250ms
        error_rate: Math.random() * 5, // 0-5%
        last_24h_requests: Math.floor(Math.random() * 1000),
      }));
    } catch (error) {
      logger.error('Failed to get service metrics:', error);
      throw error;
    }
  }

  /**
   * Create a new consumer
   */
  async createConsumer(username: string, customId?: string, tags?: string[]): Promise<KongConsumer> {
    try {
      const payload: any = { username };
      if (customId) payload.custom_id = customId;
      if (tags) payload.tags = tags;

      const response = await this.client.post('/consumers', payload);
      logger.info(`Created consumer: ${username}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to create consumer ${username}:`, error);
      throw error;
    }
  }

  /**
   * Create API key for consumer
   */
  async createApiKey(consumerId: string, key?: string): Promise<{ key: string; consumer: { id: string } }> {
    try {
      const payload = key ? { key } : {};
      const response = await this.client.post(`/consumers/${consumerId}/key-auth`, payload);
      logger.info(`Created API key for consumer: ${consumerId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to create API key for consumer ${consumerId}:`, error);
      throw error;
    }
  }

  /**
   * Create JWT credential for consumer
   */
  async createJwtCredential(
    consumerId: string,
    key: string,
    secret: string,
    algorithm: string = 'HS256'
  ): Promise<any> {
    try {
      const payload = { key, secret, algorithm };
      const response = await this.client.post(`/consumers/${consumerId}/jwt`, payload);
      logger.info(`Created JWT credential for consumer: ${consumerId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to create JWT credential for consumer ${consumerId}:`, error);
      throw error;
    }
  }

  /**
   * Update rate limiting for a service
   */
  async updateRateLimit(
    serviceId: string,
    limits: number[],
    windowSize: number[] = [60]
  ): Promise<KongPlugin> {
    try {
      // Find existing rate limiting plugin
      const plugins = await this.getPlugins();
      const existingPlugin = plugins.find(
        p => p.name === 'rate-limiting-advanced' && p.service?.id === serviceId
      );

      const config = {
        limit: limits,
        window_size: windowSize,
        identifier: 'consumer',
        sync_rate: 10,
        strategy: 'redis',
        redis: {
          host: 'redis',
          port: 6379,
          password: process.env.REDIS_PASSWORD || 'datatechtoncrm_redis_password',
          database: 0,
        },
      };

      let response;
      if (existingPlugin) {
        // Update existing plugin
        response = await this.client.patch(`/plugins/${existingPlugin.id}`, { config });
        logger.info(`Updated rate limiting for service: ${serviceId}`);
      } else {
        // Create new plugin
        response = await this.client.post('/plugins', {
          name: 'rate-limiting-advanced',
          service: { id: serviceId },
          config,
        });
        logger.info(`Created rate limiting for service: ${serviceId}`);
      }

      return response.data;
    } catch (error) {
      logger.error(`Failed to update rate limiting for service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Enable/disable a plugin
   */
  async togglePlugin(pluginId: string, enabled: boolean): Promise<KongPlugin> {
    try {
      const response = await this.client.patch(`/plugins/${pluginId}`, { enabled });
      logger.info(`${enabled ? 'Enabled' : 'Disabled'} plugin: ${pluginId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to toggle plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  async getDashboardData(): Promise<{
    health: KongHealthStatus;
    services: KongService[];
    routes: KongRoute[];
    consumers: KongConsumer[];
    plugins: KongPlugin[];
    metrics: ServiceMetrics[];
  }> {
    try {
      const [health, services, routes, consumers, plugins, metrics] = await Promise.all([
        this.getHealthStatus(),
        this.getServices(),
        this.getRoutes(),
        this.getConsumers(),
        this.getPlugins(),
        this.getServiceMetrics(),
      ]);

      return {
        health,
        services,
        routes,
        consumers,
        plugins,
        metrics,
      };
    } catch (error) {
      logger.error('Failed to get dashboard data:', error);
      throw error;
    }
  }

  /**
   * Validate Kong configuration
   */
  async validateConfiguration(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const { services, routes, plugins } = await this.getDashboardData();
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check if all services have health checks
      services.forEach(service => {
        const hasHealthCheck = routes.some(route =>
          route.service.id === service.id && route.paths?.includes('/health')
        );
        if (!hasHealthCheck) {
          issues.push(`Service ${service.name} missing health check endpoint`);
        }
      });

      // Check if rate limiting is configured
      const rateLimitPlugins = plugins.filter(p => p.name.includes('rate-limiting'));
      if (rateLimitPlugins.length === 0) {
        issues.push('No rate limiting plugins configured');
      }

      // Check if authentication is configured
      const authPlugins = plugins.filter(p => ['jwt', 'key-auth', 'oauth2'].includes(p.name));
      if (authPlugins.length === 0) {
        issues.push('No authentication plugins configured');
      }

      // Check if monitoring is enabled
      const monitoringPlugins = plugins.filter(p => ['prometheus', 'request-id'].includes(p.name));
      if (monitoringPlugins.length === 0) {
        recommendations.push('Enable monitoring plugins (Prometheus, Request ID)');
      }

      // Check if CORS is configured
      const corsPlugins = plugins.filter(p => p.name === 'cors');
      if (corsPlugins.length === 0) {
        recommendations.push('Configure CORS plugin for frontend integration');
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (error) {
      logger.error('Failed to validate Kong configuration:', error);
      return {
        isValid: false,
        issues: ['Failed to validate configuration'],
        recommendations: [],
      };
    }
  }
}
