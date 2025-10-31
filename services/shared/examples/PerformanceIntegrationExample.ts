/**
 * Example integration of performance optimization components
 * This shows how to integrate the caching, email optimization, and performance monitoring
 * into an existing service like the newsletter service.
 */

import Bull from 'bull';
import { Pool } from 'pg';
import { createClient } from 'redis';
import {
  PerformanceConfig,
  PerformanceOptimizationService,
} from '../performance/PerformanceOptimizationService';

// Example configuration
const performanceConfig: PerformanceConfig = {
  cache: {
    defaultTTL: 3600, // 1 hour
    keyPrefix: 'ailert',
    enableCompression: true,
    maxMemoryUsage: 512, // 512MB
  },
  queryCache: {
    defaultTTL: 1800, // 30 minutes
    enableQueryAnalysis: true,
    slowQueryThreshold: 1000, // 1 second
    maxCacheSize: 10000,
  },
  cdn: {
    distributionId: 'E1234567890ABC',
    bucketName: 'ailert-assets',
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    cloudFrontDomain: 'cdn.ailert.com',
    defaultCacheTTL: 86400, // 24 hours
    maxCacheTTL: 31536000, // 1 year
  },
  email: {
    smtp: {
      host: process.env.SMTP_HOST!,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    },
    rateLimiting: {
      maxEmailsPerSecond: 10,
      maxEmailsPerMinute: 500,
      maxEmailsPerHour: 10000,
      burstLimit: 50,
    },
    retry: {
      maxAttempts: 5,
      backoffMultiplier: 2,
      maxBackoffDelay: 30000,
    },
    batching: {
      batchSize: 100,
      batchDelay: 5, // seconds
      maxBatchWaitTime: 30, // seconds
    },
    prioritization: {
      enableEngagementScoring: true,
      highEngagementThreshold: 70,
      lowEngagementThreshold: 30,
    },
  },
  prioritization: {
    enableEngagementScoring: true,
    enableTimeBasedPrioritization: true,
    enableSegmentPrioritization: true,
    highEngagementThreshold: 70,
    lowEngagementThreshold: 30,
    highValueThreshold: 1000,
    recentEngagementDays: 30,
    maxBatchSize: 100,
    priorityWeights: {
      engagement: 0.4,
      recency: 0.3,
      value: 0.2,
      segment: 0.1,
    },
  },
  monitoring: {
    enableMetrics: true,
    metricsInterval: 60000, // 1 minute
    alertThresholds: {
      cacheHitRate: 70,
      avgResponseTime: 1000,
      errorRate: 5,
      queueSize: 1000,
    },
  },
};

// Example service integration
export class OptimizedNewsletterService {
  private performanceService: PerformanceOptimizationService;
  private cacheManager: any;
  private queryCache: any;
  private emailSender: any;
  private prioritization: any;

  constructor() {
    // Initialize Redis client
    const redis = createClient({
      url: process.env.REDIS_URL,
    });

    // Initialize database pool
    const dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      min: 2,
      max: 10,
    });

    // Initialize Bull queues
    const emailQueue = new Bull('email-sending', {
      redis: process.env.REDIS_URL,
    });

    const batchQueue = new Bull('email-batching', {
      redis: process.env.REDIS_URL,
    });

    // Initialize performance optimization service
    this.performanceService = new PerformanceOptimizationService(
      performanceConfig,
      redis,
      dbPool,
      emailQueue,
      batchQueue
    );

    // Get individual components for use in service methods
    const components = this.performanceService.getComponents();

    this.cacheManager = components.cacheManager;
    this.queryCache = components.queryCache;
    this.emailSender = components.emailSender;
    this.prioritization = components.prioritization;
  }

  /**
   * Example: Get newsletters with caching
   */
  async getNewsletters(userId: string, limit: number = 10): Promise<any[]> {
    const cacheKey = `newsletters:user:${userId}:limit:${limit}`;

    return await this.cacheManager.getOrSet(
      cacheKey,
      async () => {
        // Use query cache for database operations
        const result = await this.queryCache.query(
          'SELECT * FROM newsletters WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
          [userId, limit],
          {
            ttl: 1800, // 30 minutes
            tags: ['newsletter', `user:${userId}`],
          }
        );

        return result.rows;
      },
      3600 // Cache for 1 hour
    );
  }

  /**
   * Example: Send newsletter with optimization
   */
  async sendNewsletter(
    newsletterId: string,
    subscriberIds: string[]
  ): Promise<void> {
    try {
      // Get newsletter content (with caching)
      const newsletter = await this.cacheManager.getOrSet(
        `newsletter:${newsletterId}`,
        async () => {
          const result = await this.queryCache.query(
            'SELECT * FROM newsletters WHERE id = $1',
            [newsletterId],
            { ttl: 3600, tags: ['newsletter'] }
          );

          return result.rows[0];
        },
        3600
      );

      if (!newsletter) {
        throw new Error('Newsletter not found');
      }

      // Prioritize emails based on engagement
      const prioritizedEmails = await this.prioritization.prioritizeEmails(
        subscriberIds,
        'newsletter'
      );

      // Create optimized batches
      const batchResult =
        await this.prioritization.createOptimizedBatches(prioritizedEmails);

      // Queue emails for sending
      const emailJobs = prioritizedEmails.map(email => ({
        id: `newsletter_${newsletterId}_${email.subscriberId}`,
        to: email.email,
        subject: newsletter.subject,
        html: newsletter.html_content,
        text: newsletter.text_content,
        priority: email.priority,
        engagementScore: email.engagementScore,
        subscriberId: email.subscriberId,
        campaignId: newsletterId,
        metadata: {
          newsletterId,
          batchId: batchResult.batches.find(b =>
            b.emails.some(e => e.subscriberId === email.subscriberId)
          )?.id,
        },
      }));

      // Send emails using optimized sender
      await this.emailSender.queueBulkEmails(emailJobs);

      // Update newsletter status
      await this.queryCache.query(
        'UPDATE newsletters SET status = $1, sent_at = NOW() WHERE id = $2',
        ['sent', newsletterId],
        { skipCache: true } // Don't cache write operations
      );

      // Invalidate related cache entries
      await this.cacheManager.invalidateByTags([
        'newsletter',
        `newsletter:${newsletterId}`,
      ]);
    } catch (error) {
      logger.error('Failed to send newsletter', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Example: Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    return await this.performanceService.getMetrics();
  }

  /**
   * Example: Get optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<any> {
    return await this.performanceService.getOptimizationRecommendations();
  }

  /**
   * Example: Perform auto-optimizations
   */
  async performAutoOptimizations(): Promise<any> {
    return await this.performanceService.performAutoOptimizations();
  }

  /**
   * Example: Health check
   */
  async healthCheck(): Promise<any> {
    return await this.performanceService.healthCheck();
  }

  /**
   * Example: Warm up cache with frequently accessed data
   */
  async warmUpCache(): Promise<void> {
    await this.cacheManager.warmUp(async () => {
      // Return frequently accessed data to pre-populate cache
      return [
        {
          key: 'popular_newsletters',
          value: await this.getPopularNewsletters(),
          ttl: 3600,
        },
        {
          key: 'active_subscribers_count',
          value: await this.getActiveSubscribersCount(),
          ttl: 1800,
        },
      ];
    });
  }

  /**
   * Example: Handle engagement events for prioritization
   */
  async handleEngagementEvent(
    subscriberId: string,
    eventType: 'open' | 'click' | 'unsubscribe',
    metadata?: any
  ): Promise<void> {
    await this.prioritization.updateEngagementData(subscriberId, {
      type: eventType,
      timestamp: new Date(),
      campaignId: metadata?.campaignId,
      metadata,
    });

    // Invalidate subscriber-related cache
    await this.cacheManager.invalidateByTags([`subscriber:${subscriberId}`]);
  }

  private async getPopularNewsletters(): Promise<any[]> {
    const result = await this.queryCache.query(
      `SELECT n.*, COUNT(ns.id) as subscriber_count
       FROM newsletters n
       LEFT JOIN newsletter_subscribers ns ON n.id = ns.newsletter_id
       WHERE n.status = 'published'
       GROUP BY n.id
       ORDER BY subscriber_count DESC
       LIMIT 10`,
      [],
      { ttl: 3600, tags: ['newsletter', 'popular'] }
    );

    return result.rows;
  }

  private async getActiveSubscribersCount(): Promise<number> {
    const result = await this.queryCache.query(
      `SELECT COUNT(*) as count
       FROM users
       WHERE status = 'active'
       AND email_verified = true
       AND preferences->>'emailNotifications' = 'true'`,
      [],
      { ttl: 1800, tags: ['user', 'subscribers'] }
    );

    return parseInt(result.rows[0].count);
  }
}

// Example usage in Express route
export function createOptimizedRoutes(
  app: any,
  newsletterService: OptimizedNewsletterService
) {
  // Get newsletters with caching
  app.get('/api/newsletters', async (req: any, res: any) => {
    try {
      const { userId, limit } = req.query;
      const newsletters = await newsletterService.getNewsletters(userId, limit);

      res.json(newsletters);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get newsletters' });
    }
  });

  // Send newsletter with optimization
  app.post('/api/newsletters/:id/send', async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { subscriberIds } = req.body;

      await newsletterService.sendNewsletter(id, subscriberIds);
      res.json({ success: true, message: 'Newsletter queued for sending' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send newsletter' });
    }
  });

  // Performance metrics endpoint
  app.get('/api/performance/metrics', async (req: any, res: any) => {
    try {
      const metrics = await newsletterService.getPerformanceMetrics();

      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get performance metrics' });
    }
  });

  // Optimization recommendations endpoint
  app.get('/api/performance/recommendations', async (req: any, res: any) => {
    try {
      const recommendations =
        await newsletterService.getOptimizationRecommendations();

      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get recommendations' });
    }
  });

  // Auto-optimization endpoint
  app.post('/api/performance/optimize', async (req: any, res: any) => {
    try {
      const result = await newsletterService.performAutoOptimizations();

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to perform optimizations' });
    }
  });

  // Health check endpoint
  app.get('/api/health', async (req: any, res: any) => {
    try {
      const health = await newsletterService.healthCheck();
      const statusCode =
        health.overall === 'healthy'
          ? 200
          : health.overall === 'degraded'
            ? 200
            : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        overall: 'unhealthy',
        error: 'Health check failed',
      });
    }
  });

  // Engagement tracking endpoint
  app.post(
    '/api/engagement/:subscriberId/:eventType',
    async (req: any, res: any) => {
      try {
        const { subscriberId, eventType } = req.params;
        const metadata = req.body;

        await newsletterService.handleEngagementEvent(
          subscriberId,
          eventType,
          metadata
        );
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to track engagement' });
      }
    }
  );
}

// Example Docker Compose configuration for performance optimization
export const dockerComposeExample = `
version: '3.8'

services:
  # Redis for caching and queues
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # PostgreSQL with optimized configuration
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ailert
      POSTGRES_USER: ailert
      POSTGRES_PASSWORD: ailert_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-EXEC", "pg_isready -U ailert -d ailert"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Newsletter service with performance optimization
  newsletter-service:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://ailert:ailert_password@postgres:5432/ailert
      - REDIS_URL=redis://redis:6379
      - SMTP_HOST=smtp.example.com
      - SMTP_PORT=587
      - SMTP_USER=noreply@ailert.com
      - SMTP_PASS=smtp_password
      - AWS_ACCESS_KEY_ID=your_access_key
      - AWS_SECRET_ACCESS_KEY=your_secret_key
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'

volumes:
  postgres_data:
  redis_data:
`;

// Example PostgreSQL configuration for performance
export const postgresConfigExample = `
# PostgreSQL configuration for performance optimization

# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Connection settings
max_connections = 100
shared_preload_libraries = 'pg_stat_statements'

# Query optimization
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging for performance analysis
log_min_duration_statement = 1000
log_statement = 'none'
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Checkpoint settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB
checkpoint_timeout = 10min
max_wal_size = 1GB
min_wal_size = 80MB

# Statistics
track_activities = on
track_counts = on
track_io_timing = on
track_functions = pl
`;
