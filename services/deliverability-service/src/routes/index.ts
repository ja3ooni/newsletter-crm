import { Router } from 'express';
import { DeliverabilityController } from '../controllers/DeliverabilityController';

const router = Router();
const deliverabilityController = new DeliverabilityController();

// Sender reputation routes
router.get(
  '/reputation/:domain/:ip',
  deliverabilityController.getSenderReputation.bind(deliverabilityController)
);
router.post(
  '/reputation/check',
  deliverabilityController.checkReputation.bind(deliverabilityController)
);

// Bounce handling routes
router.post(
  '/bounces',
  deliverabilityController.handleBounce.bind(deliverabilityController)
);
router.get(
  '/bounces/:email',
  deliverabilityController.getBounceHistory.bind(deliverabilityController)
);

// Suppression list routes
router.post(
  '/suppression',
  deliverabilityController.addToSuppression.bind(deliverabilityController)
);
router.delete(
  '/suppression/:email',
  deliverabilityController.removeFromSuppression.bind(deliverabilityController)
);
router.get(
  '/suppression/check/:email',
  deliverabilityController.checkSuppression.bind(deliverabilityController)
);
router.get(
  '/suppression',
  deliverabilityController.getSuppressionList.bind(deliverabilityController)
);

// Authentication validation routes
router.get(
  '/auth/spf/:domain',
  deliverabilityController.validateSPF.bind(deliverabilityController)
);
router.get(
  '/auth/dkim/:domain/:selector?',
  deliverabilityController.validateDKIM.bind(deliverabilityController)
);
router.get(
  '/auth/dmarc/:domain',
  deliverabilityController.validateDMARC.bind(deliverabilityController)
);

// Blacklist checking routes
router.get(
  '/blacklist/:ip',
  deliverabilityController.checkBlacklist.bind(deliverabilityController)
);
router.post(
  '/blacklist/bulk',
  deliverabilityController.bulkBlacklistCheck.bind(deliverabilityController)
);

// Deliverability reporting routes
router.get(
  '/reports/:newsletterId',
  deliverabilityController.getDeliverabilityReport.bind(
    deliverabilityController
  )
);
router.post(
  '/reports/generate',
  deliverabilityController.generateReport.bind(deliverabilityController)
);
router.get(
  '/reports',
  deliverabilityController.getReports.bind(deliverabilityController)
);

// Email validation routes
router.post(
  '/validate/email',
  deliverabilityController.validateEmail.bind(deliverabilityController)
);
router.post(
  '/validate/bulk',
  deliverabilityController.bulkEmailValidation.bind(deliverabilityController)
);

// Alerts and monitoring routes
router.get(
  '/alerts',
  deliverabilityController.getAlerts.bind(deliverabilityController)
);
router.put(
  '/alerts/:alertId/resolve',
  deliverabilityController.resolveAlert.bind(deliverabilityController)
);

// Insights and recommendations routes
router.get(
  '/insights/:newsletterId?',
  deliverabilityController.getInsights.bind(deliverabilityController)
);
router.get(
  '/recommendations',
  deliverabilityController.getRecommendations.bind(deliverabilityController)
);

// Webhook endpoints for bounce/complaint handling
router.post(
  '/webhooks/bounce',
  deliverabilityController.handleBounceWebhook.bind(deliverabilityController)
);
router.post(
  '/webhooks/complaint',
  deliverabilityController.handleComplaintWebhook.bind(deliverabilityController)
);
router.post(
  '/webhooks/delivery',
  deliverabilityController.handleDeliveryWebhook.bind(deliverabilityController)
);

// Compliance routes
router.use('/compliance', complianceRoutes);

export default router;
