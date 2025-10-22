import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'ailert_analytics',
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
    keyPrefix: 'analytics:',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // WebSocket
  websocket: {
    port: parseInt(process.env.WS_PORT || '3006', 10),
    heartbeatInterval: parseInt(
      process.env.WS_HEARTBEAT_INTERVAL || '30000',
      10
    ),
  },

  // Analytics
  analytics: {
    batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE || '1000', 10),
    processingInterval: parseInt(
      process.env.ANALYTICS_PROCESSING_INTERVAL || '60000',
      10
    ),
    retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '365', 10),
    realTimeThreshold: parseInt(process.env.REAL_TIME_THRESHOLD || '5000', 10), // ms
  },

  // Machine Learning
  ml: {
    churnModelThreshold: parseFloat(process.env.CHURN_MODEL_THRESHOLD || '0.7'),
    predictionCacheTtl: parseInt(
      process.env.PREDICTION_CACHE_TTL || '3600',
      10
    ), // seconds
    modelUpdateInterval: parseInt(
      process.env.MODEL_UPDATE_INTERVAL || '86400000',
      10
    ), // ms
  },

  // External Services
  services: {
    userService: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    crmService: process.env.CRM_SERVICE_URL || 'http://crm-service:3003',
    newsletterService:
      process.env.NEWSLETTER_SERVICE_URL || 'http://newsletter-service:3002',
    marketingService:
      process.env.MARKETING_SERVICE_URL ||
      'http://marketing-automation-service:3004',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },

  // Report Generation
  reports: {
    outputDir: process.env.REPORTS_OUTPUT_DIR || './reports',
    maxFileSize: parseInt(process.env.MAX_REPORT_FILE_SIZE || '10485760', 10), // 10MB
    cleanupInterval: parseInt(
      process.env.REPORT_CLEANUP_INTERVAL || '86400000',
      10
    ), // 24 hours
  },
} as const;

export type Config = typeof config;
