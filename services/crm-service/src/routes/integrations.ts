import { Router } from 'express';
import { IntegrationController } from '../controllers/IntegrationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const integrationController = new IntegrationController();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Integration CRUD operations
router.post(
  '/',
  integrationController.createIntegration.bind(integrationController)
);
router.get(
  '/',
  integrationController.getIntegrations.bind(integrationController)
);
router.get(
  '/stats',
  integrationController.getIntegrationStats.bind(integrationController)
);
router.get(
  '/:integrationId',
  integrationController.getIntegration.bind(integrationController)
);
router.put(
  '/:integrationId',
  integrationController.updateIntegration.bind(integrationController)
);
router.delete(
  '/:integrationId',
  integrationController.deleteIntegration.bind(integrationController)
);

// Integration testing
router.post(
  '/:integrationId/test',
  integrationController.testIntegration.bind(integrationController)
);
router.post(
  '/test-all',
  integrationController.testAllIntegrations.bind(integrationController)
);

// Integration synchronization
router.post(
  '/:integrationId/sync',
  integrationController.syncIntegration.bind(integrationController)
);
router.post(
  '/sync-all',
  integrationController.syncAllIntegrations.bind(integrationController)
);

// Integration mappings
router.get(
  '/:integrationId/mappings',
  integrationController.getMappings.bind(integrationController)
);

export default router;
