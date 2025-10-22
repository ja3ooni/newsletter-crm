import { config } from '@/config';
import { WebSocketService } from '@/services/WebSocketService';
import { database } from '@/utils/database';
import { logger } from '@/utils/logger';
import { redis } from '@/utils/redis';
import { createApp } from './app';

async function startServer(): Promise<void> {
  try {
    // Initialize database connection
    const dbHealthy = await database.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database health check failed');
    }
    logger.info('Database connection established');

    // Initialize Redis connection
    await redis.connect();
    const redisHealthy = await redis.healthCheck();
    if (!redisHealthy) {
      throw new Error('Redis health check failed');
    }
    logger.info('Redis connection established');

    // Create Express app
    const app = createApp();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`Analytics service started on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });

    // Start WebSocket server
    const wsService = new WebSocketService();
    await wsService.start();

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Close WebSocket server
          await wsService.stop();
          logger.info('WebSocket server closed');

          // Close database connections
          await database.close();
          logger.info('Database connections closed');

          // Close Redis connection
          await redis.disconnect();
          logger.info('Redis connection closed');

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', { error });
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
      logger.error('Uncaught exception', { error });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
startServer();
