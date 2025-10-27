import { Request, Response } from 'express';
import { BillingRepository } from '../repositories/BillingRepository';
import { SubscriptionService } from '../services/SubscriptionService';
import { WebhookService } from '../services/WebhookService';
import {
  CreateSubscriptionRequest,
  CreateUsageRecordRequest,
  UpdateSubscriptionRequest,
} from '../types';
import { logger } from '../utils/logger';

export class BillingController {
  constructor(
    private subscriptionService: SubscriptionService,
    private billingRepository: BillingRepository,
    private webhookService: WebhookService
  ) {}

  /**
   * Create a new subscription
   */
  async createSubscription(req: Request, res: Response): Promise<void> {
    try {
      const subscriptionData: CreateSubscriptionRequest = req.body;

      // Add user ID from authenticated request
      subscriptionData.userId = req.user?.id || subscriptionData.userId;

      const subscription =
        await this.subscriptionService.createSubscription(subscriptionData);

      res.status(201).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to create subscription', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const subscription =
        await this.subscriptionService.getSubscription(subscriptionId);

      if (!subscription) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
        return;
      }

      // Check if user has access to this subscription
      if (req.user?.id !== subscription.userId && !req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to get subscription', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get user's active subscription
   */
  async getUserActiveSubscription(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || req.params.userId;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
        return;
      }

      // Check if user has access
      if (req.user?.id !== userId && !req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const subscription =
        await this.subscriptionService.getUserActiveSubscription(userId);

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to get user active subscription', {
        error: error.message,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get user's subscription history
   */
  async getUserSubscriptionHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || req.params.userId;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
        return;
      }

      // Check if user has access
      if (req.user?.id !== userId && !req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const subscriptions =
        await this.subscriptionService.getUserSubscriptionHistory(userId);

      res.json({
        success: true,
        data: subscriptions,
      });
    } catch (error) {
      logger.error('Failed to get user subscription history', {
        error: error.message,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const updateData: UpdateSubscriptionRequest = req.body;

      // Check if user has access to this subscription
      const existingSubscription =
        await this.subscriptionService.getSubscription(subscriptionId);
      if (!existingSubscription) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
        return;
      }

      if (req.user?.id !== existingSubscription.userId && !req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const subscription = await this.subscriptionService.updateSubscription(
        subscriptionId,
        updateData
      );

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to update subscription', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const { immediately = false } = req.body;

      // Check if user has access to this subscription
      const existingSubscription =
        await this.subscriptionService.getSubscription(subscriptionId);
      if (!existingSubscription) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
        return;
      }

      if (req.user?.id !== existingSubscription.userId && !req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const subscription = await this.subscriptionService.cancelSubscription(
        subscriptionId,
        immediately
      );

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to cancel subscription', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Record usage for metered billing
   */
  async recordUsage(req: Request, res: Response): Promise<void> {
    try {
      const usageData: CreateUsageRecordRequest = req.body;

      // Check if user has access to this subscription
      const subscription = await this.subscriptionService.getSubscription(
        usageData.subscriptionId
      );
      if (!subscription) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
        return;
      }

      if (req.user?.id !== subscription.userId && !req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const usageRecord = await this.subscriptionService.recordUsage(usageData);

      res.status(201).json({
        success: true,
        data: usageRecord,
      });
    } catch (error) {
      logger.error('Failed to record usage', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get subscription plans
   */
  async getSubscriptionPlans(req: Request, res: Response): Promise<void> {
    try {
      const plans = await this.billingRepository.getActiveSubscriptionPlans();

      res.json({
        success: true,
        data: plans,
      });
    } catch (error) {
      logger.error('Failed to get subscription plans', {
        error: error.message,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get user invoices
   */
  async getUserInvoices(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || req.params.userId;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
        return;
      }

      // Check if user has access
      if (req.user?.id !== userId && !req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const invoices = await this.billingRepository.getInvoicesByUserId(
        userId,
        limit
      );

      res.json({
        success: true,
        data: invoices,
      });
    } catch (error) {
      logger.error('Failed to get user invoices', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Sync subscription with Stripe
   */
  async syncSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;

      // Check if user has access to this subscription
      const existingSubscription =
        await this.subscriptionService.getSubscription(subscriptionId);
      if (!existingSubscription) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found',
        });
        return;
      }

      if (req.user?.id !== existingSubscription.userId && !req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const subscription =
        await this.subscriptionService.syncSubscriptionWithStripe(
          subscriptionId
        );

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to sync subscription', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const payload = req.body;

      await this.webhookService.processWebhook(payload, signature);

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Webhook processing failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: 'Webhook processing failed',
      });
    }
  }
}
