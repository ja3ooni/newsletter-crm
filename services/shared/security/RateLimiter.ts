import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { StructuredLogger } from '../logging/StructuredLogger';

const logger = new StructuredLogger('RateLimiter');

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

export interface RateLimitRule {
  name: string;
  path: string | RegExp;
  method?: string | string[];
  config: RateLimitConfig;
}

export class RateLimiter {
  private redis: Redis;
  private rules: Map<string, RateLimitRule> = new Map();

  constructor(redisUrl?: string) {
    this.redis = new Redis(
      redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
    );

    this.redis.on('error', error => {
      logger.error('Redis connection error', { error });
    });
  }

  /**
   * Add a rate limiting rule
   */
  addRule(rule: RateLimitRule): void {
    this.rules.set(rule.name, rule);
    logger.info('Rate limiting rule added', {
      name: rule.name,
      path: rule.path.toString(),
      method: rule.method,
      windowMs: rule.config.windowMs,
      maxRequests: rule.config.maxRequests,
    });
  }

  /**
   * Remove a rate limiting rule
   */
  removeRule(name: string): void {
    this.rules.delete(name);
    logger.info('Rate limiting rule removed', { name });
  }

  /**
   * Create middleware for a specific rule
   */
  createMiddleware(ruleName: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const rule = this.rules.get(ruleName);

      if (!rule) {
        logger.warn('Rate limiting rule not found', { ruleName });

        return next();
      }

      // Check if rule applies to this request
      if (!this.ruleApplies(rule, req)) {
        return next();
      }

      try {
        const allowed = await this.checkRateLimit(req, rule.config);

        if (!allowed) {
          if (rule.config.onLimitReached) {
            rule.config.onLimitReached(req, res);
          } else {
            this.handleRateLimitExceeded(req, res, rule.config);
          }

          return;
        }
        next();
      } catch (error) {
        logger.error('Rate limiting error', { error, ruleName });
        // Fail open - allow request if rate limiting fails
        next();
      }
    };
  }

  /**
   * Create dynamic middleware that checks all rules
   */
  createDynamicMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        for (const [ruleName, rule] of this.rules.entries()) {
          if (this.ruleApplies(rule, req)) {
            const allowed = await this.checkRateLimit(req, rule.config);

            if (!allowed) {
              if (rule.config.onLimitReached) {
                rule.config.onLimitReached(req, res);
              } else {
                this.handleRateLimitExceeded(req, res, rule.config);
              }

              return;
            }
          }
        }
        next();
      } catch (error) {
        logger.error('Dynamic rate limiting error', { error });
        // Fail open - allow request if rate limiting fails
        next();
      }
    };
  }

  /**
   * Check if a rule applies to the current request
   */
  private ruleApplies(rule: RateLimitRule, req: Request): boolean {
    // Check path
    let pathMatches = false;

    if (typeof rule.path === 'string') {
      pathMatches = req.path === rule.path || req.path.startsWith(rule.path);
    } else {
      pathMatches = rule.path.test(req.path);
    }

    if (!pathMatches) {
      return false;
    }

    // Check method
    if (rule.method) {
      const methods = Array.isArray(rule.method) ? rule.method : [rule.method];

      if (!methods.includes(req.method)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check rate limit for a request
   */
  private async checkRateLimit(
    req: Request,
    config: RateLimitConfig
  ): Promise<boolean> {
    const key = this.generateKey(req, config);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();

    // Remove old entries
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    pipeline.zcard(key);

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiration
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Redis pipeline execution failed');
    }

    const currentCount = results[1][1] as number;

    if (currentCount >= config.maxRequests) {
      logger.warn('Rate limit exceeded', {
        key,
        currentCount,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });

      return false;
    }

    return true;
  }

  /**
   * Generate cache key for rate limiting
   */
  private generateKey(req: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return `rate_limit:${config.keyGenerator(req)}`;
    }

    // Default key generation based on IP and user ID
    const ip = req.ip;
    const userId = (req as any).user?.id || 'anonymous';
    const path = req.path;

    return `rate_limit:${ip}:${userId}:${path}`;
  }

  /**
   * Handle rate limit exceeded
   */
  private handleRateLimitExceeded(
    req: Request,
    res: Response,
    config: RateLimitConfig
  ): void {
    const retryAfter = Math.ceil(config.windowMs / 1000);

    res.status(429).set('Retry-After', retryAfter.toString()).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter,
    });
  }

  /**
   * Get current rate limit status for a request
   */
  async getRateLimitStatus(
    req: Request,
    config: RateLimitConfig
  ): Promise<{
    remaining: number;
    resetTime: number;
    total: number;
  }> {
    const key = this.generateKey(req, config);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean old entries and count current
    await this.redis.zremrangebyscore(key, 0, windowStart);
    const currentCount = await this.redis.zcard(key);

    return {
      remaining: Math.max(0, config.maxRequests - currentCount),
      resetTime: now + config.windowMs,
      total: config.maxRequests,
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetRateLimit(req: Request, config: RateLimitConfig): Promise<void> {
    const key = this.generateKey(req, config);

    await this.redis.del(key);
    logger.info('Rate limit reset', { key });
  }

  /**
   * Get all active rate limit keys (for monitoring)
   */
  async getActiveKeys(): Promise<string[]> {
    return await this.redis.keys('rate_limit:*');
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Predefined rate limiting rules
export const CommonRateLimitRules = {
  // API endpoints
  api: {
    name: 'api',
    path: '/api',
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000,
    },
  },

  // Authentication endpoints
  auth: {
    name: 'auth',
    path: '/api/v1/auth',
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10,
    },
  },

  // Password reset
  passwordReset: {
    name: 'password-reset',
    path: '/api/v1/auth/reset-password',
    method: 'POST',
    config: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
    },
  },

  // Newsletter generation
  newsletterGeneration: {
    name: 'newsletter-generation',
    path: '/api/v1/newsletters/generate',
    method: 'POST',
    config: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5,
    },
  },

  // File uploads
  fileUpload: {
    name: 'file-upload',
    path: /\/api\/v1\/.*\/upload$/,
    method: 'POST',
    config: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
    },
  },

  // Email sending
  emailSending: {
    name: 'email-sending',
    path: '/api/v1/newsletters/send',
    method: 'POST',
    config: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 2,
    },
  },

  // Search endpoints
  search: {
    name: 'search',
    path: /\/api\/v1\/.*\/search$/,
    config: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30,
    },
  },
};

// Factory function to create rate limiter with common rules
export function createRateLimiterWithCommonRules(
  redisUrl?: string
): RateLimiter {
  const rateLimiter = new RateLimiter(redisUrl);

  // Add all common rules
  Object.values(CommonRateLimitRules).forEach(rule => {
    rateLimiter.addRule(rule as RateLimitRule);
  });

  return rateLimiter;
}
