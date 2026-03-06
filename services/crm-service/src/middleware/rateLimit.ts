// @ts-nocheck
import logger from '@/utils/logger';
import redis from '@/utils/redis';
import { NextFunction, Request, Response } from 'express';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

const defaultOptions: RateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  keyGenerator: (req: Request) => req.ip || 'unknown',
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

export const createRateLimit = (options: Partial<RateLimitOptions> = {}) => {
  const opts = { ...defaultOptions, ...options };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = `rate_limit:${opts.keyGenerator!(req)}`;
      const windowStart = Math.floor(Date.now() / opts.windowMs) * opts.windowMs;
      const windowKey = `${key}:${windowStart}`;

      // Get current count
      const current = await redis.get(windowKey);
      const count = current ? parseInt(current, 10) : 0;

      // Check if limit exceeded
      if (count >= opts.maxRequests) {
        res.status(429).json({
          success: false,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((windowStart + opts.windowMs - Date.now()) / 1000),
        });
        return;
      }

      // Increment counter
      const newCount = count + 1;
      await redis.setex(windowKey, Math.ceil(opts.windowMs / 1000), newCount.toString());

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': opts.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, opts.maxRequests - newCount).toString(),
        'X-RateLimit-Reset': new Date(windowStart + opts.windowMs).toISOString(),
      });

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Don't block requests if rate limiting fails
      next();
    }
  };
};

// Default rate limit middleware
export const rateLimitMiddleware = createRateLimit();

// Stricter rate limit for authentication endpoints
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
});

// More lenient rate limit for read operations
export const readRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 200, // 200 requests per minute
});

// Stricter rate limit for write operations
export const writeRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50, // 50 requests per minute
});

// Rate limit by user ID for authenticated requests
export const userRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute per user
  keyGenerator: (req: Request) => req.user?.id || req.ip || 'unknown',
});
