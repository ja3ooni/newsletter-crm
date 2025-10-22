/**
 * CRM Service Inter-Service Communication
 * Handles events and communication with other services
 */

import { EventCoordinator, createEventCoordinator, defaultEventCoordinatorConfig } from '../../../../infrastructure/utils/event-coordinator';
import { initializeServiceDiscovery, setupGracefulShutdown } from '../../../../infrastructure/utils/service-discovery';
import { config } from '../config';
import { logger } from './logger';

export class CRMServiceCommunication {
  private eventCoordinator: EventCoordinator;
  private serviceInstance: any;

  constructor() {
    // Initialize event coordinator
    this.eventCoordinator = createEventCoordinator({
      ...defaultEventCoordinatorConfig,
      serviceName: 'crm-service',
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
        serviceName: 'crm-service',
        version: '1.0.0',
        host: config.server.host || 'localhost',
        port: config.server.port,
        protocol: 'http',
        healthCheckPath: '/health',
        healthCheckInterval: 30000,
        healthCheckTimeout: 5000,
        unhealthyThreshold: 3,
        metadata: {
          description: 'Customer relationship management service',
          capabilities: ['contact-management', 'segmentation', 'lead-scoring'],
        },
        tags: ['crm', 'contacts', 'leads', 'core'],
      });

      // Initialize event coordinator
      await this.eventCoordinator.initialize();

      // Setup graceful shutdown
      setupGracefulShutdown('crm-service', this.serviceInstance.id);

      logger.info('CRM service inter-service communication initialized');

    } catch (error) {
      logger.error('Failed to initialize inter-service communication:', error);
      throw error;
    }
  }

  /**
   * Publish CRM-related events
   */
  async publishContactCreated(contactId: string, contactData: any): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'crm.contact_created',
      source: 'crm-service',
      data: {
        contactId,
        email: contactData.email,
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        source: contactData.source,
        lifecycle: contactData.lifecycle,
        createdAt: new Date(),
      },
      userId: contactData.userId,
    });
  }

  async publishContactUpdated(contactId: string, updatedData: any, userId?: string): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'crm.contact_updated',
      source: 'crm-service',
      data: {
        contactId,
        updatedFields: updatedData,
        updatedAt: new Date(),
      },
      userId,
    });
  }

  async publishContactSegmentChanged(contactId: string, segmentData: any, userId?: string): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'crm.contact_segment_changed',
      source: 'crm-service',
      data: {
        contactId,
        addedSegments: segmentData.added || [],
        removedSegments: segmentData.removed || [],
        changedAt: new Date(),
      },
      userId,
    });
  }

  async publishLeadScoreChanged(contactId: string, scoreData: any, userId?: string): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'crm.lead_score_changed',
      source: 'crm-service',
      data: {
        contactId,
        oldScore: scoreData.oldScore,
        newScore: scoreData.newScore,
        reason: scoreData.reason,
        changedAt: new Date(),
      },
      userId,
    });
  }

  async publishLifecycleStageChanged(contactId: string, lifecycleData: any, userId?: string): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'crm.lifecycle_stage_changed',
      source: 'crm-service',
      data: {
        contactId,
        oldStage: lifecycleData.oldStage,
        newStage: lifecycleData.newStage,
        changedAt: new Date(),
      },
      userId,
    });
  }

  /**
   * Call other services
   */
  async triggerMarketingAutomation(contactId: string, triggerType: string, triggerData: any): Promise<void> {
    await this.eventCoordinator.callService('marketing-automation-service', '/api/v1/triggers', {
      method: 'POST',
      data: {
        contactId,
        triggerType,
        triggerData,
        source: 'crm-service',
      },
    });
  }

  async sendToNewsletter(contactId: string, contactData: any): Promise<void> {
    await this.eventCoordinator.callService('newsletter-service', '/api/v1/subscribers', {
      method: 'POST',
      data: {
        email: contactData.email,
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        preferences: contactData.preferences,
        source: 'crm',
        contactId,
      },
    });
  }

  async trackEngagementEvent(contactId: string, eventType: string, eventData: any): Promise<void> {
    await this.eventCoordinator.callService('analytics-service', '/api/v1/engagement', {
      method: 'POST',
      data: {
        contactId,
        eventType,
        eventData,
        timestamp: new Date(),
      },
    });
  }

  async enrichContactData(contactId: string, email: string): Promise<any> {
    // This could call an external enrichment service or internal analytics
    return await this.eventCoordinator.callService('analytics-service', '/api/v1/enrichment', {
      method: 'POST',
      data: {
        contactId,
        email,
        enrichmentType: 'contact_profile',
      },
    });
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
    // Handle user registration events
    this.eventCoordinator.subscribeToEvent('user.registered', async (event) => {
      logger.info('User registered, creating CRM contact', {
        userId: event.userId,
        email: event.data.email,
      });

      try {
        // Create CRM contact from user registration
        // This would call your CRM service methods
        const contactData = {
          email: event.data.email,
          firstName: event.data.profile?.firstName,
          lastName: event.data.profile?.lastName,
          source: 'user_registration',
          lifecycle: 'subscriber',
          userId: event.userId,
          customFields: {
            registrationDate: event.data.registeredAt,
            subscriptionPlan: event.data.subscription?.plan,
          },
        };

        // Call your CRM service to create contact
        // const contact = await crmService.createContact(contactData);

      } catch (error) {
        logger.error('Failed to create CRM contact from user registration:', error);
      }
    });

    // Handle newsletter engagement events
    this.eventCoordinator.subscribeToEvent('newsletter.email_opened', async (event) => {
      logger.info('Newsletter email opened', {
        contactId: event.data.contactId,
        newsletterId: event.data.newsletterId,
      });

      // Update engagement score and track activity
      // This would call your CRM service methods
    });

    this.eventCoordinator.subscribeToEvent('newsletter.email_clicked', async (event) => {
      logger.info('Newsletter email clicked', {
        contactId: event.data.contactId,
        newsletterId: event.data.newsletterId,
        linkUrl: event.data.linkUrl,
      });

      // Update engagement score and track activity
      // Higher score for clicks than opens
    });

    // Handle marketing automation events
    this.eventCoordinator.subscribeToEvent('automation.workflow_completed', async (event) => {
      logger.info('Marketing workflow completed', {
        contactId: event.data.contactId,
        workflowId: event.data.workflowId,
      });

      // Update contact lifecycle stage or add tags based on workflow completion
    });

    // Handle analytics events for lead scoring
    this.eventCoordinator.subscribeToEvent('analytics.behavior_scored', async (event) => {
      logger.info('Behavior scored for contact', {
        contactId: event.data.contactId,
        behaviorType: event.data.behaviorType,
        score: event.data.score,
      });

      // Update lead score based on behavior analytics
      // This would call your CRM service methods to update lead score
    });

    // Handle content engagement events
    this.eventCoordinator.subscribeToEvent('content.article_viewed', async (event) => {
      logger.info('Content article viewed', {
        contactId: event.data.contactId,
        articleId: event.data.articleId,
        category: event.data.category,
      });

      // Track content preferences and update contact interests
    });

    // Handle subscription changes
    this.eventCoordinator.subscribeToEvent('user.subscription_changed', async (event) => {
      logger.info('User subscription changed', {
        userId: event.userId,
        oldPlan: event.data.oldPlan,
        newPlan: event.data.newPlan,
      });

      // Update contact lifecycle stage and custom fields
      // Upgrade/downgrade might affect lead scoring and segmentation
    });
  }
}

// Global instance
export const crmServiceCommunication = new CRMServiceCommunication();
