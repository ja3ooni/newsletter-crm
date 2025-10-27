import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3007', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'ailert_deliverability',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  deliverability: {
    monitoringInterval: parseInt(process.env.MONITORING_INTERVAL || '60', 10), // minutes
    blacklistCheckInterval: parseInt(process.env.BLACKLIST_CHECK_INTERVAL || '240', 10), // minutes
    reputationCheckInterval: parseInt(process.env.REPUTATION_CHECK_INTERVAL || '30', 10), // minutes

    thresholds: {
      reputationScore: parseFloat(process.env.REPUTATION_THRESHOLD || '70'),
      bounceRate: parseFloat(process.env.BOUNCE_RATE_THRESHOLD || '5'),
      spamRate: parseFloat(process.env.SPAM_RATE_THRESHOLD || '0.1'),
      deliveryRate: parseFloat(process.env.DELIVERY_RATE_THRESHOLD || '95'),
    },

    blacklistProviders: [
      'spamhaus.org',
      'surbl.org',
      'barracudacentral.org',
      'spamcop.net',
      'invaluement.com',
      'mailspike.net',
      'psbl.surriel.com',
      'uceprotect.net',
    ],

    dnsServers: [
      '8.8.8.8',
      '8.8.4.4',
      '1.1.1.1',
      '1.0.0.1',
    ],
  },

  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
  },

  webhooks: {
    bounceEndpoint: process.env.BOUNCE_WEBHOOK_ENDPOINT,
    complaintEndpoint: process.env.COMPLAINT_WEBHOOK_ENDPOINT,
    deliveryEndpoint: process.env.DELIVERY_WEBHOOK_ENDPOINT,
    secret: process.env.WEBHOOK_SECRET,
  },

  external: {
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    mailgunApiKey: process.env.MAILGUN_API_KEY,
    sesAccessKey: process.env.AWS_SES_ACCESS_KEY,
    sesSecretKey: process.env.AWS_SES_SECRET_KEY,
    sesRegion: process.env.AWS_SES_REGION || 'us-east-1',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
};
