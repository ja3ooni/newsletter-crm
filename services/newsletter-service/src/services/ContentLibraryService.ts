import { ContentLibraryRepository, CreateContentLibraryItemData, UpdateContentLibraryItemData } from '@/repositories/ContentLibraryRepository'
import { ContentLibraryItem } from '@/types'
import { logger } from '@/utils/logger'
import { redis } from '@/utils/redis'
import { ApprovalWorkflowService } from './ApprovalWorkflowService'

export class ContentLibraryService {
  constructor(
    private contentLibraryRepository: ContentLibraryRepository,
    private approvalWorkflowService: ApprovalWorkflowService
  ) {}

  async createItem(data: CreateContentLibraryItemData): Promise<ContentLibraryItem> {
    try {
      const item = await this.contentLibraryRepository.create(data)

      // Start approval workflow if configured
      if (this.shouldRequireApproval(data.type)) {
        await this.approvalWorkflowService.startWorkflow(item.id, data.createdBy)
      } else {
        // Auto-approve certain types of content
        await this.contentLibraryRepository.update(item.id, {
          status: 'approved',
          approvedBy: data.createdBy,
        })
      }

      logger.info('Content library item created', {
        itemId: item.id,
        type: data.type,
        title: data.title,
        createdBy: data.createdBy,
      })

      return item
    } catch (error) {
      logger.error('Error creating content library item:', error)
      throw error
    }
  }

  async getItem(id: string): Promise<ContentLibraryItem | null> {
    try {
      const cacheKey = `content_item:${id}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const item = await this.contentLibraryRepository.findById(id)

      if (item) {
        // Cache approved items for 1 hour
        if (item.status === 'approved') {
          await redis.set(cacheKey, JSON.stringify(item), 3600)
        }
      }

      return item
    } catch (error) {
      logger.error('Error getting content library item:', error)
      throw error
    }
  }

  async getItems(filters: {
    type?: 'article' | 'block' | 'template' | 'image'
    status?: 'draft' | 'approved' | 'archived'
    category?: string
    tags?: string[]
    search?: string
    createdBy?: string
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<{ items: ContentLibraryItem[]; total: number }> {
    try {
      return await this.contentLibraryRepository.findMany(filters)
    } catch (error) {
      logger.error('Error getting content library items:', error)
      throw error
    }
  }

  async updateItem(id: string, data: UpdateContentLibraryItemData): Promise<ContentLibraryItem | null> {
    try {
      const item = await this.contentLibraryRepository.update(id, data)

      if (item) {
        // Invalidate cache
        await redis.del(`content_item:${id}`)

        logger.info('Content library item updated', {
          itemId: id,
          updates: Object.keys(data),
        })
      }

      return item
    } catch (error) {
      logger.error('Error updating content library item:', error)
      throw error
    }
  }

  async deleteItem(id: string): Promise<boolean> {
    try {
      const deleted = await this.contentLibraryRepository.delete(id)

      if (deleted) {
        // Invalidate cache
        await redis.del(`content_item:${id}`)

        logger.info('Content library item deleted', { itemId: id })
      }

      return deleted
    } catch (error) {
      logger.error('Error deleting content library item:', error)
      throw error
    }
  }

  async searchContent(searchTerm: string, filters?: {
    type?: string
    category?: string
    tags?: string[]
  }): Promise<ContentLibraryItem[]> {
    try {
      const cacheKey = `content_search:${searchTerm}:${JSON.stringify(filters)}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const results = await this.contentLibraryRepository.searchContent(searchTerm, filters)

      // Cache search results for 15 minutes
      await redis.set(cacheKey, JSON.stringify(results), 900)

      return results
    } catch (error) {
      logger.error('Error searching content:', error)
      throw error
    }
  }

  async getItemsByTags(tags: string[]): Promise<ContentLibraryItem[]> {
    try {
      const cacheKey = `content_by_tags:${tags.sort().join(',')}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const items = await this.contentLibraryRepository.findByTags(tags)

      // Cache for 30 minutes
      await redis.set(cacheKey, JSON.stringify(items), 1800)

      return items
    } catch (error) {
      logger.error('Error getting items by tags:', error)
      throw error
    }
  }

  async getItemsByCategory(category: string): Promise<ContentLibraryItem[]> {
    try {
      const cacheKey = `content_by_category:${category}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const items = await this.contentLibraryRepository.findByCategory(category)

      // Cache for 30 minutes
      await redis.set(cacheKey, JSON.stringify(items), 1800)

      return items
    } catch (error) {
      logger.error('Error getting items by category:', error)
      throw error
    }
  }

  async getApprovedItems(): Promise<ContentLibraryItem[]> {
    try {
      const cacheKey = 'approved_content_items'
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const items = await this.contentLibraryRepository.findApproved()

      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(items), 3600)

      return items
    } catch (error) {
      logger.error('Error getting approved items:', error)
      throw error
    }
  }

  async getPendingApprovalItems(): Promise<ContentLibraryItem[]> {
    try {
      return await this.contentLibraryRepository.findPendingApproval()
    } catch (error) {
      logger.error('Error getting pending approval items:', error)
      throw error
    }
  }

  async approveItem(id: string, approverId: string): Promise<ContentLibraryItem | null> {
    try {
      const item = await this.contentLibraryRepository.update(id, {
        status: 'approved',
        approvedBy: approverId,
      })

      if (item) {
        // Invalidate relevant caches
        await this.invalidateContentCaches()

        logger.info('Content library item approved', {
          itemId: id,
          approverId,
        })
      }

      return item
    } catch (error) {
      logger.error('Error approving content library item:', error)
      throw error
    }
  }

  async rejectItem(id: string, reason?: string): Promise<ContentLibraryItem | null> {
    try {
      const item = await this.contentLibraryRepository.update(id, {
        status: 'draft',
        metadata: { rejectionReason: reason },
      })

      if (item) {
        logger.info('Content library item rejected', {
          itemId: id,
          reason,
        })
      }

      return item
    } catch (error) {
      logger.error('Error rejecting content library item:', error)
      throw error
    }
  }

  async archiveItem(id: string): Promise<ContentLibraryItem | null> {
    try {
      const item = await this.contentLibraryRepository.update(id, {
        status: 'archived',
      })

      if (item) {
        // Invalidate caches
        await this.invalidateContentCaches()

        logger.info('Content library item archived', { itemId: id })
      }

      return item
    } catch (error) {
      logger.error('Error archiving content library item:', error)
      throw error
    }
  }

  async getAllTags(): Promise<string[]> {
    try {
      const cacheKey = 'content_all_tags'
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const tags = await this.contentLibraryRepository.getAllTags()

      // Cache for 2 hours
      await redis.set(cacheKey, JSON.stringify(tags), 7200)

      return tags
    } catch (error) {
      logger.error('Error getting all tags:', error)
      throw error
    }
  }

  async getAllCategories(): Promise<string[]> {
    try {
      const cacheKey = 'content_all_categories'
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const categories = await this.contentLibraryRepository.getAllCategories()

      // Cache for 2 hours
      await redis.set(cacheKey, JSON.stringify(categories), 7200)

      return categories
    } catch (error) {
      logger.error('Error getting all categories:', error)
      throw error
    }
  }

  async getContentStats(): Promise<{
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
    byCategory: Record<string, number>
  }> {
    try {
      const cacheKey = 'content_stats'
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // Get all items for stats calculation
      const { items } = await this.contentLibraryRepository.findMany({ limit: 10000 })

      const stats = {
        total: items.length,
        byStatus: {} as Record<string, number>,
        byType: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
      }

      items.forEach(item => {
        // Count by status
        stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1

        // Count by type
        stats.byType[item.type] = (stats.byType[item.type] || 0) + 1

        // Count by category
        stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1
      })

      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(stats), 3600)

      return stats
    } catch (error) {
      logger.error('Error getting content stats:', error)
      throw error
    }
  }

  async duplicateItem(id: string, userId: string): Promise<ContentLibraryItem> {
    try {
      const original = await this.contentLibraryRepository.findById(id)
      if (!original) {
        throw new Error('Content item not found')
      }

      const duplicateData: CreateContentLibraryItemData = {
        title: `${original.title} (Copy)`,
        content: original.content,
        type: original.type,
        tags: [...original.tags],
        category: original.category,
        metadata: { ...original.metadata, duplicatedFrom: original.id },
        createdBy: userId,
      }

      const duplicate = await this.createItem(duplicateData)

      logger.info('Content library item duplicated', {
        originalId: id,
        duplicateId: duplicate.id,
        userId,
      })

      return duplicate
    } catch (error) {
      logger.error('Error duplicating content library item:', error)
      throw error
    }
  }

  private shouldRequireApproval(type: string): boolean {
    // Configure which content types require approval
    const requiresApproval = ['article', 'template']
    return requiresApproval.includes(type)
  }

  private async invalidateContentCaches(): Promise<void> {
    try {
      const keys = [
        'approved_content_items',
        'content_all_tags',
        'content_all_categories',
        'content_stats',
      ]

      await Promise.all(keys.map(key => redis.del(key)))

      // Also invalidate search and category caches (pattern-based deletion would be ideal)
      logger.debug('Content caches invalidated')
    } catch (error) {
      logger.error('Error invalidating content caches:', error)
    }
  }
}
