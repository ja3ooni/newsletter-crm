/**
 * User Service Inter-Service Communication
 * Handles events and communication with other services
 */

import { EventCoordinator, createEventCoordinator, defaultEventCoordinatorConfig } from '../../../../infrastructure/utils/event-coordinator';
import { initializeServiceDiscovery, setupGracefulShutdown } from '../../../../infrastructure/utils/service-discovery';
import { config } from '../config';
import { logger } from './logger';

export class UserServiceCommunication {
  private eventCoordinator: EventCoordinator;
  private serviceInstance: any;

  constructor() {
    // Initialize event coordinator
    this.eventCoordinator = createEventCoordinator({
      ...defaultEventCoordinatorConfig,
      serviceName: 'user-service',
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
        serviceName: 'user-service',
        version: '1.0.0',
        host: config.server.host || 'localhost',
        port: config.server.port,
        protocol: 'http',
        healthCheckPath: '/health',
        healthCheckInterval: 30000,
        healthCheckTimeout: 5000,
        unhealthyThreshold: 3,
        metadata: {
          description: 'User authentication and management service',
          capabilities: ['authentication', 'user-management', 'authorization'],
        },
        tags: ['auth', 'users', 'core'],
      });

      // Initialize event coordinator
      await this.eventCoordinator.initialize();

      // Setup graceful shutdown
      setupGracefulShutdown('user-service', this.serviceInstance.id);

      logger.info('User service inter-service communication initialized');

    } catch (error) {
      logger.error('Failed to initialize inter-service communication:', error);
      throw error;
    }
  }

  /**
   * Publish user-related events
   */
  async publishUserRegistered(userId: string, userData: any): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'user.registered',
      source: 'user-service',
      data: {
        userId,
        email: userData.email,
        profile: userData.profile,
        subscription: userData.subscription,
        registeredAt: new Date(),
      },
      userId,
    });
  }

  async publishUserUpdated(userId: string, updatedData: any): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'user.updated',
      source: 'user-service',
      data: {
        userId,
        updatedFields: updatedData,
        updatedAt: new Date(),
      },
      userId,
    });
  }

  async publishUserDeleted(userId: string): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'user.deleted',
      source: 'user-service',
      data: {
        userId,
        deletedAt: new Date(),
      },
      userId,
    });
  }

  async publishUserLoggedIn(userId: string, loginData: any): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'user.logged_in',
      source: 'user-service',
      data: {
        userId,
        loginMethod: loginData.method,
        ipAddress: loginData.ipAddress,
        userAgent: loginData.userAgent,
        loginAt: new Date(),
      },
      userId,
    });
  }

  async publishSubscriptionChanged(userId: string, subscriptionData: any): Promise<void> {
    await this.eventCoordinator.publishEvent({
      type: 'user.subscription_changed',
      source: 'user-service',
      data: {
        userId,
        oldPlan: subscriptionData.oldPlan,
        newPlan: subscriptionData.newPlan,
        changedAt: new Date(),
      },
      userId,
    });
  }

  /**
   * Call other services
   */
  async createCRMContact(userData: any): Promise<any> {
    return await this.eventCoordinator.callService('crm-service', '/api/v1/contacts', {
      method: 'POST',
      data: {
        email: userData.email,
        firstName: userData.profile?.firstName,
        lastName: userData.profile?.lastName,
        source: 'user_registration',
        lifecycle: 'subscriber',
        customFields: {
          registrationDate: new Date(),
          subscriptionPlan: userData.subscription?.plan,
        },
      },
    });
  }

  async sendWelcomeEmail(userId: string, userData: any): Promise<void> {
    await this.eventCoordinator.callService('newsletter-service', '/api/v1/emails/welcome', {
      method: 'POST',
      data: {
        userId,
        email: userData.email,
        firstName: userData.profile?.firstName,
        templateData: {
          name: userData.profile?.firstName || 'User',
          subscriptionPlan: userData.subscription?.plan,
        },
      },
    });
  }

  async trackUserEvent(userId: string, eventType: string, eventData: any): Promise<void> {
    await this.eventCoordinator.callService('analytics-service', '/api/v1/events', {
      method: 'POST',
      data: {
        userId,
        eventType,
        eventData,
        timestamp: new Date(),
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
    // Handle newsletter subscription events
    this.eventCoordinator.subscribeToEvent('newsletter.subscription_confirmed', async (event) => {
      logger.info('Newsletter subscription confirmed', {
        userId: event.userId,
        email: event.data.email,
      });

      // Update user preferences or trigger welcome sequence
      // This would call your user service methods
    });

    // Handle CRM contact updates
    this.eventCoordinator.subscribeToEvent('crm.contact_updated', async (event) => {
      if (event.data.source === 'user_service') return; // Avoid loops

      logger.info('CRM contact updated', {
        contactId: event.data.contactId,
        userId: event.userId,
      });

      // Sync CRM updates back to user profile if needed
    });

    // Handle payment/subscription events
    this.eventCoordinator.subscribeToEvent('billing.subscription_updated', async (event) => {
      logger.info('Subscription updated from billing', {
        userId: event.userId,
        subscriptionId: event.data.subscriptionId,
        newStatus: event.data.status,
      });

      // Update user subscription status
      // This would call your user service methods to update subscription
    });

    // Handle analytics events for user behavior
    this.eventCoordinator.subscribeToEvent('analytics.user_behavior', async (event) => {
      logger.info('User behavior tracked', {
        userId: event.userId,
        behaviorType: event.data.behaviorType,
      });

      // Update user engagement metrics or preferences
    });
  }
}

// Global instance
export const userServiceCommunication = new UserServiceCommunication();
