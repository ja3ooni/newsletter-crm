import express from 'express';
import { createLoggingMiddleware } from '../logging/LoggingMiddleware';

// Example of how to integrate the logging system into a service
const app = express();

// Initialize logging middleware
const loggingMiddleware = createLoggingMiddleware({
  serviceName: 'example-service',
  environment: process.env.NODE_ENV || 'development',
  version: '1.0.0',
  elasticsearchUrl: process.env.ELASTICSEARCH_URL,
  logLevel: process.env.LOG_LEVEL || 'info',
  enableErrorTracking: true,
  enableLogAnalysis: true,
  errorNotificationConfig: {
    slackWebhook: process.env.SLACK_WEBHOOK_URL,
    severityThreshold: 'medium',
  },
});

// Apply request logging middleware
app.use(loggingMiddleware.requestLogger());

// Example route with logging
app.get('/api/users/:id', async (req, res) => {
  const logger = (req as any).logger;
  const { id } = req.params;

  try {
    // Log business event
    loggingMiddleware.logBusinessEvent('user_profile_accessed', {
      userId: id,
      source: 'api',
    });

    // Database operation with logging
    const user = await loggingMiddleware.logDbOperation(
      'get_user_by_id',
      async () => {
        // Simulate database call
        return { id, name: 'John Doe', email: 'john@example.com' };
      },
      { userId: id }
    );

    // External API call with logging
    const enrichedData = await loggingMiddleware.logApiCall(
      'https://api.example.com/enrich',
      'POST',
      async () => {
        // Simulate API call
        return { score: 85, verified: true };
      },
      { userId: id }
    );

    logger.info('User profile retrieved successfully', {
      userId: id,
      enriched: true,
    });

    res.json({ user, enrichedData });
  } catch (error) {
    // Error will be automatically captured by error middleware
    throw error;
  }
});

// Apply error handling middleware (must be last)
app.use(loggingMiddleware.errorHandler());

export default app;
