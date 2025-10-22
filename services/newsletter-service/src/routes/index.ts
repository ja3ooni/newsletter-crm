import { ContentLibraryController } from '@/controllers/ContentLibraryController'
import { NewsletterController } from '@/controllers/NewsletterController'
import { authMiddleware } from '@/middleware/auth'
import { asyncHandler } from '@/middleware/errorHandler'
import { rateLimiters } from '@/middleware/rateLimit'
import { Router } from 'express'

// Import services and repositories
import { ContentLibraryRepository } from '@/repositories/ContentLibraryRepository'
import { NewsletterRepository } from '@/repositories/NewsletterRepository'
import { TemplateRepository } from '@/repositories/TemplateRepository'
import { ABTestService } from '@/services/ABTestService'
import { ApprovalWorkflowService } from '@/services/ApprovalWorkflowService'
import { ContentAnalyticsService } from '@/services/ContentAnalyticsService'
import { ContentBlockService } from '@/services/ContentBlockService'
import { ContentLibraryService } from '@/services/ContentLibraryService'
import { NewsletterService } from '@/services/NewsletterService'
import { PersonalizationService } from '@/services/PersonalizationService'
import { SchedulingService } from '@/services/SchedulingService'

// Initialize repositories
const newsletterRepository = new NewsletterRepository()
const templateRepository = new TemplateRepository()
const contentLibraryRepository = new ContentLibraryRepository()

// Initialize services
const personalizationService = new PersonalizationService()
const abTestService = new ABTestService()
const schedulingService = new SchedulingService()
const approvalWorkflowService = new ApprovalWorkflowService()
const contentBlockService = new ContentBlockService()
const contentAnalyticsService = new ContentAnalyticsService()
const contentLibraryService = new ContentLibraryService(
  contentLibraryRepository,
  approvalWorkflowService
)

const newsletterService = new NewsletterService(
  newsletterRepository,
  templateRepository,
  contentLibraryRepository,
  personalizationService,
  abTestService,
  schedulingService
)

// Initialize controllers
const newsletterController = new NewsletterController(newsletterService)
const contentLibraryController = new ContentLibraryController(
  contentLibraryService,
  approvalWorkflowService,
  contentBlockService,
  contentAnalyticsService
)

const router = Router()

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'newsletter-service',
    timestamp: new Date().toISOString(),
  })
})

// Newsletter routes
router.post(
  '/newsletters',
  rateLimiters.newsletterCreation,
  authMiddleware.authenticate,
  asyncHandler(newsletterController.createNewsletter.bind(newsletterController))
)

router.post(
  '/newsletters/generate-content',
  rateLimiters.contentGeneration,
  authMiddleware.authenticate,
  asyncHandler(newsletterController.generateContent.bind(newsletterController))
)

router.get(
  '/newsletters',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(newsletterController.getNewsletters.bind(newsletterController))
)

router.get(
  '/newsletters/:id',
  rateLimiters.general,
  authMiddleware.authenticate,
  authMiddleware.requireOwnership(),
  asyncHandler(newsletterController.getNewsletter.bind(newsletterController))
)

router.put(
  '/newsletters/:id',
  rateLimiters.general,
  authMiddleware.authenticate,
  authMiddleware.requireOwnership(),
  asyncHandler(newsletterController.updateNewsletter.bind(newsletterController))
)

router.delete(
  '/newsletters/:id',
  rateLimiters.strict,
  authMiddleware.authenticate,
  authMiddleware.requireOwnership(),
  asyncHandler(newsletterController.deleteNewsletter.bind(newsletterController))
)

router.post(
  '/newsletters/:id/schedule',
  rateLimiters.general,
  authMiddleware.authenticate,
  authMiddleware.requireOwnership(),
  asyncHandler(newsletterController.scheduleNewsletter.bind(newsletterController))
)

router.post(
  '/newsletters/:id/send',
  rateLimiters.emailSending,
  authMiddleware.authenticate,
  authMiddleware.requireOwnership(),
  asyncHandler(newsletterController.sendNewsletter.bind(newsletterController))
)

router.post(
  '/newsletters/:id/duplicate',
  rateLimiters.newsletterCreation,
  authMiddleware.authenticate,
  authMiddleware.requireOwnership(),
  asyncHandler(newsletterController.duplicateNewsletter.bind(newsletterController))
)

router.get(
  '/newsletters/:id/preview',
  rateLimiters.preview,
  authMiddleware.optionalAuth,
  asyncHandler(newsletterController.previewNewsletter.bind(newsletterController))
)

router.get(
  '/newsletters/:id/analytics',
  rateLimiters.analytics,
  authMiddleware.authenticate,
  authMiddleware.requireOwnership(),
  asyncHandler(newsletterController.getAnalytics.bind(newsletterController))
)

router.get(
  '/newsletters/:id/deliverability',
  rateLimiters.analytics,
  authMiddleware.authenticate,
  authMiddleware.requireOwnership(),
  asyncHandler(newsletterController.getDeliverabilityReport.bind(newsletterController))
)

// API routes (with API key authentication)
router.use('/api', rateLimiters.apiKey)

router.post(
  '/api/newsletters',
  authMiddleware.apiKey,
  asyncHandler(newsletterController.createNewsletter.bind(newsletterController))
)

router.get(
  '/api/newsletters',
  authMiddleware.apiKey,
  asyncHandler(newsletterController.getNewsletters.bind(newsletterController))
)

router.get(
  '/api/newsletters/:id',
  authMiddleware.apiKey,
  asyncHandler(newsletterController.getNewsletter.bind(newsletterController))
)

router.post(
  '/api/newsletters/:id/send',
  authMiddleware.apiKey,
  asyncHandler(newsletterController.sendNewsletter.bind(newsletterController))
)

// ============================================================================
// CONTENT MANAGEMENT ROUTES
// ============================================================================

// Content Library Item routes
router.post(
  '/content/items',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.createItem.bind(contentLibraryController))
)

router.get(
  '/content/items',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getItems.bind(contentLibraryController))
)

router.get(
  '/content/items/:id',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getItem.bind(contentLibraryController))
)

router.put(
  '/content/items/:id',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.updateItem.bind(contentLibraryController))
)

router.delete(
  '/content/items/:id',
  rateLimiters.strict,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.deleteItem.bind(contentLibraryController))
)

router.post(
  '/content/items/:id/duplicate',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.duplicateItem.bind(contentLibraryController))
)

// Content search and filtering
router.get(
  '/content/search',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.searchContent.bind(contentLibraryController))
)

router.get(
  '/content/tags',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getAllTags.bind(contentLibraryController))
)

router.get(
  '/content/categories',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getAllCategories.bind(contentLibraryController))
)

router.get(
  '/content/by-tags',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getItemsByTags.bind(contentLibraryController))
)

router.get(
  '/content/by-category/:category',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getItemsByCategory.bind(contentLibraryController))
)

// Approval workflow routes
router.get(
  '/content/pending-approval',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getPendingApprovalItems.bind(contentLibraryController))
)

router.post(
  '/content/items/:id/approve',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.approveItem.bind(contentLibraryController))
)

router.post(
  '/content/items/:id/reject',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.rejectItem.bind(contentLibraryController))
)

router.get(
  '/content/items/:id/workflow',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getApprovalWorkflow.bind(contentLibraryController))
)

router.post(
  '/content/workflows/:workflowId/approve',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.submitApproval.bind(contentLibraryController))
)

router.get(
  '/content/pending-approvals',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getPendingApprovals.bind(contentLibraryController))
)

// Content Blocks routes
router.post(
  '/content/blocks',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.createBlock.bind(contentLibraryController))
)

router.get(
  '/content/blocks',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getBlocks.bind(contentLibraryController))
)

router.get(
  '/content/blocks/:id',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getBlock.bind(contentLibraryController))
)

router.put(
  '/content/blocks/:id',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.updateBlock.bind(contentLibraryController))
)

router.delete(
  '/content/blocks/:id',
  rateLimiters.strict,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.deleteBlock.bind(contentLibraryController))
)

router.post(
  '/content/blocks/:id/duplicate',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.duplicateBlock.bind(contentLibraryController))
)

router.get(
  '/content/blocks/reusable',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getReusableBlocks.bind(contentLibraryController))
)

router.get(
  '/content/blocks/by-category/:category',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getBlocksByCategory.bind(contentLibraryController))
)

router.post(
  '/content/blocks/:id/render',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.renderBlock.bind(contentLibraryController))
)

router.get(
  '/content/block-categories',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getBlockCategories.bind(contentLibraryController))
)

// Content Analytics routes
router.post(
  '/content/items/:contentId/track',
  rateLimiters.analytics,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.trackContentPerformance.bind(contentLibraryController))
)

router.get(
  '/content/items/:contentId/analytics',
  rateLimiters.analytics,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getContentAnalytics.bind(contentLibraryController))
)

router.get(
  '/content/items/:contentId/performance-report',
  rateLimiters.analytics,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getContentPerformanceReport.bind(contentLibraryController))
)

router.get(
  '/content/top-performing',
  rateLimiters.analytics,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getTopPerformingContent.bind(contentLibraryController))
)

router.get(
  '/content/analytics-summary',
  rateLimiters.analytics,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getContentAnalyticsSummary.bind(contentLibraryController))
)

// Stats routes
router.get(
  '/content/stats',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getContentStats.bind(contentLibraryController))
)

router.get(
  '/content/block-stats',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getBlockStats.bind(contentLibraryController))
)

router.get(
  '/content/workflow-stats',
  rateLimiters.general,
  authMiddleware.authenticate,
  asyncHandler(contentLibraryController.getWorkflowStats.bind(contentLibraryController))
)

// API routes for content management
router.post(
  '/api/content/items',
  authMiddleware.apiKey,
  asyncHandler(contentLibraryController.createItem.bind(contentLibraryController))
)

router.get(
  '/api/content/items',
  authMiddleware.apiKey,
  asyncHandler(contentLibraryController.getItems.bind(contentLibraryController))
)

router.get(
  '/api/content/items/:id',
  authMiddleware.apiKey,
  asyncHandler(contentLibraryController.getItem.bind(contentLibraryController))
)

router.post(
  '/api/content/blocks',
  authMiddleware.apiKey,
  asyncHandler(contentLibraryController.createBlock.bind(contentLibraryController))
)

router.get(
  '/api/content/blocks',
  authMiddleware.apiKey,
  asyncHandler(contentLibraryController.getBlocks.bind(contentLibraryController))
)

router.post(
  '/api/content/items/:contentId/track',
  authMiddleware.apiKey,
  asyncHandler(contentLibraryController.trackContentPerformance.bind(contentLibraryController))
)

export default router
