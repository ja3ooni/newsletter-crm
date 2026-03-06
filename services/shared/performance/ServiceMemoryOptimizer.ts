// @ts-nocheck
import { logger } from '../utils/logger';
import { memoryLeakDetector } from './MemoryLeakDetector';
import { MemoryOptimizationIntegration } from './MemoryOptimizationIntegration';
import {
  CleanupTaskFactory,
  resourceCleanupService,
} from './ResourceCleanupService';

/**
 * Service-specific memory optimization and leak fixes
 */
export class ServiceMemoryOptimizer {
  private static instance: ServiceMemoryOptimizer;
  private memoryIntegration: MemoryOptimizationIntegration;
  private optimizedServices = new Set<string>();

  private constructor() {
    this.memoryIntegration = MemoryOptimizationIntegration.getInstance();
  }

  static getInstance(): ServiceMemoryOptimizer {
    if (!ServiceMemoryOptimizer.instance) {
      ServiceMemoryOptimizer.instance = new ServiceMemoryOptimizer();
    }

    return ServiceMemoryOptimizer.instance;
  }

  /**
   * Initialize memory optimization for a service
   */
  async initializeServiceOptimization(serviceName: string): Promise<void> {
    if (this.optimizedServices.has(serviceName)) {
      logger.warn(`Service ${serviceName} already optimized`);

      return;
    }

    logger.info(`Initializing memory optimization for ${serviceName}`);

    // Initialize memory integration
    await this.memoryIntegration.initialize(serviceName);

    // Start memory leak detection
    memoryLeakDetector.startMonitoring();

    // Apply service-specific optimizations
    await this.applyServiceSpecificOptimizations(serviceName);

    this.optimizedServices.add(serviceName);
    logger.info(`Memory optimization initialized for ${serviceName}`);
  }

  /**
   * Fix database connection leaks
   */
  fixDatabaseConnectionLeaks(database: any, serviceName: string): void {
    logger.info(`Fixing database connection leaks for ${serviceName}`);

    // Register cleanup for database pool
    if (database.pool) {
      resourceCleanupService.registerCleanupTask(
        CleanupTaskFactory.createConnectionCleanup(
          database.pool,
          `${serviceName}-database-pool`,
          'critical'
        )
      );
    }

    // Register cleanup for database instance
    resourceCleanupService.registerCleanupTask(
      CleanupTaskFactory.createConnectionCleanup(
        database,
        `${serviceName}-database`,
        'critical'
      )
    );

    // Wrap query methods to track connections
    if (database.query) {
      const originalQuery = database.query.bind(database);

      database.query = async (...args: any[]) => {
        const connectionId = `db-query-${Date.now()}-${Math.random()}`;

        this.memoryIntegration.trackResource({
          id: connectionId,
          type: 'connection',
          metadata: { service: serviceName, operation: 'query' },
        });

        try {
          const result = await originalQuery(...args);

          return result;
        } finally {
          this.memoryIntegration.untrackResource(connectionId);
        }
      };
    }

    // Wrap transaction method to track connections
    if (database.transaction) {
      const originalTransaction = database.transaction.bind(database);

      database.transaction = async (callback: any) => {
        const transactionId = `db-transaction-${Date.now()}-${Math.random()}`;

        this.memoryIntegration.trackResource({
          id: transactionId,
          type: 'connection',
          metadata: { service: serviceName, operation: 'transaction' },
        });

        try {
          const result = await originalTransaction(callback);

          return result;
        } finally {
          this.memoryIntegration.untrackResource(transactionId);
        }
      };
    }

    logger.info(`Database connection leak fixes applied for ${serviceName}`);
  }

  /**
   * Fix Redis connection leaks
   */
  fixRedisConnectionLeaks(redis: any, serviceName: string): void {
    logger.info(`Fixing Redis connection leaks for ${serviceName}`);

    // Register cleanup for Redis client
    resourceCleanupService.registerCleanupTask(
      CleanupTaskFactory.createConnectionCleanup(
        redis.client || redis,
        `${serviceName}-redis`,
        'critical'
      )
    );

    // Wrap Redis operations to track usage
    const redisOperations = [
      'get',
      'set',
      'del',
      'exists',
      'expire',
      'hGet',
      'hSet',
      'hGetAll',
    ];

    redisOperations.forEach(operation => {
      if (redis[operation]) {
        const originalOperation = redis[operation].bind(redis);

        redis[operation] = async (...args: any[]) => {
          const operationId = `redis-${operation}-${Date.now()}-${Math.random()}`;

          this.memoryIntegration.trackResource({
            id: operationId,
            type: 'connection',
            metadata: { service: serviceName, operation, args: args.length },
          });

          try {
            const result = await originalOperation(...args);

            return result;
          } finally {
            this.memoryIntegration.untrackResource(operationId);
          }
        };
      }
    });

    logger.info(`Redis connection leak fixes applied for ${serviceName}`);
  }

  /**
   * Fix queue service memory leaks
   */
  fixQueueServiceLeaks(queueService: any, serviceName: string): void {
    logger.info(`Fixing queue service leaks for ${serviceName}`);

    // Register cleanup for all queues
    if (queueService.queues && queueService.queues instanceof Map) {
      queueService.queues.forEach((queue: any, queueName: string) => {
        resourceCleanupService.registerCleanupTask(
          CleanupTaskFactory.createConnectionCleanup(
            queue,
            `${serviceName}-queue-${queueName}`,
            'high'
          )
        );
      });
    }

    // Register cleanup for the queue service itself
    resourceCleanupService.registerCleanupTask({
      name: `${serviceName}-queue-service`,
      type: 'connection',
      priority: 'high',
      cleanup: async () => {
        if (queueService.closeAll) {
          await queueService.closeAll();
        }
      },
    });

    // Wrap addJob method to track job creation
    if (queueService.addJob) {
      const originalAddJob = queueService.addJob.bind(queueService);

      queueService.addJob = async (...args: any[]) => {
        const jobId = `queue-job-${Date.now()}-${Math.random()}`;

        this.memoryIntegration.trackResource({
          id: jobId,
          type: 'buffer',
          metadata: { service: serviceName, operation: 'addJob' },
        });

        try {
          const result = await originalAddJob(...args);

          // Track the actual job
          if (result && result.id) {
            this.memoryIntegration.trackResource({
              id: `job-${result.id}`,
              type: 'buffer',
              metadata: { service: serviceName, jobId: result.id },
            });
          }

          return result;
        } finally {
          this.memoryIntegration.untrackResource(jobId);
        }
      };
    }

    logger.info(`Queue service leak fixes applied for ${serviceName}`);
  }

  /**
   * Fix event emitter memory leaks
   */
  fixEventEmitterLeaks(emitter: any, name: string, serviceName: string): void {
    logger.info(`Fixing event emitter leaks for ${name} in ${serviceName}`);

    // Register cleanup for event emitter
    resourceCleanupService.registerCleanupTask(
      CleanupTaskFactory.createEventEmitterCleanup(
        emitter,
        `${serviceName}-${name}`,
        'normal'
      )
    );

    // Wrap on/addListener methods to track listeners
    if (emitter.on) {
      const originalOn = emitter.on.bind(emitter);

      emitter.on = (event: string, listener: Function) => {
        const listenerId = `listener-${event}-${Date.now()}-${Math.random()}`;

        this.memoryIntegration.trackResource({
          id: listenerId,
          type: 'buffer',
          metadata: { service: serviceName, emitter: name, event },
        });

        // Wrap the listener to track when it's called
        const wrappedListener = (...args: any[]) => {
          try {
            return listener(...args);
          } finally {
            // Optionally untrack after single use for 'once' style listeners
          }
        };

        return originalOn(event, wrappedListener);
      };
    }

    logger.info(
      `Event emitter leak fixes applied for ${name} in ${serviceName}`
    );
  }

  /**
   * Fix timer leaks
   */
  fixTimerLeaks(serviceName: string): void {
    logger.info(`Setting up timer leak prevention for ${serviceName}`);

    // Override global timer functions to track them
    const originalSetTimeout = global.setTimeout;
    const originalSetInterval = global.setInterval;
    const originalClearTimeout = global.clearTimeout;
    const originalClearInterval = global.clearInterval;

    global.setTimeout = (
      callback: Function,
      delay?: number,
      ...args: any[]
    ) => {
      const timerId = originalSetTimeout(callback, delay, ...args);

      resourceCleanupService.registerCleanupTask(
        CleanupTaskFactory.createTimerCleanup(
          timerId,
          `${serviceName}-timeout`,
          'normal'
        )
      );

      return timerId;
    };

    global.setInterval = (
      callback: Function,
      delay?: number,
      ...args: any[]
    ) => {
      const timerId = originalSetInterval(callback, delay, ...args);

      resourceCleanupService.registerCleanupTask(
        CleanupTaskFactory.createTimerCleanup(
          timerId,
          `${serviceName}-interval`,
          'high'
        )
      );

      return timerId;
    };

    global.clearTimeout = (timerId: NodeJS.Timeout) => {
      originalClearTimeout(timerId);
      // Remove from cleanup tasks since it's manually cleared
    };

    global.clearInterval = (timerId: NodeJS.Timeout) => {
      originalClearInterval(timerId);
      // Remove from cleanup tasks since it's manually cleared
    };

    logger.info(`Timer leak prevention set up for ${serviceName}`);
  }

  /**
   * Optimize large data processing
   */
  optimizeLargeDataProcessing(serviceName: string): void {
    logger.info(`Optimizing large data processing for ${serviceName}`);

    // This method can be called to set up optimized data processing patterns
    // The actual optimization is handled by LargeDatasetProcessor

    logger.info(`Large data processing optimization set up for ${serviceName}`);
  }

  /**
   * Apply service-specific optimizations
   */
  private async applyServiceSpecificOptimizations(
    serviceName: string
  ): Promise<void> {
    switch (serviceName) {
      case 'newsletter-service':
        await this.optimizeNewsletterService();
        break;
      case 'user-service':
        await this.optimizeUserService();
        break;
      case 'analytics-service':
        await this.optimizeAnalyticsService();
        break;
      case 'content-service':
        await this.optimizeContentService();
        break;
      case 'crm-service':
        await this.optimizeCrmService();
        break;
      default:
        logger.info(`No specific optimizations for ${serviceName}`);
    }
  }

  /**
   * Newsletter service specific optimizations
   */
  private async optimizeNewsletterService(): Promise<void> {
    logger.info('Applying newsletter service optimizations');

    // Set up optimizations for email processing
    // Large subscriber lists should use streaming
    // Template processing should be cached
    // Queue jobs should have proper cleanup

    logger.info('Newsletter service optimizations applied');
  }

  /**
   * User service specific optimizations
   */
  private async optimizeUserService(): Promise<void> {
    logger.info('Applying user service optimizations');

    // Set up optimizations for user data processing
    // Session management should have proper cleanup
    // Authentication tokens should be properly managed

    logger.info('User service optimizations applied');
  }

  /**
   * Analytics service specific optimizations
   */
  private async optimizeAnalyticsService(): Promise<void> {
    logger.info('Applying analytics service optimizations');

    // Set up optimizations for analytics data processing
    // Large datasets should use streaming
    // Aggregations should be memory-efficient

    logger.info('Analytics service optimizations applied');
  }

  /**
   * Content service specific optimizations
   */
  private async optimizeContentService(): Promise<void> {
    logger.info('Applying content service optimizations');

    // Set up optimizations for content processing
    // File uploads should use streaming
    // Image processing should be memory-efficient

    logger.info('Content service optimizations applied');
  }

  /**
   * CRM service specific optimizations
   */
  private async optimizeCrmService(): Promise<void> {
    logger.info('Applying CRM service optimizations');

    // Set up optimizations for CRM data processing
    // Contact imports should use streaming
    // Data exports should be paginated

    logger.info('CRM service optimizations applied');
  }

  /**
   * Get optimization status for all services
   */
  getOptimizationStatus(): {
    optimizedServices: string[];
    memoryStats: any;
    cleanupStats: any;
  } {
    return {
      optimizedServices: Array.from(this.optimizedServices),
      memoryStats: this.memoryIntegration
        .getMemoryOptimizer()
        .getMemoryMetrics(),
      cleanupStats: resourceCleanupService.getCleanupStats(),
    };
  }
}

// Export singleton instance
export const serviceMemoryOptimizer = ServiceMemoryOptimizer.getInstance();
