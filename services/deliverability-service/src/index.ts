import { app } from './app';
import { config } from './config';
import { database } from './utils/database';
import { logger } from './utils/logger';
import { migrationRunner } from './utils/migrationRunner';
import { redis } from './utils/redis';

async function startServer(): Promise<void> {
  try {
    // Connect to Redis
    await redis.connect();
    logger.info('Connected to Redis');

    // Test database connection
    const dbHealthy = await database.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    logger.info('Connected to database');

    // Run database migrations
    await migrationRunner.runMigrations();
    logger.info('Database migrations completed');

    // Start the server
    const server = app.listen(config.port, () => {
      logger.info(`Deliverability service running on port ${config.port}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);

      server.close(async () => {
        try {
          await redis.disconnect();
          await database.close();
          logger.info('Server shut down successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
