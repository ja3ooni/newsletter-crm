import { TemplateController } from '@/controllers/TemplateController';
import { auth } from '@/middleware/auth';
import { rateLimit } from '@/middleware/rateLimit';
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
router.use(auth);

router.post(
  '/',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
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
