import { BillingRepository } from '../repositories/BillingRepository';
import {
  CreateSubscriptionRequest,
  CreateUsageRecordRequest,
  Subscription,
  SubscriptionStatus,
  UpdateSubscriptionRequest,
  UsageRecord,
} from '../types';
import { logger } from '../utils/logger';
import { EventService } from './EventService';
import { StripeService } from './StripeService';

export class SubscriptionService {
  constructor(
    private stripeService: StripeService,
    private billingRepository: BillingRepository,
    private eventService: EventService
  ) {}

  /**
   * Create a new subscription
   */
  async createSubscription(
    request: CreateSubscriptionRequest
  ): Promise<Subscription> {
    try {
      logger.info('Creating subscription', {
        userId: request.userId,
        planId: request.planId,
      });

      // Get the subscription plan
      const plan = await this.billingRepository.getSubscriptionPlan(
        request.planId
      );
      if (!plan) {
        throw new Error('Subscription plan not found');
      }

      if (!plan.isActive) {
        throw new Error('Subscription plan is not active');
      }

      // Check if user already has an active subscription
      const existingSubscription =
        await this.billingRepository.getActiveSubscriptionByUserId(
          request.userId
        );
      if (existingSubscription) {
        throw new Error('User already has an active subscription');
      }

      // Create or get Stripe customer
      let stripeCustomer;
      try {
        // Try to find existing customer by user ID in metadata
        const customers = await this.stripeService.listCustomers({
          metadata: { userId: request.userId },
          limit: 1,
        });

        if (customers.data.length > 0) {
          stripeCustomer = customers.data[0];
        } else {
          // Create new customer - we'll need user email from user service
          stripeCustomer = await this.stripeService.createCustomer(
            `user-${request.userId}@temp.com`, // Temporary email, should be replaced with actual user email
            undefined,
            { userId: request.userId }
          );
        }
      } catch (error) {
        logger.error('Failed to create/get Stripe customer', {
          userId: request.userId,
          error,
        });
        throw error;
      }

      // Attach payment method if provided
      if (request.paymentMethodId) {
        await this.stripeService.attachPaymentMethod(
          request.paymentMethodId,
          stripeCustomer.id
        );
        await this.stripeService.setDefaultPaymentMethod(
          stripeCustomer.id,
          request.paymentMethodId
        );
      }

      // Create Stripe subscription
      const stripeSubscription = await this.stripeService.createSubscription(
        stripeCustomer.id,
        plan.stripePriceId,
        request.paymentMethodId,
        request.trialDays || plan.trialDays,
        undefined, // promo code handling would go here
        request.metadata
      );

      // Create subscription record in database
      const subscription: Subscription = {
        id: '', // Will be set by repository
        userId: request.userId,
        planId: request.planId,
        status: this.mapStripeStatusToLocal(stripeSubscription.status),
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000
        ),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        cancelledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : undefined,
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : undefined,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : undefined,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomer.id,
        metadata: request.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createdSubscription =
        await this.billingRepository.createSubscription(subscription);

      // Publish subscription created event
      await this.eventService.publishEvent({
        type: 'subscription.created',
        userId: request.userId,
        subscriptionId: createdSubscription.id,
        data: {
          planId: request.planId,
          planName: plan.name,
          status: createdSubscription.status,
          trialEnd: createdSubscription.trialEnd,
        },
      });

      logger.info('Subscription created successfully', {
        subscriptionId: createdSubscription.id,
        userId: request.userId,
        planId: request.planId,
        status: createdSubscription.status,
      });

      return createdSubscription;
    } catch (error) {
      logger.error('Failed to create subscription', {
        userId: request.userId,
        planId: request.planId,
        error,
      });
      throw error;
    }
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    subscriptionId: string,
    request: UpdateSubscriptionRequest
  ): Promise<Subscription> {
    try {
      logger.info('Updating subscription', { subscriptionId, request });

      // Get existing subscription
      const subscription =
        await this.billingRepository.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const updates: any = {};

      // Handle plan change
      if (request.planId && request.planId !== subscription.planId) {
        const newPlan = await this.billingRepository.getSubscriptionPlan(
          request.planId
        );
        if (!newPlan) {
          throw new Error('New subscription plan not found');
        }

        if (!newPlan.isActive) {
          throw new Error('New subscription plan is not active');
        }

        updates.priceId = newPlan.stripePriceId;
      }

      // Handle cancellation
      if (request.cancelAtPeriodEnd !== undefined) {
        updates.cancelAtPeriodEnd = request.cancelAtPeriodEnd;
      }

      // Handle metadata updates
      if (request.metadata) {
        updates.metadata = { ...subscription.metadata, ...request.metadata };
      }

      // Update Stripe subscription
      const stripeSubscription = await this.stripeService.updateSubscription(
        subscription.stripeSubscriptionId,
        updates
      );

      // Update local subscription record
      const updatedSubscription =
        await this.billingRepository.updateSubscription(subscriptionId, {
          planId: request.planId || subscription.planId,
          status: this.mapStripeStatusToLocal(stripeSubscription.status),
          currentPeriodStart: new Date(
            stripeSubscription.current_period_start * 1000
          ),
          currentPeriodEnd: new Date(
            stripeSubscription.current_period_end * 1000
          ),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          cancelledAt: stripeSubscription.canceled_at
            ? new Date(stripeSubscription.canceled_at * 1000)
            : undefined,
          metadata: updates.metadata || subscription.metadata,
          updatedAt: new Date(),
        });

      // Publish subscription updated event
      await this.eventService.publishEvent({
        type: 'subscription.updated',
        userId: subscription.userId,
        subscriptionId,
        data: {
          oldPlanId: subscription.planId,
          newPlanId: request.planId || subscription.planId,
          status: updatedSubscription.status,
          cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
        },
      });

      logger.info('Subscription updated successfully', {
        subscriptionId,
        userId: subscription.userId,
        status: updatedSubscription.status,
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('Failed to update subscription', {
        subscriptionId,
        request,
        error,
      });
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediately = false
  ): Promise<Subscription> {
    try {
      logger.info('Cancelling subscription', { subscriptionId, immediately });

      const subscription =
        await this.billingRepository.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Cancel Stripe subscription
      const stripeSubscription = await this.stripeService.cancelSubscription(
        subscription.stripeSubscriptionId,
        immediately
      );

      // Update local subscription record
      const updatedSubscription =
        await this.billingRepository.updateSubscription(subscriptionId, {
          status: this.mapStripeStatusToLocal(stripeSubscription.status),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          cancelledAt: stripeSubscription.canceled_at
            ? new Date(stripeSubscription.canceled_at * 1000)
            : undefined,
          updatedAt: new Date(),
        });

      // Publish subscription cancelled event
      await this.eventService.publishEvent({
        type: 'subscription.cancelled',
        userId: subscription.userId,
        subscriptionId,
        data: {
          immediately,
          cancelledAt: updatedSubscription.cancelledAt,
          endDate: updatedSubscription.currentPeriodEnd,
        },
      });

      logger.info('Subscription cancelled successfully', {
        subscriptionId,
        userId: subscription.userId,
        immediately,
        status: updatedSubscription.status,
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('Failed to cancel subscription', {
        subscriptionId,
        immediately,
        error,
      });
      throw error;
    }
  }

  /**
   * Record usage for metered billing
   */
  async recordUsage(request: CreateUsageRecordRequest): Promise<UsageRecord> {
    try {
      logger.info('Recording usage', {
        subscriptionId: request.subscriptionId,
        metricName: request.metricName,
      });

      const subscription = await this.billingRepository.getSubscription(
        request.subscriptionId
      );
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Get Stripe subscription to find subscription item
      const stripeSubscription = await this.stripeService.getSubscription(
        subscription.stripeSubscriptionId
      );
      const subscriptionItem = stripeSubscription.items.data[0]; // Assuming single item for now

      // Create usage record in Stripe
      const stripeUsageRecord = await this.stripeService.createUsageRecord(
        subscriptionItem.id,
        request.quantity,
        request.timestamp
      );

      // Create usage record in database
      const usageRecord: UsageRecord = {
        id: '', // Will be set by repository
        subscriptionId: request.subscriptionId,
        userId: subscription.userId,
        metricName: request.metricName,
        quantity: request.quantity,
        timestamp: request.timestamp || new Date(),
        stripeUsageRecordId: stripeUsageRecord.id,
        metadata: request.metadata || {},
      };

      const createdUsageRecord =
        await this.billingRepository.createUsageRecord(usageRecord);

      // Publish usage recorded event
      await this.eventService.publishEvent({
        type: 'usage.recorded',
        userId: subscription.userId,
        subscriptionId: request.subscriptionId,
        data: {
          metricName: request.metricName,
          quantity: request.quantity,
          timestamp: createdUsageRecord.timestamp,
        },
      });

      logger.info('Usage recorded successfully', {
        usageRecordId: createdUsageRecord.id,
        subscriptionId: request.subscriptionId,
        metricName: request.metricName,
        quantity: request.quantity,
      });

      return createdUsageRecord;
    } catch (error) {
      logger.error('Failed to record usage', { request, error });
      throw error;
    }
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    return await this.billingRepository.getSubscription(subscriptionId);
  }

  /**
   * Get user's active subscription
   */
  async getUserActiveSubscription(
    userId: string
  ): Promise<Subscription | null> {
    return await this.billingRepository.getActiveSubscriptionByUserId(userId);
  }

  /**
   * Get user's subscription history
   */
  async getUserSubscriptionHistory(userId: string): Promise<Subscription[]> {
    return await this.billingRepository.getSubscriptionsByUserId(userId);
  }

  /**
   * Sync subscription status with Stripe
   */
  async syncSubscriptionWithStripe(
    subscriptionId: string
  ): Promise<Subscription> {
    try {
      const subscription =
        await this.billingRepository.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const stripeSubscription = await this.stripeService.getSubscription(
        subscription.stripeSubscriptionId
      );

      const updatedSubscription =
        await this.billingRepository.updateSubscription(subscriptionId, {
          status: this.mapStripeStatusToLocal(stripeSubscription.status),
          currentPeriodStart: new Date(
            stripeSubscription.current_period_start * 1000
          ),
          currentPeriodEnd: new Date(
            stripeSubscription.current_period_end * 1000
          ),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          cancelledAt: stripeSubscription.canceled_at
            ? new Date(stripeSubscription.canceled_at * 1000)
            : undefined,
          updatedAt: new Date(),
        });

      logger.info('Subscription synced with Stripe', {
        subscriptionId,
        status: updatedSubscription.status,
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('Failed to sync subscription with Stripe', {
        subscriptionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Map Stripe subscription status to local status
   */
  private mapStripeStatusToLocal(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return 'active';
      case 'canceled':
        return 'cancelled';
      case 'past_due':
        return 'past_due';
      case 'trialing':
        return 'trialing';
      case 'incomplete':
        return 'incomplete';
      case 'incomplete_expired':
        return 'incomplete_expired';
      case 'unpaid':
        return 'unpaid';
      default:
        logger.warn('Unknown Stripe subscription status', { stripeStatus });
        return 'incomplete';
    }
  }
}
