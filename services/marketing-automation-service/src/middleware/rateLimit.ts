import { config } from '@/config';
import { logger } from '@/utils/logger';
import rateLimit from 'express-rate-limit';

// General API rate limiting
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });

    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.round(config.rateLimit.windowMs / 1000),
    });
  },
});

// Stricter rate limiting for workflow triggers
export const triggerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 triggers per minute per IP
  message: {
    success: false,
    message: 'Too many workflow triggers from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Trigger rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      userId: req.user?.id,
    });

    res.status(429).json({
      success: false,
      message:
        'Too many workflow triggers from this IP, please try again later.',
      retryAfter: 60,
    });
  },
});

// Rate limiting for event creation
export const eventLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 events per minute per IP
  message: {
    success: false,
    message: 'Too many events from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Event rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      userId: req.user?.id,
    });

    res.status(429).json({
      success: false,
      message: 'Too many events from this IP, please try again later.',
      retryAfter: 60,
    });
  },
});

// Rate limiting for campaign subscriptions
export const subscriptionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 subscriptions per minute per IP
  message: {
    success: false,
    message:
      'Too many subscription requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Subscription rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      userId: req.user?.id,
    });

    res.status(429).json({
      success: false,
      message:
        'Too many subscription requests from this IP, please try again later.',
      retryAfter: 60,
    });
  },
});
