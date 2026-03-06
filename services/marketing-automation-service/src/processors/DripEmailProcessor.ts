// @ts-nocheck
import { DripCampaignService } from '@/services/DripCampaignService';
import { logger } from '@/utils/logger';
import { DripEmailJobData } from '@/utils/queue';
import { Job } from 'bull';

export class DripEmailProcessor {
  private dripCampaignService: DripCampaignService;

  constructor() {
    this.dripCampaignService = new DripCampaignService();
  }

  async processDripEmail(job: Job<DripEmailJobData>): Promise<void> {
    const { subscriptionId, emailIndex, emailId } = job.data;

    try {
      logger.info('Processing drip email job', {
        jobId: job.id,
        subscriptionId,
        emailIndex,
        emailId,
        attempts: job.attemptsMade + 1,
      });

      // Update job progress
      await job.progress(10);

      // Process the drip email
      await this.dripCampaignService.processDripEmail(
        subscriptionId,
        emailIndex,
        emailId
      );

      // Update job progress to completion
      await job.progress(100);

      logger.info('Drip email job completed successfully', {
        jobId: job.id,
        subscriptionId,
        emailIndex,
        emailId,
      });
    } catch (error) {
      logger.error('Drip email job failed', {
        jobId: job.id,
        subscriptionId,
        emailIndex,
        emailId,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: job.attemptsMade + 1,
      });

      // Re-throw error to let Bull handle retries
      throw error;
    }
  }

  async onCompleted(job: Job<DripEmailJobData>, result: any): Promise<void> {
    logger.info('Drip email job completed', {
      jobId: job.id,
      subscriptionId: job.data.subscriptionId,
      emailIndex: job.data.emailIndex,
      emailId: job.data.emailId,
      processingTime: Date.now() - job.processedOn!,
      result,
    });
  }

  async onFailed(job: Job<DripEmailJobData>, error: Error): Promise<void> {
    logger.error('Drip email job failed permanently', {
      jobId: job.id,
      subscriptionId: job.data.subscriptionId,
      emailIndex: job.data.emailIndex,
      emailId: job.data.emailId,
      error: error.message,
      attempts: job.attemptsMade,
      failedReason: job.failedReason,
    });

    // Here you could implement additional failure handling:
    // - Mark subscription as failed
    // - Send notifications to administrators
    // - Retry with different email service
  }

  async onStalled(job: Job<DripEmailJobData>): Promise<void> {
    logger.warn('Drip email job stalled', {
      jobId: job.id,
      subscriptionId: job.data.subscriptionId,
      emailIndex: job.data.emailIndex,
      emailId: job.data.emailId,
      processedOn: job.processedOn,
      stalledInterval: Date.now() - (job.processedOn || 0),
    });
  }

  async onProgress(
    job: Job<DripEmailJobData>,
    progress: number
  ): Promise<void> {
    logger.debug('Drip email job progress', {
      jobId: job.id,
      subscriptionId: job.data.subscriptionId,
      emailIndex: job.data.emailIndex,
      emailId: job.data.emailId,
      progress,
    });
  }
}

export default DripEmailProcessor;
