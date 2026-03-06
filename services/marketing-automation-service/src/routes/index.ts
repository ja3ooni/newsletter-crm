// @ts-nocheck
import DripCampaignController from '@/controllers/DripCampaignController';
import EventController from '@/controllers/EventController';
import WorkflowController from '@/controllers/WorkflowController';
import { Router } from 'express';
import { body, param, query } from 'express-validator';

const router = Router();

// Initialize controllers
const workflowController = new WorkflowController();
const dripCampaignController = new DripCampaignController();
const eventController = new EventController();
const integrationController = new IntegrationController();

// ============================================================================
// WORKFLOW ROUTES
// ============================================================================

// Workflow management
router.post(
  '/workflows',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('description').optional().isString(),
    body('trigger').isObject().withMessage('Trigger is required'),
    body('steps')
      .isArray({ min: 1 })
      .withMessage('At least one step is required'),
  ],
  workflowController.createWorkflow.bind(workflowController)
);

router.get(
  '/workflows',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
  workflowController.getWorkflows.bind(workflowController)
);

router.get(
  '/workflows/:id',
  [param('id').isUUID().withMessage('Invalid workflow ID')],
  workflowController.getWorkflow.bind(workflowController)
);

router.put(
  '/workflows/:id',
  [
    param('id').isUUID().withMessage('Invalid workflow ID'),
    body('name').optional().notEmpty(),
    body('description').optional().isString(),
    body('trigger').optional().isObject(),
    body('steps').optional().isArray(),
    body('status').optional().isIn(['active', 'paused', 'draft']),
  ],
  workflowController.updateWorkflow.bind(workflowController)
);

router.delete(
  '/workflows/:id',
  [param('id').isUUID().withMessage('Invalid workflow ID')],
  workflowController.deleteWorkflow.bind(workflowController)
);

router.post(
  '/workflows/:id/activate',
  [param('id').isUUID().withMessage('Invalid workflow ID')],
  workflowController.activateWorkflow.bind(workflowController)
);

router.post(
  '/workflows/:id/pause',
  [param('id').isUUID().withMessage('Invalid workflow ID')],
  workflowController.pauseWorkflow.bind(workflowController)
);

// Workflow execution
router.post(
  '/workflows/:id/trigger',
  [
    param('id').isUUID().withMessage('Invalid workflow ID'),
    body('contactId').notEmpty().withMessage('Contact ID is required'),
    body('metadata').optional().isObject(),
  ],
  workflowController.triggerWorkflow.bind(workflowController)
);

router.get(
  '/workflows/:id/executions',
  [
    param('id').isUUID().withMessage('Invalid workflow ID'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  workflowController.getWorkflowExecutions.bind(workflowController)
);

router.get(
  '/executions/:executionId',
  [param('executionId').isUUID().withMessage('Invalid execution ID')],
  workflowController.getWorkflowExecution.bind(workflowController)
);

router.post(
  '/executions/:executionId/pause',
  [param('executionId').isUUID().withMessage('Invalid execution ID')],
  workflowController.pauseExecution.bind(workflowController)
);

router.post(
  '/executions/:executionId/resume',
  [param('executionId').isUUID().withMessage('Invalid execution ID')],
  workflowController.resumeExecution.bind(workflowController)
);

// Workflow analytics
router.get(
  '/workflows/:id/analytics',
  [param('id').isUUID().withMessage('Invalid workflow ID')],
  workflowController.getWorkflowAnalytics.bind(workflowController)
);

// ============================================================================
// DRIP CAMPAIGN ROUTES
// ============================================================================

// Drip campaign management
router.post(
  '/drip-campaigns',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('description').optional().isString(),
    body('emails')
      .isArray({ min: 1 })
      .withMessage('At least one email is required'),
    body('trigger').isObject().withMessage('Trigger is required'),
    body('targetSegments').optional().isArray(),
  ],
  dripCampaignController.createDripCampaign.bind(dripCampaignController)
);

router.get(
  '/drip-campaigns',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
  dripCampaignController.getDripCampaigns.bind(dripCampaignController)
);

router.get(
  '/drip-campaigns/:id',
  [param('id').isUUID().withMessage('Invalid campaign ID')],
  dripCampaignController.getDripCampaign.bind(dripCampaignController)
);

router.put(
  '/drip-campaigns/:id',
  [
    param('id').isUUID().withMessage('Invalid campaign ID'),
    body('name').optional().notEmpty(),
    body('description').optional().isString(),
    body('emails').optional().isArray(),
    body('trigger').optional().isObject(),
    body('status').optional().isIn(['active', 'paused', 'completed', 'draft']),
    body('targetSegments').optional().isArray(),
  ],
  dripCampaignController.updateDripCampaign.bind(dripCampaignController)
);

router.delete(
  '/drip-campaigns/:id',
  [param('id').isUUID().withMessage('Invalid campaign ID')],
  dripCampaignController.deleteDripCampaign.bind(dripCampaignController)
);

router.post(
  '/drip-campaigns/:id/activate',
  [param('id').isUUID().withMessage('Invalid campaign ID')],
  dripCampaignController.activateDripCampaign.bind(dripCampaignController)
);

router.post(
  '/drip-campaigns/:id/pause',
  [param('id').isUUID().withMessage('Invalid campaign ID')],
  dripCampaignController.pauseDripCampaign.bind(dripCampaignController)
);

// Subscription management
router.post(
  '/drip-campaigns/:id/subscribe',
  [
    param('id').isUUID().withMessage('Invalid campaign ID'),
    body('contactId').notEmpty().withMessage('Contact ID is required'),
    body('metadata').optional().isObject(),
  ],
  dripCampaignController.subscribeToCampaign.bind(dripCampaignController)
);

router.post(
  '/subscriptions/:subscriptionId/unsubscribe',
  [param('subscriptionId').isUUID().withMessage('Invalid subscription ID')],
  dripCampaignController.unsubscribeFromCampaign.bind(dripCampaignController)
);

router.post(
  '/subscriptions/:subscriptionId/pause',
  [param('subscriptionId').isUUID().withMessage('Invalid subscription ID')],
  dripCampaignController.pauseSubscription.bind(dripCampaignController)
);

router.post(
  '/subscriptions/:subscriptionId/resume',
  [param('subscriptionId').isUUID().withMessage('Invalid subscription ID')],
  dripCampaignController.resumeSubscription.bind(dripCampaignController)
);

router.get(
  '/drip-campaigns/:id/subscriptions',
  [
    param('id').isUUID().withMessage('Invalid campaign ID'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  dripCampaignController.getCampaignSubscriptions.bind(dripCampaignController)
);

// Drip campaign analytics
router.get(
  '/drip-campaigns/:id/analytics',
  [param('id').isUUID().withMessage('Invalid campaign ID')],
  dripCampaignController.getCampaignAnalytics.bind(dripCampaignController)
);

// Batch operations
router.post(
  '/drip-campaigns/process-active',
  dripCampaignController.processActiveSubscriptions.bind(dripCampaignController)
);

// ============================================================================
// EVENT ROUTES
// ============================================================================

// Event management
router.post(
  '/events',
  [
    body('type').notEmpty().withMessage('Event type is required'),
    body('contactId').notEmpty().withMessage('Contact ID is required'),
    body('data').isObject().withMessage('Event data is required'),
    body('source').optional().isString(),
  ],
  eventController.createEvent.bind(eventController)
);

router.get(
  '/events/:id',
  [param('id').isUUID().withMessage('Invalid event ID')],
  eventController.getEvent.bind(eventController)
);

router.get(
  '/contacts/:contactId/events',
  [
    param('contactId').notEmpty().withMessage('Contact ID is required'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  eventController.getEventsByContact.bind(eventController)
);

router.get(
  '/events/type/:eventType',
  [
    param('eventType').notEmpty().withMessage('Event type is required'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  eventController.getEventsByType.bind(eventController)
);

router.post(
  '/events/:id/process',
  [param('id').isUUID().withMessage('Invalid event ID')],
  eventController.processEvent.bind(eventController)
);

router.post(
  '/events/process-unprocessed',
  [query('batchSize').optional().isInt({ min: 1, max: 1000 })],
  eventController.processUnprocessedEvents.bind(eventController)
);

// Event trigger management
router.post(
  '/event-triggers',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('eventType').notEmpty().withMessage('Event type is required'),
    body('conditions').isArray().withMessage('Conditions must be an array'),
    body('workflowId').optional().isUUID(),
    body('campaignId').optional().isUUID(),
  ],
  eventController.createEventTrigger.bind(eventController)
);

router.get(
  '/event-triggers',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  eventController.getEventTriggers.bind(eventController)
);

router.get(
  '/event-triggers/:id',
  [param('id').isUUID().withMessage('Invalid trigger ID')],
  eventController.getEventTrigger.bind(eventController)
);

router.put(
  '/event-triggers/:id',
  [
    param('id').isUUID().withMessage('Invalid trigger ID'),
    body('name').optional().notEmpty(),
    body('conditions').optional().isArray(),
    body('isActive').optional().isBoolean(),
  ],
  eventController.updateEventTrigger.bind(eventController)
);

router.delete(
  '/event-triggers/:id',
  [param('id').isUUID().withMessage('Invalid trigger ID')],
  eventController.deleteEventTrigger.bind(eventController)
);

router.post(
  '/event-triggers/:id/activate',
  [param('id').isUUID().withMessage('Invalid trigger ID')],
  eventController.activateEventTrigger.bind(eventController)
);

router.post(
  '/event-triggers/:id/deactivate',
  [param('id').isUUID().withMessage('Invalid trigger ID')],
  eventController.deactivateEventTrigger.bind(eventController)
);

// Event analytics
router.get(
  '/events/stats',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  eventController.getEventStats.bind(eventController)
);

// Maintenance
router.post(
  '/events/cleanup',
  [query('olderThanDays').optional().isInt({ min: 1 })],
  eventController.cleanupOldEvents.bind(eventController)
);

// ============================================================================
// INTEGRATION ROUTES
// ============================================================================

// Integration Management
router.post(
  '/integrations',
  [
    body('id').notEmpty().withMessage('Integration ID is required'),
    body('name').notEmpty().withMessage('Integration name is required'),
    body('type')
      .isIn(['google_analytics', 'facebook_pixel', 'zapier', 'segment'])
      .withMessage('Invalid integration type'),
    body('credentials').isObject().withMessage('Credentials are required'),
    body('settings').optional().isObject(),
    body('isActive').optional().isBoolean(),
    body('trackingSettings').optional().isObject(),
  ],
  integrationController.createIntegration.bind(integrationController)
);

router.get(
  '/integrations',
  integrationController.getIntegrations.bind(integrationController)
);

router.get(
  '/integrations/:id',
  [param('id').notEmpty().withMessage('Integration ID is required')],
  integrationController.getIntegration.bind(integrationController)
);

router.put(
  '/integrations/:id',
  [
    param('id').notEmpty().withMessage('Integration ID is required'),
    body('name').optional().notEmpty(),
    body('credentials').optional().isObject(),
    body('settings').optional().isObject(),
    body('isActive').optional().isBoolean(),
    body('trackingSettings').optional().isObject(),
  ],
  integrationController.updateIntegration.bind(integrationController)
);

router.delete(
  '/integrations/:id',
  [param('id').notEmpty().withMessage('Integration ID is required')],
  integrationController.deleteIntegration.bind(integrationController)
);

// Integration Testing
router.post(
  '/integrations/:id/test',
  [param('id').notEmpty().withMessage('Integration ID is required')],
  integrationController.testIntegration.bind(integrationController)
);

router.post(
  '/integrations/test-all',
  integrationController.testAllIntegrations.bind(integrationController)
);

// Event Tracking
router.post(
  '/integrations/track/page-view',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('page').notEmpty().withMessage('Page URL is required'),
    body('properties').optional().isObject(),
  ],
  integrationController.trackPageView.bind(integrationController)
);

router.post(
  '/integrations/track/event',
  [
    body('eventName').notEmpty().withMessage('Event name is required'),
    body('eventType')
      .isIn(['page_view', 'click', 'conversion', 'custom'])
      .withMessage('Invalid event type'),
    body('properties').isObject().withMessage('Event properties are required'),
    body('userId').optional().isString(),
    body('sessionId').optional().isString(),
    body('source').optional().isString(),
    body('timestamp').optional().isISO8601(),
  ],
  integrationController.trackEvent.bind(integrationController)
);

router.post(
  '/integrations/track/conversion',
  [
    body('eventName').notEmpty().withMessage('Event name is required'),
    body('conversionType')
      .isIn(['purchase', 'signup', 'lead', 'custom'])
      .withMessage('Invalid conversion type'),
    body('properties')
      .isObject()
      .withMessage('Conversion properties are required'),
    body('userId').optional().isString(),
    body('sessionId').optional().isString(),
    body('value').optional().isNumeric(),
    body('currency').optional().isString(),
    body('timestamp').optional().isISO8601(),
  ],
  integrationController.trackConversion.bind(integrationController)
);

router.post(
  '/integrations/track/custom',
  [
    body('eventName').notEmpty().withMessage('Event name is required'),
    body('properties').isObject().withMessage('Event properties are required'),
  ],
  integrationController.trackCustomEvent.bind(integrationController)
);

// Batch Operations
router.post(
  '/integrations/track/batch',
  [
    body('events')
      .isArray({ min: 1 })
      .withMessage('At least one event is required'),
    body('events.*.eventName')
      .notEmpty()
      .withMessage('Event name is required for each event'),
    body('events.*.eventType')
      .isIn(['page_view', 'click', 'conversion', 'custom'])
      .withMessage('Invalid event type'),
    body('events.*.properties')
      .isObject()
      .withMessage('Event properties are required for each event'),
  ],
  integrationController.trackBatchEvents.bind(integrationController)
);

// Statistics and Analytics
router.get(
  '/integrations/stats',
  integrationController.getIntegrationStats.bind(integrationController)
);

// Webhook Handling
router.post(
  '/integrations/:integrationId/webhook',
  [param('integrationId').notEmpty().withMessage('Integration ID is required')],
  integrationController.handleWebhook.bind(integrationController)
);

// Data Export/Import
router.get(
  '/integrations/:integrationId/export',
  [
    param('integrationId').notEmpty().withMessage('Integration ID is required'),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  integrationController.exportIntegrationData.bind(integrationController)
);

router.post(
  '/integrations/:integrationId/import',
  [
    param('integrationId').notEmpty().withMessage('Integration ID is required'),
    body('data').isObject().withMessage('Import data is required'),
  ],
  integrationController.importIntegrationData.bind(integrationController)
);

// ============================================================================
// HEALTH CHECK ROUTE
// ============================================================================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Marketing Automation Service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

export default router;
