const dotenv = require('dotenv')

dotenv.config()

export const config = {
  port: parseInt(process.env.PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'datatechtoncrm_newsletter',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Email
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    },
    from: {
      name: process.env.EMAIL_FROM_NAME || 'DatatechtonCRM Newsletter',
      address: process.env.EMAIL_FROM_ADDRESS || 'noreply@datatechtoncrm.com',
    },
    replyTo: process.env.EMAIL_REPLY_TO || 'support@datatechtoncrm.com',
  },

  // Queue
  queue: {
    redis: {
      host: process.env.QUEUE_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.QUEUE_REDIS_PORT || process.env.REDIS_PORT || '6379', 10),
      password: process.env.QUEUE_REDIS_PASSWORD || process.env.REDIS_PASSWORD,
    },
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    defaultJobOptions: {
      removeOnComplete: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE || '100', 10),
      removeOnFail: parseInt(process.env.QUEUE_REMOVE_ON_FAIL || '50', 10),
      attempts: parseInt(process.env.QUEUE_ATTEMPTS || '3', 10),
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '2000', 10),
      },
    },
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // limit each IP to 100 requests per windowMs
  },

  // Content
  content: {
    maxSections: parseInt(process.env.MAX_CONTENT_SECTIONS || '10', 10),
    maxItemsPerSection: parseInt(process.env.MAX_ITEMS_PER_SECTION || '20', 10),
    cacheTimeout: parseInt(process.env.CONTENT_CACHE_TIMEOUT || '3600', 10), // 1 hour
  },

  // Templates
  templates: {
    defaultTemplate: process.env.DEFAULT_TEMPLATE || 'modern',
    maxCustomTemplates: parseInt(process.env.MAX_CUSTOM_TEMPLATES || '50', 10),
    allowCustomCSS: process.env.ALLOW_CUSTOM_CSS === 'true',
  },

  // A/B Testing
  abTesting: {
    minSampleSize: parseInt(process.env.AB_TEST_MIN_SAMPLE_SIZE || '100', 10),
    confidenceLevel: parseFloat(process.env.AB_TEST_CONFIDENCE_LEVEL || '0.95'),
    maxVariants: parseInt(process.env.AB_TEST_MAX_VARIANTS || '5', 10),
  },

  // Personalization
  personalization: {
    enabled: process.env.PERSONALIZATION_ENABLED !== 'false',
    mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
    cacheTimeout: parseInt(process.env.PERSONALIZATION_CACHE_TIMEOUT || '1800', 10), // 30 minutes
  },

  // Deliverability
  deliverability: {
    trackOpens: process.env.TRACK_OPENS !== 'false',
    trackClicks: process.env.TRACK_CLICKS !== 'false',
    reputationServiceUrl: process.env.REPUTATION_SERVICE_URL,
    bounceWebhookSecret: process.env.BOUNCE_WEBHOOK_SECRET,
  },

  // External Services
  services: {
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    crmService: process.env.CRM_SERVICE_URL || 'http://localhost:3003',
    contentService: process.env.CONTENT_SERVICE_URL || 'http://localhost:3004',
    analyticsService: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // Security
  security: {
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    trustProxy: process.env.TRUST_PROXY === 'true',
    helmetOptions: {
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    },
  },
} as const

export type Config = typeof config
