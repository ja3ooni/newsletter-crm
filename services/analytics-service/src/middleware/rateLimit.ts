import { config } from '@/config';
import { logger } from '@/utils/logger';
import rateLimit from 'express-rate-limit';

export const createRateLimit = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs || config.rateLimit.windowMs,
    max: options.max || config.rateLimit.max,
    message: {
      success: false,
      error: options.message || 'Too many requests, please try again later',
      statusCode: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        url: req.url,
        userAgent: req.get('User-Agent'),
      });

      res.status(429).json({
        success: false,
        error: options.message || 'Too many requests, please try again later',
        statusCode: 429,
      });
    },
  });
};

// Default rate limiter
export const defaultRateLimit = createRateLimit({});

// Strict rate limiter for sensitive endpoints
export const strictRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many requests to this endpoint, please try again later',
});

// Lenient rate limiter for read-only endpoints
export const readOnlyRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  skipSuccessfulRequests: true,
});
