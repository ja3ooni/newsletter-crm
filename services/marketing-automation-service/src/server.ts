// @ts-nocheck
import app from '@/app';
import { config } from '@/config';
import DripEmailProcessor from '@/processors/DripEmailProcessor';
import EventProcessor from '@/processors/EventProcessor';
import WebhookProcessor from '@/processors/WebhookProcessor';
import WorkflowProcessor from '@/processors/WorkflowProcessor';
import { database } from '@/utils/database';
import { logger } from '@/utils/logger';
import { queueManager } from '@/utils/queue';

class Server {
  private workflowProcessor: WorkflowProcessor;
  private dripEmailProcessor: DripEmailProcessor;
  private eventProcessor: EventProcessor;
  private webhookProcessor: WebhookProcessor;

  constructor() {
    this.workflowProcessor = new WorkflowProcessor();
    this.dripEmailProcessor = new DripEmailProcessor();
    this.eventProcessor = new EventProcessor();
    this.webhookProcessor = new WebhookProcessor();
  }

  async start(): Promise<void> {
    try {
      // Test database connection
      const dbHealthy = await database.healthCheck();

      if (!dbHealthy) {
        throw new Error('Database connection failed');
      }
      logger.info('Database connection established');

      // Test queue connection
      const queueHealthy = await queueManager.healthCheck();

      if (!queueHealthy) {
        throw new Error('Queue connection failed');
      }
      logger.info('Queue connection established');

      // Set up queue processors
      this.setupQueueProcessors();

      // Start HTTP server
      const server = app.listen(config.port, () => {
        logger.info(`Marketing Automation Service started`, {
          port: config.port,
          environment: config.nodeEnv,
          version: '1.0.0',
        });
      });

      // Graceful shutdown handling
      const gracefulShutdown = async (signal: string) => {
        logger.info(`${signal} received, starting graceful shutdown`);

        // Stop accepting new connections
        server.close(async () => {
          logger.info('HTTP server closed');

          try {
            // Close queue connections
            await queueManager.close();
            logger.info('Queue connections closed');

            // Close database connections
            await database.close();
            logger.info('Database connections closed');

            logger.info('Graceful shutdown completed');
            process.exit(0);
          } catch (error) {
            logger.error('Error during graceful shutdown', error);
            process.exit(1);
          }
        });

        // Force shutdown after 30 seconds
        setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
        }, 30000);
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  private setupQueueProcessors(): void {
    // Workflow execution processor
    const workflowQueue = queueManager.getWorkflowQueue();

    workflowQueue.process(
      'execute-workflow',
      5,
      this.workflowProcessor.processWorkflowExecution.bind(
        this.workflowProcessor
      )
    );

    workflowQueue.on(
      'completed',
      this.workflowProcessor.onCompleted.bind(this.workflowProcessor)
    );
    workflowQueue.on(
      'failed',
      this.workflowProcessor.onFailed.bind(this.workflowProcessor)
    );
    workflowQueue.on(
      'stalled',
      this.workflowProcessor.onStalled.bind(this.workflowProcessor)
    );
    workflowQueue.on(
      'progress',
      this.workflowProcessor.onProgress.bind(this.workflowProcessor)
    );

    // Drip email processor
    const dripQueue = queueManager.getDripQueue();

    dripQueue.process(
      'send-drip-email',
      10,
      this.dripEmailProcessor.processDripEmail.bind(this.dripEmailProcessor)
    );

    dripQueue.on(
      'completed',
      this.dripEmailProcessor.onCompleted.bind(this.dripEmailProcessor)
    );
    dripQueue.on(
      'failed',
      this.dripEmailProcessor.onFailed.bind(this.dripEmailProcessor)
    );
    dripQueue.on(
      'stalled',
      this.dripEmailProcessor.onStalled.bind(this.dripEmailProcessor)
    );
    dripQueue.on(
      'progress',
      this.dripEmailProcessor.onProgress.bind(this.dripEmailProcessor)
    );

    // Event processor
    const eventQueue = queueManager.getEventQueue();

    eventQueue.process(
      'process-event',
      20,
      this.eventProcessor.processEvent.bind(this.eventProcessor)
    );

    eventQueue.on(
      'completed',
      this.eventProcessor.onCompleted.bind(this.eventProcessor)
    );
    eventQueue.on(
      'failed',
      this.eventProcessor.onFailed.bind(this.eventProcessor)
    );
    eventQueue.on(
      'stalled',
      this.eventProcessor.onStalled.bind(this.eventProcessor)
    );
    eventQueue.on(
      'progress',
      this.eventProcessor.onProgress.bind(this.eventProcessor)
    );

    // Webhook processor
    const webhookQueue = queueManager.getWebhookQueue();

    webhookQueue.process(
      'send-webhook',
      15,
      this.webhookProcessor.processWebhook.bind(this.webhookProcessor)
    );

    webhookQueue.on(
      'completed',
      this.webhookProcessor.onCompleted.bind(this.webhookProcessor)
    );
    webhookQueue.on(
      'failed',
      this.webhookProcessor.onFailed.bind(this.webhookProcessor)
    );
    webhookQueue.on(
      'stalled',
      this.webhookProcessor.onStalled.bind(this.webhookProcessor)
    );
    webhookQueue.on(
      'progress',
      this.webhookProcessor.onProgress.bind(this.webhookProcessor)
    );

    logger.info('Queue processors set up successfully', {
      workflowConcurrency: 5,
      dripEmailConcurrency: 10,
      eventConcurrency: 20,
      webhookConcurrency: 15,
    });
  }
}

// Start the server
const server = new Server();

server.start().catch(error => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
