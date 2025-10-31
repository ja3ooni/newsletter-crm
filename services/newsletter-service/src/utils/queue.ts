import { config } from '@/config';
import Bull, { Job, JobOptions, Queue } from 'bull';
import { logger } from './logger';

export interface QueueJobData {
  [key: string]: any;
}

export interface QueueOptions extends JobOptions {
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

class QueueService {
  private queues: Map<string, Queue> = new Map();
  private processors: Map<string, (job: Job<QueueJobData>) => Promise<any>> =
    new Map();

  constructor() {
    // Set up global queue events
    this.setupGlobalEvents();
  }

  createQueue(name: string): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Bull(name, {
      redis: {
        host: config.queue.redis.host,
        port: config.queue.redis.port,
        password: config.queue.redis.password,
      },
      defaultJobOptions: config.queue.defaultJobOptions,
    });

    // Set up queue-specific events
    this.setupQueueEvents(queue, name);

    this.queues.set(name, queue);

    return queue;
  }

  async addJob(
    queueName: string,
    jobName: string,
    data: QueueJobData,
    options: QueueOptions = {}
  ): Promise<Job<QueueJobData>> {
    const queue = this.createQueue(queueName);

    const jobOptions: JobOptions = {
      ...options,
      priority: this.getPriorityValue(options.priority || 'normal'),
    };

    const job = await queue.add(jobName, data, jobOptions);

    logger.info('Job added to queue', {
      queueName,
      jobName,
      jobId: job.id,
      priority: options.priority,
    });

    return job;
  }

  registerProcessor(
    queueName: string,
    processor: (job: Job<QueueJobData>) => Promise<unknown>
  ): void {
    const queue = this.createQueue(queueName);

    this.processors.set(queueName, processor);

    queue.process(config.queue.concurrency, async (job: Job<QueueJobData>) => {
      logger.info('Processing job', {
        queueName,
        jobId: job.id,
        jobName: job.name,
        attempt: job.attemptsMade + 1,
      });

      try {
        const result = await processor(job);

        logger.info('Job completed successfully', {
          queueName,
          jobId: job.id,
          jobName: job.name,
        });

        return result;
      } catch (error) {
        logger.error('Job failed', {
          queueName,
          jobId: job.id,
          jobName: job.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt: job.attemptsMade + 1,
        });
        throw error;
      }
    });
  }

  async getJob(
    queueName: string,
    jobId: string
  ): Promise<Job<QueueJobData> | null> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      return null;
    }

    return await queue.getJob(jobId);
  }

  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed, paused] =
      await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
        queue.getPaused(),
      ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: paused.length,
    };
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    logger.info('Queue paused', { queueName });
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    logger.info('Queue resumed', { queueName });
  }

  async cleanQueue(
    queueName: string,
    grace: number = 0,
    status:
      | 'completed'
      | 'waiting'
      | 'active'
      | 'delayed'
      | 'failed' = 'completed'
  ): Promise<void> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.clean(grace, status);
    logger.info('Queue cleaned', { queueName, status, grace });
  }

  async closeAll(): Promise<void> {
    logger.info('Closing all queues and cleaning up resources');

    try {
      // Close all queues with timeout
      const closePromises = Array.from(this.queues.values()).map(
        async queue => {
          try {
            // Wait for active jobs to complete (with timeout)
            const activeJobs = await queue.getActive();

            if (activeJobs.length > 0) {
              logger.info(
                `Waiting for ${activeJobs.length} active jobs to complete`
              );

              // Wait up to 30 seconds for jobs to complete
              const timeout = 30000;
              const startTime = Date.now();

              while (
                (await queue.getActive()).length > 0 &&
                Date.now() - startTime < timeout
              ) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }

            await queue.close();
            logger.debug('Queue closed successfully', {
              queueName: queue.name,
            });
          } catch (error) {
            logger.error('Error closing queue', {
              queueName: queue.name,
              error,
            });
          }
        }
      );

      await Promise.allSettled(closePromises);

      // Clear collections
      this.queues.clear();
      this.processors.clear();

      logger.info('All queues closed and resources cleaned up');
    } catch (error) {
      logger.error('Error during queue cleanup', error);
      throw error;
    }
  }

  /**
   * Clean up old jobs to prevent memory leaks
   */
  async cleanupOldJobs(): Promise<void> {
    logger.info('Starting cleanup of old jobs across all queues');

    const cleanupPromises = Array.from(this.queues.entries()).map(
      async ([queueName, queue]) => {
        try {
          // Clean completed jobs older than 1 hour
          await queue.clean(3600000, 'completed');

          // Clean failed jobs older than 24 hours
          await queue.clean(86400000, 'failed');

          logger.debug('Queue cleanup completed', { queueName });
        } catch (error) {
          logger.error('Error cleaning queue', { queueName, error });
        }
      }
    );

    await Promise.allSettled(cleanupPromises);
    logger.info('Old jobs cleanup completed');
  }

  /**
   * Get memory usage statistics for all queues
   */
  async getMemoryStats(): Promise<{
    totalQueues: number;
    totalJobs: number;
    queueStats: Array<{
      name: string;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    }>;
  }> {
    const queueStats = [];
    let totalJobs = 0;

    for (const [queueName, queue] of this.queues.entries()) {
      try {
        const stats = await this.getQueueStats(queueName);
        const queueTotal =
          stats.waiting +
          stats.active +
          stats.completed +
          stats.failed +
          stats.delayed;

        queueStats.push({
          name: queueName,
          ...stats,
        });

        totalJobs += queueTotal;
      } catch (error) {
        logger.error('Error getting queue stats', { queueName, error });
      }
    }

    return {
      totalQueues: this.queues.size,
      totalJobs,
      queueStats,
    };
  }

  private getPriorityValue(
    priority: 'low' | 'normal' | 'high' | 'urgent'
  ): number {
    const priorities = {
      low: 1,
      normal: 5,
      high: 10,
      urgent: 20,
    };

    return priorities[priority];
  }

  private setupGlobalEvents(): void {
    // Global error handling with proper cleanup
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, initiating graceful shutdown...`);

      try {
        await this.closeAll();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async error => {
      logger.error('Uncaught exception, performing emergency cleanup', error);
      try {
        await this.closeAll();
      } catch (cleanupError) {
        logger.error('Error during emergency cleanup', cleanupError);
      }
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled rejection, performing emergency cleanup', {
        reason,
        promise,
      });
      try {
        await this.closeAll();
      } catch (cleanupError) {
        logger.error('Error during emergency cleanup', cleanupError);
      }
      process.exit(1);
    });
  }

  private setupQueueEvents(queue: Queue, queueName: string): void {
    queue.on('error', error => {
      logger.error('Queue error', { queueName, error });
    });

    queue.on('waiting', jobId => {
      logger.debug('Job waiting', { queueName, jobId });
    });

    queue.on('active', job => {
      logger.debug('Job active', {
        queueName,
        jobId: job.id,
        jobName: job.name,
      });
    });

    queue.on('stalled', job => {
      logger.warn('Job stalled', {
        queueName,
        jobId: job.id,
        jobName: job.name,
      });
    });

    queue.on('progress', (job, progress) => {
      logger.debug('Job progress', { queueName, jobId: job.id, progress });
    });

    queue.on('completed', (job, result) => {
      logger.debug('Job completed', {
        queueName,
        jobId: job.id,
        jobName: job.name,
      });
    });

    queue.on('failed', (job, error) => {
      logger.error('Job failed', {
        queueName,
        jobId: job.id,
        jobName: job.name,
        error: error.message,
        attempts: job.attemptsMade,
      });
    });

    queue.on('paused', () => {
      logger.info('Queue paused', { queueName });
    });

    queue.on('resumed', () => {
      logger.info('Queue resumed', { queueName });
    });

    queue.on('cleaned', (jobs, type) => {
      logger.info('Queue cleaned', {
        queueName,
        jobsRemoved: jobs.length,
        type,
      });
    });
  }
}

export const queueService = new QueueService();

// Pre-defined queue names
export const QUEUE_NAMES = {
  NEWSLETTER_GENERATION: 'newsletter-generation',
  EMAIL_SENDING: 'email-sending',
  CONTENT_PROCESSING: 'content-processing',
  ANALYTICS_PROCESSING: 'analytics-processing',
  TEMPLATE_PROCESSING: 'template-processing',
  AB_TEST_PROCESSING: 'ab-test-processing',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
