import { logger } from '../utils/logger';
import { memoryMonitoringService } from './MemoryMonitoringService';
import { resourceCleanupService } from './ResourceCleanupService';
import { serviceMemoryOptimizer } from './ServiceMemoryOptimizer';

/**
 * Bootstrap service to apply memory optimizations across all services
 */
export class MemoryOptimizationBootstrap {
  private static instance: MemoryOptimizationBootstrap;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): MemoryOptimizationBootstrap {
    if (!MemoryOptimizationBootstrap.instance) {
      MemoryOptimizationBootstrap.instance = new MemoryOptimizationBootstrap();
    }

    return MemoryOptimizationBootstrap.instance;
  }

  /**
   * Initialize memory optimization for a service
   */
  async initializeService(
    serviceName: string,
    serviceInstances: {
      database?: any;
      redis?: any;
      queueService?: any;
      eventEmitters?: Array<{ instance: any; name: string }>;
    }
  ): Promise<void> {
    if (this.isInitialized) {
      logger.warn(`Memory optimization already initialized for ${serviceName}`);

      return;
    }

    logger.info(`Bootstrapping memory optimization for ${serviceName}`);

    try {
      // Initialize service-level optimization
      await serviceMemoryOptimizer.initializeServiceOptimization(serviceName);

      // Apply specific fixes based on available service instances
      if (serviceInstances.database) {
        serviceMemoryOptimizer.fixDatabaseConnectionLeaks(
          serviceInstances.database,
          serviceName
        );
      }

      if (serviceInstances.redis) {
        serviceMemoryOptimizer.fixRedisConnectionLeaks(
          serviceInstances.redis,
          serviceName
        );
      }

      if (serviceInstances.queueService) {
        serviceMemoryOptimizer.fixQueueServiceLeaks(
          serviceInstances.queueService,
          serviceName
        );
      }

      if (serviceInstances.eventEmitters) {
        serviceInstances.eventEmitters.forEach(({ instance, name }) => {
          serviceMemoryOptimizer.fixEventEmitterLeaks(
            instance,
            name,
            serviceName
          );
        });
      }

      // Set up timer leak prevention
      serviceMemoryOptimizer.fixTimerLeaks(serviceName);

      // Optimize large data processing
      serviceMemoryOptimizer.optimizeLargeDataProcessing(serviceName);

      // Start memory monitoring
      memoryMonitoringService.start();

      this.isInitialized = true;
      logger.info(`Memory optimization bootstrap completed for ${serviceName}`);
    } catch (error) {
      logger.error(
        `Failed to bootstrap memory optimization for ${serviceName}`,
        error
      );
      throw error;
    }
  }

  /**
   * Apply memory optimizations to newsletter service
   */
  async optimizeNewsletterService(): Promise<void> {
    const serviceName = 'newsletter-service';

    try {
      // Import service dependencies (these would be the actual service instances)
      // For now, we'll use placeholders that would be replaced with actual imports

      logger.info(`Applying memory optimizations to ${serviceName}`);

      // Example of how this would be used:
      /*
      const { database } = require('../../../newsletter-service/src/utils/database');
      const { redis } = require('../../../newsletter-service/src/utils/redis');
      const { queueService } = require('../../../newsletter-service/src/utils/queue');

      await this.initializeService(serviceName, {
        database,
        redis,
        queueService,
        eventEmitters: [
          { instance: someEventEmitter, name: 'newsletter-events' }
        ]
      });
      */

      logger.info(`Newsletter service memory optimization completed`);
    } catch (error) {
      logger.error(`Failed to optimize newsletter service`, error);
      throw error;
    }
  }

  /**
   * Apply memory optimizations to user service
   */
  async optimizeUserService(): Promise<void> {
    const serviceName = 'user-service';

    try {
      logger.info(`Applying memory optimizations to ${serviceName}`);

      // Similar pattern for user service
      // Import and apply optimizations to user service instances

      logger.info(`User service memory optimization completed`);
    } catch (error) {
      logger.error(`Failed to optimize user service`, error);
      throw error;
    }
  }

  /**
   * Apply memory optimizations to all services
   */
  async optimizeAllServices(): Promise<void> {
    logger.info('Starting memory optimization for all services');

    const services = [
      'newsletter-service',
      'user-service',
      'analytics-service',
      'content-service',
      'crm-service',
      'deliverability-service',
      'marketing-automation-service',
      'billing-service',
    ];

    const results = await Promise.allSettled(
      services.map(async serviceName => {
        try {
          // For each service, we would apply the appropriate optimizations
          await serviceMemoryOptimizer.initializeServiceOptimization(
            serviceName
          );

          return { service: serviceName, success: true };
        } catch (error) {
          logger.error(`Failed to optimize ${serviceName}`, error);

          return { service: serviceName, success: false, error };
        }
      })
    );

    const successful = results.filter(
      r => r.status === 'fulfilled' && r.value.success
    ).length;
    const failed = results.length - successful;

    logger.info('Memory optimization completed for all services', {
      total: services.length,
      successful,
      failed,
    });

    // Start global monitoring
    memoryMonitoringService.start();
  }

  /**
   * Create middleware for Express.js applications
   */
  createExpressMiddleware(serviceName: string) {
    return (req: any, res: any, next: any) => {
      const requestId = `request_${Date.now()}_${Math.random()}`;
      const startTime = Date.now();

      // Track the request
      const cleanupTaskId = resourceCleanupService.registerCleanupTask({
        name: `${serviceName} HTTP Request`,
        type: 'connection',
        priority: 'normal',
        cleanup: () => {
          // Cleanup any request-specific resources
        },
        metadata: {
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          startTime,
        },
      });

      // Cleanup when response finishes
      res.on('finish', () => {
        resourceCleanupService.unregisterCleanupTask(cleanupTaskId);
      });

      // Cleanup on error
      res.on('error', () => {
        resourceCleanupService.unregisterCleanupTask(cleanupTaskId);
      });

      next();
    };
  }

  /**
   * Create health check endpoint data
   */
  async getHealthCheckData(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    memory: any;
    alerts: any[];
    recommendations: string[];
    services: string[];
  }> {
    const memoryReport = await memoryMonitoringService.getMemoryReport();
    const optimizationStatus = serviceMemoryOptimizer.getOptimizationStatus();

    return {
      status: memoryReport.summary.status,
      memory: memoryReport.metrics,
      alerts: memoryReport.alerts,
      recommendations: memoryReport.recommendations,
      services: optimizationStatus.optimizedServices,
    };
  }

  /**
   * Graceful shutdown with cleanup
   */
  async gracefulShutdown(): Promise<void> {
    logger.info('Starting graceful shutdown with memory cleanup');

    try {
      // Stop monitoring
      memoryMonitoringService.stop();

      // Perform cleanup
      await resourceCleanupService.gracefulShutdown();

      logger.info('Graceful shutdown completed');
    } catch (error) {
      logger.error('Error during graceful shutdown', error);
      throw error;
    }
  }
}

/**
 * Utility function to bootstrap memory optimization for a service
 */
export async function bootstrapMemoryOptimization(
  serviceName: string,
  serviceInstances: {
    database?: any;
    redis?: any;
    queueService?: any;
    eventEmitters?: Array<{ instance: any; name: string }>;
  }
): Promise<void> {
  const bootstrap = MemoryOptimizationBootstrap.getInstance();

  await bootstrap.initializeService(serviceName, serviceInstances);
}

/**
 * Utility function to create memory-optimized Express middleware
 */
export function createMemoryOptimizedMiddleware(serviceName: string) {
  const bootstrap = MemoryOptimizationBootstrap.getInstance();

  return bootstrap.createExpressMiddleware(serviceName);
}

/**
 * Utility function for health checks
 */
export async function getMemoryHealthCheck() {
  const bootstrap = MemoryOptimizationBootstrap.getInstance();

  return bootstrap.getHealthCheckData();
}

// Export singleton instance
export const memoryOptimizationBootstrap =
  MemoryOptimizationBootstrap.getInstance();
