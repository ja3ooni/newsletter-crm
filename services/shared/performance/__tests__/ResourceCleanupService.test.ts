import { EventEmitter } from 'events';
import {
  CleanupTaskFactory,
  ResourceCleanupService,
} from '../ResourceCleanupService';

describe('ResourceCleanupService', () => {
  let cleanupService: ResourceCleanupService;

  beforeEach(() => {
    cleanupService = new ResourceCleanupService();
  });

  afterEach(async () => {
    await cleanupService.gracefulShutdown();
  });

  describe('task registration', () => {
    it('should register cleanup tasks', () => {
      const taskId = cleanupService.registerCleanupTask({
        name: 'Test Task',
        type: 'custom',
        priority: 'normal',
        cleanup: () => {
          // Test cleanup function
        },
      });

      expect(typeof taskId).toBe('string');
      expect(taskId).toMatch(/^cleanup_/);

      const tasks = cleanupService.getCleanupTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('Test Task');
    });

    it('should unregister cleanup tasks', () => {
      const taskId = cleanupService.registerCleanupTask({
        name: 'Test Task',
        type: 'custom',
        priority: 'normal',
        cleanup: () => {},
      });

      expect(cleanupService.getCleanupTasks()).toHaveLength(1);

      const removed = cleanupService.unregisterCleanupTask(taskId);
      expect(removed).toBe(true);
      expect(cleanupService.getCleanupTasks()).toHaveLength(0);

      // Try to remove non-existent task
      const notFound = cleanupService.unregisterCleanupTask('non-existent');
      expect(notFound).toBe(false);
    });
  });

  describe('task execution', () => {
    it('should execute individual cleanup tasks', async () => {
      let executed = false;

      const taskId = cleanupService.registerCleanupTask({
        name: 'Test Task',
        type: 'custom',
        priority: 'normal',
        cleanup: () => {
          executed = true;
        },
      });

      const result = await cleanupService.executeCleanupTask(taskId);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(taskId);
      expect(typeof result.duration).toBe('number');
      expect(executed).toBe(true);
    });

    it('should handle task execution errors', async () => {
      const taskId = cleanupService.registerCleanupTask({
        name: 'Failing Task',
        type: 'custom',
        priority: 'normal',
        cleanup: () => {
          throw new Error('Test error');
        },
      });

      const result = await cleanupService.executeCleanupTask(taskId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should execute all cleanup tasks', async () => {
      let task1Executed = false;
      let task2Executed = false;

      cleanupService.registerCleanupTask({
        name: 'Task 1',
        type: 'custom',
        priority: 'high',
        cleanup: () => {
          task1Executed = true;
        },
      });

      cleanupService.registerCleanupTask({
        name: 'Task 2',
        type: 'custom',
        priority: 'low',
        cleanup: () => {
          task2Executed = true;
        },
      });

      const results = await cleanupService.executeAllCleanupTasks();

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(task1Executed).toBe(true);
      expect(task2Executed).toBe(true);

      // High priority task should execute first
      expect(results[0].taskId).toContain('cleanup_');
    });

    it('should execute tasks by type', async () => {
      let timerExecuted = false;
      let cacheExecuted = false;

      cleanupService.registerCleanupTask({
        name: 'Timer Task',
        type: 'timer',
        priority: 'normal',
        cleanup: () => {
          timerExecuted = true;
        },
      });

      cleanupService.registerCleanupTask({
        name: 'Cache Task',
        type: 'cache',
        priority: 'normal',
        cleanup: () => {
          cacheExecuted = true;
        },
      });

      const results = await cleanupService.executeCleanupByType('timer');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(timerExecuted).toBe(true);
      expect(cacheExecuted).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should provide cleanup statistics', async () => {
      cleanupService.registerCleanupTask({
        name: 'Test Task',
        type: 'custom',
        priority: 'normal',
        cleanup: () => {},
      });

      await cleanupService.executeAllCleanupTasks();

      const stats = cleanupService.getCleanupStats();

      expect(stats).toHaveProperty('totalTasks');
      expect(stats).toHaveProperty('completedTasks');
      expect(stats).toHaveProperty('failedTasks');
      expect(stats).toHaveProperty('averageCleanupTime');
      expect(stats).toHaveProperty('lastCleanupTime');

      expect(stats.totalTasks).toBe(1);
      expect(stats.completedTasks).toBe(1);
      expect(stats.failedTasks).toBe(0);
    });
  });

  describe('event handling', () => {
    it('should emit task completion events', done => {
      cleanupService.on('taskCompleted', result => {
        expect(result.success).toBe(true);
        done();
      });

      const taskId = cleanupService.registerCleanupTask({
        name: 'Test Task',
        type: 'custom',
        priority: 'normal',
        cleanup: () => {},
      });

      cleanupService.executeCleanupTask(taskId);
    });

    it('should emit task failure events', done => {
      cleanupService.on('taskFailed', result => {
        expect(result.success).toBe(false);
        expect(result.error).toBe('Test error');
        done();
      });

      const taskId = cleanupService.registerCleanupTask({
        name: 'Failing Task',
        type: 'custom',
        priority: 'normal',
        cleanup: () => {
          throw new Error('Test error');
        },
      });

      cleanupService.executeCleanupTask(taskId);
    });
  });
});

describe('CleanupTaskFactory', () => {
  describe('timer cleanup', () => {
    it('should create timer cleanup tasks', () => {
      const timerId = setTimeout(() => {}, 1000);

      const task = CleanupTaskFactory.createTimerCleanup(timerId, 'test-timer');

      expect(task.name).toBe('Timer: test-timer');
      expect(task.type).toBe('timer');
      expect(task.priority).toBe('normal');
      expect(typeof task.cleanup).toBe('function');

      // Cleanup the timer
      clearTimeout(timerId);
    });
  });

  describe('event emitter cleanup', () => {
    it('should create event emitter cleanup tasks', () => {
      const emitter = new EventEmitter();
      emitter.on('test', () => {});

      const task = CleanupTaskFactory.createEventEmitterCleanup(
        emitter,
        'test-emitter'
      );

      expect(task.name).toBe('EventEmitter: test-emitter');
      expect(task.type).toBe('event_listener');
      expect(task.priority).toBe('normal');
      expect(typeof task.cleanup).toBe('function');
    });
  });

  describe('connection cleanup', () => {
    it('should create connection cleanup tasks', () => {
      const connection = {
        close: jest.fn().mockResolvedValue(undefined),
      };

      const task = CleanupTaskFactory.createConnectionCleanup(
        connection,
        'test-connection'
      );

      expect(task.name).toBe('Connection: test-connection');
      expect(task.type).toBe('connection');
      expect(task.priority).toBe('high');
      expect(typeof task.cleanup).toBe('function');
    });
  });

  describe('cache cleanup', () => {
    it('should create cache cleanup tasks', () => {
      const cache = {
        clear: jest.fn(),
      };

      const task = CleanupTaskFactory.createCacheCleanup(cache, 'test-cache');

      expect(task.name).toBe('Cache: test-cache');
      expect(task.type).toBe('cache');
      expect(task.priority).toBe('normal');
      expect(typeof task.cleanup).toBe('function');
    });
  });
});
