import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface CleanupTask {
  id: string;
  name: string;
  type:
    | 'timer'
    | 'connection'
    | 'stream'
    | 'cache'
    | 'event_listener'
    | 'custom';
  cleanup: () => Promise<void> | void;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number; // milliseconds
  createdAt: number;
  metadata?: Record<string, any>;
}

export interface CleanupResult {
  taskId: string;
  success: boolean;
  duration: number;
  error?: string;
}

export interface CleanupStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageCleanupTime: number;
  lastCleanupTime: number;
}

export class ResourceCleanupService extends EventEmitter {
  private cleanupTasks = new Map<string, CleanupTask>();
  private cleanupHistory: CleanupResult[] = [];
  private isShuttingDown = false;
  private cleanupTimeout = 30000; // 30 seconds default timeout
  private maxHistorySize = 1000;

  constructor() {
    super();
    this.setupGracefulShutdown();
  }

  /**
   * Register a cleanup task
   */
  registerCleanupTask(task: Omit<CleanupTask, 'id' | 'createdAt'>): string {
    const taskId = `cleanup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const cleanupTask: CleanupTask = {
      ...task,
      id: taskId,
      createdAt: Date.now(),
    };

    this.cleanupTasks.set(taskId, cleanupTask);

    logger.debug('Cleanup task registered', {
      taskId,
      name: task.name,
      type: task.type,
      priority: task.priority,
    });

    return taskId;
  }

  /**
   * Unregister a cleanup task
   */
  unregisterCleanupTask(taskId: string): boolean {
    const removed = this.cleanupTasks.delete(taskId);

    if (removed) {
      logger.debug('Cleanup task unregistered', { taskId });
    }

    return removed;
  }

  /**
   * Execute a specific cleanup task
   */
  async executeCleanupTask(taskId: string): Promise<CleanupResult> {
    const task = this.cleanupTasks.get(taskId);

    if (!task) {
      throw new Error(`Cleanup task ${taskId} not found`);
    }

    return this.executeTask(task);
  }

  /**
   * Execute all cleanup tasks
   */
  async executeAllCleanupTasks(): Promise<CleanupResult[]> {
    const tasks = Array.from(this.cleanupTasks.values());

    // Sort by priority (critical first)
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const results: CleanupResult[] = [];

    for (const task of tasks) {
      try {
        const result = await this.executeTask(task);
        results.push(result);
      } catch (error) {
        const result: CleanupResult = {
          taskId: task.id,
          success: false,
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Execute cleanup tasks by type
   */
  async executeCleanupByType(
    type: CleanupTask['type']
  ): Promise<CleanupResult[]> {
    const tasks = Array.from(this.cleanupTasks.values()).filter(
      task => task.type === type
    );
    const results: CleanupResult[] = [];

    for (const task of tasks) {
      try {
        const result = await this.executeTask(task);
        results.push(result);
      } catch (error) {
        const result: CleanupResult = {
          taskId: task.id,
          success: false,
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats(): CleanupStats {
    const completedTasks = this.cleanupHistory.filter(r => r.success).length;
    const failedTasks = this.cleanupHistory.filter(r => !r.success).length;
    const totalDuration = this.cleanupHistory.reduce(
      (sum, r) => sum + r.duration,
      0
    );
    const averageCleanupTime =
      this.cleanupHistory.length > 0
        ? totalDuration / this.cleanupHistory.length
        : 0;
    const lastCleanupTime =
      this.cleanupHistory.length > 0
        ? Math.max(...this.cleanupHistory.map(r => Date.now()))
        : 0;

    return {
      totalTasks: this.cleanupTasks.size,
      completedTasks,
      failedTasks,
      averageCleanupTime,
      lastCleanupTime,
    };
  }

  /**
   * Get registered cleanup tasks
   */
  getCleanupTasks(): CleanupTask[] {
    return Array.from(this.cleanupTasks.values());
  }

  /**
   * Get cleanup history
   */
  getCleanupHistory(): CleanupResult[] {
    return [...this.cleanupHistory];
  }

  /**
   * Clear cleanup history
   */
  clearCleanupHistory(): void {
    this.cleanupHistory = [];
    logger.info('Cleanup history cleared');
  }

  /**
   * Perform graceful shutdown with cleanup
   */
  async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown with resource cleanup');

    try {
      const results = await this.executeAllCleanupTasks();
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      logger.info('Graceful shutdown completed', {
        totalTasks: results.length,
        successful,
        failed,
      });

      this.emit('shutdownComplete', { successful, failed, results });
    } catch (error) {
      logger.error('Error during graceful shutdown', error);
      this.emit('shutdownError', error);
    }
  }

  /**
   * Execute a single cleanup task with timeout and error handling
   */
  private async executeTask(task: CleanupTask): Promise<CleanupResult> {
    const startTime = Date.now();
    const timeout = task.timeout || this.cleanupTimeout;

    logger.debug('Executing cleanup task', {
      taskId: task.id,
      name: task.name,
      type: task.type,
      timeout,
    });

    try {
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`Cleanup task ${task.name} timed out after ${timeout}ms`)
          );
        }, timeout);
      });

      // Race between cleanup and timeout
      await Promise.race([Promise.resolve(task.cleanup()), timeoutPromise]);

      const duration = Date.now() - startTime;
      const result: CleanupResult = {
        taskId: task.id,
        success: true,
        duration,
      };

      this.addToHistory(result);
      this.emit('taskCompleted', result);

      logger.debug('Cleanup task completed successfully', {
        taskId: task.id,
        name: task.name,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      const result: CleanupResult = {
        taskId: task.id,
        success: false,
        duration,
        error: errorMessage,
      };

      this.addToHistory(result);
      this.emit('taskFailed', result);

      logger.error('Cleanup task failed', {
        taskId: task.id,
        name: task.name,
        duration,
        error: errorMessage,
      });

      return result;
    }
  }

  /**
   * Add result to cleanup history
   */
  private addToHistory(result: CleanupResult): void {
    this.cleanupHistory.push(result);

    // Keep history size manageable
    if (this.cleanupHistory.length > this.maxHistorySize) {
      this.cleanupHistory = this.cleanupHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdownHandler = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown`);
      await this.gracefulShutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async error => {
      logger.error('Uncaught exception, performing emergency cleanup', error);
      await this.gracefulShutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled rejection, performing emergency cleanup', {
        reason,
        promise,
      });
      await this.gracefulShutdown();
      process.exit(1);
    });
  }
}

/**
 * Helper function to create cleanup tasks for common resources
 */
export class CleanupTaskFactory {
  /**
   * Create cleanup task for timers
   */
  static createTimerCleanup(
    timerId: NodeJS.Timeout,
    name: string,
    priority: CleanupTask['priority'] = 'normal'
  ): Omit<CleanupTask, 'id' | 'createdAt'> {
    return {
      name: `Timer: ${name}`,
      type: 'timer',
      priority,
      cleanup: () => {
        clearTimeout(timerId);
        clearInterval(timerId);
      },
      metadata: { timerId: timerId.toString() },
    };
  }

  /**
   * Create cleanup task for event emitters
   */
  static createEventEmitterCleanup(
    emitter: EventEmitter,
    name: string,
    priority: CleanupTask['priority'] = 'normal'
  ): Omit<CleanupTask, 'id' | 'createdAt'> {
    return {
      name: `EventEmitter: ${name}`,
      type: 'event_listener',
      priority,
      cleanup: () => {
        emitter.removeAllListeners();
      },
      metadata: { listenerCount: emitter.listenerCount('*') },
    };
  }

  /**
   * Create cleanup task for streams
   */
  static createStreamCleanup(
    stream: NodeJS.ReadableStream | NodeJS.WritableStream,
    name: string,
    priority: CleanupTask['priority'] = 'high'
  ): Omit<CleanupTask, 'id' | 'createdAt'> {
    return {
      name: `Stream: ${name}`,
      type: 'stream',
      priority,
      cleanup: async () => {
        if ('destroy' in stream && typeof stream.destroy === 'function') {
          stream.destroy();
        }
        if ('end' in stream && typeof stream.end === 'function') {
          stream.end();
        }
      },
      metadata: { streamType: stream.constructor.name },
    };
  }

  /**
   * Create cleanup task for database connections
   */
  static createConnectionCleanup(
    connection: {
      close?: () => Promise<void> | void;
      end?: () => Promise<void> | void;
    },
    name: string,
    priority: CleanupTask['priority'] = 'high'
  ): Omit<CleanupTask, 'id' | 'createdAt'> {
    return {
      name: `Connection: ${name}`,
      type: 'connection',
      priority,
      cleanup: async () => {
        if (connection.close) {
          await Promise.resolve(connection.close());
        } else if (connection.end) {
          await Promise.resolve(connection.end());
        }
      },
    };
  }

  /**
   * Create cleanup task for caches
   */
  static createCacheCleanup(
    cache: { clear?: () => void; flush?: () => Promise<void> | void },
    name: string,
    priority: CleanupTask['priority'] = 'normal'
  ): Omit<CleanupTask, 'id' | 'createdAt'> {
    return {
      name: `Cache: ${name}`,
      type: 'cache',
      priority,
      cleanup: async () => {
        if (cache.clear) {
          cache.clear();
        } else if (cache.flush) {
          await Promise.resolve(cache.flush());
        }
      },
    };
  }
}

// Export singleton instance
export const resourceCleanupService = new ResourceCleanupService();
