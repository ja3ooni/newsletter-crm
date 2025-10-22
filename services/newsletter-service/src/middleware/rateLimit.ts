import { config } from '@/config'
import { logger } from '@/utils/logger'
import { redis } from '@/utils/redis'
import { Request, Response } from 'express'
import rateLimit from 'express-rate-limit'

// Custom store using Redis
class RedisStore {
  constructor(private prefix: string = 'rl:') {}

  async incr(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
    const redisKey = `${this.prefix}${key}`

    try {
      const current = await redis.incr(redisKey)

      if (current === 1) {
        // Set expiration on first request
        await redis.expire(redisKey, Math.ceil(config.rateLimit.windowMs / 1000))
      }

      const ttl = await redis.getClient().ttl(redisKey)
      const resetTime = ttl > 0 ? new Date(Date.now() + ttl * 1000) : undefined

      return {
        totalHits: current,
        resetTime,
      }
    } catch (error) {
      logger.error('Redis rate limit error:', error)
      // Fallback to allowing the request if Redis fails
      return { totalHits: 1 }
    }
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`

    try {
      await redis.decr(redisKey)
    } catch (error) {
      logger.error('Redis rate limit decrement error:', error)
    }
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`

    try {
      await redis.del(redisKey)
    } catch (error) {
      logger.error('Redis rate limit reset error:', error)
    }
  }
}

// Create rate limit middleware with Redis store
const createRateLimiter = (options: {
  windowMs?: number
  max?: number
  message?: string
  keyGenerator?: (req: Request) => string
  skip?: (req: Request) => boolean
}) => {
  const store = new RedisStore()

  return rateLimit({
    windowMs: options.windowMs || config.rateLimit.windowMs,
    max: options.max || config.rateLimit.max,
    message: {
      error: options.message || 'Too many requests, please try again later',
      statusCode: 429,
    },
    keyGenerator: options.keyGenerator || ((req: Request) => {
      // Use IP address and user ID if available
      const userId = (req as any).user?.id
      return userId ? `${req.ip}:${userId}` : req.ip
    }),
    skip: options.skip || (() => false),
    store: {
      incr: async (key: string, cb: Function) => {
        try {
          const result = await store.incr(key)
          cb(null, result.totalHits, result.resetTime)
        } catch (error) {
          cb(error)
        }
      },
      decrement: async (key: string) => {
        await store.decrement(key)
      },
      resetKey: async (key: string) => {
        await store.resetKey(key)
      },
    },
    onLimitReached: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        method: req.method,
        userId: (req as any).user?.id,
      })
    },
  })
}

// General rate limiter
export const generalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later',
})

// Strict rate limiter for sensitive operations
export const strictRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many requests for this operation, please try again later',
})

// Newsletter creation rate limiter
export const newsletterCreationRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 newsletters per hour
  message: 'Too many newsletters created, please try again later',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id
    return userId ? `newsletter_creation:${userId}` : `newsletter_creation:${req.ip}`
  },
})

// Email sending rate limiter
export const emailSendingRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 emails per hour
  message: 'Email sending limit exceeded, please try again later',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id
    return userId ? `email_sending:${userId}` : `email_sending:${req.ip}`
  },
})

// API key rate limiter (higher limits)
export const apiKeyRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window for API keys
  message: 'API rate limit exceeded, please try again later',
  keyGenerator: (req: Request) => {
    const apiKey = req.headers['x-api-key'] as string
    return apiKey ? `api:${apiKey}` : req.ip
  },
  skip: (req: Request) => {
    // Skip rate limiting if no API key is provided
    return !req.headers['x-api-key']
  },
})

// Content generation rate limiter
export const contentGenerationRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 content generations per hour
  message: 'Content generation limit exceeded, please try again later',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id
    return userId ? `content_generation:${userId}` : `content_generation:${req.ip}`
  },
})

// Preview rate limiter (more lenient)
export const previewRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 previews per 5 minutes
  message: 'Too many preview requests, please try again later',
})

// Analytics rate limiter
export const analyticsRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 analytics requests per window
  message: 'Analytics rate limit exceeded, please try again later',
})

// Dynamic rate limiter based on user subscription
export const createSubscriptionBasedRateLimit = (
  baseMax: number,
  premiumMultiplier: number = 5
) => {
  return createRateLimiter({
    max: (req: Request) => {
      const user = (req as any).user
      if (!user) return baseMax

      // In a real implementation, you would check the user's subscription
      // For now, we'll use role as a proxy
      switch (user.role) {
        case 'premium':
          return baseMax * premiumMultiplier
        case 'enterprise':
          return baseMax * premiumMultiplier * 2
        case 'admin':
          return baseMax * 100 // Very high limit for admins
        default:
          return baseMax
      }
    },
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.id
      return userId ? `subscription:${userId}` : req.ip
    },
  })
}

// Export rate limiters
export const rateLimiters = {
  general: generalRateLimit,
  strict: strictRateLimit,
  newsletterCreation: newsletterCreationRateLimit,
  emailSending: emailSendingRateLimit,
  apiKey: apiKeyRateLimit,
  contentGeneration: contentGenerationRateLimit,
  preview: previewRateLimit,
  analytics: analyticsRateLimit,
  createSubscriptionBased: createSubscriptionBasedRateLimit,
}
