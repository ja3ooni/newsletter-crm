/**
 * Performance Optimization Tests
 *
 * Tests for the performance optimizations implemented in debug-tools
 */

import { performanceOptimizer } from '../shared/PerformanceOptimizer';

describe('PerformanceOptimizer', () => {
  beforeEach(() => {
    // Clear cache before each test
    performanceOptimizer.clearCache();
  });

  describe('Caching', () => {
    it('should cache function results', async () => {
      let callCount = 0;
      const expensiveOperation = async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      // First call should execute the function
      const result1 = await performanceOptimizer.cached(
        'test-key',
        expensiveOperation,
        1000
      );
      expect(result1).toBe('result');
      expect(callCount).toBe(1);

      // Second call should use cache
      const result2 = await performanceOptimizer.cached(
        'test-key',
        expensiveOperation,
        1000
      );
      expect(result2).toBe('result');
      expect(callCount).toBe(1); // Should not increment
    });

    it('should expire cache entries after TTL', async () => {
      let callCount = 0;
      const expensiveOperation = async () => {
        callCount++;
        return 'result';
      };

      // First call
      await performanceOptimizer.cached('test-key', expensiveOperation, 50);
      expect(callCount).toBe(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      // Second call should execute again
      await performanceOptimizer.cached('test-key', expensiveOperation, 50);
      expect(callCount).toBe(2);
    });

    it('should provide cache statistics', () => {
      const stats = performanceOptimizer.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute operations in parallel', async () => {
      const items = [1, 2, 3, 4, 5];
      const startTime = Date.now();

      const results = await performanceOptimizer.executeInParallel(
        items,
        async item => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return item * 2;
        },
        { maxConcurrency: 3 }
      );

      const duration = Date.now() - startTime;

      expect(results).toEqual([2, 4, 6, 8, 10]);
      // Should complete faster than sequential execution (5 * 100ms = 500ms)
      expect(duration).toBeLessThan(400);
    });

    it('should handle errors in parallel execution', async () => {
      const items = [1, 2, 3];

      const results = await performanceOptimizer.executeInParallel(
        items,
        async item => {
          if (item === 2) {
            throw new Error('Test error');
          }
          return item * 2;
        },
        { maxConcurrency: 2, failFast: false }
      );

      expect(results[0]).toBe(2);
      expect(results[1]).toBeUndefined(); // Failed operation
      expect(results[2]).toBe(6);
    });

    it('should fail fast when configured', async () => {
      const items = [1, 2, 3];

      await expect(
        performanceOptimizer.executeInParallel(
          items,
          async item => {
            if (item === 2) {
              throw new Error('Test error');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            return item * 2;
          },
          { maxConcurrency: 2, failFast: true }
        )
      ).rejects.toThrow('Test error');
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running operations', async () => {
      const longOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'completed';
      };

      await expect(
        performanceOptimizer.withTimeout(longOperation, { timeout: 100 })
      ).rejects.toThrow('Operation timed out after 100ms');
    });

    it('should complete fast operations normally', async () => {
      const fastOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'completed';
      };

      const result = await performanceOptimizer.withTimeout(fastOperation, {
        timeout: 100,
      });

      expect(result).toBe('completed');
    });

    it('should call timeout callback when provided', async () => {
      let timeoutCalled = false;
      const longOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'completed';
      };

      await expect(
        performanceOptimizer.withTimeout(longOperation, {
          timeout: 100,
          onTimeout: () => {
            timeoutCalled = true;
          },
        })
      ).rejects.toThrow();

      expect(timeoutCalled).toBe(true);
    });
  });

  describe('Progress Tracking', () => {
    it('should create and track progress', () => {
      const tracker = performanceOptimizer.createProgressTracker(
        'test',
        10,
        'Testing'
      );

      expect(tracker.id).toBe('test');
      expect(tracker.total).toBe(10);
      expect(tracker.message).toBe('Testing');

      const stats = tracker.getStats();
      expect(stats.percentage).toBe(0);

      tracker.update(5);
      const updatedStats = tracker.getStats();
      expect(updatedStats.percentage).toBe(50);

      tracker.complete();
      const completedStats = tracker.getStats();
      expect(completedStats.percentage).toBe(100);

      performanceOptimizer.removeProgressTracker('test');
    });

    it('should increment progress correctly', () => {
      const tracker = performanceOptimizer.createProgressTracker('test', 10);

      tracker.increment(3);
      expect(tracker.getStats().percentage).toBe(30);

      tracker.increment(2);
      expect(tracker.getStats().percentage).toBe(50);

      performanceOptimizer.removeProgressTracker('test');
    });
  });

  describe('Performance Measurement', () => {
    it('should measure operation performance', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      };

      const measurement = await performanceOptimizer.measurePerformance(
        operation,
        'test-operation'
      );

      expect(measurement.result).toBe('result');
      expect(measurement.duration).toBeGreaterThan(90);
      expect(measurement.duration).toBeLessThan(200);
      expect(typeof measurement.memoryDelta).toBe('number');
    });
  });

  describe('Batched Execution', () => {
    it('should execute operations in batches', async () => {
      const items = Array.from({ length: 25 }, (_, i) => i + 1);
      let batchCount = 0;

      const results = await performanceOptimizer.executeBatched(
        items,
        async batch => {
          batchCount++;
          return batch.map(item => item * 2);
        },
        10 // Batch size
      );

      expect(results).toEqual(items.map(item => item * 2));
      expect(batchCount).toBe(3); // 25 items / 10 batch size = 3 batches
    });
  });

  describe('Memory Monitoring', () => {
    it('should provide memory usage information', () => {
      const memUsage = performanceOptimizer.getMemoryUsage();

      expect(memUsage).toHaveProperty('heapUsed');
      expect(memUsage).toHaveProperty('heapTotal');
      expect(memUsage).toHaveProperty('external');
      expect(memUsage).toHaveProperty('rss');
      expect(memUsage).toHaveProperty('cacheSize');

      expect(typeof memUsage.heapUsed).toBe('number');
      expect(typeof memUsage.cacheSize).toBe('number');
    });
  });
});
