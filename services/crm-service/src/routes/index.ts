// @ts-nocheck
import { CRMController } from '@/controllers/CRMController';
import { authMiddleware } from '@/middleware/auth';
import { rateLimitMiddleware } from '@/middleware/rateLimit';
import { ContactRepository } from '@/repositories/ContactRepository';
import { SegmentRepository } from '@/repositories/SegmentRepository';
import { CRMService } from '@/services/CRMService';
import { Router } from 'express';
import { Pool } from 'pg';
import { createAutomationRoutes } from './automation';
import { createNotificationRoutes } from './notifications';

// This function will be called with a database pool
export function createCRMRoutes(db: Pool): Router {
  // Initialize repositories and services
  const contactRepository = new ContactRepository();
  const segmentRepository = new SegmentRepository();
  const crmService = new CRMService(contactRepository, segmentRepository);
  const crmController = new CRMController(crmService);

  const router = Router();

  // Apply authentication and rate limiting to all routes
  router.use(authMiddleware);
  router.use(rateLimitMiddleware);

  // ============================================================================
  // CONTACT ROUTES
  // ============================================================================

  // Contact CRUD operations
  router.post('/contacts', crmController.createContact);
  router.get('/contacts/search', crmController.searchContacts);
  router.get('/contacts/stats', crmController.getContactStats);
  router.get('/contacts/:id', crmController.getContact);
  router.put('/contacts/:id', crmController.updateContact);
  router.delete('/contacts/:id', crmController.deleteContact);

  // Contact journey and activities
  router.get('/contacts/:id/journey', crmController.getContactJourney);

  // Engagement tracking
  router.post('/contacts/:contactId/engagement', crmController.trackEngagement);

  // Lead scoring
  router.post('/contacts/:contactId/score', crmController.calculateLeadScore);

  // Contact enrichment
  router.post('/contacts/:contactId/enrich', crmController.enrichContact);

  // Duplicate detection
  router.get('/contacts/:contactId/duplicates', crmController.findDuplicates);

  // ============================================================================
  // SEGMENT ROUTES
  // ============================================================================

  // Segment CRUD operations
  router.post('/segments', crmController.createSegment);
  router.get('/segments', crmController.getAllSegments);
  router.get('/segments/:id', crmController.getSegment);
  router.put('/segments/:id', crmController.updateSegment);
  router.delete('/segments/:id', crmController.deleteSegment);

  // Segment contact management
  router.get('/segments/:id/contacts', crmController.getSegmentContacts);
  router.post('/segments/:id/contacts', crmController.addContactsToSegment);
  router.delete(
    '/segments/:id/contacts',
    crmController.removeContactsFromSegment
  );

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  router.post('/contacts/bulk', crmController.bulkUpdateContacts);

  // ============================================================================
  // AUTOMATION ROUTES
  // ============================================================================

  router.use('/automation', createAutomationRoutes(db));

  // ============================================================================
  // NOTIFICATION ROUTES
  // ============================================================================

  router.use('/notifications', createNotificationRoutes(db));

  // ============================================================================
  // INTEGRATION ROUTES
  // ============================================================================

  router.use('/integrations', integrationRoutes);

  return router;
}

// For backward compatibility, export a default router that can be used without db
const router = Router();
export default router;
