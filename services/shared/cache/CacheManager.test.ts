import { CacheConfig, CacheManager } from './CacheManager';

// Mock Redis client
const mockRedisClient = {
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  sMembers: jest.fn(),
  sAdd: jest.fn(),
  expire: jest.fn(),
  ping: jest.fn(),
} as any;

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let config: CacheConfig;

  beforeEach(() => {
    config = {
      defaultTTL: 300,
      keyPrefix: 'test',
      enableCompression: false,
      maxMemoryUsage: 100, // 100MB
    };

    cacheManager = new CacheManager(mockRedisClient, config);
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return null for cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheManager.get('nonexistent');

      expect(result).toBeNull();
      expect(mockRedisClient.get).toHaveBeenCalledWith('test:nonexistent');
    });

    it('should return value from Redis cache', async () => {
      const testData = { message: 'hello' };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheManager.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test:test-key');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheManager.get('error-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value in Redis cache', async () => {
      const testData = { message: 'hello' };

      mockRedisClient.setEx.mockResolvedValue('OK');

      await cacheManager.set('test-key', testData);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:test-key',
        300,
        JSON.stringify(testData)
      );
    });

    it('should use custom TTL when provided', async () => {
      const testData = { message: 'hello' };

      mockRedisClient.setEx.mockResolvedValue('OK');

      await cacheManager.set('test-key', testData, 600);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:test-key',
        600,
        JSON.stringify(testData)
      );
    });

    it('should throw error when Redis fails', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      await expect(cacheManager.set('test-key', 'value')).rejects.toThrow(
        'Redis error'
      );
    });
  });

  describe('delete', () => {
    it('should delete key from Redis cache', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await cacheManager.delete('test-key');

      expect(mockRedisClient.del).toHaveBeenCalledWith('test:test-key');
    });

    it('should throw error when Redis fails', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      await expect(cacheManager.delete('test-key')).rejects.toThrow(
        'Redis error'
      );
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { message: 'cached' };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const fetchFunction = jest.fn().mockResolvedValue({ message: 'fresh' });
      const result = await cacheManager.getOrSet('test-key', fetchFunction);

      expect(result).toEqual(cachedData);
      expect(fetchFunction).not.toHaveBeenCalled();
    });

    it('should fetch and cache value if not exists', async () => {
      const freshData = { message: 'fresh' };

      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setEx.mockResolvedValue('OK');

      const fetchFunction = jest.fn().mockResolvedValue(freshData);
      const result = await cacheManager.getOrSet('test-key', fetchFunction);

      expect(result).toEqual(freshData);
      expect(fetchFunction).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:test-key',
        300,
        JSON.stringify(freshData)
      );
    });
  });

  describe('invalidatePattern', () => {
    it('should delete keys matching pattern', async () => {
      const keys = ['test:key1', 'test:key2'];

      mockRedisClient.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(2);

      await cacheManager.invalidatePattern('key*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('test:key*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
    });

    it('should handle no matching keys', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await cacheManager.invalidatePattern('nonexistent*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('test:nonexistent*');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('setWithTags', () => {
    it('should set value and associate with tags', async () => {
      const testData = { message: 'hello' };

      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.sAdd.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);

      await cacheManager.setWithTags('test-key', testData, ['tag1', 'tag2']);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:test-key',
        300,
        JSON.stringify(testData)
      );
      expect(mockRedisClient.sAdd).toHaveBeenCalledWith(
        'tag:tag1',
        'test:test-key'
      );
      expect(mockRedisClient.sAdd).toHaveBeenCalledWith(
        'tag:tag2',
        'test:test-key'
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith('tag:tag1', 360);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('tag:tag2', 360);
    });
  });

  describe('invalidateByTags', () => {
    it('should invalidate keys associated with tags', async () => {
      const taggedKeys = ['test:key1', 'test:key2'];

      mockRedisClient.sMembers.mockResolvedValue(taggedKeys);
      mockRedisClient.del.mockResolvedValue(2);

      await cacheManager.invalidateByTags(['tag1']);

      expect(mockRedisClient.sMembers).toHaveBeenCalledWith('tag:tag1');
      expect(mockRedisClient.del).toHaveBeenCalledWith(taggedKeys);
      expect(mockRedisClient.del).toHaveBeenCalledWith('tag:tag1');
    });
  });

  describe('clear', () => {
    it('should clear all cache data with prefix', async () => {
      const keys = ['test:key1', 'test:key2'];

      mockRedisClient.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(2);

      await cacheManager.clear();

      expect(mockRedisClient.keys).toHaveBeenCalledWith('test:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when Redis is responsive', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await cacheManager.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.details).toHaveProperty('responseTime');
      expect(result.details).toHaveProperty('memoryUsage');
      expect(result.details).toHaveProperty('memoryCacheSize');
      expect(result.details).toHaveProperty('stats');
    });

    it('should return unhealthy status when Redis fails', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await cacheManager.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.details).toHaveProperty('error');
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = cacheManager.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('sets');
      expect(stats).toHaveProperty('deletes');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('memoryUsage');
    });
  });

  describe('warmUp', () => {
    it('should warm up cache with provided data', async () => {
      const warmUpData = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2', ttl: 600 },
      ];

      mockRedisClient.setEx.mockResolvedValue('OK');

      const warmUpFunction = jest.fn().mockResolvedValue(warmUpData);

      await cacheManager.warmUp(warmUpFunction);

      expect(warmUpFunction).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:key1',
        300,
        JSON.stringify('value1')
      );
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:key2',
        600,
        JSON.stringify('value2')
      );
    });
  });

  describe('optimizeCache', () => {
    it('should optimize cache and return optimization results', async () => {
      // Set up some cache entries first
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.set('key3', 'value3');

      const result = await cacheManager.optimizeCache();

      expect(result).toHaveProperty('expiredEntriesRemoved');
      expect(result).toHaveProperty('memoryFreed');
      expect(result).toHaveProperty('lruEvictionsPerformed');
      expect(typeof result.expiredEntriesRemoved).toBe('number');
      expect(typeof result.memoryFreed).toBe('number');
      expect(typeof result.lruEvictionsPerformed).toBe('boolean');
      expect(result.expiredEntriesRemoved).toBeGreaterThanOrEqual(0);
      expect(result.memoryFreed).toBeGreaterThanOrEqual(0);
    });

    it('should handle optimization when cache is empty', async () => {
      // Clear cache first
      await cacheManager.clear();

      const result = await cacheManager.optimizeCache();

      expect(result).toEqual({
        expiredEntriesRemoved: 0,
        memoryFreed: 0,
        lruEvictionsPerformed: false,
      });
    });

    it('should log optimization results', async () => {
      const loggerSpy = jest.spyOn(require('../utils/logger').logger, 'info');

      await cacheManager.optimizeCache();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Cache optimization completed',
        expect.objectContaining({
          expiredEntriesRemoved: expect.any(Number),
          memoryFreed: expect.any(Number),
          lruEvictionsPerformed: expect.any(Boolean),
          finalMemoryUsage: expect.any(Number),
          finalCacheSize: expect.any(Number),
        })
      );

      loggerSpy.mockRestore();
    });
  });
});
