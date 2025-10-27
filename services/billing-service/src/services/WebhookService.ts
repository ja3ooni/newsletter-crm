import Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_SECRET } from '../config/stripe';
import { BillingRepository } from '../repositories/BillingRepository';
import { logger } from '../utils/logger';
import { DunningService } from './DunningService';
import { EventService } from './EventService';
import { SubscriptionService } from './SubscriptionService';

export class WebhookService {
  constructor(
    private subscriptionService: SubscriptionService,
    private billingRepository: BillingRepository,
    private eventService: EventService,
    private dunningService: DunningService
  ) {}

  /**
   * Process Stripe webhook events
   */
  async processWebhook(payload: string, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      // Verify webhook signature
      if (STRIPE_WEBHOOK_SECRET) {
        event = stripe.webhooks.constructEvent(
          payload,
          signature,
          STRIPE_WEBHOOK_SECRET
        );
      } else {
        // For development/testing without webhook secret
        event = JSON.parse(payload);
        logger.warn('Processing webhook without signature verification');
      }

      logger.info('Processing Stripe webhook', {
        eventId: event.id,
        type: event.type,
      });

      // Process the event based on type
      await this.handleWebhookEvent(event);

      logger.info('Webhook processed successfully', {
        eventId: event.id,
        type: event.type,
      });
    } catch (error) {
      logger.error('Webhook processing failed', {
        error: error.message,
        signature,
      });
      throw error;
    }
  }

  /**
   * Handle different types of webhook events
   */
  private async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'customer.subscription.trial_will_end':
        await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.created':
        await this.handleInvoiceCreated(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice
        );
        break;

      case 'invoice.payment_action_required':
        await this.handleInvoicePaymentActionRequired(
          event.data.object as Stripe.Invoice
        );
        break;

      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(
          event.data.object as Stripe.PaymentMethod
        );
        break;

      case 'payment_method.detached':
        await this.handlePaymentMethodDetached(
          event.data.object as Stripe.PaymentMethod
        );
        break;

      default:
        logger.info('Unhandled webhook event type', { type: event.type });
    }
  }

  /**
   * Handle subscription created webhook
   */
  private async handleSubscriptionCreated(
    subscription: Stripe.Subscription
  ): Promise<void> {
    logger.info('Handling subscription created webhook', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
    });

    try {
      // Sync subscription with local database
      await this.syncSubscriptionFromStripe(subscription);

      // Publish event
      const userId = await this.getUserIdFromCustomer(
        subscription.customer as string
      );
      if (userId) {
        await this.eventService.publishEvent({
          type: 'subscription.created',
          userId,
          subscriptionId: subscription.id,
          data: {
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            trialEnd: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : undefined,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to handle subscription created webhook', {
        subscriptionId: subscription.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Handle subscription updated webhook
   */
  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription
  ): Promise<void> {
    logger.info('Handling subscription updated webhook', {
      subscriptionId: subscription.id,
      status: subscription.status,
    });

    try {
      // Find local subscription by Stripe ID
      const localSubscription = await this.findLocalSubscriptionByStripeId(
        subscription.id
      );
      if (!localSubscription) {
        logger.warn('Local subscription not found for Stripe subscription', {
          stripeSubscriptionId: subscription.id,
        });
        return;
      }

      // Update local subscription
      await this.billingRepository.updateSubscription(localSubscription.id, {
        status: this.mapStripeStatusToLocal(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        cancelledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : undefined,
        updatedAt: new Date(),
      });

      // Publish event
      await this.eventService.publishEvent({
        type: 'subscription.updated',
        userId: localSubscription.userId,
        subscriptionId: localSubscription.id,
        data: {
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
    } catch (error) {
      logger.error('Failed to handle subscription updated webhook', {
        subscriptionId: subscription.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Handle subscription deleted webhook
   */
  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription
  ): Promise<void> {
    logger.info('Handling subscription deleted webhook', {
      subscriptionId: subscription.id,
    });

    try {
      const localSubscription = await this.findLocalSubscriptionByStripeId(
        subscription.id
      );
      if (!localSubscription) {
        logger.warn(
          'Local subscription not found for deleted Stripe subscription',
          {
            stripeSubscriptionId: subscription.id,
          }
        );
        return;
      }

      // Update local subscription status
      await this.billingRepository.updateSubscription(localSubscription.id, {
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      });

      // Publish event
      await this.eventService.publishEvent({
        type: 'subscription.cancelled',
        userId: localSubscription.userId,
        subscriptionId: localSubscription.id,
        data: {
          stripeSubscriptionId: subscription.id,
          cancelledAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to handle subscription deleted webhook', {
        subscriptionId: subscription.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Handle trial will end webhook
   */
  private async handleTrialWillEnd(
    subscription: Stripe.Subscription
  ): Promise<void> {
    logger.info('Handling trial will end webhook', {
      subscriptionId: subscription.id,
      trialEnd: subscription.trial_end,
    });

    try {
      const localSubscription = await this.findLocalSubscriptionByStripeId(
        subscription.id
      );
      if (!localSubscription) {
        return;
      }

      // Publish event
      await this.eventService.publishEvent({
        type: 'subscription.trial_will_end',
        userId: localSubscription.userId,
        subscriptionId: localSubscription.id,
        data: {
          trialEndDate: subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : undefined,
          daysRemaining: subscription.trial_end
            ? Math.ceil(
                (subscription.trial_end * 1000 - Date.now()) /
                  (1000 * 60 * 60 * 24)
              )
            : 0,
        },
      });
    } catch (error) {
      logger.error('Failed to handle trial will end webhook', {
        subscriptionId: subscription.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Handle invoice created webhook
   */
  private async handleInvoiceCreated(invoice: Stripe.Invoice): Promise<void> {
    logger.info('Handling invoice created webhook', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amount: invoice.amount_due,
    });

    try {
      // Create local invoice record
      const localSubscription = await this.findLocalSubscriptionByStripeId(
        invoice.subscription as string
      );
      if (!localSubscription) {
        logger.warn('Local subscription not found for invoice', {
          stripeSubscriptionId: invoice.subscription,
          invoiceId: invoice.id,
        });
        return;
      }

      const localInvoice = await this.billingRepository.createInvoice({
        subscriptionId: localSubscription.id,
        userId: localSubscription.userId,
        stripeInvoiceId: invoice.id,
        status: invoice.status as any,
        amount: invoice.amount_due,
        currency: invoice.currency,
        dueDate: new Date(invoice.due_date! * 1000),
        paidAt: invoice.status_transitions.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : undefined,
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
        items: invoice.lines.data.map(line => ({
          id: line.id,
          description: line.description || '',
          amount: line.amount,
          quantity: line.quantity || 1,
          unitAmount: line.amount,
          metadata: {},
        })),
        metadata: invoice.metadata || {},
      });

      // Publish event
      await this.eventService.publishEvent({
        type: 'invoice.created',
        userId: localSubscription.userId,
        subscriptionId: localSubscription.id,
        data: {
          invoiceId: localInvoice.id,
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_due,
          dueDate: new Date(invoice.due_date! * 1000),
        },
      });
    } catch (error) {
      logger.error('Failed to handle invoice created webhook', {
        invoiceId: invoice.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Handle invoice paid webhook
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    logger.info('Handling invoice paid webhook', {
      invoiceId: invoice.id,
      amount: invoice.amount_paid,
    });

    try {
      const localSubscription = await this.findLocalSubscriptionByStripeId(
        invoice.subscription as string
      );
      if (!localSubscription) {
        return;
      }

      // Cancel any ongoing dunning process
      await this.dunningService.cancelDunningProcess(localSubscription.id);

      // Publish event
      await this.eventService.publishEvent({
        type: 'invoice.paid',
        userId: localSubscription.userId,
        subscriptionId: localSubscription.id,
        data: {
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_paid,
          paidAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to handle invoice paid webhook', {
        invoiceId: invoice.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Handle invoice payment failed webhook
   */
  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice
  ): Promise<void> {
    logger.info('Handling invoice payment failed webhook', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      attemptCount: invoice.attempt_count,
    });

    try {
      const localSubscription = await this.findLocalSubscriptionByStripeId(
        invoice.subscription as string
      );
      if (!localSubscription) {
        return;
      }

      // Start or continue dunning process
      await this.dunningService.startDunningProcess(
        invoice.id,
        localSubscription.id
      );

      // Publish event
      await this.eventService.publishEvent({
        type: 'invoice.payment_failed',
        userId: localSubscription.userId,
        subscriptionId: localSubscription.id,
        data: {
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_due,
          attemptCount: invoice.attempt_count,
          nextPaymentAttempt: invoice.next_payment_attempt
            ? new Date(invoice.next_payment_attempt * 1000)
            : undefined,
        },
      });
    } catch (error) {
      logger.error('Failed to handle invoice payment failed webhook', {
        invoiceId: invoice.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Handle invoice payment action required webhook
   */
  private async handleInvoicePaymentActionRequired(
    invoice: Stripe.Invoice
  ): Promise<void> {
    logger.info('Handling invoice payment action required webhook', {
      invoiceId: invoice.id,
    });

    // This typically happens with 3D Secure or other authentication requirements
    // You might want to notify the customer to complete the payment
  }

  /**
   * Handle payment method attached webhook
   */
  private async handlePaymentMethodAttached(
    paymentMethod: Stripe.PaymentMethod
  ): Promise<void> {
    logger.info('Handling payment method attached webhook', {
      paymentMethodId: paymentMethod.id,
      customerId: paymentMethod.customer,
    });

    try {
      const userId = await this.getUserIdFromCustomer(
        paymentMethod.customer as string
      );
      if (userId) {
        await this.eventService.publishEvent({
          type: 'payment_method.attached',
          userId,
          data: {
            paymentMethodId: paymentMethod.id,
            type: paymentMethod.type,
            last4: paymentMethod.card?.last4,
            brand: paymentMethod.card?.brand,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to handle payment method attached webhook', {
        paymentMethodId: paymentMethod.id,
        error,
      });
    }
  }

  /**
   * Handle payment method detached webhook
   */
  private async handlePaymentMethodDetached(
    paymentMethod: Stripe.PaymentMethod
  ): Promise<void> {
    logger.info('Handling payment method detached webhook', {
      paymentMethodId: paymentMethod.id,
    });

    try {
      // You might want to update local payment method records here
      // and notify the user if this was their default payment method
    } catch (error) {
      logger.error('Failed to handle payment method detached webhook', {
        paymentMethodId: paymentMethod.id,
        error,
      });
    }
  }

  /**
   * Helper methods
   */
  private async findLocalSubscriptionByStripeId(
    _stripeSubscriptionId: string
  ): Promise<any> {
    // In a real implementation, you'd query the database
    // For now, return null as we don't have the query method implemented
    return null;
  }

  private async getUserIdFromCustomer(
    customerId: string
  ): Promise<string | null> {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        return null;
      }
      return (customer as Stripe.Customer).metadata?.userId || null;
    } catch (error) {
      logger.error('Failed to get user ID from customer', {
        customerId,
        error,
      });
      return null;
    }
  }

  private async syncSubscriptionFromStripe(
    stripeSubscription: Stripe.Subscription
  ): Promise<void> {
    // This would sync the Stripe subscription with your local database
    // Implementation depends on your specific needs
    logger.info('Syncing subscription from Stripe', {
      subscriptionId: stripeSubscription.id,
    });
  }

  private mapStripeStatusToLocal(stripeStatus: string): any {
    // Map Stripe status to your local status enum
    return stripeStatus;
  }
}
