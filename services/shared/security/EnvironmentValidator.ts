import { StructuredLogger } from '../logging/StructuredLogger';

const logger = new StructuredLogger({
  service: 'EnvironmentValidator',
  environment: process.env.NODE_ENV || 'development',
});

export interface EnvironmentConfig {
  required: string[];
  optional?: Record<string, string>; // key: default value
  sensitive?: string[];
}

export class EnvironmentValidator {
  private static sensitiveKeys = [
    'JWT_SECRET',
    'DATABASE_PASSWORD',
    'API_KEY',
    'ENCRYPTION_KEY',
    'AWS_SECRET_ACCESS_KEY',
    'STRIPE_SECRET_KEY',
    'VAULT_TOKEN',
    'REDIS_PASSWORD',
  ];

  /**
   * Validate and load environment variables securely
   */
  static validateEnvironment(
    config: EnvironmentConfig
  ): Record<string, string> {
    const result: Record<string, string> = {};
    const missing: string[] = [];

    // Check required variables
    for (const key of config.required) {
      const value = process.env[key];
      if (!value || value.trim().length === 0) {
        missing.push(key);
      } else {
        result[key] = value.trim();
      }
    }

    if (missing.length > 0) {
      const error = `Missing required environment variables: ${missing.join(', ')}`;
      logger.error('Environment validation failed', new Error(error), {
        missingVariables: missing,
        environment: process.env.NODE_ENV,
      });
      throw new Error(error);
    }

    // Set optional variables with defaults
    if (config.optional) {
      for (const [key, defaultValue] of Object.entries(config.optional)) {
        const value = process.env[key];
        result[key] =
          value && value.trim().length > 0 ? value.trim() : defaultValue;
      }
    }

    // Validate sensitive variables are not exposed
    this.validateSensitiveVariables(config.sensitive);

    logger.info('Environment validation successful', {
      loadedVariables: Object.keys(result).filter(
        key => !this.isSensitive(key)
      ),
      environment: process.env.NODE_ENV,
    });

    return result;
  }

  /**
   * Get environment variable securely
   */
  static getEnvVar(
    key: string,
    defaultValue?: string,
    required: boolean = false
  ): string {
    const value = process.env[key];

    if (!value || value.trim().length === 0) {
      if (required) {
        const error = `Required environment variable ${key} is not set`;
        logger.error(
          'Missing required environment variable',
          new Error(error),
          { key }
        );
        throw new Error(error);
      }
      return defaultValue || '';
    }

    return value.trim();
  }

  /**
   * Get boolean environment variable
   */
  static getBooleanEnvVar(key: string, defaultValue: boolean = false): boolean {
    const value = this.getEnvVar(key);
    if (!value) return defaultValue;

    const lowerValue = value.toLowerCase();
    return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
  }

  /**
   * Get numeric environment variable
   */
  static getNumericEnvVar(
    key: string,
    defaultValue?: number,
    required: boolean = false
  ): number {
    const value = this.getEnvVar(key, undefined, required);
    if (!value && defaultValue !== undefined) return defaultValue;

    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      const error = `Environment variable ${key} must be a valid number, got: ${value}`;
      logger.error('Invalid numeric environment variable', new Error(error), {
        key,
        value,
      });
      throw new Error(error);
    }

    return numValue;
  }

  /**
   * Validate that sensitive variables are properly configured
   */
  private static validateSensitiveVariables(
    additionalSensitive?: string[]
  ): void {
    const allSensitive = [
      ...this.sensitiveKeys,
      ...(additionalSensitive || []),
    ];
    const issues: string[] = [];

    for (const key of allSensitive) {
      const value = process.env[key];
      if (value) {
        // Check for common insecure patterns
        if (
          value === 'changeme' ||
          value === 'password' ||
          value === 'secret'
        ) {
          issues.push(`${key} uses a default/insecure value`);
        }

        if (value.length < 16 && key.includes('SECRET')) {
          issues.push(
            `${key} is too short for a secret (minimum 16 characters)`
          );
        }

        // Check if it's accidentally logged anywhere (basic check)
        if (value.includes('console.log') || value.includes('logger.')) {
          issues.push(`${key} appears to contain logging statements`);
        }
      }
    }

    if (issues.length > 0) {
      logger.warn('Sensitive environment variable issues detected', {
        issues,
        environment: process.env.NODE_ENV,
      });

      // Only throw in production
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `Sensitive environment variable issues: ${issues.join(', ')}`
        );
      }
    }
  }

  /**
   * Check if a key is considered sensitive
   */
  private static isSensitive(key: string): boolean {
    return this.sensitiveKeys.some(sensitive =>
      key.toUpperCase().includes(sensitive.toUpperCase())
    );
  }

  /**
   * Sanitize environment variables for logging
   */
  static sanitizeForLogging(
    env: Record<string, string>
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      if (this.isSensitive(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Validate database connection string security
   */
  static validateDatabaseUrl(url: string): void {
    if (!url) {
      throw new Error('Database URL is required');
    }

    try {
      const parsed = new URL(url);

      // Check for insecure patterns
      if (parsed.password === 'password' || parsed.password === 'admin') {
        throw new Error('Database URL contains insecure default password');
      }

      if (
        parsed.hostname === 'localhost' &&
        process.env.NODE_ENV === 'production'
      ) {
        logger.warn('Database URL uses localhost in production environment');
      }

      // Ensure SSL in production
      if (
        process.env.NODE_ENV === 'production' &&
        !parsed.searchParams.get('sslmode')
      ) {
        logger.warn('Database URL does not specify SSL mode in production');
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid database URL format');
      }
      throw error;
    }
  }

  /**
   * Generate secure configuration object
   */
  static createSecureConfig(): Record<string, any> {
    return {
      // Database
      database: {
        url: this.getEnvVar('DATABASE_URL', undefined, true),
        maxConnections: this.getNumericEnvVar('DB_MAX_CONNECTIONS', 10),
        ssl: this.getBooleanEnvVar(
          'DB_SSL',
          process.env.NODE_ENV === 'production'
        ),
      },

      // Authentication
      auth: {
        jwtSecret: this.getEnvVar('JWT_SECRET', undefined, true),
        jwtExpiresIn: this.getEnvVar('JWT_EXPIRES_IN', '24h'),
        bcryptRounds: this.getNumericEnvVar('BCRYPT_ROUNDS', 12),
      },

      // Encryption
      encryption: {
        provider: this.getEnvVar('ENCRYPTION_PROVIDER', 'local'),
        keyId: this.getEnvVar('ENCRYPTION_KEY_ID'),
        masterKey: this.getEnvVar('MASTER_ENCRYPTION_KEY'),
      },

      // Redis
      redis: {
        url: this.getEnvVar('REDIS_URL', 'redis://localhost:6379'),
        password: this.getEnvVar('REDIS_PASSWORD'),
        tls: this.getBooleanEnvVar(
          'REDIS_TLS',
          process.env.NODE_ENV === 'production'
        ),
      },

      // AWS
      aws: {
        region: this.getEnvVar('AWS_REGION', 'us-east-1'),
        accessKeyId: this.getEnvVar('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.getEnvVar('AWS_SECRET_ACCESS_KEY'),
      },

      // Application
      app: {
        port: this.getNumericEnvVar('PORT', 3000),
        nodeEnv: this.getEnvVar('NODE_ENV', 'development'),
        logLevel: this.getEnvVar('LOG_LEVEL', 'info'),
        corsOrigin: this.getEnvVar('CORS_ORIGIN', '*'),
      },

      // Security
      security: {
        rateLimitMax: this.getNumericEnvVar('RATE_LIMIT_MAX', 100),
        rateLimitWindow: this.getNumericEnvVar(
          'RATE_LIMIT_WINDOW_MS',
          15 * 60 * 1000
        ),
        sessionSecret: this.getEnvVar('SESSION_SECRET', undefined, true),
        csrfSecret: this.getEnvVar('CSRF_SECRET'),
      },
    };
  }
}

// Common environment configurations
export const CommonEnvironmentConfigs = {
  webService: {
    required: ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'],
    optional: {
      PORT: '3000',
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      CORS_ORIGIN: '*',
    },
    sensitive: ['JWT_SECRET', 'SESSION_SECRET', 'DATABASE_PASSWORD'],
  },

  microservice: {
    required: ['DATABASE_URL', 'JWT_SECRET'],
    optional: {
      PORT: '3000',
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
    },
    sensitive: ['JWT_SECRET', 'DATABASE_PASSWORD'],
  },

  worker: {
    required: ['DATABASE_URL', 'REDIS_URL'],
    optional: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      WORKER_CONCURRENCY: '5',
    },
    sensitive: ['DATABASE_PASSWORD', 'REDIS_PASSWORD'],
  },
};
