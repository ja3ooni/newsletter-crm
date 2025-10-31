import { config } from '@/config';
import { database } from '@/utils/database';
import { logger } from '@/utils/logger';
import { queueService } from '@/utils/queue';
import { redis } from '@/utils/redis';
import app from './app';

async function startServer(): Promise<void> {
  try {
    // Initialize memory optimization
    await initializeMemoryOptimization();
    logger.info('Memory optimization initialized');

    // Connect to database
    await database.connect();
    logger.info('Database connected successfully');

    // Connect to Redis
    await redis.connect();
    logger.info('Redis connected successfully');

    // Setup queue processors
    setupQueueProcessors();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`Newsletter service started on port ${config.port}`, {
        environment: config.nodeEnv,
        port: config.port,
      });
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Shutdown memory optimization
          await shutdownMemoryOptimization();
          logger.info('Memory optimization shutdown');

          // Close queue connections
          await queueService.closeAll();
          logger.info('Queue connections closed');

          // Close Redis connection
          await redis.disconnect();
          logger.info('Redis connection closed');

          // Close database connection
          await database.disconnect();
          logger.info('Database connection closed');

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', error => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

function setupQueueProcessors(): void {
  // Newsletter generation processor
  queueService.registerProcessor('newsletter-generation', async job => {
    logger.info('Processing newsletter generation job', { jobId: job.id });

    // In a real implementation, this would:
    // 1. Fetch content from various sources
    // 2. Apply AI filtering and scoring
    // 3. Personalize content based on user preferences
    // 4. Generate newsletter HTML
    // 5. Save the generated content

    const { sections, personalization, templateId, userId } = job.data;

    // Mock processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    logger.info('Newsletter generation completed', { jobId: job.id });
    return { success: true, contentGenerated: true };
  });

  // Email sending processor with memory optimization
  queueService.registerProcessor('email-sending', async job => {
    logger.info('Processing email sending job', { jobId: job.id });

    const { newsletterId, scheduledNewsletterIds, subscriberList } = job.data;

    try {
      // If we have a large subscriber list, use memory-optimized processing
      if (subscriberList && subscriberList.length > 100) {
        logger.info(
          'Using memory-optimized processing for large subscriber list',
          {
            subscriberCount: subscriberList.length,
          }
        );

        await processLargeEmailList(
          subscriberList,
          async (subscriber: any) => {
            // Mock email sending for each subscriber
            await new Promise(resolve => setTimeout(resolve, 10));
            logger.debug('Email sent to subscriber', {
              subscriberId: subscriber.id,
            });
          },
          {
            chunkSize: 50, // Process 50 emails at a time
            concurrency: 3, // Max 3 concurrent chunks
            trackProgress: true,
          }
        );
      } else {
        // For smaller lists, use regular processing
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      logger.info('Email sending completed', {
        jobId: job.id,
        newsletterId,
        subscriberCount: subscriberList?.length || 0,
      });

      return {
        success: true,
        emailsSent: subscriberList?.length || 1000,
      };
    } catch (error) {
      logger.error('Email sending failed', { jobId: job.id, error });
      throw error;
    }
  });

  // Content processing processor
  queueService.registerProcessor('content-processing', async job => {
    logger.info('Processing content processing job', { jobId: job.id });

    // In a real implementation, this would:
    // 1. Fetch content from RSS feeds, APIs, etc.
    // 2. Apply content filtering and deduplication
    // 3. Score content based on relevance
    // 4. Extract metadata and tags
    // 5. Store processed content

    const { sources, filters } = job.data;

    // Mock processing delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    logger.info('Content processing completed', { jobId: job.id });
    return { success: true, itemsProcessed: 50 };
  });

  // Analytics processing processor
  queueService.registerProcessor('analytics-processing', async job => {
    logger.info('Processing analytics job', { jobId: job.id });

    // In a real implementation, this would:
    // 1. Aggregate engagement data
    // 2. Calculate metrics and KPIs
    // 3. Generate reports
    // 4. Update dashboards

    const { newsletterId, eventType, data } = job.data;

    // Mock processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    logger.info('Analytics processing completed', { jobId: job.id });
    return { success: true, metricsUpdated: true };
  });

  logger.info('Queue processors registered successfully');
}

// Start the server
startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
