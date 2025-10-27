import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { StructuredLogger } from '../logging/StructuredLogger';
import { InputValidator } from './InputValidator';

const logger = new StructuredLogger({
  service: 'SecurityMiddleware',
  environment: process.env.NODE_ENV || 'development',
});

export interface SecurityConfig {
  rateLimit?: {
    windowMs?: number;
    max?: number;
    message?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
  };
  slowDown?: {
    windowMs?: number;
    delayAfter?: number;
    delayMs?: number;
    maxDelayMs?: number;
  };
  cors?: {
    origin?: string | string[] | boolean;
    credentials?: boolean;
    optionsSuccessStatus?: number;
  };
  helmet?: {
    contentSecurityPolicy?: any;
    crossOriginEmbedderPolicy?: boolean;
  };
}

export class SecurityMiddleware {
  private static instance: SecurityMiddleware;
  private config: SecurityConfig;

  constructor(config: SecurityConfig = {}) {
    this.config = {
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
        ...config.rateLimit,
      },
      slowDown: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        delayAfter: 50, // allow 50 requests per windowMs without delay
        delayMs: 500, // add 500ms delay per request after delayAfter
        maxDelayMs: 20000, // max delay of 20 seconds
        ...config.slowDown,
      },
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
        ],
        credentials: true,
        optionsSuccessStatus: 200,
        ...config.cors,
      },
      helmet: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://fonts.googleapis.com',
            ],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            manifestSrc: ["'self'"],
            workerSrc: ["'self'"],
          },
        },
        crossOriginEmbedderPolicy: false,
        ...config.helmet,
      },
    };
  }

  static getInstance(config?: SecurityConfig): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware(config);
    }

    return SecurityMiddleware.instance;
  }

  /**
   * Apply all security middleware
   */
  applySecurityMiddleware() {
    return [
      this.helmetMiddleware(),
      this.corsMiddleware(),
      this.rateLimitMiddleware(),
      this.slowDownMiddleware(),
      this.requestSanitizationMiddleware(),
      this.securityHeadersMiddleware(),
    ];
  }

  /**
   * Helmet middleware for security headers
   */
  helmetMiddleware() {
    return helmet(this.config.helmet);
  }

  /**
   * CORS middleware
   */
  corsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      const allowedOrigins = Array.isArray(this.config.cors?.origin)
        ? this.config.cors.origin
        : [this.config.cors?.origin || 'http://localhost:3000'];

      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }

      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,HEAD,PUT,PATCH,POST,DELETE'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );

      if (req.method === 'OPTIONS') {
        res.status(this.config.cors?.optionsSuccessStatus || 200).end();

        return;
      }

      next();
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimitMiddleware() {
    return rateLimit({
      ...this.config.rateLimit,
      handler: (req: Request, res: Response) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
        });

        res.status(429).json({
          error: 'Too Many Requests',
          message: this.config.rateLimit?.message,
          retryAfter: Math.round(this.config.rateLimit?.windowMs! / 1000),
        });
      },
    });
  }

  /**
   * Slow down middleware for progressive delays
   */
  slowDownMiddleware() {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip;
      const now = Date.now();
      const windowMs = this.config.slowDown?.windowMs || 15 * 60 * 1000;
      const delayAfter = this.config.slowDown?.delayAfter || 50;
      const delayMs = this.config.slowDown?.delayMs || 500;
      const maxDelayMs = this.config.slowDown?.maxDelayMs || 20000;

      // Clean expired entries
      for (const [key, data] of requests.entries()) {
        if (now > data.resetTime) {
          requests.delete(key);
        }
      }

      const requestData = requests.get(ip) || {
        count: 0,
        resetTime: now + windowMs,
      };

      requestData.count++;
      requests.set(ip, requestData);

      if (requestData.count > delayAfter) {
        const delay = Math.min(
          (requestData.count - delayAfter) * delayMs,
          maxDelayMs
        );

        setTimeout(() => next(), delay);
      } else {
        next();
      }
    };
  }

  /**
   * Request sanitization middleware
   */
  requestSanitizationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Sanitize query parameters
        if (req.query) {
          for (const [key, value] of Object.entries(req.query)) {
            if (typeof value === 'string') {
              const result = InputValidator.sanitizeString(value, 1000);

              if (!result.isValid) {
                logger.warn('Malicious query parameter detected', {
                  ip: req.ip,
                  parameter: key,
                  value: value.substring(0, 100),
                  errors: result.errors,
                });

                return res.status(400).json({
                  error: 'Bad Request',
                  message: 'Invalid query parameter',
                  details: result.errors,
                });
              }
              req.query[key] = result.sanitizedData;
            }
          }
        }

        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
          req.body = this.sanitizeObject(req.body);
        }

        next();
      } catch (error) {
        logger.error('Error in request sanitization', error as Error, {
          ip: req.ip,
        });
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Request processing failed',
        });
      }
    };
  }

  /**
   * Additional security headers middleware
   */
  securityHeadersMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Remove server information
      res.removeHeader('X-Powered-By');

      // Add custom security headers
      res.setHeader('X-Request-ID', req.headers['x-request-id'] || 'unknown');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader(
        'Permissions-Policy',
        'geolocation=(), microphone=(), camera=()'
      );

      // HSTS header for HTTPS
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains; preload'
        );
      }

      next();
    };
  }

  /**
   * SQL injection protection middleware
   */
  sqlInjectionProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      const checkForSqlInjection = (obj: any, path: string = ''): boolean => {
        if (typeof obj === 'string') {
          const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
            /(UNION\s+SELECT)/gi,
            /(\bOR\s+1\s*=\s*1\b)/gi,
            /(\bAND\s+1\s*=\s*1\b)/gi,
            /(--|\#|\/\*|\*\/)/g,
            /(\bxp_cmdshell\b)/gi,
            /(\bsp_executesql\b)/gi,
          ];

          for (const pattern of sqlPatterns) {
            if (pattern.test(obj)) {
              logger.warn('SQL injection attempt detected', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path,
                field: path,
                value: obj.substring(0, 100),
              });

              return true;
            }
          }
        } else if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            if (checkForSqlInjection(value, `${path}.${key}`)) {
              return true;
            }
          }
        }

        return false;
      };

      if (checkForSqlInjection(req.body) || checkForSqlInjection(req.query)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Request contains potentially malicious content',
        });
      }

      next();
    };
  }

  /**
   * XSS protection middleware
   */
  xssProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      const sanitizeForXss = (obj: any): any => {
        if (typeof obj === 'string') {
          // Check for XSS patterns
          const xssPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
            /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
            /<embed\b[^>]*>/gi,
            /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
          ];

          for (const pattern of xssPatterns) {
            if (pattern.test(obj)) {
              logger.warn('XSS attempt detected', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path,
                value: obj.substring(0, 100),
              });

              // Return sanitized version
              return obj.replace(pattern, '');
            }
          }

          return obj;
        } else if (
          typeof obj === 'object' &&
          obj !== null &&
          !Array.isArray(obj)
        ) {
          const sanitized: any = {};

          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeForXss(value);
          }

          return sanitized;
        } else if (Array.isArray(obj)) {
          return obj.map(item => sanitizeForXss(item));
        }

        return obj;
      };

      if (req.body) {
        req.body = sanitizeForXss(req.body);
      }

      if (req.query) {
        req.query = sanitizeForXss(req.query);
      }

      next();
    };
  }

  /**
   * DDoS protection middleware
   */
  ddosProtection() {
    const suspiciousIPs = new Map<
      string,
      { count: number; lastSeen: number }
    >();
    const THRESHOLD = 1000; // requests per minute
    const WINDOW = 60 * 1000; // 1 minute
    const BAN_DURATION = 15 * 60 * 1000; // 15 minutes

    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip;
      const now = Date.now();

      // Clean old entries
      for (const [suspiciousIP, data] of suspiciousIPs.entries()) {
        if (now - data.lastSeen > BAN_DURATION) {
          suspiciousIPs.delete(suspiciousIP);
        }
      }

      const ipData = suspiciousIPs.get(ip);

      if (ipData) {
        if (now - ipData.lastSeen < WINDOW) {
          ipData.count++;
          ipData.lastSeen = now;

          if (ipData.count > THRESHOLD) {
            logger.error('DDoS attack detected', {
              ip,
              requestCount: ipData.count,
              userAgent: req.get('User-Agent'),
            });

            return res.status(429).json({
              error: 'Too Many Requests',
              message:
                'Suspicious activity detected. Access temporarily restricted.',
              retryAfter: Math.round(BAN_DURATION / 1000),
            });
          }
        } else {
          // Reset counter for new window
          ipData.count = 1;
          ipData.lastSeen = now;
        }
      } else {
        suspiciousIPs.set(ip, { count: 1, lastSeen: now });
      }

      next();
    };
  }

  /**
   * Content Security Policy middleware
   */
  contentSecurityPolicy(customDirectives?: Record<string, string[]>) {
    const defaultDirectives = {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      ...customDirectives,
    };

    return (req: Request, res: Response, next: NextFunction) => {
      const cspHeader = Object.entries(defaultDirectives)
        .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
        .join('; ');

      res.setHeader('Content-Security-Policy', cspHeader);
      next();
    };
  }

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      const result = InputValidator.sanitizeString(obj);

      return result.isValid ? result.sanitizedData : obj;
    } else if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      const sanitized: any = {};

      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }

      return sanitized;
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    return obj;
  }
}

// Export middleware factory functions
export const createSecurityMiddleware = (config?: SecurityConfig) => {
  return SecurityMiddleware.getInstance(config);
};

export const applyBasicSecurity = () => {
  const security = SecurityMiddleware.getInstance();

  return security.applySecurityMiddleware();
};

export const applyAdvancedSecurity = () => {
  const security = SecurityMiddleware.getInstance();

  return [
    ...security.applySecurityMiddleware(),
    security.sqlInjectionProtection(),
    security.xssProtection(),
    security.ddosProtection(),
  ];
};
