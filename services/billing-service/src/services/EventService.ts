import { BillingRepository } from '../repositories/BillingRepository';
import { BillingEvent, BillingEventType } from '../types';
import { logger } from '../utils/logger';

interface EventData {
  type: BillingEventType;
  userId: string;
  subscriptionId?: string;
  data: Record<string, any>;
}

export class EventService {
  constructor(private billingRepository: BillingRepository) {}

  /**
   * Publish a billing event
   */
  async publishEvent(eventData: EventData): Promise<void> {
    try {
      // Store event in database
      const event: Omit<BillingEvent, 'id' | 'createdAt'> = {
        type: eventData.type,
        subscriptionId: eventData.subscriptionId,
        userId: eventData.userId,
        data: eventData.data,
        processedAt: undefined, // Will be set when processed
      };

      const createdEvent =
        await this.billingRepository.createBillingEvent(event);

      // Here you would typically publish to a message queue (Redis, RabbitMQ, etc.)
      // For now, we'll just log the event
      logger.info('Billing event published', {
        eventId: createdEvent.id,
        type: eventData.type,
        userId: eventData.userId,
        subscriptionId: eventData.subscriptionId,
        data: eventData.data,
      });

      // In a real implementation, you might:
      // 1. Publish to Redis pub/sub
      // 2. Send to RabbitMQ exchange
      // 3. Trigger webhooks
      // 4. Send notifications to other services

      await this.handleEventSideEffects(createdEvent);
    } catch (error) {
      logger.error('Failed to publish billing event', {
        type: eventData.type,
        userId: eventData.userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Handle side effects of billing events
   */
  private async handleEventSideEffects(event: BillingEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'subscription.created':
          await this.handleSubscriptionCreated(event);
          break;
        case 'subscription.updated':
          await this.handleSubscriptionUpdated(event);
          break;
        case 'subscription.cancelled':
          await this.handleSubscriptionCancelled(event);
          break;
        case 'subscription.trial_will_end':
          await this.handleTrialWillEnd(event);
          break;
        case 'invoice.created':
          await this.handleInvoiceCreated(event);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event);
          break;
        case 'usage.recorded':
          await this.handleUsageRecorded(event);
          break;
        default:
          logger.warn('Unknown billing event type', { type: event.type });
      }

      // Mark event as processed
      // In a real implementation, you'd update the processed_at timestamp
      logger.debug('Billing event processed', {
        eventId: event.id,
        type: event.type,
      });
    } catch (error) {
      logger.error('Failed to handle billing event side effects', {
        eventId: event.id,
        type: event.type,
        error,
      });
    }
  }

  private async handleSubscriptionCreated(event: BillingEvent): Promise<void> {
    logger.info('Handling subscription created event', {
      userId: event.userId,
      subscriptionId: event.subscriptionId,
      planName: event.data.planName,
    });

    // Here you might:
    // 1. Send welcome email
    // 2. Update user permissions
    // 3. Trigger onboarding workflow
    // 4. Update analytics
  }

  private async handleSubscriptionUpdated(event: BillingEvent): Promise<void> {
    logger.info('Handling subscription updated event', {
      userId: event.userId,
      subscriptionId: event.subscriptionId,
      oldPlanId: event.data.oldPlanId,
      newPlanId: event.data.newPlanId,
    });

    // Here you might:
    // 1. Update user permissions based on new plan
    // 2. Send plan change confirmation email
    // 3. Update usage limits
    // 4. Trigger plan change workflow
  }

  private async handleSubscriptionCancelled(
    event: BillingEvent
  ): Promise<void> {
    logger.info('Handling subscription cancelled event', {
      userId: event.userId,
      subscriptionId: event.subscriptionId,
      immediately: event.data.immediately,
      endDate: event.data.endDate,
    });

    // Here you might:
    // 1. Send cancellation confirmation email
    // 2. Schedule account downgrade
    // 3. Trigger retention campaign
    // 4. Update user permissions if immediate cancellation
  }

  private async handleTrialWillEnd(event: BillingEvent): Promise<void> {
    logger.info('Handling trial will end event', {
      userId: event.userId,
      subscriptionId: event.subscriptionId,
      trialEndDate: event.data.trialEndDate,
    });

    // Here you might:
    // 1. Send trial ending reminder email
    // 2. Offer upgrade incentives
    // 3. Request payment method if not provided
  }

  private async handleInvoiceCreated(event: BillingEvent): Promise<void> {
    logger.info('Handling invoice created event', {
      userId: event.userId,
      invoiceId: event.data.invoiceId,
      amount: event.data.amount,
    });

    // Here you might:
    // 1. Send invoice notification email
    // 2. Update billing dashboard
  }

  private async handleInvoicePaid(event: BillingEvent): Promise<void> {
    logger.info('Handling invoice paid event', {
      userId: event.userId,
      invoiceId: event.data.invoiceId,
      amount: event.data.amount,
    });

    // Here you might:
    // 1. Send payment confirmation email
    // 2. Update account status
    // 3. Generate receipt
  }

  private async handleInvoicePaymentFailed(event: BillingEvent): Promise<void> {
    logger.info('Handling invoice payment failed event', {
      userId: event.userId,
      invoiceId: event.data.invoiceId,
      amount: event.data.amount,
      attemptCount: event.data.attemptCount,
    });

    // Here you might:
    // 1. Send payment failed notification
    // 2. Start dunning process
    // 3. Request payment method update
    // 4. Suspend account if multiple failures
  }

  private async handleUsageRecorded(event: BillingEvent): Promise<void> {
    logger.info('Handling usage recorded event', {
      userId: event.userId,
      subscriptionId: event.subscriptionId,
      metricName: event.data.metricName,
      quantity: event.data.quantity,
    });

    // Here you might:
    // 1. Update usage dashboard
    // 2. Check usage limits
    // 3. Send usage alerts if approaching limits
  }
}
