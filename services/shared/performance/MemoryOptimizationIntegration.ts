// @ts-nocheck
import { logger } from '../utils/logger';
import { MemoryOptimizer } from './MemoryOptimizer';
import {
  ResourceMonitor,
  defaultResourceMonitorConfig,
} from './ResourceMonitor';

/**
 * Integration service for memory optimization across all services
 * This provides a unified interface for memory management and monitoring
 */
export class MemoryOptimizationIntegration {
  private static instance: MemoryOptimizationIntegration;
  private resourceMonitor: ResourceMonitor;
  private isInitialized = false;

  private constructor() {
    // Private constructor for singleton pattern
    this.resourceMonitor = new ResourceMonitor(defaultResourceMonitorConfig);
    this.setupEventHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MemoryOptimizationIntegration {
    if (!MemoryOptimizationIntegration.instance) {
      MemoryOptimizationIntegration.instance =
        new MemoryOptimizationIntegration();
    }

    return MemoryOptimizationIntegration.instance;
  }

  /**
   * Initialize memory optimization for a service
   */
  async initialize(serviceName: string): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Memory optimization already initialized');

      return;
    }

    logger.info('Initializing memory optimization', { service: serviceName });

    // Start monitoring
    this.resourceMonitor.start();

    // Set up graceful shutdown
    this.setupGracefulShutdown();

    this.isInitialized = true;
    logger.info('Memory optimization initialized successfully', {
      service: serviceName,
    });
  }

  /**
   * Get memory optimizer instance
   */
  getMemoryOptimizer(): MemoryOptimizer {
    return this.resourceMonitor.getMemoryOptimizer();
  }

  /**
   * Get resource monitor instance
   */
  getResourceMonitor(): ResourceMonitor {
    return this.resourceMonitor;
  }

  /**
   * Optimize memory for large dataset processing
   * Use this when processing large amounts of data
   */
  async processLargeDataset<T>(
    data: T[],
    processor: (chunk: T[]) => Promise<void>,
    options?: {
      chunkSize?: number;
      concurrency?: number;
      trackProgress?: boolean;
    }
  ): Promise<void> {
    const memoryOptimizer = this.getMemoryOptimizer();

    logger.info('Starting large dataset processing', {
      totalItems: data.length,
      chunkSize: options?.chunkSize,
      concurrency: options?.concurrency,
    });

    // Track progress if requested
    if (options?.trackProgress) {
      memoryOptimizer.on('streamProgress', progress => {
        logger.info('Dataset processing progress', {
          processed: progress.processed,
          total: progress.total,
          percentage: `${progress.percentage.toFixed(1)}%`,
        });
      });
    }

    try {
      await memoryOptimizer.createStreamProcessor(data, processor, options);
      logger.info('Large dataset processing completed successfully');
    } catch (error) {
      logger.error('Large dataset processing failed', error);
      throw error;
    }
  }

  /**
   * Track a resource for automatic cleanup
   */
  trackResource(resource: {
    id: string;
    type: 'stream' | 'timer' | 'connection' | 'cache' | 'buffer';
    size?: number;
    metadata?: Record<string, any>;
  }): string {
    return this.getMemoryOptimizer().trackResource(resource);
  }

  /**
   * Untrack a resource
   */
  untrackResource(id: string): boolean {
    return this.getMemoryOptimizer().untrackResource(id);
  }

  /**
   * Get current system health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    memory: any;
    alerts: any[];
    recommendations: string[];
  }> {
    const memoryMetrics = this.getMemoryOptimizer().getMemoryMetrics();
    const activeAlerts = this.resourceMonitor.getActiveAlerts();
    const recommendations =
      this.getMemoryOptimizer().getOptimizationRecommendations();

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Determine overall status
    if (activeAlerts.some(alert => alert.severity === 'critical')) {
      status = 'critical';
    } else if (
      activeAlerts.length > 0 ||
      memoryMetrics.heapUsagePercentage > 80
    ) {
      status = 'warning';
    }

    return {
      status,
      memory: memoryMetrics,
      alerts: activeAlerts,
      recommendations,
    };
  }

  /**
   * Force system optimization
   */
  async optimizeSystem(): Promise<{
    success: boolean;
    results: any;
    error?: string;
  }> {
    try {
      logger.info('Starting system optimization');
      const results = await this.resourceMonitor.optimizeSystem();

      logger.info('System optimization completed', results);

      return {
        success: true,
        results,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('System optimization failed', error);

      return {
        success: false,
        results: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Get performance report
   */
  async getPerformanceReport(hours: number = 1): Promise<any> {
    const startTime = Date.now() - hours * 60 * 60 * 1000;

    return this.resourceMonitor.getPerformanceReport(startTime);
  }

  /**
   * Shutdown memory optimization
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Shutting down memory optimization');
    this.resourceMonitor.stop();
    this.isInitialized = false;
    logger.info('Memory optimization shutdown complete');
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    this.resourceMonitor.on('alert', alert => {
      logger.warn('Resource alert triggered', {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
      });

      // Auto-optimize on critical memory alerts
      if (alert.type === 'memory' && alert.severity === 'critical') {
        logger.info('Auto-optimizing due to critical memory alert');
        this.optimizeSystem().catch(error => {
          logger.error('Auto-optimization failed', error);
        });
      }
    });

    this.resourceMonitor.on('alertResolved', alert => {
      logger.info('Resource alert resolved', {
        id: alert.id,
        type: alert.type,
        title: alert.title,
        duration: alert.resolvedAt ? alert.resolvedAt - alert.timestamp : 0,
      });
    });

    this.resourceMonitor.on('performanceReport', report => {
      logger.info('Performance report generated', {
        period: report.period,
        avgMemory: `${report.summary.avgMemoryUsage.toFixed(1)}%`,
        avgCpu: `${report.summary.avgCpuUsage.toFixed(1)}%`,
        alerts: report.summary.totalAlerts,
        memoryTrend: report.trends.memoryTrend,
      });
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdownHandler = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async error => {
      logger.error('Uncaught exception', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      await this.shutdown();
      process.exit(1);
    });
  }
}

/**
 * Middleware for Express.js to track request resources
 */
export function memoryTrackingMiddleware() {
  const integration = MemoryOptimizationIntegration.getInstance();

  return (req: any, res: any, next: any) => {
    const requestId = `request_${Date.now()}_${Math.random()}`;
    const startTime = Date.now();

    // Track the request
    integration.trackResource({
      id: requestId,
      type: 'connection',
      metadata: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        startTime,
      },
    });

    // Cleanup when response finishes
    res.on('finish', () => {
      integration.untrackResource(requestId);
    });

    // Cleanup on error
    res.on('error', () => {
      integration.untrackResource(requestId);
    });

    next();
  };
}

/**
 * Decorator for automatic resource tracking in class methods
 */
export function trackMemoryUsage(
  resourceType:
    | 'stream'
    | 'timer'
    | 'connection'
    | 'cache'
    | 'buffer' = 'buffer'
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const integration = MemoryOptimizationIntegration.getInstance();
      const resourceId = `${target.constructor.name}_${propertyName}_${Date.now()}_${Math.random()}`;

      // Track resource
      integration.trackResource({
        id: resourceId,
        type: resourceType,
        metadata: {
          className: target.constructor.name,
          methodName: propertyName,
          args: args.length,
        },
      });

      try {
        const result = await method.apply(this, args);

        return result;
      } finally {
        // Always cleanup
        integration.untrackResource(resourceId);
      }
    };

    return descriptor;
  };
}

/**
 * Utility function to process large datasets with automatic memory optimization
 */
export async function processLargeDatasetWithOptimization<T, R>(
  data: T[],
  processor: (item: T) => Promise<R>,
  options?: {
    chunkSize?: number;
    concurrency?: number;
    trackProgress?: boolean;
  }
): Promise<R[]> {
  const integration = MemoryOptimizationIntegration.getInstance();
  const results: R[] = [];

  await integration.processLargeDataset(
    data,
    async (chunk: T[]) => {
      const chunkResults = await Promise.all(chunk.map(processor));

      results.push(...chunkResults);
    },
    options
  );

  return results;
}

// Export singleton instance for easy access
export const memoryOptimization = MemoryOptimizationIntegration.getInstance();
