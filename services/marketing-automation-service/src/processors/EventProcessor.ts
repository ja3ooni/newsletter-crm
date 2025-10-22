import { EventService } from '@/services/EventService';
import { logger } from '@/utils/logger';
import { EventProcessingJobData } from '@/utils/queue';
import { Job } from 'bull';

export class EventProcessor {
  private eventService: EventService;

  constructor() {
    this.eventService = new EventService();
  }

  async processEvent(job: Job<EventProcessingJobData>): Promise<void> {
    const { eventId, eventType } = job.data;

    try {
      logger.info('Processing event job', {
        jobId: job.id,
        eventId,
        eventType,
        attempts: job.attemptsMade + 1
      });

      // Update job progress
      await job.progress(10);

      // Process the event
      await this.eventService.processEvent(eventId);

      // Update job progress to completion
      await job.progress(100);

      logger.info('Event processing job completed successfully', {
        jobId: job.id,
        eventId,
        eventType
      });

    } catch (error) {
      logger.error('Event processing job failed', {
        jobId: job.id,
        eventId,
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: job.attemptsMade + 1
      });

      // Re-throw error to let Bull handle retries
      throw error;
    }
  }

  async onCompleted(job: Job<EventProcessingJobData>, result: any): Promise<void> {
    logger.info('Event processing job completed', {
      jobId: job.id,
      eventId: job.data.eventId,
      eventType: job.data.eventType,
      processingTime: Date.now() - job.processedOn!,
      result
    });
  }

  async onFailed(job: Job<EventProcessingJobData>, error: Error): Promise<void> {
    logger.error('Event processing job failed permanently', {
      jobId: job.id,
      eventId: job.data.eventId,
      eventType: job.data.eventType,
      error: error.message,
      attempts: job.attemptsMade,
      failedReason: job.failedReason
    });

    // Here you could implement additional failure handling:
    // - Mark event as failed in database
    // - Send notifications to administrators
    // - Create dead letter queue for manual processing
  }

  async onStalled(job: Job<EventProcessingJobData>): Promise<void> {
    logger.warn('Event processing job stalled', {
      jobId: job.id,
      eventId: job.data.eventId,
      eventType: job.data.eventType,
      processedOn: job.processedOn,
      stalledInterval: Date.now() - (job.processedOn || 0)
    });
  }

  async onProgress(job: Job<EventProcessingJobData>, progress: number): Promise<void> {
    logger.debug('Event processing job progress', {
      jobId: job.id,
      eventId: job.data.eventId,
      eventType: job.data.eventType,
      progress
    });
  }
}

export default EventProcessor;
