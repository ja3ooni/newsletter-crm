import { TemplateController } from '@/controllers/TemplateController';
import { authMiddleware } from '@/middleware/auth';
import { rateLimiters } from '@/middleware/rateLimit';
import { Router } from 'express';

const router = Router();
const templateController = new TemplateController();

// Public routes
router.get(
  '/marketplace',
  templateController.getMarketplaceTemplates.bind(templateController)
);
router.get(
  '/category/:category',
  templateController.getTemplatesByCategory.bind(templateController)
);
router.get('/:id', templateController.getTemplateById.bind(templateController));
router.get('/', templateController.getTemplates.bind(templateController));

// Protected routes
router.use(authMiddleware.authenticate);

router.post(
  '/',
  rateLimiters.general,
  templateController.createTemplate.bind(templateController)
);
router.post(
  '/:id/customize',
  templateController.customizeTemplate.bind(templateController)
);
router.post(
  '/:id/duplicate',
  templateController.duplicateTemplate.bind(templateController)
);
router.post(
  '/:id/validate',
  templateController.validateTemplate.bind(templateController)
);
router.post(
  '/:id/preview',
  templateController.generatePreview.bind(templateController)
);
router.put('/:id', templateController.updateTemplate.bind(templateController));
router.delete(
  '/:id',
  templateController.deleteTemplate.bind(templateController)
);

export { router as templateRoutes };
