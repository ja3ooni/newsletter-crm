// @ts-nocheck
import { config } from '@/config';
import { DripCampaignRepository } from '@/repositories/DripCampaignRepository';
import {
  CampaignSubscription,
  CreateDripCampaignRequest,
  DripCampaign,
  DripEmail,
  FilterParams,
  PaginatedResponse,
  PaginationParams,
  UpdateDripCampaignRequest,
} from '@/types';
import { logger } from '@/utils/logger';
import { queueManager } from '@/utils/queue';
import axios from 'axios';

export class DripCampaignService {
  private dripCampaignRepository: DripCampaignRepository;

  constructor() {
    this.dripCampaignRepository = new DripCampaignRepository();
  }

  // ============================================================================
  // DRIP CAMPAIGN MANAGEMENT
  // ============================================================================

  async createDripCampaign(
    data: CreateDripCampaignRequest,
    createdBy: string
  ): Promise<DripCampaign> {
    try {
      // Validate campaign structure
      this.validateCampaignStructure(data);

      const campaign = await this.dripCampaignRepository.create(
        data,
        createdBy
      );

      logger.info('Drip campaign created successfully', {
        campaignId: campaign.id,
        name: campaign.name,
        emailCount: campaign.emails.length,
        createdBy,
      });

      return campaign;
    } catch (error) {
      logger.error('Error creating drip campaign', { error, data, createdBy });
      throw error;
    }
  }

  async getDripCampaign(id: string): Promise<DripCampaign | null> {
    try {
      return await this.dripCampaignRepository.findById(id);
    } catch (error) {
      logger.error('Error getting drip campaign', { error, id });
      throw error;
    }
  }

  async getDripCampaigns(
    pagination: PaginationParams,
    filters?: FilterParams
  ): Promise<PaginatedResponse<DripCampaign>> {
    try {
      return await this.dripCampaignRepository.findAll(pagination, filters);
    } catch (error) {
      logger.error('Error getting drip campaigns', {
        error,
        pagination,
        filters,
      });
      throw error;
    }
  }

  async updateDripCampaign(
    id: string,
    data: UpdateDripCampaignRequest
  ): Promise<DripCampaign | null> {
    try {
      // Validate campaign structure if emails are being updated
      if (data.emails) {
        this.validateEmailSequence(data.emails);
      }

      const campaign = await this.dripCampaignRepository.update(id, data);

      if (campaign) {
        logger.info('Drip campaign updated successfully', { campaignId: id });
      }

      return campaign;
    } catch (error) {
      logger.error('Error updating drip campaign', { error, id, data });
      throw error;
    }
  }

  async deleteDripCampaign(id: string): Promise<boolean> {
    try {
      // Check if campaign has active subscriptions
      const activeSubscriptions =
        await this.dripCampaignRepository.findSubscriptionsByCampaign(id, {
          page: 1,
          limit: 1,
        });

      if (activeSubscriptions.data.some(sub => sub.status === 'active')) {
        throw new Error('Cannot delete campaign with active subscriptions');
      }

      const deleted = await this.dripCampaignRepository.delete(id);

      if (deleted) {
        logger.info('Drip campaign deleted successfully', { campaignId: id });
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting drip campaign', { error, id });
      throw error;
    }
  }

  async activateDripCampaign(id: string): Promise<DripCampaign | null> {
    try {
      const campaign = await this.dripCampaignRepository.update(id, {
        status: 'active',
      });

      if (campaign) {
        logger.info('Drip campaign activated', { campaignId: id });
      }

      return campaign;
    } catch (error) {
      logger.error('Error activating drip campaign', { error, id });
      throw error;
    }
  }

  async pauseDripCampaign(id: string): Promise<DripCampaign | null> {
    try {
      const campaign = await this.dripCampaignRepository.update(id, {
        status: 'paused',
      });

      if (campaign) {
        // Pause all active subscriptions
        const activeSubscriptions =
          await this.dripCampaignRepository.findSubscriptionsByCampaign(id, {
            page: 1,
            limit: 1000,
          });

        for (const subscription of activeSubscriptions.data) {
          if (subscription.status === 'active') {
            await queueManager.cancelDripSubscription(subscription.id);
            await this.dripCampaignRepository.updateSubscription(
              subscription.id,
              {
                status: 'paused',
              }
            );
          }
        }

        logger.info('Drip campaign paused', { campaignId: id });
      }

      return campaign;
    } catch (error) {
      logger.error('Error pausing drip campaign', { error, id });
      throw error;
    }
  }

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  async subscribeToCampaign(
    campaignId: string,
    contactId: string,
    metadata?: Record<string, any>
  ): Promise<CampaignSubscription> {
    try {
      const campaign = await this.dripCampaignRepository.findById(campaignId);

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      if (campaign.status !== 'active') {
        throw new Error(`Campaign ${campaignId} is not active`);
      }

      // Check if contact is already subscribed
      const existingSubscriptions =
        await this.dripCampaignRepository.findSubscriptionsByCampaign(
          campaignId,
          { page: 1, limit: 1000 }
        );

      const existingSubscription = existingSubscriptions.data.find(
        sub => sub.contactId === contactId && sub.status === 'active'
      );

      if (existingSubscription) {
        throw new Error('Contact is already subscribed to this campaign');
      }

      // Create subscription
      const subscription = await this.dripCampaignRepository.createSubscription(
        campaignId,
        contactId,
        metadata
      );

      // Schedule first email
      await this.scheduleNextEmail(subscription, campaign);

      logger.info('Contact subscribed to drip campaign', {
        campaignId,
        subscriptionId: subscription.id,
        contactId,
      });

      return subscription;
    } catch (error) {
      logger.error('Error subscribing to campaign', {
        error,
        campaignId,
        contactId,
      });
      throw error;
    }
  }

  async unsubscribeFromCampaign(
    subscriptionId: string
  ): Promise<CampaignSubscription | null> {
    try {
      // Cancel any pending emails
      await queueManager.cancelDripSubscription(subscriptionId);

      // Update subscription status
      const subscription = await this.dripCampaignRepository.updateSubscription(
        subscriptionId,
        {
          status: 'unsubscribed',
        }
      );

      if (subscription) {
        logger.info('Contact unsubscribed from drip campaign', {
          subscriptionId,
          campaignId: subscription.campaignId,
          contactId: subscription.contactId,
        });
      }

      return subscription;
    } catch (error) {
      logger.error('Error unsubscribing from campaign', {
        error,
        subscriptionId,
      });
      throw error;
    }
  }

  async pauseSubscription(
    subscriptionId: string
  ): Promise<CampaignSubscription | null> {
    try {
      // Cancel any pending emails
      await queueManager.cancelDripSubscription(subscriptionId);

      // Update subscription status
      const subscription = await this.dripCampaignRepository.updateSubscription(
        subscriptionId,
        {
          status: 'paused',
        }
      );

      if (subscription) {
        logger.info('Subscription paused', {
          subscriptionId,
          campaignId: subscription.campaignId,
          contactId: subscription.contactId,
        });
      }

      return subscription;
    } catch (error) {
      logger.error('Error pausing subscription', { error, subscriptionId });
      throw error;
    }
  }

  async resumeSubscription(
    subscriptionId: string
  ): Promise<CampaignSubscription | null> {
    try {
      const subscription =
        await this.dripCampaignRepository.findSubscriptionById(subscriptionId);

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      if (subscription.status !== 'paused') {
        throw new Error(`Subscription ${subscriptionId} is not paused`);
      }

      const campaign = await this.dripCampaignRepository.findById(
        subscription.campaignId
      );

      if (!campaign) {
        throw new Error(`Campaign ${subscription.campaignId} not found`);
      }

      // Update subscription status
      const updatedSubscription =
        await this.dripCampaignRepository.updateSubscription(subscriptionId, {
          status: 'active',
        });

      if (updatedSubscription) {
        // Schedule next email
        await this.scheduleNextEmail(updatedSubscription, campaign);

        logger.info('Subscription resumed', {
          subscriptionId,
          campaignId: subscription.campaignId,
          contactId: subscription.contactId,
        });
      }

      return updatedSubscription;
    } catch (error) {
      logger.error('Error resuming subscription', { error, subscriptionId });
      throw error;
    }
  }

  async getCampaignSubscriptions(
    campaignId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<CampaignSubscription>> {
    try {
      return await this.dripCampaignRepository.findSubscriptionsByCampaign(
        campaignId,
        pagination
      );
    } catch (error) {
      logger.error('Error getting campaign subscriptions', {
        error,
        campaignId,
      });
      throw error;
    }
  }

  // ============================================================================
  // EMAIL PROCESSING
  // ============================================================================

  async processDripEmail(
    subscriptionId: string,
    emailIndex: number,
    emailId: string
  ): Promise<void> {
    try {
      const subscription =
        await this.dripCampaignRepository.findSubscriptionById(subscriptionId);

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      if (subscription.status !== 'active') {
        logger.warn('Skipping email for inactive subscription', {
          subscriptionId,
          status: subscription.status,
        });

        return;
      }

      const campaign = await this.dripCampaignRepository.findById(
        subscription.campaignId
      );

      if (!campaign) {
        throw new Error(`Campaign ${subscription.campaignId} not found`);
      }

      if (campaign.status !== 'active') {
        logger.warn('Skipping email for inactive campaign', {
          campaignId: campaign.id,
          status: campaign.status,
        });

        return;
      }

      const email = campaign.emails.find(e => e.id === emailId);

      if (!email) {
        throw new Error(
          `Email ${emailId} not found in campaign ${campaign.id}`
        );
      }

      // Check email conditions if any
      if (email.conditions && email.conditions.length > 0) {
        const conditionsMet = await this.evaluateEmailConditions(
          email.conditions,
          subscription
        );

        if (!conditionsMet) {
          logger.info('Email conditions not met, skipping', {
            subscriptionId,
            emailId,
            emailIndex,
          });

          // Move to next email
          await this.moveToNextEmail(subscription, campaign);

          return;
        }
      }

      // Send email
      await this.sendDripEmail(email, subscription, campaign);

      // Update subscription and schedule next email
      await this.moveToNextEmail(subscription, campaign);

      logger.info('Drip email processed successfully', {
        subscriptionId,
        emailId,
        emailIndex,
        campaignId: campaign.id,
        contactId: subscription.contactId,
      });
    } catch (error) {
      logger.error('Error processing drip email', {
        error,
        subscriptionId,
        emailIndex,
        emailId,
      });
      throw error;
    }
  }

  private async sendDripEmail(
    email: DripEmail,
    subscription: CampaignSubscription,
    campaign: DripCampaign
  ): Promise<void> {
    try {
      // Call newsletter service to send email
      await axios.post(
        `${config.services.newsletterService.baseUrl}/api/v1/emails/send`,
        {
          to: subscription.contactId,
          subject: email.subject,
          preheader: email.preheader,
          content: email.content,
          templateId: email.templateId,
          metadata: {
            campaignId: campaign.id,
            subscriptionId: subscription.id,
            emailId: email.id,
            emailOrder: email.order,
            dripCampaign: true,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${config.services.newsletterService.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Drip email sent successfully', {
        emailId: email.id,
        subscriptionId: subscription.id,
        contactId: subscription.contactId,
        subject: email.subject,
      });
    } catch (error) {
      logger.error('Failed to send drip email', {
        error,
        emailId: email.id,
        subscriptionId: subscription.id,
      });
      throw error;
    }
  }

  private async moveToNextEmail(
    subscription: CampaignSubscription,
    campaign: DripCampaign
  ): Promise<void> {
    const nextEmailIndex = subscription.currentEmailIndex + 1;

    if (nextEmailIndex >= campaign.emails.length) {
      // Campaign completed
      await this.dripCampaignRepository.updateSubscription(subscription.id, {
        status: 'completed',
        completedAt: new Date(),
        currentEmailIndex: nextEmailIndex,
      });

      logger.info('Drip campaign completed for subscription', {
        subscriptionId: subscription.id,
        campaignId: campaign.id,
        contactId: subscription.contactId,
      });

      return;
    }

    // Update to next email
    const updatedSubscription =
      await this.dripCampaignRepository.updateSubscription(subscription.id, {
        currentEmailIndex: nextEmailIndex,
      });

    if (updatedSubscription) {
      // Schedule next email
      await this.scheduleNextEmail(updatedSubscription, campaign);
    }
  }

  private async scheduleNextEmail(
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
    const nextEmailAt = new Date(Date.now() + delayMs);

    // Update subscription with next email time
    await this.dripCampaignRepository.updateSubscription(subscription.id, {
      nextEmailAt,
    });

    // Queue email for sending
    await queueManager.addDripEmail(
      {
        subscriptionId: subscription.id,
        campaignId: subscription.campaignId,
        contactId: subscription.contactId,
        emailIndex: subscription.currentEmailIndex,
        emailId: currentEmail.id,
      },
      delayMs
    );

    logger.info('Next drip email scheduled', {
      subscriptionId: subscription.id,
      emailId: currentEmail.id,
      emailIndex: subscription.currentEmailIndex,
      delayMs,
      nextEmailAt,
    });
  }

  private async evaluateEmailConditions(
    conditions: any[],
    subscription: CampaignSubscription
  ): boolean {
    // This would typically involve getting contact data and evaluating conditions
    // For now, return true (conditions met)
    return true;
  }

  // ============================================================================
  // ANALYTICS AND REPORTING
  // ============================================================================

  async getCampaignAnalytics(campaignId: string): Promise<Record<string, any>> {
    try {
      const campaign = await this.dripCampaignRepository.findById(campaignId);

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const subscriptions =
        await this.dripCampaignRepository.findSubscriptionsByCampaign(
          campaignId,
          { page: 1, limit: 1000 }
        );

      const analytics = {
        campaign,
        totalSubscribers: subscriptions.data.length,
        activeSubscribers: subscriptions.data.filter(s => s.status === 'active')
          .length,
        completedSubscribers: subscriptions.data.filter(
          s => s.status === 'completed'
        ).length,
        unsubscribed: subscriptions.data.filter(
          s => s.status === 'unsubscribed'
        ).length,
        emailPerformance: campaign.emails.map(email => ({
          emailId: email.id,
          subject: email.subject,
          order: email.order,
          // These would come from actual email tracking
          sent: 0,
          opens: 0,
          clicks: 0,
          unsubscribes: 0,
        })),
        conversionFunnel: this.calculateConversionFunnel(
          campaign.emails,
          subscriptions.data
        ),
      };

      return analytics;
    } catch (error) {
      logger.error('Error getting campaign analytics', { error, campaignId });
      throw error;
    }
  }

  private calculateConversionFunnel(
    emails: DripEmail[],
    subscriptions: CampaignSubscription[]
  ): any[] {
    return emails.map((email, index) => {
      const reachedThisEmail = subscriptions.filter(
        s =>
          s.currentEmailIndex > index ||
          (s.currentEmailIndex === index && s.status === 'completed')
      ).length;

      const conversionRate =
        subscriptions.length > 0
          ? (reachedThisEmail / subscriptions.length) * 100
          : 0;

      return {
        emailIndex: index,
        emailId: email.id,
        subject: email.subject,
        subscribersReached: reachedThisEmail,
        conversionRate,
      };
    });
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  private validateCampaignStructure(data: CreateDripCampaignRequest): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Campaign name is required');
    }

    if (!data.emails || data.emails.length === 0) {
      throw new Error('Campaign must have at least one email');
    }

    this.validateEmailSequence(data.emails);
  }

  private validateEmailSequence(emails: any[]): void {
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      if (!email.subject || email.subject.trim().length === 0) {
        throw new Error(`Email ${i + 1} must have a subject`);
      }

      if (!email.content || email.content.trim().length === 0) {
        throw new Error(`Email ${i + 1} must have content`);
      }

      if (email.delay === undefined || email.delay < 0) {
        throw new Error(`Email ${i + 1} must have a valid delay (>= 0 hours)`);
      }

      // First email should have 0 delay
      if (i === 0 && email.delay !== 0) {
        throw new Error('First email must have 0 delay');
      }
    }
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  async processActiveSubscriptions(): Promise<number> {
    try {
      const activeSubscriptions =
        await this.dripCampaignRepository.findActiveSubscriptions();

      if (activeSubscriptions.length === 0) {
        return 0;
      }

      logger.info('Processing active drip subscriptions', {
        count: activeSubscriptions.length,
      });

      let processedCount = 0;

      for (const subscription of activeSubscriptions) {
        try {
          const campaign = await this.dripCampaignRepository.findById(
            subscription.campaignId
          );

          if (campaign && campaign.status === 'active') {
            const currentEmail =
              campaign.emails[subscription.currentEmailIndex];

            if (currentEmail) {
              await this.processDripEmail(
                subscription.id,
                subscription.currentEmailIndex,
                currentEmail.id
              );
              processedCount++;
            }
          }
        } catch (error) {
          logger.error('Error processing subscription in batch', {
            error,
            subscriptionId: subscription.id,
          });
          // Continue processing other subscriptions
        }
      }

      logger.info('Batch processing of subscriptions completed', {
        totalSubscriptions: activeSubscriptions.length,
        processedCount,
        failedCount: activeSubscriptions.length - processedCount,
      });

      return processedCount;
    } catch (error) {
      logger.error('Error processing active subscriptions', { error });
      throw error;
    }
  }
}

export default DripCampaignService;
