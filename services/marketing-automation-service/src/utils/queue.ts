import { config } from '@/config';
import { CampaignSubscription, DripCampaign } from '@/types';
import Bull, { Job, JobOptions, Queue } from 'bull';
import { logger } from './logger';

// Job data interfaces
export interface WorkflowExecutionJobData {
  executionId: string;
  workflowId: string;
  contactId: string;
  currentStep: string;
  metadata?: Record<string, any>;
}

export interface DripEmailJobData {
  subscriptionId: string;
  campaignId: string;
  contactId: string;
  emailIndex: number;
  emailId: string;
}

export interface EventProcessingJobData {
  eventId: string;
  eventType: string;
  contactId: string;
  eventData: Record<string, any>;
}

export interface WebhookJobData {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  payload: Record<string, any>;
  executionId: string;
  stepId: string;
}

class QueueManager {
  private workflowQueue: Queue<WorkflowExecutionJobData>;
  private dripQueue: Queue<DripEmailJobData>;
  private eventQueue: Queue<EventProcessingJobData>;
  private webhookQueue: Queue<WebhookJobData>;

  constructor() {
    const redisConfig = {
      redis: {
        host: config.queue.redis.host,
        port: config.queue.redis.port,
        password: config.queue.redis.password,
        db: config.queue.redis.db,
      },
      defaultJobOptions: config.queue.defaultJobOptions,
    };

    this.workflowQueue = new Bull('workflow-execution', redisConfig);
    this.dripQueue = new Bull('drip-email', redisConfig);
    this.eventQueue = new Bull('event-processing', redisConfig);
    this.webhookQueue = new Bull('webhook', redisConfig);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Workflow queue events
    this.workflowQueue.on(
      'completed',
      (job: Job<WorkflowExecutionJobData>, result: any) => {
        logger.info('Workflow execution job completed', {
          jobId: job.id,
          executionId: job.data.executionId,
        });
      }
    );

    this.workflowQueue.on(
      'failed',
      (job: Job<WorkflowExecutionJobData>, err: Error) => {
        logger.error('Workflow execution job failed', {
          jobId: job.id,
          executionId: job.data.executionId,
          error: err.message,
        });
      }
    );

    // Drip queue events
    this.dripQueue.on(
      'completed',
      (job: Job<DripEmailJobData>, result: any) => {
        logger.info('Drip email job completed', {
          jobId: job.id,
          subscriptionId: job.data.subscriptionId,
        });
      }
    );

    this.dripQueue.on('failed', (job: Job<DripEmailJobData>, err: Error) => {
      logger.error('Drip email job failed', {
        jobId: job.id,
        subscriptionId: job.data.subscriptionId,
        error: err.message,
      });
    });

    // Event queue events
    this.eventQueue.on(
      'completed',
      (job: Job<EventProcessingJobData>, result: any) => {
        logger.info('Event processing job completed', {
          jobId: job.id,
          eventId: job.data.eventId,
        });
      }
    );

    this.eventQueue.on(
      'failed',
      (job: Job<EventProcessingJobData>, err: Error) => {
        logger.error('Event processing job failed', {
          jobId: job.id,
          eventId: job.data.eventId,
          error: err.message,
        });
      }
    );

    // Webhook queue events
    this.webhookQueue.on(
      'completed',
      (job: Job<WebhookJobData>, result: any) => {
        logger.info('Webhook job completed', {
          jobId: job.id,
          url: job.data.url,
        });
      }
    );

    this.webhookQueue.on('failed', (job: Job<WebhookJobData>, err: Error) => {
      logger.error('Webhook job failed', {
        jobId: job.id,
        url: job.data.url,
        error: err.message,
      });
    });
  }

  // Workflow execution methods
  async addWorkflowExecution(
    data: WorkflowExecutionJobData,
    options?: JobOptions
  ): Promise<Job<WorkflowExecutionJobData>> {
    return this.workflowQueue.add('execute-workflow', data, {
      ...options,
      jobId: `workflow-${data.executionId}-${data.currentStep}`,
    });
  }

  async addDelayedWorkflowStep(
    data: WorkflowExecutionJobData,
    delayMs: number
  ): Promise<Job<WorkflowExecutionJobData>> {
    return this.workflowQueue.add('execute-workflow', data, {
      delay: delayMs,
      jobId: `workflow-${data.executionId}-${data.currentStep}-${Date.now()}`,
    });
  }

  // Drip campaign methods
  async addDripEmail(
    data: DripEmailJobData,
    delayMs: number
  ): Promise<Job<DripEmailJobData>> {
    return this.dripQueue.add('send-drip-email', data, {
      delay: delayMs,
      jobId: `drip-${data.subscriptionId}-${data.emailIndex}`,
    });
  }

  async scheduleDripCampaign(
    subscription: CampaignSubscription,
    campaign: DripCampaign
  ): Promise<void> {
    const currentEmail = campaign.emails[subscription.currentEmailIndex];

    if (!currentEmail) {
      logger.warn('No current email found for subscription', {
        subscriptionId: subscription.id,
        currentEmailIndex: subscription.currentEmailIndex,
      });

      return;
    }

    const delayMs = currentEmail.delay * 60 * 60 * 1000; // Convert hours to milliseconds

    await this.addDripEmail(
      {
        subscriptionId: subscription.id,
        campaignId: subscription.campaignId,
        contactId: subscription.contactId,
        emailIndex: subscription.currentEmailIndex,
        emailId: currentEmail.id,
      },
      delayMs
    );
  }

  // Event processing methods
  async addEventProcessing(
    data: EventProcessingJobData
  ): Promise<Job<EventProcessingJobData>> {
    return this.eventQueue.add('process-event', data, {
      priority: this.getEventPriority(data.eventType),
    });
  }

  private getEventPriority(eventType: string): number {
    const priorities: Record<string, number> = {
      signup: 1,
      purchase: 1,
      email_open: 3,
      email_click: 2,
      website_visit: 4,
      form_submit: 2,
      tag_added: 3,
      segment_entry: 3,
    };

    return priorities[eventType] || 5;
  }

  // Webhook methods
  async addWebhook(
    data: WebhookJobData,
    options?: JobOptions
  ): Promise<Job<WebhookJobData>> {
    return this.webhookQueue.add('send-webhook', data, {
      ...options,
      timeout: config.webhook.timeout,
      attempts: config.webhook.retries,
    });
  }

  // Queue management methods
  async pauseWorkflowExecution(executionId: string): Promise<void> {
    const jobs = await this.workflowQueue.getJobs(['waiting', 'delayed']);
    const executionJobs = jobs.filter(
      job => job.data.executionId === executionId
    );

    for (const job of executionJobs) {
      await job.remove();
    }

    logger.info('Paused workflow execution', { executionId });
  }

  async resumeWorkflowExecution(
    executionId: string,
    currentStep: string,
    contactId: string,
    workflowId: string
  ): Promise<void> {
    await this.addWorkflowExecution({
      executionId,
      workflowId,
      contactId,
      currentStep,
    });

    logger.info('Resumed workflow execution', { executionId, currentStep });
  }

  async cancelDripSubscription(subscriptionId: string): Promise<void> {
    const jobs = await this.dripQueue.getJobs(['waiting', 'delayed']);
    const subscriptionJobs = jobs.filter(
      job => job.data.subscriptionId === subscriptionId
    );

    for (const job of subscriptionJobs) {
      await job.remove();
    }

    logger.info('Cancelled drip subscription', { subscriptionId });
  }

  // Health check and monitoring
  async getQueueStats(): Promise<Record<string, any>> {
    const [workflowStats, dripStats, eventStats, webhookStats] =
      await Promise.all([
        this.getQueueCounts(this.workflowQueue),
        this.getQueueCounts(this.dripQueue),
        this.getQueueCounts(this.eventQueue),
        this.getQueueCounts(this.webhookQueue),
      ]);

    return {
      workflow: workflowStats,
      drip: dripStats,
      event: eventStats,
      webhook: webhookStats,
    };
  }

  private async getQueueCounts(queue: Queue): Promise<Record<string, number>> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await Promise.all([
        this.workflowQueue.isReady(),
        this.dripQueue.isReady(),
        this.eventQueue.isReady(),
        this.webhookQueue.isReady(),
      ]);

      return true;
    } catch (error) {
      logger.error('Queue health check failed', error);

      return false;
    }
  }

  // Cleanup methods
  async close(): Promise<void> {
    await Promise.all([
      this.workflowQueue.close(),
      this.dripQueue.close(),
      this.eventQueue.close(),
      this.webhookQueue.close(),
    ]);
    logger.info('All queues closed');
  }

  // Getters for processors
  getWorkflowQueue(): Queue<WorkflowExecutionJobData> {
    return this.workflowQueue;
  }

  getDripQueue(): Queue<DripEmailJobData> {
    return this.dripQueue;
  }

  getEventQueue(): Queue<EventProcessingJobData> {
    return this.eventQueue;
  }

  getWebhookQueue(): Queue<WebhookJobData> {
    return this.webhookQueue;
  }
}

export const queueManager = new QueueManager();
export default queueManager;
