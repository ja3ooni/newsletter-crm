import { config } from '@/config';
import Redis from 'redis';
import { logger } from './logger';

class RedisClient {
  private client: Redis.RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = Redis.createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    this.client.on('error', err => {
      logger.error('Redis Client Error', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Disconnected from Redis');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(this.prefixKey(key));
    } catch (error) {
      logger.error('Redis GET error', { key, error });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      const prefixedKey = this.prefixKey(key);
      if (ttl) {
        await this.client.setEx(prefixedKey, ttl, value);
      } else {
        await this.client.set(prefixedKey, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error', { key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(this.prefixKey(key));
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL error', { key, error });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(this.prefixKey(key));
      return result > 0;
    } catch (error) {
      logger.error('Redis EXISTS error', { key, error });
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(this.prefixKey(key));
    } catch (error) {
      logger.error('Redis INCR error', { key, error });
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(this.prefixKey(key), seconds);
      return result;
    } catch (error) {
      logger.error('Redis EXPIRE error', { key, error });
      return false;
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hGet(this.prefixKey(key), field);
    } catch (error) {
      logger.error('Redis HGET error', { key, field, error });
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      await this.client.hSet(this.prefixKey(key), field, value);
      return true;
    } catch (error) {
      logger.error('Redis HSET error', { key, field, error });
      return false;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hGetAll(this.prefixKey(key));
    } catch (error) {
      logger.error('Redis HGETALL error', { key, error });
      return {};
    }
  }

  async zadd(key: string, score: number, member: string): Promise<boolean> {
    try {
      await this.client.zAdd(this.prefixKey(key), { score, value: member });
      return true;
    } catch (error) {
      logger.error('Redis ZADD error', { key, score, member, error });
      return false;
    }
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.zRange(this.prefixKey(key), start, stop);
    } catch (error) {
      logger.error('Redis ZRANGE error', { key, start, stop, error });
      return [];
    }
  }

  async publish(channel: string, message: string): Promise<boolean> {
    try {
      await this.client.publish(channel, message);
      return true;
    } catch (error) {
      logger.error('Redis PUBLISH error', { channel, error });
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', error);
      return false;
    }
  }

  private prefixKey(key: string): string {
    return `${config.redis.keyPrefix}${key}`;
  }

  getClient(): Redis.RedisClientType {
    return this.client;
  }
}

export const redis = new RedisClient();
export { RedisClient };
