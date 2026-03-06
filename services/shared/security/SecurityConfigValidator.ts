// @ts-nocheck
import { StructuredLogger } from '../logging/StructuredLogger';
import { EnvironmentValidator } from './EnvironmentValidator';

const logger = new StructuredLogger({
  service: 'SecurityConfigValidator',
  environment: process.env.NODE_ENV || 'development',
});

export interface SecurityConfig {
  authentication: {
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptRounds: number;
    sessionSecret?: string;
  };
  encryption: {
    provider: 'local' | 'aws-kms' | 'vault';
    keyId?: string;
    masterKey?: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
    methods: string[];
  };
  headers: {
    contentSecurityPolicy: string;
    strictTransportSecurity: string;
    xFrameOptions: string;
    xContentTypeOptions: string;
  };
  fileUpload: {
    maxSize: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
  };
}

export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  securityScore: number;
}

export class SecurityConfigValidator {
  private static readonly MINIMUM_JWT_SECRET_LENGTH = 32;
  private static readonly MINIMUM_BCRYPT_ROUNDS = 10;
  private static readonly RECOMMENDED_BCRYPT_ROUNDS = 12;
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly SECURE_HEADERS_REQUIRED = [
    'contentSecurityPolicy',
    'strictTransportSecurity',
    'xFrameOptions',
    'xContentTypeOptions',
  ];

  /**
   * Validate complete security configuration
   */
  static validateSecurityConfig(
    config: Partial<SecurityConfig>
  ): SecurityValidationResult {
    const result: SecurityValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      recommendations: [],
      securityScore: 100,
    };

    try {
      // Validate authentication configuration
      this.validateAuthentication(config.authentication, result);

      // Validate encryption configuration
      this.validateEncryption(config.encryption, result);

      // Validate rate limiting configuration
      this.validateRateLimit(config.rateLimit, result);

      // Validate CORS configuration
      this.validateCors(config.cors, result);

      // Validate security headers
      this.validateSecurityHeaders(config.headers, result);

      // Validate file upload configuration
      this.validateFileUpload(config.fileUpload, result);

      // Calculate final security score
      this.calculateSecurityScore(result);

      // Determine if configuration is valid
      result.isValid = result.errors.length === 0;

      logger.info('Security configuration validation completed', {
        isValid: result.isValid,
        errorsCount: result.errors.length,
        warningsCount: result.warnings.length,
        securityScore: result.securityScore,
      });
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation failed: ${(error as Error).message}`);
      logger.error('Security configuration validation failed', error as Error);
    }

    return result;
  }

  /**
   * Validate authentication configuration
   */
  private static validateAuthentication(
    auth: SecurityConfig['authentication'] | undefined,
    result: SecurityValidationResult
  ): void {
    if (!auth) {
      result.errors.push('Authentication configuration is required');
      return;
    }

    // Validate JWT secret
    if (!auth.jwtSecret) {
      result.errors.push('JWT secret is required');
    } else {
      if (auth.jwtSecret.length < this.MINIMUM_JWT_SECRET_LENGTH) {
        result.errors.push(
          `JWT secret must be at least ${this.MINIMUM_JWT_SECRET_LENGTH} characters long`
        );
      }

      if (auth.jwtSecret === 'secret' || auth.jwtSecret === 'changeme') {
        result.errors.push('JWT secret must not use default values');
      }

      if (!/^[A-Za-z0-9+/=]+$/.test(auth.jwtSecret)) {
        result.warnings.push(
          'JWT secret should be base64 encoded for better entropy'
        );
      }
    }

    // Validate JWT expiration
    if (!auth.jwtExpiresIn) {
      result.warnings.push('JWT expiration time not specified, using default');
    } else {
      const expirationMs = this.parseTimeToMs(auth.jwtExpiresIn);
      if (expirationMs > 24 * 60 * 60 * 1000) {
        // 24 hours
        result.warnings.push('JWT expiration time is longer than 24 hours');
      }
      if (expirationMs < 15 * 60 * 1000) {
        // 15 minutes
        result.warnings.push(
          'JWT expiration time is very short (< 15 minutes)'
        );
      }
    }

    // Validate bcrypt rounds
    if (auth.bcryptRounds < this.MINIMUM_BCRYPT_ROUNDS) {
      result.errors.push(
        `Bcrypt rounds must be at least ${this.MINIMUM_BCRYPT_ROUNDS}`
      );
    } else if (auth.bcryptRounds < this.RECOMMENDED_BCRYPT_ROUNDS) {
      result.warnings.push(
        `Bcrypt rounds should be at least ${this.RECOMMENDED_BCRYPT_ROUNDS} for better security`
      );
    }

    // Validate session secret if provided
    if (auth.sessionSecret) {
      if (auth.sessionSecret.length < this.MINIMUM_JWT_SECRET_LENGTH) {
        result.errors.push(
          `Session secret must be at least ${this.MINIMUM_JWT_SECRET_LENGTH} characters long`
        );
      }
    }
  }

  /**
   * Validate encryption configuration
   */
  private static validateEncryption(
    encryption: SecurityConfig['encryption'] | undefined,
    result: SecurityValidationResult
  ): void {
    if (!encryption) {
      result.errors.push('Encryption configuration is required');
      return;
    }

    const validProviders = ['local', 'aws-kms', 'vault'];
    if (!validProviders.includes(encryption.provider)) {
      result.errors.push(
        `Invalid encryption provider. Must be one of: ${validProviders.join(', ')}`
      );
    }

    if (encryption.provider === 'local' && !encryption.masterKey) {
      result.errors.push(
        'Master key is required for local encryption provider'
      );
    }

    if (encryption.provider === 'aws-kms' && !encryption.keyId) {
      result.errors.push('Key ID is required for AWS KMS encryption provider');
    }

    if (encryption.masterKey && encryption.masterKey.length < 32) {
      result.errors.push(
        'Master encryption key must be at least 32 characters long'
      );
    }
  }

  /**
   * Validate rate limiting configuration
   */
  private static validateRateLimit(
    rateLimit: SecurityConfig['rateLimit'] | undefined,
    result: SecurityValidationResult
  ): void {
    if (!rateLimit) {
      result.warnings.push('Rate limiting configuration not specified');
      return;
    }

    if (rateLimit.windowMs < 60000) {
      // 1 minute
      result.warnings.push('Rate limit window is very short (< 1 minute)');
    }

    if (rateLimit.maxRequests > 1000) {
      result.warnings.push('Rate limit max requests is very high (> 1000)');
    }

    if (rateLimit.maxRequests < 10) {
      result.warnings.push('Rate limit max requests is very low (< 10)');
    }
  }

  /**
   * Validate CORS configuration
   */
  private static validateCors(
    cors: SecurityConfig['cors'] | undefined,
    result: SecurityValidationResult
  ): void {
    if (!cors) {
      result.warnings.push('CORS configuration not specified');
      return;
    }

    // Check for overly permissive CORS
    if (cors.origin === '*') {
      if (process.env.NODE_ENV === 'production') {
        result.errors.push('CORS origin should not be "*" in production');
      } else {
        result.warnings.push(
          'CORS origin is set to "*" - ensure this is intended'
        );
      }
    }

    // Validate origin format
    if (typeof cors.origin === 'string' && cors.origin !== '*') {
      try {
        new URL(cors.origin);
      } catch {
        result.errors.push(`Invalid CORS origin URL: ${cors.origin}`);
      }
    }

    if (Array.isArray(cors.origin)) {
      for (const origin of cors.origin) {
        if (origin !== '*') {
          try {
            new URL(origin);
          } catch {
            result.errors.push(`Invalid CORS origin URL: ${origin}`);
          }
        }
      }
    }

    // Check for credentials with wildcard origin
    if (cors.credentials && cors.origin === '*') {
      result.errors.push('Cannot use credentials with wildcard CORS origin');
    }

    // Validate methods
    const allowedMethods = [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
      'OPTIONS',
      'HEAD',
    ];
    if (cors.methods) {
      for (const method of cors.methods) {
        if (!allowedMethods.includes(method.toUpperCase())) {
          result.warnings.push(`Unusual HTTP method in CORS: ${method}`);
        }
      }
    }
  }

  /**
   * Validate security headers configuration
   */
  private static validateSecurityHeaders(
    headers: SecurityConfig['headers'] | undefined,
    result: SecurityValidationResult
  ): void {
    if (!headers) {
      result.errors.push('Security headers configuration is required');
      return;
    }

    // Check required headers
    for (const requiredHeader of this.SECURE_HEADERS_REQUIRED) {
      if (!headers[requiredHeader as keyof SecurityConfig['headers']]) {
        result.errors.push(
          `Required security header missing: ${requiredHeader}`
        );
      }
    }

    // Validate Content Security Policy
    if (headers.contentSecurityPolicy) {
      if (headers.contentSecurityPolicy.includes("'unsafe-eval'")) {
        result.warnings.push("CSP contains 'unsafe-eval' directive");
      }
      if (headers.contentSecurityPolicy.includes("'unsafe-inline'")) {
        result.warnings.push("CSP contains 'unsafe-inline' directive");
      }
      if (headers.contentSecurityPolicy.includes('*')) {
        result.warnings.push('CSP contains wildcard (*) directive');
      }
    }

    // Validate HSTS
    if (headers.strictTransportSecurity) {
      if (!headers.strictTransportSecurity.includes('max-age=')) {
        result.errors.push('HSTS header must include max-age directive');
      }

      const maxAgeMatch =
        headers.strictTransportSecurity.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1]);
        if (maxAge < 31536000) {
          // 1 year
          result.warnings.push(
            'HSTS max-age should be at least 1 year (31536000 seconds)'
          );
        }
      }
    }

    // Validate X-Frame-Options
    if (headers.xFrameOptions) {
      const validOptions = ['DENY', 'SAMEORIGIN'];
      if (
        !validOptions.includes(headers.xFrameOptions) &&
        !headers.xFrameOptions.startsWith('ALLOW-FROM ')
      ) {
        result.errors.push('Invalid X-Frame-Options value');
      }
    }

    // Validate X-Content-Type-Options
    if (
      headers.xContentTypeOptions &&
      headers.xContentTypeOptions !== 'nosniff'
    ) {
      result.errors.push('X-Content-Type-Options should be set to "nosniff"');
    }
  }

  /**
   * Validate file upload configuration
   */
  private static validateFileUpload(
    fileUpload: SecurityConfig['fileUpload'] | undefined,
    result: SecurityValidationResult
  ): void {
    if (!fileUpload) {
      result.warnings.push('File upload configuration not specified');
      return;
    }

    // Validate max file size
    if (fileUpload.maxSize > this.MAX_FILE_SIZE) {
      result.warnings.push(
        `File upload max size is very large (${fileUpload.maxSize} bytes)`
      );
    }

    if (fileUpload.maxSize <= 0) {
      result.errors.push('File upload max size must be positive');
    }

    // Check for dangerous MIME types
    const dangerousMimeTypes = [
      'application/x-msdownload',
      'application/x-executable',
      'application/x-bat',
      'application/x-sh',
      'text/x-shellscript',
    ];

    if (fileUpload.allowedMimeTypes) {
      for (const mimeType of fileUpload.allowedMimeTypes) {
        if (dangerousMimeTypes.includes(mimeType)) {
          result.warnings.push(
            `Potentially dangerous MIME type allowed: ${mimeType}`
          );
        }
      }
    }

    // Check for dangerous file extensions
    const dangerousExtensions = [
      '.exe',
      '.bat',
      '.cmd',
      '.com',
      '.pif',
      '.scr',
      '.vbs',
      '.js',
      '.jar',
      '.sh',
      '.ps1',
      '.php',
      '.asp',
      '.aspx',
      '.jsp',
    ];

    if (fileUpload.allowedExtensions) {
      for (const extension of fileUpload.allowedExtensions) {
        if (dangerousExtensions.includes(extension.toLowerCase())) {
          result.warnings.push(
            `Potentially dangerous file extension allowed: ${extension}`
          );
        }
      }
    }
  }

  /**
   * Calculate overall security score
   */
  private static calculateSecurityScore(
    result: SecurityValidationResult
  ): void {
    let score = 100;

    // Deduct points for errors and warnings
    score -= result.errors.length * 10;
    score -= result.warnings.length * 5;

    // Bonus points for good practices
    if (result.recommendations.length === 0) {
      score += 5; // No recommendations means good configuration
    }

    result.securityScore = Math.max(0, Math.min(100, score));
  }

  /**
   * Parse time string to milliseconds
   */
  private static parseTimeToMs(timeStr: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const match = timeStr.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 0;
    }

    const [, value, unit] = match;
    return parseInt(value) * (units[unit] || 1000);
  }

  /**
   * Generate security configuration recommendations
   */
  static generateSecurityRecommendations(
    config: Partial<SecurityConfig>
  ): string[] {
    const recommendations: string[] = [];

    // Authentication recommendations
    if (
      config.authentication?.bcryptRounds &&
      config.authentication.bcryptRounds < this.RECOMMENDED_BCRYPT_ROUNDS
    ) {
      recommendations.push(
        `Increase bcrypt rounds to ${this.RECOMMENDED_BCRYPT_ROUNDS} or higher`
      );
    }

    // Encryption recommendations
    if (config.encryption?.provider === 'local') {
      recommendations.push(
        'Consider using AWS KMS or HashiCorp Vault for production'
      );
    }

    // Rate limiting recommendations
    if (!config.rateLimit) {
      recommendations.push('Implement rate limiting to prevent abuse');
    }

    // CORS recommendations
    if (config.cors?.origin === '*') {
      recommendations.push('Specify explicit CORS origins instead of wildcard');
    }

    // Headers recommendations
    if (!config.headers?.contentSecurityPolicy) {
      recommendations.push('Implement Content Security Policy (CSP) headers');
    }

    // File upload recommendations
    if (!config.fileUpload) {
      recommendations.push('Configure file upload restrictions');
    }

    // General recommendations
    recommendations.push(
      'Regularly update dependencies to patch security vulnerabilities'
    );
    recommendations.push('Implement security monitoring and alerting');
    recommendations.push(
      'Conduct regular security audits and penetration testing'
    );
    recommendations.push(
      'Use HTTPS in production with proper SSL/TLS configuration'
    );

    return recommendations;
  }

  /**
   * Create secure default configuration
   */
  static createSecureDefaults(): SecurityConfig {
    return {
      authentication: {
        jwtSecret: EnvironmentValidator.getEnvVar(
          'JWT_SECRET',
          undefined,
          true
        ),
        jwtExpiresIn: '24h',
        bcryptRounds: this.RECOMMENDED_BCRYPT_ROUNDS,
        sessionSecret: EnvironmentValidator.getEnvVar('SESSION_SECRET'),
      },
      encryption: {
        provider: 'local',
        masterKey: EnvironmentValidator.getEnvVar('MASTER_ENCRYPTION_KEY'),
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        skipSuccessfulRequests: false,
      },
      cors: {
        origin:
          process.env.NODE_ENV === 'production'
            ? EnvironmentValidator.getEnvVar(
                'CORS_ORIGIN',
                'https://yourdomain.com'
              )
            : 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      },
      headers: {
        contentSecurityPolicy:
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
        strictTransportSecurity: 'max-age=31536000; includeSubDomains',
        xFrameOptions: 'DENY',
        xContentTypeOptions: 'nosniff',
      },
      fileUpload: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'text/plain',
          'text/csv',
        ],
        allowedExtensions: [
          '.jpg',
          '.jpeg',
          '.png',
          '.gif',
          '.pdf',
          '.txt',
          '.csv',
        ],
      },
    };
  }
}
