import { Router } from 'express';
import { BillingController } from '../controllers/BillingController';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  createSubscriptionSchema,
  createUsageRecordSchema,
  updateSubscriptionSchema,
} from '../utils/validation';

export function createBillingRoutes(
  billingController: BillingController
): Router {
  const router = Router();

  // Subscription management routes
  router.post(
    '/subscriptions',
    authMiddleware,
    validateRequest(createSubscriptionSchema),
    billingController.createSubscription.bind(billingController)
  );

  router.get(
    '/subscriptions/:subscriptionId',
    authMiddleware,
    billingController.getSubscription.bind(billingController)
  );

  router.put(
    '/subscriptions/:subscriptionId',
    authMiddleware,
    validateRequest(updateSubscriptionSchema),
    billingController.updateSubscription.bind(billingController)
  );

  router.post(
    '/subscriptions/:subscriptionId/cancel',
    authMiddleware,
    billingController.cancelSubscription.bind(billingController)
  );

  router.post(
    '/subscriptions/:subscriptionId/sync',
    authMiddleware,
    billingController.syncSubscription.bind(billingController)
  );

  // User subscription routes
  router.get(
    '/users/:userId/subscription',
    authMiddleware,
    billingController.getUserActiveSubscription.bind(billingController)
  );

  router.get(
    '/users/:userId/subscriptions',
    authMiddleware,
    billingController.getUserSubscriptionHistory.bind(billingController)
  );

  router.get(
    '/users/:userId/invoices',
    authMiddleware,
    billingController.getUserInvoices.bind(billingController)
  );

  // Current user routes (using token)
  router.get(
    '/my/subscription',
    authMiddleware,
    billingController.getUserActiveSubscription.bind(billingController)
  );

  router.get(
    '/my/subscriptions',
    authMiddleware,
    billingController.getUserSubscriptionHistory.bind(billingController)
  );

  router.get(
    '/my/invoices',
    authMiddleware,
    billingController.getUserInvoices.bind(billingController)
  );

  // Usage tracking routes
  router.post(
    '/usage',
    authMiddleware,
    validateRequest(createUsageRecordSchema),
    billingController.recordUsage.bind(billingController)
  );

  // Subscription plans routes
  router.get(
    '/plans',
    billingController.getSubscriptionPlans.bind(billingController)
  );

  // Webhook route (no auth required, verified by Stripe signature)
  router.post(
    '/webhooks/stripe',
    billingController.handleWebhook.bind(billingController)
  );

  return router;
}
