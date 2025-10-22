import { WorkflowService } from '@/services/WorkflowService';
import { logger } from '@/utils/logger';
import { WorkflowExecutionJobData } from '@/utils/queue';
import { Job } from 'bull';

export class WorkflowProcessor {
  private workflowService: WorkflowService;

  constructor() {
    this.workflowService = new WorkflowService();
  }

  async processWorkflowExecution(job: Job<WorkflowExecutionJobData>): Promise<void> {
    const { executionId, currentStep } = job.data;

    try {
      logger.info('Processing workflow execution job', {
        jobId: job.id,
        executionId,
        currentStep,
        attempts: job.attemptsMade + 1
      });

      // Update job progress
      await job.progress(10);

      // Execute the workflow step
      await this.workflowService.executeWorkflowStep(executionId, currentStep);

      // Update job progress to completion
      await job.progress(100);

      logger.info('Workflow execution job completed successfully', {
        jobId: job.id,
        executionId,
        currentStep
      });

    } catch (error) {
      logger.error('Workflow execution job failed', {
        jobId: job.id,
        executionId,
        currentStep,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: job.attemptsMade + 1
      });

      // Re-throw error to let Bull handle retries
      throw error;
    }
  }

  async onCompleted(job: Job<WorkflowExecutionJobData>, result: any): Promise<void> {
    logger.info('Workflow execution job completed', {
      jobId: job.id,
      executionId: job.data.executionId,
      currentStep: job.data.currentStep,
      processingTime: Date.now() - job.processedOn!,
      result
    });
  }

  async onFailed(job: Job<WorkflowExecutionJobData>, error: Error): Promise<void> {
    logger.error('Workflow execution job failed permanently', {
      jobId: job.id,
      executionId: job.data.executionId,
      currentStep: job.data.currentStep,
      error: error.message,
      attempts: job.attemptsMade,
      failedReason: job.failedReason
    });

    // Here you could implement additional failure handling:
    // - Send notifications
    // - Update execution status in database
    // - Trigger error workflows
  }

  async onStalled(job: Job<WorkflowExecutionJobData>): Promise<void> {
    logger.warn('Workflow execution job stalled', {
      jobId: job.id,
      executionId: job.data.executionId,
      currentStep: job.data.currentStep,
      processedOn: job.processedOn,
      stalledInterval: Date.now() - (job.processedOn || 0)
    });
  }

  async onProgress(job: Job<WorkflowExecutionJobData>, progress: number): Promise<void> {
    logger.debug('Workflow execution job progress', {
      jobId: job.id,
      executionId: job.data.executionId,
      currentStep: job.data.currentStep,
      progress
    });
  }
}

export default WorkflowProcessor;
