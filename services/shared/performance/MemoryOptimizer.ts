import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface MemoryConfig {
  maxHeapSize: number; // in MB
  gcThreshold: number; // percentage of heap usage to trigger GC
  monitoringInterval: number; // in milliseconds
  alertThresholds: {
    heapUsage: number; // percentage
    memoryLeakThreshold: number; // MB increase per minute
    largeObjectThreshold: number; // MB
  };
  cleanup: {
    enableAutoCleanup: boolean;
    cleanupInterval: number; // in milliseconds
    maxCacheAge: number; // in milliseconds
  };
  streaming: {
    chunkSize: number; // for large dataset processing
    maxConcurrentStreams: number;
    bufferSize: number; // in MB
  };
}

export interface MemoryMetrics {
  heapUsed: number; // in MB
  heapTotal: number; // in MB
  external: number; // in MB
  rss: number; // in MB
  heapUsagePercentage: number;
  gcCount: number;
  memoryLeakRate: number; // MB per minute
  largeObjects: number;
  activeStreams: number;
  lastGcTime: number;
}

export interface ResourceTracker {
  id: string;
  type: 'stream' | 'timer' | 'connection' | 'cache' | 'buffer';
  createdAt: number;
  size?: number; // in bytes
  metadata?: Record<string, unknown>;
}

export interface MemoryAlert {
  type: 'heap_usage' | 'memory_leak' | 'large_object' | 'gc_pressure';
  severity: 'warning' | 'critical';
  message: string;
  metrics: Partial<MemoryMetrics>;
  timestamp: number;
  recommendations: string[];
}

export class MemoryOptimizer extends EventEmitter {
  private config: MemoryConfig;
  private monitoringTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private resourceTrackers = new Map<string, ResourceTracker>();
  private memoryHistory: MemoryMetrics[] = [];
  private gcCount = 0;
  private activeStreams = new Set<string>();

  constructor(config: MemoryConfig) {
    super();
    this.config = config;
    this.setupMemoryMonitoring();
    this.setupResourceCleanup();
    this.setupGarbageCollectionHooks();

    logger.info('MemoryOptimizer initialized', { config });
  }

  /**
   * Start memory monitoring and optimization
   */
  start(): void {
    this.startMonitoring();
    if (this.config.cleanup.enableAutoCleanup) {
      this.startAutoCleanup();
    }
    logger.info('Memory optimization started');
  }

  /**
   * Stop memory monitoring and cleanup
   */
  stop(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.cleanupAllResources();
    logger.info('Memory optimization stopped');
  }

  /**
   * Get current memory metrics
   */
  getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed / (1024 * 1024);
    const heapTotal = memUsage.heapTotal / (1024 * 1024);

    return {
      heapUsed,
      heapTotal,
      external: memUsage.external / (1024 * 1024),
      rss: memUsage.rss / (1024 * 1024),
      heapUsagePercentage: (heapUsed / heapTotal) * 100,
      gcCount: this.gcCount,
      memoryLeakRate: this.calculateMemoryLeakRate(),
      largeObjects: this.countLargeObjects(),
      activeStreams: this.activeStreams.size,
      lastGcTime: Date.now(),
    };
  }

  /**
   * Register a resource for tracking and cleanup
   */
  trackResource(resource: Omit<ResourceTracker, 'createdAt'>): string {
    const tracker: ResourceTracker = {
      ...resource,
      createdAt: Date.now(),
    };

    this.resourceTrackers.set(resource.id, tracker);

    // Track streams separately for monitoring
    if (resource.type === 'stream') {
      this.activeStreams.add(resource.id);
    }

    logger.debug('Resource tracked', { id: resource.id, type: resource.type });

    return resource.id;
  }

  /**
   * Unregister and cleanup a tracked resource
   */
  untrackResource(id: string): boolean {
    const tracker = this.resourceTrackers.get(id);

    if (!tracker) {
      return false;
    }

    this.resourceTrackers.delete(id);
    this.activeStreams.delete(id);

    logger.debug('Resource untracked', { id, type: tracker.type });

    return true;
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): boolean {
    if (global.gc) {
      const beforeGc = process.memoryUsage().heapUsed;

      global.gc();
      const afterGc = process.memoryUsage().heapUsed;
      const freed = (beforeGc - afterGc) / (1024 * 1024);

      logger.info('Forced garbage collection', { freedMB: freed.toFixed(2) });

      return true;
    }

    logger.warn('Garbage collection not available. Run with --expose-gc flag.');

    return false;
  }

  /**
   * Optimize memory usage by cleaning up resources and forcing GC
   */
  async optimizeMemory(): Promise<{
    beforeOptimization: MemoryMetrics;
    afterOptimization: MemoryMetrics;
    actions: string[];
  }> {
    const beforeOptimization = this.getMemoryMetrics();
    const actions: string[] = [];

    // Clean up expired resources
    const cleanedResources = this.cleanupExpiredResources();

    if (cleanedResources > 0) {
      actions.push(`Cleaned ${cleanedResources} expired resources`);
    }

    // Clear old memory history
    if (this.memoryHistory.length > 100) {
      this.memoryHistory = this.memoryHistory.slice(-50);
      actions.push('Cleared old memory history');
    }

    // Force garbage collection if heap usage is high
    if (beforeOptimization.heapUsagePercentage > this.config.gcThreshold) {
      if (this.forceGarbageCollection()) {
        actions.push('Forced garbage collection');
      }
    }

    // Wait a moment for GC to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const afterOptimization = this.getMemoryMetrics();

    logger.info('Memory optimization completed', {
      beforeMB: beforeOptimization.heapUsed.toFixed(2),
      afterMB: afterOptimization.heapUsed.toFixed(2),
      freedMB: (
        beforeOptimization.heapUsed - afterOptimization.heapUsed
      ).toFixed(2),
      actions,
    });

    return { beforeOptimization, afterOptimization, actions };
  }

  /**
   * Create a memory-efficient stream processor for large datasets
   */
  createStreamProcessor<T>(
    data: T[],
    processor: (chunk: T[]) => Promise<void>,
    options?: { chunkSize?: number; concurrency?: number }
  ): Promise<void> {
    const chunkSize = options?.chunkSize || this.config.streaming.chunkSize;
    const concurrency =
      options?.concurrency || this.config.streaming.maxConcurrentStreams;

    return new Promise((resolve, reject) => {
      const streamId = `stream_${Date.now()}_${Math.random()}`;

      this.trackResource({
        id: streamId,
        type: 'stream',
        size: data.length,
        metadata: { chunkSize, concurrency },
      });

      let processed = 0;
      let activePromises = 0;
      let hasError = false;

      const processChunk = async (chunk: T[]): Promise<void> => {
        if (hasError) return;

        activePromises++;

        try {
          await processor(chunk);
          processed += chunk.length;

          // Emit progress event
          this.emit('streamProgress', {
            streamId,
            processed,
            total: data.length,
            percentage: (processed / data.length) * 100,
          });
        } catch (error) {
          hasError = true;
          this.untrackResource(streamId);
          reject(error);

          return;
        } finally {
          activePromises--;
        }

        // Check if we're done
        if (processed >= data.length && activePromises === 0) {
          this.untrackResource(streamId);
          resolve();
        }
      };

      // Process data in chunks with concurrency control
      let index = 0;
      const processNext = (): void => {
        while (
          activePromises < concurrency &&
          index < data.length &&
          !hasError
        ) {
          const chunk = data.slice(index, index + chunkSize);

          index += chunkSize;
          processChunk(chunk);
        }
      };

      processNext();

      // Continue processing as promises complete
      const checkProgress = setInterval(() => {
        if (hasError) {
          clearInterval(checkProgress);

          return;
        }

        if (index < data.length) {
          processNext();
        } else if (activePromises === 0) {
          clearInterval(checkProgress);
        }
      }, 10);
    });
  }

  /**
   * Monitor for memory leaks and large objects
   */
  detectMemoryLeaks(): MemoryAlert[] {
    const alerts: MemoryAlert[] = [];
    const metrics = this.getMemoryMetrics();

    // Check heap usage
    if (metrics.heapUsagePercentage > this.config.alertThresholds.heapUsage) {
      alerts.push({
        type: 'heap_usage',
        severity: metrics.heapUsagePercentage > 90 ? 'critical' : 'warning',
        message: `High heap usage: ${metrics.heapUsagePercentage.toFixed(1)}%`,
        metrics: { heapUsagePercentage: metrics.heapUsagePercentage },
        timestamp: Date.now(),
        recommendations: [
          'Force garbage collection',
          'Clean up unused resources',
          'Reduce cache size',
          'Implement memory pooling',
        ],
      });
    }

    // Check memory leak rate
    if (
      metrics.memoryLeakRate > this.config.alertThresholds.memoryLeakThreshold
    ) {
      alerts.push({
        type: 'memory_leak',
        severity: 'critical',
        message: `Potential memory leak detected: ${metrics.memoryLeakRate.toFixed(
          2
        )} MB/min increase`,
        metrics: { memoryLeakRate: metrics.memoryLeakRate },
        timestamp: Date.now(),
        recommendations: [
          'Check for unclosed resources',
          'Review event listener cleanup',
          'Audit cache implementations',
          'Monitor resource tracking',
        ],
      });
    }

    // Check large objects
    if (
      metrics.largeObjects > this.config.alertThresholds.largeObjectThreshold
    ) {
      alerts.push({
        type: 'large_object',
        severity: 'warning',
        message: `Large number of objects detected: ${metrics.largeObjects}`,
        metrics: { largeObjects: metrics.largeObjects },
        timestamp: Date.now(),
        recommendations: [
          'Implement object pooling',
          'Use streaming for large data',
          'Optimize data structures',
          'Consider pagination',
        ],
      });
    }

    return alerts;
  }

  /**
   * Get memory optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const metrics = this.getMemoryMetrics();
    const recommendations: string[] = [];

    if (metrics.heapUsagePercentage > 70) {
      recommendations.push(
        'Consider increasing heap size or optimizing memory usage'
      );
    }

    if (metrics.activeStreams > this.config.streaming.maxConcurrentStreams) {
      recommendations.push(
        'Reduce concurrent stream processing to prevent memory pressure'
      );
    }

    if (this.resourceTrackers.size > 1000) {
      recommendations.push(
        'High number of tracked resources - consider cleanup strategies'
      );
    }

    if (metrics.memoryLeakRate > 0) {
      recommendations.push(
        'Monitor for potential memory leaks in long-running processes'
      );
    }

    return recommendations;
  }

  private setupMemoryMonitoring(): void {
    // Store initial memory state
    this.memoryHistory.push(this.getMemoryMetrics());
  }

  private setupResourceCleanup(): void {
    // Set up periodic cleanup of expired resources
    if (this.config.cleanup.enableAutoCleanup) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredResources();
      }, this.config.cleanup.cleanupInterval);
    }
  }

  private setupGarbageCollectionHooks(): void {
    // Monitor GC events if available
    if (process.env.NODE_ENV !== 'production') {
      process.on('beforeExit', () => {
        logger.info(
          'Process exiting, final memory stats',
          this.getMemoryMetrics()
        );
      });
    }
  }

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      const metrics = this.getMemoryMetrics();

      this.memoryHistory.push(metrics);

      // Keep only recent history
      if (this.memoryHistory.length > 100) {
        this.memoryHistory = this.memoryHistory.slice(-50);
      }

      // Check for alerts
      const alerts = this.detectMemoryLeaks();

      alerts.forEach(alert => {
        this.emit('memoryAlert', alert);
        logger.warn('Memory alert', alert);
      });

      // Auto-optimize if needed
      if (metrics.heapUsagePercentage > this.config.gcThreshold) {
        this.optimizeMemory().catch(error => {
          logger.error('Auto-optimization failed', error);
        });
      }
    }, this.config.monitoringInterval);
  }

  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredResources();
    }, this.config.cleanup.cleanupInterval);
  }

  private cleanupExpiredResources(): number {
    const now = Date.now();
    const maxAge = this.config.cleanup.maxCacheAge;
    let cleaned = 0;

    for (const [id, tracker] of this.resourceTrackers.entries()) {
      if (now - tracker.createdAt > maxAge) {
        this.untrackResource(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up expired resources', { count: cleaned });
    }

    return cleaned;
  }

  private cleanupAllResources(): void {
    const count = this.resourceTrackers.size;

    this.resourceTrackers.clear();
    this.activeStreams.clear();

    if (count > 0) {
      logger.info('Cleaned up all tracked resources', { count });
    }
  }

  private calculateMemoryLeakRate(): number {
    if (this.memoryHistory.length < 2) {
      return 0;
    }

    const recent = this.memoryHistory.slice(-10); // Last 10 measurements

    if (recent.length < 2) {
      return 0;
    }

    const first = recent[0];
    const last = recent[recent.length - 1];

    if (!first || !last) {
      return 0;
    }

    const timeDiff = (last.lastGcTime - first.lastGcTime) / (1000 * 60); // minutes
    const memoryDiff = last.heapUsed - first.heapUsed;

    return timeDiff > 0 ? memoryDiff / timeDiff : 0;
  }

  private countLargeObjects(): number {
    // This is a simplified implementation
    // In a real scenario, you might use heap snapshots or other profiling tools
    return Math.floor(this.getMemoryMetrics().heapUsed / 10); // Rough estimate
  }
}

// Default configuration
export const defaultMemoryConfig: MemoryConfig = {
  maxHeapSize: 1024, // 1GB
  gcThreshold: 80, // 80% heap usage
  monitoringInterval: 30000, // 30 seconds
  alertThresholds: {
    heapUsage: 85, // 85%
    memoryLeakThreshold: 10, // 10MB per minute
    largeObjectThreshold: 100, // 100 large objects
  },
  cleanup: {
    enableAutoCleanup: true,
    cleanupInterval: 60000, // 1 minute
    maxCacheAge: 300000, // 5 minutes
  },
  streaming: {
    chunkSize: 1000, // 1000 items per chunk
    maxConcurrentStreams: 5,
    bufferSize: 50, // 50MB buffer
  },
};
