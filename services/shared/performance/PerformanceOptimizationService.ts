import { Queue } from 'bull';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { CDNConfig, CDNManager } from '../cache/CDNManager';
import { CacheInvalidationStrategy } from '../cache/CacheInvalidationStrategy';
import { CacheConfig, CacheManager } from '../cache/CacheManager';
import { QueryCache, QueryCacheConfig } from '../cache/QueryCache';
import {
  EngagementBasedPrioritization,
  PrioritizationConfig,
} from '../email/EngagementBasedPrioritization';
import {
  EmailConfig,
  OptimizedEmailSender,
} from '../email/OptimizedEmailSender';
import { RetryMechanism } from '../email/RetryMechanism';
import { logger } from '../utils/logger';

export interface PerformanceConfig {
  cache: CacheConfig;
  queryCache: QueryCacheConfig;
  cdn?: CDNConfig;
  email: EmailConfig;
  prioritization: PrioritizationConfig;
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number;
    alertThresholds: {
      cacheHitRate: number;
      avgResponseTime: number;
      errorRate: number;
      queueSize: number;
    };
  };
}

export interface PerformanceMetrics {
  cache: {
    hitRate: number;
    memoryUsage: number;
    operations: number;
  };
  database: {
    avgQueryTime: number;
    slowQueries: number;
    connectionPoolUsage: number;
  };
  email: {
    sendRate: number;
    queueSize: number;
    failureRate: number;
    avgDeliveryTime: number;
  };
  cdn?: {
    hitRate: number;
    bandwidth: number;
    responseTime: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
  };
}

export interface OptimizationRecommendation {
  type: 'cache' | 'database' | 'email' | 'cdn' | 'system';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: string;
}

export class PerformanceOptimizationService {
  private cacheManager: CacheManager;
  private queryCache: QueryCache;
  private cdnManager?: CDNManager;
  private invalidationStrategy: CacheInvalidationStrategy;
  private emailSender: OptimizedEmailSender;
  private prioritization: EngagementBasedPrioritization;
  private retryMechanism: RetryMechanism;
  private config: PerformanceConfig;
  private metricsInterval?: NodeJS.Timeout;
  private currentMetrics: PerformanceMetrics;

  constructor(
    config: PerformanceConfig,
    redis: RedisClientType,
    dbPool: Pool,
    emailQueue: Queue,
    batchQueue: Queue
  ) {
    this.config = config;

    // Initialize cache components
    this.cacheManager = new CacheManager(redis, config.cache);
    this.queryCache = new QueryCache(
      dbPool,
      this.cacheManager,
      config.queryCache
    );

    if (config.cdn) {
      this.cdnManager = new CDNManager(config.cdn);
    }

    this.invalidationStrategy = new CacheInvalidationStrategy(
      this.cacheManager,
      this.queryCache,
      this.cdnManager
    );

    // Initialize email components
    this.emailSender = new OptimizedEmailSender(
      config.email,
      emailQueue,
      batchQueue
    );
    this.prioritization = new EngagementBasedPrioritization(
      config.prioritization
    );
    this.retryMechanism = RetryMechanism.createEmailRetryMechanism();

    // Initialize metrics
    this.currentMetrics = this.initializeMetrics();

    // Start monitoring if enabled
    if (config.monitoring.enableMetrics) {
      this.startMetricsCollection();
    }

    logger.info('Performance optimization service initialized');
  }

  /**
   * Get all performance optimization components
   */
  getComponents() {
    return {
      cacheManager: this.cacheManager,
      queryCache: this.queryCache,
      cdnManager: this.cdnManager,
      invalidationStrategy: this.invalidationStrategy,
      emailSender: this.emailSender,
      prioritization: this.prioritization,
      retryMechanism: this.retryMechanism,
    };
  }

  /**
   * Get current performance metrics
   */
  async getMetrics(): Promise<PerformanceMetrics> {
    await this.updateMetrics();

    return { ...this.currentMetrics };
  }

  /**
   * Get performance optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<
    OptimizationRecommendation[]
  > {
    const metrics = await this.getMetrics();
    const recommendations: OptimizationRecommendation[] = [];

    // Cache recommendations
    if (metrics.cache.hitRate < 70) {
      recommendations.push({
        type: 'cache',
        priority: 'high',
        title: 'Low Cache Hit Rate',
        description: `Cache hit rate is ${metrics.cache.hitRate.toFixed(1)}%, which is below the recommended 70%`,
        impact:
          'High - Poor cache performance leads to increased database load and slower response times',
        implementation:
          'Review cache TTL settings, add more cacheable queries, implement cache warming',
        estimatedImprovement: '30-50% reduction in response time',
      });
    }

    if (metrics.cache.memoryUsage > 80) {
      recommendations.push({
        type: 'cache',
        priority: 'medium',
        title: 'High Cache Memory Usage',
        description: `Cache memory usage is ${metrics.cache.memoryUsage.toFixed(1)}%`,
        impact: 'Medium - May lead to cache evictions and reduced performance',
        implementation:
          'Increase cache memory limit or optimize cache key patterns',
        estimatedImprovement: '10-20% improvement in cache efficiency',
      });
    }

    // Database recommendations
    if (metrics.database.avgQueryTime > 100) {
      recommendations.push({
        type: 'database',
        priority: 'high',
        title: 'Slow Database Queries',
        description: `Average query time is ${metrics.database.avgQueryTime.toFixed(0)}ms`,
        impact: 'High - Slow queries impact overall application performance',
        implementation:
          'Add database indexes, optimize queries, increase connection pool size',
        estimatedImprovement: '40-60% reduction in query time',
      });
    }

    if (metrics.database.connectionPoolUsage > 80) {
      recommendations.push({
        type: 'database',
        priority: 'medium',
        title: 'High Database Connection Pool Usage',
        description: `Connection pool usage is ${metrics.database.connectionPoolUsage.toFixed(1)}%`,
        impact: 'Medium - May lead to connection timeouts under load',
        implementation:
          'Increase connection pool size or optimize query patterns',
        estimatedImprovement:
          '15-25% improvement in concurrent request handling',
      });
    }

    // Email recommendations
    if (metrics.email.failureRate > 5) {
      recommendations.push({
        type: 'email',
        priority: 'high',
        title: 'High Email Failure Rate',
        description: `Email failure rate is ${metrics.email.failureRate.toFixed(1)}%`,
        impact: 'High - Poor email deliverability affects user engagement',
        implementation:
          'Review SMTP configuration, implement better retry logic, check sender reputation',
        estimatedImprovement: '50-70% reduction in email failures',
      });
    }

    if (metrics.email.queueSize > 1000) {
      recommendations.push({
        type: 'email',
        priority: 'medium',
        title: 'Large Email Queue',
        description: `Email queue has ${metrics.email.queueSize} pending emails`,
        impact: 'Medium - Delayed email delivery may affect user experience',
        implementation:
          'Increase email sending concurrency, optimize batching strategy',
        estimatedImprovement: '30-40% faster email delivery',
      });
    }

    // CDN recommendations
    if (this.cdnManager && metrics.cdn) {
      if (metrics.cdn.hitRate < 80) {
        recommendations.push({
          type: 'cdn',
          priority: 'medium',
          title: 'Low CDN Hit Rate',
          description: `CDN hit rate is ${metrics.cdn.hitRate.toFixed(1)}%`,
          impact:
            'Medium - Increased origin server load and slower asset delivery',
          implementation:
            'Optimize cache headers, implement asset versioning, preload critical assets',
          estimatedImprovement: '20-30% faster asset loading',
        });
      }
    }

    // System recommendations
    if (metrics.system.memoryUsage > 85) {
      recommendations.push({
        type: 'system',
        priority: 'high',
        title: 'High Memory Usage',
        description: `System memory usage is ${metrics.system.memoryUsage.toFixed(1)}%`,
        impact:
          'High - Risk of out-of-memory errors and performance degradation',
        implementation:
          'Optimize memory usage, implement garbage collection tuning, scale horizontally',
        estimatedImprovement: '25-35% improvement in system stability',
      });
    }

    if (metrics.system.cpuUsage > 80) {
      recommendations.push({
        type: 'system',
        priority: 'high',
        title: 'High CPU Usage',
        description: `System CPU usage is ${metrics.system.cpuUsage.toFixed(1)}%`,
        impact: 'High - Slow response times and potential service degradation',
        implementation:
          'Optimize CPU-intensive operations, implement caching, scale horizontally',
        estimatedImprovement: '30-50% improvement in response times',
      });
    }

    // Sort by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };

    recommendations.sort(
      (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]
    );

    return recommendations;
  }

  /**
   * Perform automatic optimizations
   */
  async performAutoOptimizations(): Promise<{
    applied: string[];
    skipped: string[];
    errors: string[];
  }> {
    const applied: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    try {
      // Optimize cache
      await this.cacheManager.optimizeCache();
      applied.push('Cache optimization');
    } catch (error) {
      errors.push(`Cache optimization failed: ${error}`);
    }

    try {
      // Optimize query cache
      await this.queryCache.optimizeCache();
      applied.push('Query cache optimization');
    } catch (error) {
      errors.push(`Query cache optimization failed: ${error}`);
    }

    try {
      // Optimize invalidation rules
      await this.invalidationStrategy.optimizeRules();
      applied.push('Cache invalidation optimization');
    } catch (error) {
      errors.push(`Invalidation optimization failed: ${error}`);
    }

    try {
      // Warm up common queries
      await this.queryCache.warmUpCommonQueries();
      applied.push('Query cache warm-up');
    } catch (error) {
      errors.push(`Query warm-up failed: ${error}`);
    }

    logger.info('Auto-optimization completed', { applied, skipped, errors });

    return { applied, skipped, errors };
  }

  /**
   * Health check for all performance components
   */
  async healthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, any>;
  }> {
    const components: Record<string, any> = {};
    let healthyCount = 0;
    let totalCount = 0;

    // Cache health
    totalCount++;
    try {
      components.cache = await this.cacheManager.healthCheck();
      if (components.cache.status === 'healthy') healthyCount++;
    } catch (error) {
      components.cache = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Email sender health
    totalCount++;
    try {
      components.email = await this.emailSender.getQueueHealth();
      components.email.status = 'healthy'; // Assume healthy if no error
      healthyCount++;
    } catch (error) {
      components.email = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // CDN health (if available)
    if (this.cdnManager) {
      totalCount++;
      try {
        components.cdn = await this.cdnManager.healthCheck();
        if (components.cdn.status === 'healthy') healthyCount++;
      } catch (error) {
        components.cdn = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    const healthRatio = healthyCount / totalCount;

    if (healthRatio >= 0.8) {
      overall = 'healthy';
    } else if (healthRatio >= 0.5) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return { overall, components };
  }

  /**
   * Shutdown all performance components gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down performance optimization service');

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    try {
      await this.emailSender.pauseSending();
    } catch (error) {
      logger.error('Error pausing email sender', error);
    }

    try {
      await this.cacheManager.clear();
    } catch (error) {
      logger.error('Error clearing cache', error);
    }

    logger.info('Performance optimization service shutdown complete');
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      cache: {
        hitRate: 0,
        memoryUsage: 0,
        operations: 0,
      },
      database: {
        avgQueryTime: 0,
        slowQueries: 0,
        connectionPoolUsage: 0,
      },
      email: {
        sendRate: 0,
        queueSize: 0,
        failureRate: 0,
        avgDeliveryTime: 0,
      },
      cdn: this.cdnManager
        ? {
            hitRate: 0,
            bandwidth: 0,
            responseTime: 0,
          }
        : undefined,
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        uptime: process.uptime(),
      },
    };
  }

  private async updateMetrics(): Promise<void> {
    try {
      // Update cache metrics
      const cacheStats = this.cacheManager.getStats();

      this.currentMetrics.cache = {
        hitRate: cacheStats.hitRate,
        memoryUsage: cacheStats.memoryUsage / (1024 * 1024), // Convert to MB
        operations: cacheStats.hits + cacheStats.misses,
      };

      // Update email metrics
      const emailStats = this.emailSender.getStats();

      this.currentMetrics.email = {
        sendRate: emailStats.ratePerMinute,
        queueSize: emailStats.queued,
        failureRate:
          (emailStats.failed / (emailStats.sent + emailStats.failed)) * 100 ||
          0,
        avgDeliveryTime: emailStats.avgResponseTime,
      };

      // Update system metrics
      const memUsage = process.memoryUsage();

      this.currentMetrics.system = {
        memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        cpuUsage: process.cpuUsage().user / 1000000, // Convert to percentage (simplified)
        uptime: process.uptime(),
      };

      // Check alert thresholds
      this.checkAlertThresholds();
    } catch (error) {
      logger.error('Failed to update metrics', error);
    }
  }

  private checkAlertThresholds(): void {
    const thresholds = this.config.monitoring.alertThresholds;

    if (this.currentMetrics.cache.hitRate < thresholds.cacheHitRate) {
      logger.warn('Cache hit rate below threshold', {
        current: this.currentMetrics.cache.hitRate,
        threshold: thresholds.cacheHitRate,
      });
    }

    if (
      this.currentMetrics.email.avgDeliveryTime > thresholds.avgResponseTime
    ) {
      logger.warn('Email delivery time above threshold', {
        current: this.currentMetrics.email.avgDeliveryTime,
        threshold: thresholds.avgResponseTime,
      });
    }

    if (this.currentMetrics.email.failureRate > thresholds.errorRate) {
      logger.warn('Email failure rate above threshold', {
        current: this.currentMetrics.email.failureRate,
        threshold: thresholds.errorRate,
      });
    }

    if (this.currentMetrics.email.queueSize > thresholds.queueSize) {
      logger.warn('Email queue size above threshold', {
        current: this.currentMetrics.email.queueSize,
        threshold: thresholds.queueSize,
      });
    }
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      await this.updateMetrics();
    }, this.config.monitoring.metricsInterval);

    logger.info('Metrics collection started', {
      interval: this.config.monitoring.metricsInterval,
    });
  }
}
