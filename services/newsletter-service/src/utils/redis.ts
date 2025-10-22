import { config } from '@/config'
import { createClient, RedisClientType } from 'redis'
import { logger } from './logger'

class RedisService {
  private client: RedisClientType
  private isConnected = false

  constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    })

    this.client.on('error', (err) => {
      logger.error('Redis client error:', err)
      this.isConnected = false
    })

    this.client.on('connect', () => {
      logger.info('Redis client connected')
      this.isConnected = true
    })

    this.client.on('disconnect', () => {
      logger.info('Redis client disconnected')
      this.isConnected = false
    })
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect()
      logger.info('Redis connected successfully')
    } catch (error) {
      logger.error('Failed to connect to Redis:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect()
      logger.info('Redis disconnected successfully')
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error)
      throw error
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key)
    } catch (error) {
      logger.error('Redis GET error:', { key, error })
      throw error
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value)
      } else {
        await this.client.set(key, value)
      }
    } catch (error) {
      logger.error('Redis SET error:', { key, error })
      throw error
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key)
    } catch (error) {
      logger.error('Redis DEL error:', { key, error })
      throw error
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key)
      return result === 1
    } catch (error) {
      logger.error('Redis EXISTS error:', { key, error })
      throw error
    }
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    try {
      return await this.client.hGet(key, field)
    } catch (error) {
      logger.error('Redis HGET error:', { key, field, error })
      throw error
    }
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.client.hSet(key, field, value)
    } catch (error) {
      logger.error('Redis HSET error:', { key, field, error })
      throw error
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hGetAll(key)
    } catch (error) {
      logger.error('Redis HGETALL error:', { key, error })
      throw error
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds)
      return result
    } catch (error) {
      logger.error('Redis EXPIRE error:', { key, seconds, error })
      throw error
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key)
    } catch (error) {
      logger.error('Redis INCR error:', { key, error })
      throw error
    }
  }

  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key)
    } catch (error) {
      logger.error('Redis DECR error:', { key, error })
      throw error
    }
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sAdd(key, members)
    } catch (error) {
      logger.error('Redis SADD error:', { key, members, error })
      throw error
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.sMembers(key)
    } catch (error) {
      logger.error('Redis SMEMBERS error:', { key, error })
      throw error
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sRem(key, members)
    } catch (error) {
      logger.error('Redis SREM error:', { key, members, error })
      throw error
    }
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.client.zAdd(key, { score, value: member })
    } catch (error) {
      logger.error('Redis ZADD error:', { key, score, member, error })
      throw error
    }
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.zRange(key, start, stop)
    } catch (error) {
      logger.error('Redis ZRANGE error:', { key, start, stop, error })
      throw error
    }
  }

  async flushdb(): Promise<void> {
    try {
      await this.client.flushDb()
    } catch (error) {
      logger.error('Redis FLUSHDB error:', error)
      throw error
    }
  }

  isHealthy(): boolean {
    return this.isConnected
  }

  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const start = Date.now()
      await this.client.ping()
      const responseTime = Date.now() - start

      return {
        status: 'healthy',
        details: {
          connected: this.isConnected,
          responseTime,
        },
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }

  getClient(): RedisClientType {
    return this.client
  }
}

export const redis = new RedisService()
export { RedisService }
