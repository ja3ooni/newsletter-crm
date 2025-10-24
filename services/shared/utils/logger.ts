import { createStructuredLogger } from '../logging/StructuredLogger';

// Create structured logger instance
export const logger = createStructuredLogger({
  service: process.env.SERVICE_NAME || 'ailert-shared',
  environment: process.env.NODE_ENV || 'development',
  version: process.env.npm_package_version || '1.0.0',
  elasticsearchUrl: process.env.ELASTICSEARCH_URL,
  logLevel: process.env.LOG_LEVEL || 'info',
});

// Export the winston logger for backward compatibility
export const winstonLogger = logger.getLogger();
