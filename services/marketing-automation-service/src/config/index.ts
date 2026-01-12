import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'datatechtoncrm_automation',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '2', 10),
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // limit each IP to 100 requests per windowMs
  },

  // Queue configuration
  queue: {
    redis: {
      host:
        process.env.QUEUE_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
      port: parseInt(
        process.env.QUEUE_REDIS_PORT || process.env.REDIS_PORT || '6379',
        10
      ),
      password: process.env.QUEUE_REDIS_PASSWORD || process.env.REDIS_PASSWORD,
      db: parseInt(process.env.QUEUE_REDIS_DB || '3', 10),
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  },

  // Email service configuration
  email: {
    provider: process.env.EMAIL_PROVIDER || 'sendgrid',
    apiKey: process.env.EMAIL_API_KEY,
    fromEmail: process.env.EMAIL_FROM || 'noreply@datatechtoncrm.com',
    fromName: process.env.EMAIL_FROM_NAME || 'DatatechtonCRM',
  },

  // Webhook configuration
  webhook: {
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '30000', 10), // 30 seconds
    retries: parseInt(process.env.WEBHOOK_RETRIES || '3', 10),
  },

  // External services
  services: {
    userService: {
      baseUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
      apiKey: process.env.USER_SERVICE_API_KEY,
    },
    crmService: {
      baseUrl: process.env.CRM_SERVICE_URL || 'http://localhost:3002',
      apiKey: process.env.CRM_SERVICE_API_KEY,
    },
    newsletterService: {
      baseUrl: process.env.NEWSLETTER_SERVICE_URL || 'http://localhost:3004',
      apiKey: process.env.NEWSLETTER_SERVICE_API_KEY,
    },
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // Automation settings
  automation: {
    maxConcurrentExecutions: parseInt(
      process.env.MAX_CONCURRENT_EXECUTIONS || '100',
      10
    ),
    executionTimeout: parseInt(process.env.EXECUTION_TIMEOUT || '300000', 10), // 5 minutes
    retryDelay: parseInt(process.env.RETRY_DELAY || '60000', 10), // 1 minute
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  },

  // A/B Testing
  abTesting: {
    minSampleSize: parseInt(process.env.AB_TEST_MIN_SAMPLE_SIZE || '100', 10),
    confidenceLevel: parseFloat(process.env.AB_TEST_CONFIDENCE_LEVEL || '0.95'),
    testDuration: parseInt(process.env.AB_TEST_DURATION || '604800000', 10), // 7 days in ms
  },
};

export default config;
