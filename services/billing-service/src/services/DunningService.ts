import { BillingRepository } from '../repositories/BillingRepository';
import { DunningAttempt } from '../types';
import { logger } from '../utils/logger';
import { EventService } from './EventService';
import { StripeService } from './StripeService';

export class DunningService {
  private readonly MAX_DUNNING_ATTEMPTS = 3;
  private readonly DUNNING_INTERVALS = [1, 3, 7]; // days between attempts

  constructor(
    private stripeService: StripeService,
    private billingRepository: BillingRepository,
    private eventService: EventService
  ) {}

  /**
   * Start dunning process for a failed invoice
   */
  async startDunningProcess(
    invoiceId: string,
    subscriptionId: string
  ): Promise<void> {
    try {
      logger.info('Starting dunning process', { invoiceId, subscriptionId });

      // Create first dunning attempt
      const dunningAttempt: Omit<
        DunningAttempt,
        'id' | 'createdAt' | 'updatedAt'
      > = {
        subscriptionId,
        invoiceId,
        attemptNumber: 1,
        status: 'pending',
        nextAttemptAt: this.calculateNextAttemptDate(1),
        metadata: {},
      };

      // In a real implementation, you'd save this to the database
      // const createdAttempt = await this.billingRepository.createDunningAttempt(dunningAttempt);

      // Schedule the first retry
      await this.scheduleRetryAttempt(invoiceId, subscriptionId, 1);

      logger.info('Dunning process started', {
        invoiceId,
        subscriptionId,
        nextAttempt: dunningAttempt.nextAttemptAt,
      });
    } catch (error) {
      logger.error('Failed to start dunning process', {
        invoiceId,
        subscriptionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Process a dunning attempt
   */
  async processDunningAttempt(
    invoiceId: string,
    attemptNumber: number
  ): Promise<void> {
    try {
      logger.info('Processing dunning attempt', { invoiceId, attemptNumber });

      // Attempt to retry the invoice payment
      const invoice = await this.stripeService.retryInvoicePayment(invoiceId);

      if (invoice.status === 'paid') {
        // Payment succeeded
        await this.handleSuccessfulPayment(invoiceId, attemptNumber);
      } else {
        // Payment failed
        await this.handleFailedPayment(
          invoiceId,
          attemptNumber,
          'Payment method declined'
        );
      }
    } catch (error) {
      logger.error('Dunning attempt failed', {
        invoiceId,
        attemptNumber,
        error: error.message,
      });

      await this.handleFailedPayment(invoiceId, attemptNumber, error.message);
    }
  }

  /**
   * Handle successful payment after dunning
   */
  private async handleSuccessfulPayment(
    invoiceId: string,
    attemptNumber: number
  ): Promise<void> {
    logger.info('Dunning attempt succeeded', { invoiceId, attemptNumber });

    // Update dunning attempt status
    // In a real implementation, you'd update the database record
    // await this.billingRepository.updateDunningAttempt(attemptId, {
    //   status: 'succeeded',
    //   updatedAt: new Date(),
    // });

    // Publish success event
    await this.eventService.publishEvent({
      type: 'invoice.paid',
      userId: 'user-id', // You'd get this from the invoice/subscription
      data: {
        invoiceId,
        attemptNumber,
        recoveredAfterFailure: true,
      },
    });
  }

  /**
   * Handle failed payment during dunning
   */
  private async handleFailedPayment(
    invoiceId: string,
    attemptNumber: number,
    failureReason: string
  ): Promise<void> {
    logger.info('Dunning attempt failed', {
      invoiceId,
      attemptNumber,
      failureReason,
    });

    // Update dunning attempt status
    // In a real implementation, you'd update the database record
    // await this.billingRepository.updateDunningAttempt(attemptId, {
    //   status: 'failed',
    //   failureReason,
    //   updatedAt: new Date(),
    // });

    if (attemptNumber < this.MAX_DUNNING_ATTEMPTS) {
      // Schedule next attempt
      const nextAttemptNumber = attemptNumber + 1;
      await this.scheduleRetryAttempt(
        invoiceId,
        'subscription-id',
        nextAttemptNumber
      );

      logger.info('Next dunning attempt scheduled', {
        invoiceId,
        nextAttemptNumber,
        nextAttemptDate: this.calculateNextAttemptDate(nextAttemptNumber),
      });
    } else {
      // Max attempts reached, handle final failure
      await this.handleFinalFailure(invoiceId);
    }

    // Publish failure event
    await this.eventService.publishEvent({
      type: 'invoice.payment_failed',
      userId: 'user-id', // You'd get this from the invoice/subscription
      data: {
        invoiceId,
        attemptNumber,
        failureReason,
        maxAttemptsReached: attemptNumber >= this.MAX_DUNNING_ATTEMPTS,
      },
    });
  }

  /**
   * Handle final failure after all dunning attempts
   */
  private async handleFinalFailure(invoiceId: string): Promise<void> {
    logger.warn('All dunning attempts failed', { invoiceId });

    try {
      // In a real implementation, you might:
      // 1. Cancel the subscription
      // 2. Downgrade the account
      // 3. Send final notice email
      // 4. Mark account as delinquent

      // For now, just log the final failure
      logger.info(
        'Subscription marked for cancellation due to payment failure',
        {
          invoiceId,
        }
      );

      // Publish final failure event
      await this.eventService.publishEvent({
        type: 'subscription.cancelled',
        userId: 'user-id', // You'd get this from the invoice/subscription
        data: {
          reason: 'payment_failure',
          invoiceId,
          finalAttempt: true,
        },
      });
    } catch (error) {
      logger.error('Failed to handle final dunning failure', {
        invoiceId,
        error,
      });
    }
  }

  /**
   * Schedule a retry attempt
   */
  private async scheduleRetryAttempt(
    invoiceId: string,
    subscriptionId: string,
    attemptNumber: number
  ): Promise<void> {
    const nextAttemptDate = this.calculateNextAttemptDate(attemptNumber);

    // In a real implementation, you'd use a job scheduler like Bull/BullMQ
    // to schedule the retry attempt
    logger.info('Scheduling dunning retry', {
      invoiceId,
      subscriptionId,
      attemptNumber,
      scheduledFor: nextAttemptDate,
    });

    // For demonstration, we'll just log the scheduling
    // In practice, you'd do something like:
    // await this.jobQueue.add('process-dunning-attempt', {
    //   invoiceId,
    //   attemptNumber,
    // }, {
    //   delay: nextAttemptDate.getTime() - Date.now(),
    // });
  }

  /**
   * Calculate the next attempt date based on attempt number
   */
  private calculateNextAttemptDate(attemptNumber: number): Date {
    const daysToAdd = this.DUNNING_INTERVALS[attemptNumber - 1] || 7;
    const nextAttempt = new Date();
    nextAttempt.setDate(nextAttempt.getDate() + daysToAdd);
    return nextAttempt;
  }

  /**
   * Get dunning status for a subscription
   */
  async getDunningStatus(_subscriptionId: string): Promise<{
    hasFailedPayments: boolean;
    attemptCount: number;
    nextAttemptDate?: Date;
    lastFailureReason?: string;
  }> {
    // In a real implementation, you'd query the database for dunning attempts
    // For now, return a mock status
    return {
      hasFailedPayments: false,
      attemptCount: 0,
    };
  }

  /**
   * Cancel dunning process (e.g., when payment method is updated)
   */
  async cancelDunningProcess(subscriptionId: string): Promise<void> {
    logger.info('Cancelling dunning process', { subscriptionId });

    // In a real implementation, you'd:
    // 1. Cancel scheduled retry jobs
    // 2. Update dunning attempt records
    // 3. Clear any pending notifications

    logger.info('Dunning process cancelled', { subscriptionId });
  }

  /**
   * Send dunning notification to customer
   */
  private async sendDunningNotification(
    userId: string,
    attemptNumber: number,
    nextAttemptDate: Date
  ): Promise<void> {
    logger.info('Sending dunning notification', {
      userId,
      attemptNumber,
      nextAttemptDate,
    });

    // In a real implementation, you'd send an email notification
    // This might include:
    // 1. Payment failure notice
    // 2. Instructions to update payment method
    // 3. Warning about account suspension
    // 4. Next retry date
  }
}
