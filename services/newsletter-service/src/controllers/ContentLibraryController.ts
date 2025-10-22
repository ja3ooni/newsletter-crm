import { ApprovalWorkflowService } from '@/services/ApprovalWorkflowService'
import { ContentAnalyticsService } from '@/services/ContentAnalyticsService'
import { ContentBlockService } from '@/services/ContentBlockService'
import { ContentLibraryService } from '@/services/ContentLibraryService'
import { logger } from '@/utils/logger'
import {
    createContentBlockSchema,
    createContentLibraryItemSchema,
    updateApprovalSchema,
    updateContentBlockSchema,
    updateContentLibraryItemSchema,
    validateRequest,
} from '@/utils/validation'
import { Request, Response } from 'express'
import { z } from 'zod'

// Additional validation schemas
const SearchQuerySchema = z.object({
  q: z.string().min(1),
  type: z.enum(['article', 'block', 'template', 'image']).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export class ContentLibraryController {
  constructor(
    private contentLibraryService: ContentLibraryService,
    private approvalWorkflowService: ApprovalWorkflowService,
    private contentBlockService: ContentBlockService,
    private contentAnalyticsService: ContentAnalyticsService
  ) {}

  // ============================================================================
  // CONTENT LIBRARY ITEM ENDPOINTS
  // ============================================================================

  async createItem(req: Request, res: Response): Promise<void> {
    try {
      const data = validateRequest(createContentLibraryItemSchema, req.body)
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const item = await this.contentLibraryService.createItem({
        title: data.title,
        content: data.content,
        type: data.type,
        tags: data.tags,
        category: data.category,
        metadata: data.metadata,
        createdBy: userId,
      })

      logger.info('Content library item created via API', {
        itemId: item.id,
        userId,
        type: data.type,
      })

      res.status(201).json(item)
    } catch (error) {
      logger.error('Error creating content library item:', error)
      res.status(500).json({ error: 'Failed to create content item' })
    }
  }

  async getItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const item = await this.contentLibraryService.getItem(id)

      if (!item) {
        res.status(404).json({ error: 'Content item not found' })
        return
      }

      res.json(item)
    } catch (error) {
      logger.error('Error getting content library item:', error)
      res.status(500).json({ error: 'Failed to get content item' })
    }
  }

  async getItems(req: Request, res: Response): Promise<void> {
    try {
      const {
        type,
        status,
        category,
        tags,
        search,
        createdBy,
        page = '1',
        limit = '20',
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query

      const filters: any = {}

      if (type) filters.type = type as 'article' | 'block' | 'template' | 'image'
      if (status) filters.status = status as 'draft' | 'approved' | 'archived'
      if (category) filters.category = category as string
      if (tags) filters.tags = Array.isArray(tags) ? tags as string[] : [tags as string]
      if (search) filters.search = search as string
      if (createdBy) filters.createdBy = createdBy as string

      filters.page = parseInt(page as string, 10)
      filters.limit = parseInt(limit as string, 10)
      if (sortBy) filters.sortBy = sortBy as string
      filters.sortOrder = sortOrder as 'asc' | 'desc'

      const result = await this.contentLibraryService.getItems(filters)
      res.json(result)
    } catch (error) {
      logger.error('Error getting content library items:', error)
      res.status(500).json({ error: 'Failed to get content items' })
    }
  }

  async updateItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const data = validateRequest(updateContentLibraryItemSchema, req.body)

      const updateData: any = {}
      if (data.title !== undefined) updateData.title = data.title
      if (data.content !== undefined) updateData.content = data.content
      if (data.type !== undefined) updateData.type = data.type
      if (data.tags !== undefined) updateData.tags = data.tags
      if (data.category !== undefined) updateData.category = data.category
      if (data.metadata !== undefined) updateData.metadata = data.metadata

      const item = await this.contentLibraryService.updateItem(id, updateData)

      if (!item) {
        res.status(404).json({ error: 'Content item not found' })
        return
      }

      res.json(item)
    } catch (error) {
      logger.error('Error updating content library item:', error)
      res.status(500).json({ error: 'Failed to update content item' })
    }
  }

  async deleteItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const deleted = await this.contentLibraryService.deleteItem(id)

      if (!deleted) {
        res.status(404).json({ error: 'Content item not found' })
        return
      }

      res.status(204).send()
    } catch (error) {
      logger.error('Error deleting content library item:', error)
      res.status(500).json({ error: 'Failed to delete content item' })
    }
  }

  async duplicateItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const duplicate = await this.contentLibraryService.duplicateItem(id, userId)
      res.status(201).json(duplicate)
    } catch (error) {
      logger.error('Error duplicating content library item:', error)
      res.status(500).json({ error: 'Failed to duplicate content item' })
    }
  }

  // ============================================================================
  // SEARCH AND FILTERING ENDPOINTS
  // ============================================================================

  async searchContent(req: Request, res: Response): Promise<void> {
    try {
      const query = validateRequest(SearchQuerySchema, req.query)
      const results = await this.contentLibraryService.searchContent(query.q, {
        type: query.type,
        category: query.category,
        tags: query.tags,
      })

      res.json(results)
    } catch (error) {
      logger.error('Error searching content:', error)
      res.status(500).json({ error: 'Failed to search content' })
    }
  }

  async getItemsByTags(req: Request, res: Response): Promise<void> {
    try {
      const { tags } = req.query

      if (!tags) {
        res.status(400).json({ error: 'Tags parameter is required' })
        return
      }

      const tagArray = Array.isArray(tags) ? tags as string[] : [tags as string]
      const items = await this.contentLibraryService.getItemsByTags(tagArray)

      res.json(items)
    } catch (error) {
      logger.error('Error getting items by tags:', error)
      res.status(500).json({ error: 'Failed to get items by tags' })
    }
  }

  async getItemsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params
      const items = await this.contentLibraryService.getItemsByCategory(category)
      res.json(items)
    } catch (error) {
      logger.error('Error getting items by category:', error)
      res.status(500).json({ error: 'Failed to get items by category' })
    }
  }

  async getAllTags(req: Request, res: Response): Promise<void> {
    try {
      const tags = await this.contentLibraryService.getAllTags()
      res.json(tags)
    } catch (error) {
      logger.error('Error getting all tags:', error)
      res.status(500).json({ error: 'Failed to get tags' })
    }
  }

  async getAllCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await this.contentLibraryService.getAllCategories()
      res.json(categories)
    } catch (error) {
      logger.error('Error getting all categories:', error)
      res.status(500).json({ error: 'Failed to get categories' })
    }
  }

  // ============================================================================
  // APPROVAL WORKFLOW ENDPOINTS
  // ============================================================================

  async getPendingApprovalItems(req: Request, res: Response): Promise<void> {
    try {
      const items = await this.contentLibraryService.getPendingApprovalItems()
      res.json(items)
    } catch (error) {
      logger.error('Error getting pending approval items:', error)
      res.status(500).json({ error: 'Failed to get pending approval items' })
    }
  }

  async approveItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const item = await this.contentLibraryService.approveItem(id, userId)

      if (!item) {
        res.status(404).json({ error: 'Content item not found' })
        return
      }

      res.json(item)
    } catch (error) {
      logger.error('Error approving content library item:', error)
      res.status(500).json({ error: 'Failed to approve content item' })
    }
  }

  async rejectItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { reason } = req.body

      const item = await this.contentLibraryService.rejectItem(id, reason)

      if (!item) {
        res.status(404).json({ error: 'Content item not found' })
        return
      }

      res.json(item)
    } catch (error) {
      logger.error('Error rejecting content library item:', error)
      res.status(500).json({ error: 'Failed to reject content item' })
    }
  }

  async getApprovalWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const workflow = await this.approvalWorkflowService.getWorkflowByContentId(id)

      if (!workflow) {
        res.status(404).json({ error: 'Approval workflow not found' })
        return
      }

      res.json(workflow)
    } catch (error) {
      logger.error('Error getting approval workflow:', error)
      res.status(500).json({ error: 'Failed to get approval workflow' })
    }
  }

  async submitApproval(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params
      const userId = (req as any).user?.id
      const data = validateRequest(updateApprovalSchema, req.body)

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const workflow = await this.approvalWorkflowService.submitApproval(
        workflowId,
        userId,
        {
          status: data.status,
          comments: data.comments,
        }
      )

      if (!workflow) {
        res.status(404).json({ error: 'Approval workflow not found' })
        return
      }

      res.json(workflow)
    } catch (error) {
      logger.error('Error submitting approval:', error)
      res.status(500).json({ error: 'Failed to submit approval' })
    }
  }

  async getPendingApprovals(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const workflows = await this.approvalWorkflowService.getPendingApprovals(userId)
      res.json(workflows)
    } catch (error) {
      logger.error('Error getting pending approvals:', error)
      res.status(500).json({ error: 'Failed to get pending approvals' })
    }
  }

  // ============================================================================
  // CONTENT BLOCKS ENDPOINTS
  // ============================================================================

  async createBlock(req: Request, res: Response): Promise<void> {
    try {
      const data = validateRequest(createContentBlockSchema, req.body)
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const block = await this.contentBlockService.createBlock({
        name: data.name,
        html: data.html,
        css: data.css,
        variables: data.variables,
        category: data.category,
        isReusable: data.isReusable,
        createdBy: userId,
      })

      logger.info('Content block created via API', {
        blockId: block.id,
        userId,
        name: data.name,
      })

      res.status(201).json(block)
    } catch (error) {
      logger.error('Error creating content block:', error)
      res.status(500).json({ error: 'Failed to create content block' })
    }
  }

  async getBlock(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const block = await this.contentBlockService.getBlock(id)

      if (!block) {
        res.status(404).json({ error: 'Content block not found' })
        return
      }

      res.json(block)
    } catch (error) {
      logger.error('Error getting content block:', error)
      res.status(500).json({ error: 'Failed to get content block' })
    }
  }

  async getBlocks(req: Request, res: Response): Promise<void> {
    try {
      const {
        category,
        isReusable,
        createdBy,
        search,
        page = '1',
        limit = '20',
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query

      const filters: any = {}

      if (category) filters.category = category as string
      if (isReusable !== undefined) {
        filters.isReusable = isReusable === 'true' ? true : isReusable === 'false' ? false : undefined
      }
      if (createdBy) filters.createdBy = createdBy as string
      if (search) filters.search = search as string

      filters.page = parseInt(page as string, 10)
      filters.limit = parseInt(limit as string, 10)
      if (sortBy) filters.sortBy = sortBy as string
      filters.sortOrder = sortOrder as 'asc' | 'desc'

      const result = await this.contentBlockService.getBlocks(filters)
      res.json(result)
    } catch (error) {
      logger.error('Error getting content blocks:', error)
      res.status(500).json({ error: 'Failed to get content blocks' })
    }
  }

  async updateBlock(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const data = validateRequest(updateContentBlockSchema, req.body)

      const updateData: any = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.html !== undefined) updateData.html = data.html
      if (data.css !== undefined) updateData.css = data.css
      if (data.variables !== undefined) updateData.variables = data.variables
      if (data.category !== undefined) updateData.category = data.category
      if (data.isReusable !== undefined) updateData.isReusable = data.isReusable

      const block = await this.contentBlockService.updateBlock(id, updateData)

      if (!block) {
        res.status(404).json({ error: 'Content block not found' })
        return
      }

      res.json(block)
    } catch (error) {
      logger.error('Error updating content block:', error)
      res.status(500).json({ error: 'Failed to update content block' })
    }
  }

  async deleteBlock(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const deleted = await this.contentBlockService.deleteBlock(id)

      if (!deleted) {
        res.status(404).json({ error: 'Content block not found' })
        return
      }

      res.status(204).send()
    } catch (error) {
      logger.error('Error deleting content block:', error)
      res.status(500).json({ error: 'Failed to delete content block' })
    }
  }

  async duplicateBlock(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const duplicate = await this.contentBlockService.duplicateBlock(id, userId)
      res.status(201).json(duplicate)
    } catch (error) {
      logger.error('Error duplicating content block:', error)
      res.status(500).json({ error: 'Failed to duplicate content block' })
    }
  }

  async getReusableBlocks(req: Request, res: Response): Promise<void> {
    try {
      const blocks = await this.contentBlockService.getReusableBlocks()
      res.json(blocks)
    } catch (error) {
      logger.error('Error getting reusable blocks:', error)
      res.status(500).json({ error: 'Failed to get reusable blocks' })
    }
  }

  async getBlocksByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params
      const blocks = await this.contentBlockService.getBlocksByCategory(category)
      res.json(blocks)
    } catch (error) {
      logger.error('Error getting blocks by category:', error)
      res.status(500).json({ error: 'Failed to get blocks by category' })
    }
  }

  async renderBlock(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { variables = {} } = req.body

      const html = await this.contentBlockService.renderBlock(id, variables)
      res.json({ html })
    } catch (error) {
      logger.error('Error rendering content block:', error)
      res.status(500).json({ error: 'Failed to render content block' })
    }
  }

  async getBlockCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await this.contentBlockService.getBlockCategories()
      res.json(categories)
    } catch (error) {
      logger.error('Error getting block categories:', error)
      res.status(500).json({ error: 'Failed to get block categories' })
    }
  }

  // ============================================================================
  // ANALYTICS AND STATS ENDPOINTS
  // ============================================================================

  async getContentStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.contentLibraryService.getContentStats()
      res.json(stats)
    } catch (error) {
      logger.error('Error getting content stats:', error)
      res.status(500).json({ error: 'Failed to get content stats' })
    }
  }

  async getBlockStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.contentBlockService.getBlockStats()
      res.json(stats)
    } catch (error) {
      logger.error('Error getting block stats:', error)
      res.status(500).json({ error: 'Failed to get block stats' })
    }
  }

  async getWorkflowStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.approvalWorkflowService.getWorkflowStats()
      res.json(stats)
    } catch (error) {
      logger.error('Error getting workflow stats:', error)
      res.status(500).json({ error: 'Failed to get workflow stats' })
    }
  }

  // ============================================================================
  // CONTENT PERFORMANCE AND ANALYTICS ENDPOINTS
  // ============================================================================

  async trackContentPerformance(req: Request, res: Response): Promise<void> {
    try {
      const { contentId } = req.params
      const { metricType, metricValue, newsletterId, campaignId, metadata } = req.body

      if (!metricType || metricValue === undefined) {
        res.status(400).json({ error: 'metricType and metricValue are required' })
        return
      }

      const metric = await this.contentAnalyticsService.trackPerformance({
        contentId,
        metricType,
        metricValue,
        newsletterId,
        campaignId,
        metadata,
      })

      res.status(201).json(metric)
    } catch (error) {
      logger.error('Error tracking content performance:', error)
      res.status(500).json({ error: 'Failed to track content performance' })
    }
  }

  async getContentAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { contentId } = req.params
      const { periodStart, periodEnd } = req.query

      if (!periodStart || !periodEnd) {
        res.status(400).json({ error: 'periodStart and periodEnd are required' })
        return
      }

      const analytics = await this.contentAnalyticsService.getContentAnalytics(
        contentId,
        new Date(periodStart as string),
        new Date(periodEnd as string)
      )

      if (!analytics) {
        res.status(404).json({ error: 'Analytics not found for the specified period' })
        return
      }

      res.json(analytics)
    } catch (error) {
      logger.error('Error getting content analytics:', error)
      res.status(500).json({ error: 'Failed to get content analytics' })
    }
  }

  async getContentPerformanceReport(req: Request, res: Response): Promise<void> {
    try {
      const { contentId } = req.params
      const { days = '30' } = req.query

      const report = await this.contentAnalyticsService.getContentPerformanceReport(
        contentId,
        parseInt(days as string, 10)
      )

      res.json(report)
    } catch (error) {
      logger.error('Error getting content performance report:', error)
      res.status(500).json({ error: 'Failed to get content performance report' })
    }
  }

  async getTopPerformingContent(req: Request, res: Response): Promise<void> {
    try {
      const {
        limit = '10',
        days = '30',
        category,
        type,
      } = req.query

      const reports = await this.contentAnalyticsService.getTopPerformingContent(
        parseInt(limit as string, 10),
        parseInt(days as string, 10),
        category as string,
        type as string
      )

      res.json(reports)
    } catch (error) {
      logger.error('Error getting top performing content:', error)
      res.status(500).json({ error: 'Failed to get top performing content' })
    }
  }

  async getContentAnalyticsSummary(req: Request, res: Response): Promise<void> {
    try {
      const { days = '30' } = req.query

      const summary = await this.contentAnalyticsService.getContentAnalyticsSummary(
        parseInt(days as string, 10)
      )

      res.json(summary)
    } catch (error) {
      logger.error('Error getting content analytics summary:', error)
      res.status(500).json({ error: 'Failed to get content analytics summary' })
    }
  }
}
