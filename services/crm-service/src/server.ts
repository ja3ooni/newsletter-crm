import config from '@/config';
import logger from '@/utils/logger';
import app from './app';

const PORT = config.port || 3003;

const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    const database = (await import('@/utils/database')).default;
    await database.query('SELECT 1');
    logger.info('Database connection established');

    // Test Redis connection
    const redis = (await import('@/utils/redis')).default;
    await redis.ping();
    logger.info('Redis connection established');

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`CRM Service started on port ${PORT}`, {
        environment: config.env,
        port: PORT,
        nodeVersion: process.version,
      });
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
