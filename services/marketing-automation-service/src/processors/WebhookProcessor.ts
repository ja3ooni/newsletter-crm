import { config } from '@/config';
import { logger } from '@/utils/logger';
import { WebhookJobData } from '@/utils/queue';
import axios, { AxiosResponse } from 'axios';
import { Job } from 'bull';

export class WebhookProcessor {
  async processWebhook(job: Job<WebhookJobData>): Promise<void> {
    const { url, method, headers, payload, executionId, stepId } = job.data;

    try {
      logger.info('Processing webhook job', {
        jobId: job.id,
        url,
        method,
        executionId,
        stepId,
        attempts: job.attemptsMade + 1,
      });

      // Update job progress
      await job.progress(10);

      // Prepare request configuration
      const requestConfig = {
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DatatechtonCRM-Marketing-Automation/1.0',
          ...headers,
        },
        timeout: config.webhook.timeout,
        validateStatus: (status: number) => status < 500, // Don't throw on 4xx errors
      };

      // Add payload for POST/PUT requests
      if (method === 'POST' || method === 'PUT') {
        (requestConfig as any).data = payload;
      }

      // Update job progress
      await job.progress(50);

      // Make the webhook request
      const response: AxiosResponse = await axios(requestConfig);

      // Update job progress
      await job.progress(90);

      // Log response details
      logger.info('Webhook request completed', {
        jobId: job.id,
        url,
        method,
        statusCode: response.status,
        responseSize: JSON.stringify(response.data).length,
        executionId,
        stepId,
      });

      // Check if response indicates success
      if (response.status >= 400) {
        throw new Error(
          `Webhook returned ${response.status}: ${response.statusText}`
        );
      }

      // Update job progress to completion
      await job.progress(100);

      logger.info('Webhook job completed successfully', {
        jobId: job.id,
        url,
        method,
        statusCode: response.status,
        executionId,
        stepId,
      });
    } catch (error) {
      logger.error('Webhook job failed', {
        jobId: job.id,
        url,
        method,
        executionId,
        stepId,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: job.attemptsMade + 1,
      });

      // Re-throw error to let Bull handle retries
      throw error;
    }
  }

  async onCompleted(job: Job<WebhookJobData>, result: any): Promise<void> {
    logger.info('Webhook job completed', {
      jobId: job.id,
      url: job.data.url,
      method: job.data.method,
      executionId: job.data.executionId,
      stepId: job.data.stepId,
      processingTime: Date.now() - job.processedOn!,
      result,
    });
  }

  async onFailed(job: Job<WebhookJobData>, error: Error): Promise<void> {
    logger.error('Webhook job failed permanently', {
      jobId: job.id,
      url: job.data.url,
      method: job.data.method,
      executionId: job.data.executionId,
      stepId: job.data.stepId,
      error: error.message,
      attempts: job.attemptsMade,
      failedReason: job.failedReason,
    });

    // Here you could implement additional failure handling:
    // - Mark workflow step as failed
    // - Send notifications to administrators
    // - Store failed webhook for manual retry
  }

  async onStalled(job: Job<WebhookJobData>): Promise<void> {
    logger.warn('Webhook job stalled', {
      jobId: job.id,
      url: job.data.url,
      method: job.data.method,
      executionId: job.data.executionId,
      stepId: job.data.stepId,
      processedOn: job.processedOn,
      stalledInterval: Date.now() - (job.processedOn || 0),
    });
  }

  async onProgress(job: Job<WebhookJobData>, progress: number): Promise<void> {
    logger.debug('Webhook job progress', {
      jobId: job.id,
      url: job.data.url,
      method: job.data.method,
      executionId: job.data.executionId,
      stepId: job.data.stepId,
      progress,
    });
  }
}

export default WebhookProcessor;
