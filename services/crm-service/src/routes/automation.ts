import { CRMAutomationController } from '@/controllers/CRMAutomationController';
import { authenticateToken } from '@/middleware/auth';
import { ContactRepository } from '@/repositories/ContactRepository';
import { EngagementEventRepository } from '@/repositories/EngagementEventRepository';
import { LeadScoringRepository } from '@/repositories/LeadScoringRepository';
import { SegmentRepository } from '@/repositories/SegmentRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { TerritoryRepository } from '@/repositories/TerritoryRepository';
import { CRMAnalyticsService } from '@/services/CRMAnalyticsService';
import { CRMAutomationService } from '@/services/CRMAutomationService';
import { InterServiceClient } from '@/utils/InterServiceClient';
import { Router } from 'express';
import { Pool } from 'pg';

export function createAutomationRoutes(db: Pool): Router {
  const router = Router();

  // Initialize repositories
  const territoryRepository = new TerritoryRepository(db);
  const contactRepository = new ContactRepository();
  const segmentRepository = new SegmentRepository();
  const leadScoringRepository = new LeadScoringRepository(db);
  const taskRepository = new TaskRepository(db);
  const engagementEventRepository = new EngagementEventRepository(db);

  // Initialize services
  const interServiceClient = new InterServiceClient();
  const automationService = new CRMAutomationService(
    contactRepository,
    segmentRepository,
    leadScoringRepository,
    taskRepository,
    territoryRepository,
    engagementEventRepository,
    interServiceClient
  );
  const analyticsService = new CRMAnalyticsService(db);

  // Initialize controller
  const controller = new CRMAutomationController(
    automationService,
    analyticsService,
    territoryRepository
  );

  // Apply authentication middleware to all routes
  router.use(authenticateToken);

  // ============================================================================
  // TERRITORY MANAGEMENT ROUTES
  // ============================================================================

  // Territory CRUD operations
  router.post('/territories', controller.createTerritory.bind(controller));
  router.get('/territories', controller.getAllTerritories.bind(controller));
  router.get('/territories/:id', controller.getTerritory.bind(controller));
  router.put('/territories/:id', controller.updateTerritory.bind(controller));
  router.delete(
    '/territories/:id',
    controller.deleteTerritory.bind(controller)
  );

  // Territory assignments
  router.post(
    '/territories/:id/assignments',
    controller.assignUserToTerritory.bind(controller)
  );
  router.delete(
    '/territories/:id/assignments/:userId',
    controller.unassignUserFromTerritory.bind(controller)
  );
  router.get(
    '/territories/:id/assignments',
    controller.getTerritoryAssignments.bind(controller)
  );

  // Territory analytics
  router.get(
    '/territories/coverage/stats',
    controller.getTerritoryCoverage.bind(controller)
  );
  router.get(
    '/users/:userId/territories',
    controller.getUserTerritories.bind(controller)
  );

  // ============================================================================
  // AUTOMATION TRIGGER ROUTES
  // ============================================================================

  // Individual automation triggers
  router.post(
    '/contacts/:contactId/automation/lead-assignment',
    controller.triggerLeadAssignment.bind(controller)
  );
  router.post(
    '/contacts/:contactId/automation/follow-up-sequence',
    controller.triggerFollowUpSequence.bind(controller)
  );
  router.post(
    '/contacts/:contactId/automation/lead-qualification',
    controller.triggerLeadQualification.bind(controller)
  );
  router.post(
    '/contacts/:contactId/automation/data-enrichment',
    controller.triggerDataEnrichment.bind(controller)
  );

  // Bulk automation operations
  router.post(
    '/automation/bulk/assign-contacts',
    controller.bulkAssignContacts.bind(controller)
  );
  router.post(
    '/automation/bulk/trigger',
    controller.bulkTriggerAutomation.bind(controller)
  );

  // ============================================================================
  // ANALYTICS AND REPORTING ROUTES
  // ============================================================================

  // Dashboard metrics
  router.get(
    '/analytics/dashboard/metrics',
    controller.getDashboardMetrics.bind(controller)
  );

  // Custom dashboards
  router.post(
    '/analytics/dashboards',
    controller.createCustomDashboard.bind(controller)
  );
  router.get(
    '/analytics/dashboards',
    controller.getUserDashboards.bind(controller)
  );
  router.get(
    '/analytics/dashboards/:id',
    controller.getCustomDashboard.bind(controller)
  );

  // ============================================================================
  // WEBHOOK ROUTES FOR AUTOMATION EVENTS
  // ============================================================================

  // Webhook endpoint for contact events
  router.post('/webhooks/contact-created', async (req, res) => {
    try {
      const { contact } = req.body;
      await automationService.handleContactCreated(contact);
      res.json({ success: true });
    } catch (error) {
      console.error('Error handling contact created webhook:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  router.post('/webhooks/contact-updated', async (req, res) => {
    try {
      const { contact } = req.body;
      await automationService.handleContactUpdated(contact);
      res.json({ success: true });
    } catch (error) {
      console.error('Error handling contact updated webhook:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  router.post('/webhooks/engagement-event', async (req, res) => {
    try {
      const { event } = req.body;
      await automationService.handleEngagementEvent(event);
      res.json({ success: true });
    } catch (error) {
      console.error('Error handling engagement event webhook:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  router.post('/webhooks/score-threshold', async (req, res) => {
    try {
      const { contactId, newScore } = req.body;
      await automationService.handleScoreThresholdReached(contactId, newScore);
      res.json({ success: true });
    } catch (error) {
      console.error('Error handling score threshold webhook:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  return router;
}
