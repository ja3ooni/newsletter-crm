import {
  defaultMemoryConfig,
  MemoryConfig,
  MemoryOptimizer,
} from '../MemoryOptimizer';

describe('MemoryOptimizer', () => {
  let memoryOptimizer: MemoryOptimizer;
  let testConfig: MemoryConfig;

  beforeEach(() => {
    testConfig = {
      ...defaultMemoryConfig,
      monitoringInterval: 100, // Faster for testing
      cleanup: {
        ...defaultMemoryConfig.cleanup,
        cleanupInterval: 100,
        maxCacheAge: 500,
      },
    };
    memoryOptimizer = new MemoryOptimizer(testConfig);
  });

  afterEach(() => {
    memoryOptimizer.stop();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const optimizer = new MemoryOptimizer(defaultMemoryConfig);
      expect(optimizer).toBeDefined();
      optimizer.stop();
    });

    it('should start and stop monitoring', () => {
      memoryOptimizer.start();
      expect(memoryOptimizer).toBeDefined();
      memoryOptimizer.stop();
    });
  });

  describe('memory metrics', () => {
    it('should return current memory metrics', () => {
      const metrics = memoryOptimizer.getMemoryMetrics();

      expect(metrics).toHaveProperty('heapUsed');
      expect(metrics).toHaveProperty('heapTotal');
      expect(metrics).toHaveProperty('heapUsagePercentage');
      expect(metrics).toHaveProperty('gcCount');
      expect(metrics).toHaveProperty('memoryLeakRate');
      expect(metrics).toHaveProperty('largeObjects');
      expect(metrics).toHaveProperty('activeStreams');

      expect(typeof metrics.heapUsed).toBe('number');
      expect(typeof metrics.heapTotal).toBe('number');
      expect(typeof metrics.heapUsagePercentage).toBe('number');
      expect(metrics.heapUsagePercentage).toBeGreaterThanOrEqual(0);
      expect(metrics.heapUsagePercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('resource tracking', () => {
    it('should track and untrack resources', () => {
      const resourceId = memoryOptimizer.trackResource({
        id: 'test-resource',
        type: 'buffer',
        size: 1024,
      });

      expect(resourceId).toBe('test-resource');

      const untracked = memoryOptimizer.untrackResource('test-resource');
      expect(untracked).toBe(true);

      // Should return false for non-existent resource
      const notFound = memoryOptimizer.untrackResource('non-existent');
      expect(notFound).toBe(false);
    });

    it('should track stream resources separately', () => {
      memoryOptimizer.trackResource({
        id: 'stream-1',
        type: 'stream',
        size: 2048,
      });

      const metrics = memoryOptimizer.getMemoryMetrics();
      expect(metrics.activeStreams).toBe(1);

      memoryOptimizer.untrackResource('stream-1');
      const updatedMetrics = memoryOptimizer.getMemoryMetrics();
      expect(updatedMetrics.activeStreams).toBe(0);
    });
  });

  describe('memory optimization', () => {
    it('should perform memory optimization', async () => {
      const result = await memoryOptimizer.optimizeMemory();

      expect(result).toHaveProperty('beforeOptimization');
      expect(result).toHaveProperty('afterOptimization');
      expect(result).toHaveProperty('actions');

      expect(Array.isArray(result.actions)).toBe(true);
      expect(typeof result.beforeOptimization.heapUsed).toBe('number');
      expect(typeof result.afterOptimization.heapUsed).toBe('number');
    });

    it('should force garbage collection if available', () => {
      // Mock global.gc
      const originalGc = global.gc;
      global.gc = jest.fn();

      const result = memoryOptimizer.forceGarbageCollection();
      expect(result).toBe(true);
      expect(global.gc).toHaveBeenCalled();

      // Restore original
      global.gc = originalGc;
    });

    it('should handle missing garbage collection gracefully', () => {
      // Ensure gc is not available
      const originalGc = global.gc;
      delete (global as any).gc;

      const result = memoryOptimizer.forceGarbageCollection();
      expect(result).toBe(false);

      // Restore original
      global.gc = originalGc;
    });
  });

  describe('stream processing', () => {
    it('should process large datasets in chunks', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => i);
      const processedItems: number[] = [];

      await memoryOptimizer.createStreamProcessor(
        testData,
        async (chunk: number[]) => {
          processedItems.push(...chunk);
        },
        { chunkSize: 10, concurrency: 2 }
      );

      expect(processedItems).toHaveLength(100);
      expect(processedItems.sort((a, b) => a - b)).toEqual(testData);
    });

    it('should emit progress events during stream processing', async () => {
      const testData = Array.from({ length: 50 }, (_, i) => i);
      const progressEvents: any[] = [];

      memoryOptimizer.on('streamProgress', (progress: any) => {
        progressEvents.push(progress);
      });

      await memoryOptimizer.createStreamProcessor(
        testData,
        async (chunk: number[]) => {
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 10));
        },
        { chunkSize: 10 }
      );

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].processed).toBe(50);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);
    });

    it('should handle stream processing errors', async () => {
      const testData = [1, 2, 3, 4, 5];

      await expect(
        memoryOptimizer.createStreamProcessor(
          testData,
          async (chunk: number[]) => {
            if (chunk.includes(3)) {
              throw new Error('Test error');
            }
          }
        )
      ).rejects.toThrow('Test error');
    });
  });

  describe('memory leak detection', () => {
    it('should detect memory alerts', () => {
      // Create a scenario that would trigger alerts
      memoryOptimizer.start();

      const alerts = memoryOptimizer.detectMemoryLeaks();
      expect(Array.isArray(alerts)).toBe(true);

      // Each alert should have required properties
      alerts.forEach((alert: any) => {
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('timestamp');
        expect(alert).toHaveProperty('recommendations');
        expect(Array.isArray(alert.recommendations)).toBe(true);
      });
    });

    it('should provide optimization recommendations', () => {
      const recommendations = memoryOptimizer.getOptimizationRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('resource cleanup', () => {
    it('should clean up expired resources automatically', async () => {
      memoryOptimizer.start();

      // Track a resource
      memoryOptimizer.trackResource({
        id: 'temp-resource',
        type: 'cache',
        size: 1024,
      });

      // Wait for cleanup interval
      await new Promise(resolve => setTimeout(resolve, 600));

      // Resource should be cleaned up due to maxCacheAge
      const untracked = memoryOptimizer.untrackResource('temp-resource');
      expect(untracked).toBe(false); // Should already be cleaned up
    });
  });

  describe('event handling', () => {
    it('should emit memory alerts when thresholds are exceeded', done => {
      const alertConfig: MemoryConfig = {
        ...testConfig,
        alertThresholds: {
          heapUsage: 0, // Very low threshold to trigger alert
          memoryLeakThreshold: 0,
          largeObjectThreshold: 0,
        },
      };

      const alertOptimizer = new MemoryOptimizer(alertConfig);

      alertOptimizer.on('memoryAlert', (alert: any) => {
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('message');
        alertOptimizer.stop();
        done();
      });

      alertOptimizer.start();
    });
  });
});
