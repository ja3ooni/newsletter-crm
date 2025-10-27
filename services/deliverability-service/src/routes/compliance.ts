import { Router } from 'express';
import { ComplianceController } from '../controllers/ComplianceController';

const router = Router();
const complianceController = new ComplianceController();

// GDPR Consent Management Routes
router.post(
  '/consent',
  complianceController.recordConsent.bind(complianceController)
);
router.put(
  '/consent/withdraw',
  complianceController.withdrawConsent.bind(complianceController)
);
router.get(
  '/consent/:contactId',
  complianceController.getConsentStatus.bind(complianceController)
);

// GDPR Data Request Routes
router.post(
  '/data-requests',
  complianceController.submitDataRequest.bind(complianceController)
);
router.get(
  '/data-requests/:requestId',
  complianceController.getDataRequest.bind(complianceController)
);
router.post(
  '/data-requests/:contactId/right-to-be-forgotten',
  complianceController.processRightToBeForgotten.bind(complianceController)
);
router.delete(
  '/data-deletion/:deletionRequestId',
  complianceController.executeDeletion.bind(complianceController)
);
router.post(
  '/data-export/:contactId',
  complianceController.exportUserData.bind(complianceController)
);

// CAN-SPAM Compliance Routes
router.post(
  '/email/validate-compliance',
  complianceController.validateEmailCompliance.bind(complianceController)
);
router.post(
  '/email/:emailId/enforce-compliance',
  complianceController.enforceCompliance.bind(complianceController)
);

// Audit Logging Routes
router.get(
  '/audit-logs',
  complianceController.getAuditLogs.bind(complianceController)
);
router.post(
  '/audit-logs',
  complianceController.createAuditLog.bind(complianceController)
);

// Compliance Reporting Routes
router.post(
  '/reports',
  complianceController.generateComplianceReport.bind(complianceController)
);
router.get(
  '/reports/:reportId',
  complianceController.getComplianceReport.bind(complianceController)
);
router.get(
  '/metrics',
  complianceController.getComplianceMetrics.bind(complianceController)
);

// Webhook Routes for Compliance Events
router.post(
  '/webhooks/consent',
  complianceController.handleConsentWebhook.bind(complianceController)
);
router.post(
  '/webhooks/unsubscribe',
  complianceController.handleUnsubscribeWebhook.bind(complianceController)
);

// Enhanced Compliance Management Routes
router.get(
  '/violations',
  complianceController.getViolations.bind(complianceController)
);
router.put(
  '/violations/:violationId/resolve',
  complianceController.resolveViolation.bind(complianceController)
);

// Data Management Routes
router.post(
  '/data-cleanup',
  complianceController.performDataCleanup.bind(complianceController)
);
router.delete(
  '/data-requests/:requestId',
  complianceController.cancelDataRequest.bind(complianceController)
);

// Export Access Route
router.get(
  '/exports/:exportId',
  complianceController.getDataExport.bind(complianceController)
);

// Health Check Route
router.get(
  '/health-check',
  complianceController.getComplianceHealthCheck.bind(complianceController)
);

export default router;
