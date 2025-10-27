import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from './logger';

class RedisClient {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      ...(config.redis.password && { password: config.redis.password }),
      database: config.redis.db,
    });

    this.client.on('error', err => {
      logger.error('Redis Client Error', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis Client Disconnected');
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
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    return this.client.hGet(key, field);
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    return this.client.hSet(key, field, value);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.client.hGetAll(key);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sAdd(key, members);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return this.client.sIsMember(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.sMembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.sRem(key, members);
  }

  async setex(
    key: string,
    seconds: number,
    value: string
  ): Promise<string | null> {
    return this.client.setEx(key, seconds, value);
  }

  async lpush(key: string, ...elements: string[]): Promise<number> {
    return this.client.lPush(key, elements);
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    return this.client.lTrim(key, start, stop);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.client.zAdd(key, { score, value: member });
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zRange(key, start, stop);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return this.client.expire(key, seconds);
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
}

export const redis = new RedisClient();
