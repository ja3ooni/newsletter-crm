import { MemoryOptimizationIntegration } from '../MemoryOptimizationIntegration';

describe('MemoryOptimizationIntegration', () => {
  let integration: MemoryOptimizationIntegration;

  beforeEach(() => {
    integration = MemoryOptimizationIntegration.getInstance();
  });

  afterEach(async () => {
    await integration.shutdown();
  });

  describe('initialization', () => {
    it('should get singleton instance', () => {
      const instance1 = MemoryOptimizationIntegration.getInstance();
      const instance2 = MemoryOptimizationIntegration.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should initialize service optimization', async () => {
      await integration.initialize('test-service');

      const healthStatus = await integration.getHealthStatus();
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('memory');
      expect(healthStatus).toHaveProperty('alerts');
      expect(healthStatus).toHaveProperty('recommendations');
    });
  });

  describe('resource tracking', () => {
    it('should track and untrack resources', () => {
      const resourceId = integration.trackResource({
        id: 'test-resource',
        type: 'buffer',
        size: 1024,
      });

      expect(resourceId).toBe('test-resource');

      const untracked = integration.untrackResource('test-resource');
      expect(untracked).toBe(true);
    });
  });

  describe('large dataset processing', () => {
    it('should process large datasets efficiently', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => i);
      const processedItems: number[] = [];

      await integration.processLargeDataset(
        testData,
        async (chunk: number[]) => {
          processedItems.push(...chunk);
        },
        { chunkSize: 10, trackProgress: false }
      );

      expect(processedItems).toHaveLength(100);
      expect(processedItems.sort((a, b) => a - b)).toEqual(testData);
    });
  });

  describe('health monitoring', () => {
    it('should provide health status', async () => {
      await integration.initialize('test-service');

      const healthStatus = await integration.getHealthStatus();

      expect(['healthy', 'warning', 'critical']).toContain(healthStatus.status);
      expect(typeof healthStatus.memory.heapUsed).toBe('number');
      expect(Array.isArray(healthStatus.alerts)).toBe(true);
      expect(Array.isArray(healthStatus.recommendations)).toBe(true);
    });

    it('should generate performance reports', async () => {
      await integration.initialize('test-service');

      const report = await integration.getPerformanceReport(1);

      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('summary');
      expect(typeof report.summary.avgMemoryUsage).toBe('number');
    });
  });

  describe('system optimization', () => {
    it('should optimize system resources', async () => {
      await integration.initialize('test-service');

      const result = await integration.optimizeSystem();

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        expect(result).toHaveProperty('results');
      } else {
        expect(result).toHaveProperty('error');
      }
    });
  });
});
