/**
 * Marketing Automation Service Inter-Service Communication
 * Handles events and communication with other services
 */

import {
  EventCoordinator,
  createEventCoordinator,
  defaultEventCoordinatorConfig,
} from '../../../../infrastructure/utils/event-coordinator';
import {
  initializeServiceDiscovery,
  setupGracefulShutdown,
} from '../../../../infrastructure/utils/service-discovery';
import { config } from '../config';
import { logger } from './logger';

export class MarketingAutomationServiceCommunication {
  private eventCoordinator: EventCoordinator;
  private serviceInstance: any;

  constructor() {
    // Initialize event coordinator
    this.eventCoordinator = createEventCoordinator({
      ...defaultEventCoordinatorConfig,
      serviceName: 'marketing-automation-service',
      messagebus: {
        url: config.rabbitmq.url,
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Initialize inter-service communication
   */
  async initialize(): Promise<void> {
    try {
      // Register service with service discovery
      this.serviceInstance = initializeServiceDiscovery({
        serviceName: 'marketing-automation-service',
        version: '1.0.0',
        host: config.server.host || 'localhost',
        port: config.server.port,
        protocol: 'http',
        healthCheckPath: '/health',
        healthCheckInterval: 30000,
        healthCheckTimeout: 5000,
        unhealthyThreshold: 3,
        metadata: {
          description: 'Marketing automation and workflow service',
          capabilities: [
            'workflows',
            'drip-campaigns',
            'event-processing',
            'webhooks',
          ],
        },
        tags: ['automation', 'marketing', 'workflows', 'campaigns'],
      });

      // Initialize event coordinator
      await this.eventCoordinator.initialize();

      // Setup graceful shutdown
      setupGracefulShutdown(
        'marketing-automation-service',
        this.serviceInstance.id
      );

      logger.info(
        'Marketing automation service inter-service communication initialized'
      );
    } catch (error) {
      logger.error('Failed to initialize inter-service communication:', error);
      throw error;
    }
  }

  /**
   * Publish marketing automation events
   */
  async publishWorkflowStarted(
    workflowId: string,
    executionId: string,
    contactId: string
  ): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'automation.workflow_started',
      source: 'marketing-automation-service',
      data: {
        workflowId,
        executionId,
        contactId,
        startedAt: new Date(),
      },
    });
  }

  async publishWorkflowCompleted(
    workflowId: string,
    executionId: string,
    contactId: string,
    result: any
  ): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'automation.workflow_completed',
      source: 'marketing-automation-service',
      data: {
        workflowId,
        executionId,
        contactId,
        result,
        completedAt: new Date(),
      },
    });
  }

  async publishWorkflowFailed(
    workflowId: string,
    executionId: string,
    contactId: string,
    error: any
  ): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'automation.workflow_failed',
      source: 'marketing-automation-service',
      data: {
        workflowId,
        executionId,
        contactId,
        error: error.message,
        failedAt: new Date(),
      },
    });
  }

  async publishDripEmailSent(
    campaignId: string,
    contactId: string,
    emailId: string
  ): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'automation.drip_email_sent',
      source: 'marketing-automation-service',
      data: {
        campaignId,
        contactId,
        emailId,
        sentAt: new Date(),
      },
    });
  }

  async publishEventProcessed(
    eventId: string,
    eventType: string,
    contactId: string,
    result: any
  ): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'automation.event_processed',
      source: 'marketing-automation-service',
      data: {
        eventId,
        eventType,
        contactId,
        result,
        processedAt: new Date(),
      },
    });
  }

  /**
   * Call other services
   */
  async sendEmail(contactId: string, emailData: any): Promise<any> {
    return await this.eventCoordinator.callService(
      'newsletter-service',
      '/api/v1/emails/send',
      {
        method: 'POST',
        data: {
          contactId,
          ...emailData,
          source: 'marketing-automation',
        },
      }
    );
  }

  async getContactData(contactId: string): Promise<any> {
    return await this.eventCoordinator.callService(
      'crm-service',
      `/api/v1/contacts/${contactId}`,
      {
        method: 'GET',
      }
    );
  }

  async updateContactTags(contactId: string, tags: string[]): Promise<void> {
    await this.eventCoordinator.callService(
      'crm-service',
      `/api/v1/contacts/${contactId}/tags`,
      {
        method: 'PUT',
        data: { tags },
      }
    );
  }

  async updateLeadScore(
    contactId: string,
    scoreChange: number,
    reason: string
  ): Promise<void> {
    await this.eventCoordinator.callService(
      'crm-service',
      `/api/v1/contacts/${contactId}/score`,
      {
        method: 'PUT',
        data: {
          scoreChange,
          reason,
          source: 'marketing-automation',
        },
      }
    );
  }

  async trackEvent(
    contactId: string,
    eventType: string,
    eventData: any
  ): Promise<void> {
    await this.eventCoordinator.callService(
      'analytics-service',
      '/api/v1/events',
      {
        method: 'POST',
        data: {
          contactId,
          eventType,
          eventData,
          source: 'marketing-automation',
          timestamp: new Date(),
        },
      }
    );
  }

  async sendWebhook(
    url: string,
    data: any,
    headers?: Record<string, string>
  ): Promise<any> {
    // This could be handled internally or via a webhook service
    return await this.eventCoordinator.callService(
      'webhook-service',
      '/api/v1/send',
      {
        method: 'POST',
        data: {
          url,
          method: 'POST',
          headers: headers || {},
          payload: data,
        },
      }
    );
  }

  /**
   * Get service health status
   */
  getHealthStatus(): any {
    return this.eventCoordinator.getHealthStatus();
  }

  /**
   * Shutdown inter-service communication
   */
  async shutdown(): Promise<void> {
    await this.eventCoordinator.shutdown();
  }

  /**
   * Setup event handlers for incoming events
   */
  private setupEventHandlers(): void {
    // Handle CRM contact events for workflow triggers
    this.eventCoordinator.subscribeToEvent(
      'crm.contact_created',
      async event => {
        logger.info('Contact created, checking workflow triggers', {
          contactId: event.data.contactId,
          source: event.data.source,
        });

        // Check for workflows that should trigger on contact creation
        // This would call your workflow service methods
        await this.checkAndTriggerWorkflows('contact_created', event.data);
      }
    );

    this.eventCoordinator.subscribeToEvent(
      'crm.contact_segment_changed',
      async event => {
        logger.info('Contact segment changed, checking workflow triggers', {
          contactId: event.data.contactId,
          addedSegments: event.data.addedSegments,
        });

        // Trigger workflows for new segments
        for (const segment of event.data.addedSegments) {
          await this.checkAndTriggerWorkflows('segment_entry', {
            contactId: event.data.contactId,
            segment,
          });
        }
      }
    );

    this.eventCoordinator.subscribeToEvent(
      'crm.lead_score_changed',
      async event => {
        logger.info('Lead score changed, checking workflow triggers', {
          contactId: event.data.contactId,
          newScore: event.data.newScore,
        });

        // Trigger workflows based on score thresholds
        await this.checkAndTriggerWorkflows('score_threshold', event.data);
      }
    );

    // Handle user events for automation triggers
    this.eventCoordinator.subscribeToEvent('user.registered', async event => {
      logger.info('User registered, starting welcome workflow', {
        userId: event.userId,
        email: event.data.email,
      });

      // Start welcome workflow for new users
      await this.checkAndTriggerWorkflows('user_registered', event.data);
    });

    this.eventCoordinator.subscribeToEvent(
      'user.subscription_changed',
      async event => {
        logger.info('Subscription changed, checking automation triggers', {
          userId: event.userId,
          newPlan: event.data.newPlan,
        });

        // Trigger workflows for subscription changes (upgrade/downgrade)
        await this.checkAndTriggerWorkflows('subscription_changed', event.data);
      }
    );

    // Handle newsletter engagement events
    this.eventCoordinator.subscribeToEvent(
      'newsletter.email_opened',
      async event => {
        logger.info('Email opened, processing engagement', {
          contactId: event.data.contactId,
          newsletterId: event.data.newsletterId,
        });

        // Process email engagement for workflows and scoring
        await this.processEngagementEvent('email_opened', event.data);
      }
    );

    this.eventCoordinator.subscribeToEvent(
      'newsletter.email_clicked',
      async event => {
        logger.info('Email clicked, processing engagement', {
          contactId: event.data.contactId,
          newsletterId: event.data.newsletterId,
          linkUrl: event.data.linkUrl,
        });

        // Process email click for workflows and scoring
        await this.processEngagementEvent('email_clicked', event.data);
      }
    );

    // Handle content engagement events
    this.eventCoordinator.subscribeToEvent(
      'content.article_viewed',
      async event => {
        logger.info('Content viewed, processing engagement', {
          contactId: event.data.contactId,
          articleId: event.data.articleId,
        });

        // Process content engagement
        await this.processEngagementEvent('content_viewed', event.data);
      }
    );

    // Handle analytics events
    this.eventCoordinator.subscribeToEvent(
      'analytics.behavior_detected',
      async event => {
        logger.info('Behavior detected, checking triggers', {
          contactId: event.data.contactId,
          behaviorType: event.data.behaviorType,
        });

        // Trigger workflows based on behavior patterns
        await this.checkAndTriggerWorkflows('behavior_detected', event.data);
      }
    );
  }

  /**
   * Check and trigger workflows based on events
   */
  private async checkAndTriggerWorkflows(
    triggerType: string,
    eventData: any
  ): Promise<void> {
    try {
      // This would integrate with your workflow service
      // For now, we'll just log the trigger
      logger.info('Checking workflow triggers', {
        triggerType,
        eventData,
      });

      // In a real implementation, this would:
      // 1. Query active workflows with matching triggers
      // 2. Evaluate trigger conditions
      // 3. Start workflow executions for matching workflows
    } catch (error) {
      logger.error('Failed to check workflow triggers:', error);
    }
  }

  /**
   * Process engagement events for scoring and workflows
   */
  private async processEngagementEvent(
    eventType: string,
    eventData: any
  ): Promise<void> {
    try {
      // Calculate engagement score
      const scoreMap: Record<string, number> = {
        email_opened: 1,
        email_clicked: 3,
        content_viewed: 2,
        form_submitted: 5,
        purchase: 10,
      };

      const score = scoreMap[eventType] || 0;

      if (score > 0 && eventData.contactId) {
        // Update lead score
        await this.updateLeadScore(
          eventData.contactId,
          score,
          `${eventType} engagement`
        );

        // Track the event
        await this.trackEvent(eventData.contactId, eventType, eventData);
      }

      // Check for engagement-based workflow triggers
      await this.checkAndTriggerWorkflows(`engagement_${eventType}`, eventData);
    } catch (error) {
      logger.error('Failed to process engagement event:', error);
    }
  }
}

// Global instance
export const marketingAutomationServiceCommunication =
  new MarketingAutomationServiceCommunication();
