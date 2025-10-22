import dotenv from 'dotenv';

dotenv.config();

export interface CRMConfig {
  port: number;
  nodeEnv: string;
  env: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    maxConnections: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  cors: {
    origin: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  logging: {
    level: string;
    format: string;
  };
  enrichment: {
    providers: {
      clearbit: {
        apiKey?: string;
        enabled: boolean;
      };
      fullcontact: {
        apiKey?: string;
        enabled: boolean;
      };
      hunter: {
        apiKey?: string;
        enabled: boolean;
      };
    };
    defaultProvider: string;
    maxCostPerContact: number;
    batchSize: number;
  };
  import: {
    maxFileSize: number;
    allowedFormats: string[];
    batchSize: number;
    tempDir: string;
  };
  export: {
    maxRecords: number;
    retentionDays: number;
    storageDir: string;
  };
  segmentation: {
    maxConditions: number;
    updateInterval: number; // minutes
    batchSize: number;
  };
  leadScoring: {
    maxRules: number;
    decayInterval: number; // hours
    maxScore: number;
    minScore: number;
  };
  duplicateDetection: {
    enabled: boolean;
    threshold: number;
    batchSize: number;
    autoMergeThreshold: number;
  };
  monitoring: {
    healthCheckInterval: number;
    metricsInterval: number;
  };
}

const config: CRMConfig = {
  port: parseInt(process.env.PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  env: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'ailert_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },

  enrichment: {
    providers: {
      clearbit: {
        apiKey: process.env.CLEARBIT_API_KEY || undefined,
        enabled: process.env.CLEARBIT_ENABLED === 'true',
      },
      fullcontact: {
        apiKey: process.env.FULLCONTACT_API_KEY || undefined,
        enabled: process.env.FULLCONTACT_ENABLED === 'true',
      },
      hunter: {
        apiKey: process.env.HUNTER_API_KEY || undefined,
        enabled: process.env.HUNTER_ENABLED === 'true',
      },
    },
    defaultProvider: process.env.ENRICHMENT_DEFAULT_PROVIDER || 'clearbit',
    maxCostPerContact: parseFloat(process.env.ENRICHMENT_MAX_COST || '0.50'),
    batchSize: parseInt(process.env.ENRICHMENT_BATCH_SIZE || '10', 10),
  },

  import: {
    maxFileSize: parseInt(process.env.IMPORT_MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedFormats: process.env.IMPORT_ALLOWED_FORMATS?.split(',') || ['csv', 'xlsx'],
    batchSize: parseInt(process.env.IMPORT_BATCH_SIZE || '100', 10),
    tempDir: process.env.IMPORT_TEMP_DIR || '/tmp/crm-imports',
  },

  export: {
    maxRecords: parseInt(process.env.EXPORT_MAX_RECORDS || '50000', 10),
    retentionDays: parseInt(process.env.EXPORT_RETENTION_DAYS || '7', 10),
    storageDir: process.env.EXPORT_STORAGE_DIR || '/tmp/crm-exports',
  },

  segmentation: {
    maxConditions: parseInt(process.env.SEGMENTATION_MAX_CONDITIONS || '20', 10),
    updateInterval: parseInt(process.env.SEGMENTATION_UPDATE_INTERVAL || '30', 10),
    batchSize: parseInt(process.env.SEGMENTATION_BATCH_SIZE || '1000', 10),
  },

  leadScoring: {
    maxRules: parseInt(process.env.LEAD_SCORING_MAX_RULES || '50', 10),
    decayInterval: parseInt(process.env.LEAD_SCORING_DECAY_INTERVAL || '24', 10),
    maxScore: parseInt(process.env.LEAD_SCORING_MAX_SCORE || '1000', 10),
    minScore: parseInt(process.env.LEAD_SCORING_MIN_SCORE || '0', 10),
  },

  duplicateDetection: {
    enabled: process.env.DUPLICATE_DETECTION_ENABLED !== 'false',
    threshold: parseFloat(process.env.DUPLICATE_DETECTION_THRESHOLD || '0.8'),
    batchSize: parseInt(process.env.DUPLICATE_DETECTION_BATCH_SIZE || '100', 10),
    autoMergeThreshold: parseFloat(process.env.DUPLICATE_AUTO_MERGE_THRESHOLD || '0.95'),
  },

  monitoring: {
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000', 10),
  },
};

export default config;
