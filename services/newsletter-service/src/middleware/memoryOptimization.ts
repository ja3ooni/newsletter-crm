import { NextFunction, Request, Response } from 'express';
import {
  MemoryOptimizationIntegration,
  memoryTrackingMiddleware,
  processLargeDatasetWithOptimization,
} from '../../../shared/performance/MemoryOptimizationIntegration';
import { logger } from '../../../shared/utils/logger';

// Initialize memory optimization for newsletter service
const memoryOptimization = MemoryOptimizationIntegration.getInstance();

/**
 * Initialize memory optimization for the newsletter service
 */
export async function initializeMemoryOptimization(): Promise<void> {
  try {
    await memoryOptimization.initialize('newsletter-service');
    logger.info('Memory optimization initialized for newsletter service');
  } catch (error) {
    logger.error('Failed to initialize memory optimization', error);
    throw error;
  }
}

/**
 * Middleware to track memory usage for newsletter operations
 */
export const newsletterMemoryMiddleware = memoryTrackingMiddleware();

/**
 * Middleware to monitor memory usage for bulk operations
 */
export function bulkOperationMemoryMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startMemory = process.memoryUsage();
    const startTime = Date.now();

    // Track the bulk operation
    const operationId = memoryOptimization.trackResource({
      id: `bulk_operation_${Date.now()}_${Math.random()}`,
      type: 'buffer',
      metadata: {
        operation: req.path,
        method: req.method,
        startTime,
        startMemory: startMemory.heapUsed,
      },
    });

    // Monitor memory during operation
    const memoryCheckInterval = setInterval(async () => {
      const currentMemory = process.memoryUsage();
      const memoryIncrease =
        (currentMemory.heapUsed - startMemory.heapUsed) / (1024 * 1024);

      if (memoryIncrease > 100) {
        // 100MB increase
        logger.warn('High memory usage detected during bulk operation', {
          operationId,
          memoryIncreaseMB: memoryIncrease.toFixed(2),
          path: req.path,
        });

        // Force optimization if memory usage is too high
        if (memoryIncrease > 200) {
          // 200MB increase
          logger.info('Forcing memory optimization due to high usage');
          await memoryOptimization.optimizeSystem();
        }
      }
    }, 5000); // Check every 5 seconds

    // Cleanup when response finishes
    res.on('finish', () => {
      clearInterval(memoryCheckInterval);
      memoryOptimization.untrackResource(operationId);

      const endMemory = process.memoryUsage();
      const duration = Date.now() - startTime;
      const memoryDelta =
        (endMemory.heapUsed - startMemory.heapUsed) / (1024 * 1024);

      logger.info('Bulk operation completed', {
        operationId,
        duration,
        memoryDeltaMB: memoryDelta.toFixed(2),
        path: req.path,
      });
    });

    // Cleanup on error
    res.on('error', () => {
      clearInterval(memoryCheckInterval);
      memoryOptimization.untrackResource(operationId);
    });

    next();
  };
}

/**
 * Process large email lists with memory optimization
 */
export async function processLargeEmailList<T>(
  emails: T[],
  processor: (email: T) => Promise<void>,
  options?: {
    chunkSize?: number;
    concurrency?: number;
    trackProgress?: boolean;
  }
): Promise<void> {
  const defaultOptions = {
    chunkSize: 100, // Process 100 emails at a time
    concurrency: 3, // Max 3 concurrent chunks
    trackProgress: true,
    ...options,
  };

  logger.info('Starting large email list processing', {
    totalEmails: emails.length,
    chunkSize: defaultOptions.chunkSize,
    concurrency: defaultOptions.concurrency,
  });

  try {
    await memoryOptimization.processLargeDataset(
      emails,
      async (chunk: T[]) => {
        // Process chunk of emails
        await Promise.all(chunk.map(processor));

        // Optional: Force garbage collection after each chunk for large datasets
        if (emails.length > 10000) {
          const optimizer = memoryOptimization.getMemoryOptimizer();
          optimizer.forceGarbageCollection();
        }
      },
      defaultOptions
    );

    logger.info('Large email list processing completed successfully');
  } catch (error) {
    logger.error('Large email list processing failed', error);
    throw error;
  }
}

/**
 * Process newsletter templates with memory optimization
 */
export async function processNewsletterTemplates(
  templates: any[],
  processor: (template: any) => Promise<any>
): Promise<any[]> {
  return processLargeDatasetWithOptimization(templates, processor, {
    chunkSize: 50, // Smaller chunks for template processing
    concurrency: 2,
    trackProgress: true,
  });
}

/**
 * Memory health check endpoint handler
 */
export async function memoryHealthCheck(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const healthStatus = await memoryOptimization.getHealthStatus();
    const performanceReport = await memoryOptimization.getPerformanceReport(1); // Last hour

    res.json({
      status: healthStatus.status,
      memory: {
        heapUsed: healthStatus.memory.heapUsed,
        heapTotal: healthStatus.memory.heapTotal,
        heapUsagePercentage: healthStatus.memory.heapUsagePercentage,
        memoryLeakRate: healthStatus.memory.memoryLeakRate,
        activeStreams: healthStatus.memory.activeStreams,
      },
      alerts: healthStatus.alerts.map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        timestamp: alert.timestamp,
      })),
      recommendations: healthStatus.recommendations,
      performance: {
        avgMemoryUsage: performanceReport.summary.avgMemoryUsage,
        peakMemoryUsage: performanceReport.summary.peakMemoryUsage,
        memoryTrend: performanceReport.trends.memoryTrend,
        totalAlerts: performanceReport.summary.totalAlerts,
      },
    });
  } catch (error) {
    logger.error('Memory health check failed', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get memory health status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Force memory optimization endpoint handler
 */
export async function forceMemoryOptimization(
  req: Request,
  res: Response
): Promise<void> {
  try {
    logger.info('Manual memory optimization requested');
    const result = await memoryOptimization.optimizeSystem();

    res.json({
      success: result.success,
      message: result.success
        ? 'Memory optimization completed'
        : 'Memory optimization failed',
      results: result.results,
      error: result.error,
    });
  } catch (error) {
    logger.error('Manual memory optimization failed', error);
    res.status(500).json({
      success: false,
      message: 'Memory optimization failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get memory performance report endpoint handler
 */
export async function getMemoryPerformanceReport(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const hours = parseInt(req.query.hours as string) || 24; // Default to 24 hours
    const report = await memoryOptimization.getPerformanceReport(hours);

    res.json({
      report,
      generatedAt: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to generate memory performance report', error);
    res.status(500).json({
      error: 'Failed to generate performance report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Graceful shutdown handler
 */
export async function shutdownMemoryOptimization(): Promise<void> {
  try {
    await memoryOptimization.shutdown();
    logger.info('Memory optimization shutdown completed');
  } catch (error) {
    logger.error('Memory optimization shutdown failed', error);
  }
}

// Export the memory optimization instance for direct access if needed
export { memoryOptimization };
