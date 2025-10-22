import { ContentBlock, TemplateVariable } from '@/types'
import { database } from '@/utils/database'
import { logger } from '@/utils/logger'
import { redis } from '@/utils/redis'

export interface CreateContentBlockData {
  name: string
  html: string
  css?: string
  variables: TemplateVariable[]
  category: string
  isReusable: boolean
  createdBy: string
}

export interface UpdateContentBlockData {
  name?: string
  html?: string
  css?: string
  variables?: TemplateVariable[]
  category?: string
  isReusable?: boolean
}

export class ContentBlockService {
  async createBlock(data: CreateContentBlockData): Promise<ContentBlock> {
    try {
      const query = `
        INSERT INTO content_blocks (
          name, html, css, variables, category, is_reusable, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `

      const values = [
        data.name,
        data.html,
        data.css || null,
        JSON.stringify(data.variables),
        data.category,
        data.isReusable,
        data.createdBy,
      ]

      const result = await database.queryOne<any>(query, values)
      const block = this.mapToContentBlock(result)

      // Invalidate cache
      await this.invalidateBlockCaches()

      logger.info('Content block created', {
        blockId: block.id,
        name: data.name,
        category: data.category,
        createdBy: data.createdBy,
      })

      return block
    } catch (error) {
      logger.error('Error creating content block:', error)
      throw error
    }
  }

  async getBlock(id: string): Promise<ContentBlock | null> {
    try {
      const cacheKey = `content_block:${id}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const query = `SELECT * FROM content_blocks WHERE id = $1`
      const result = await database.queryOne<any>(query, [id])

      if (!result) {
        return null
      }

      const block = this.mapToContentBlock(result)

      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(block), 3600)

      return block
    } catch (error) {
      logger.error('Error getting content block:', error)
      throw error
    }
  }

  async getBlocks(filters: {
    category?: string
    isReusable?: boolean
    createdBy?: string
    search?: string
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<{ blocks: ContentBlock[]; total: number }> {
    try {
      const conditions: string[] = []
      const values: any[] = []
      let paramCount = 0

      if (filters.category) {
        conditions.push(`category = $${++paramCount}`)
        values.push(filters.category)
      }

      if (filters.isReusable !== undefined) {
        conditions.push(`is_reusable = $${++paramCount}`)
        values.push(filters.isReusable)
      }

      if (filters.createdBy) {
        conditions.push(`created_by = $${++paramCount}`)
        values.push(filters.createdBy)
      }

      if (filters.search) {
        conditions.push(`(name ILIKE $${++paramCount} OR html ILIKE $${paramCount})`)
        values.push(`%${filters.search}%`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Count query
      const countQuery = `SELECT COUNT(*) as total FROM content_blocks ${whereClause}`
      const countResult = await database.queryOne<{ total: string }>(countQuery, values)
      const total = parseInt(countResult?.total || '0', 10)

      // Data query
      const sortBy = filters.sortBy || 'created_at'
      const sortOrder = filters.sortOrder || 'desc'
      const limit = filters.limit || 20
      const offset = ((filters.page || 1) - 1) * limit

      const dataQuery = `
        SELECT * FROM content_blocks
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `
      values.push(limit, offset)

      const results = await database.query<any>(dataQuery, values)
      const blocks = results.map(result => this.mapToContentBlock(result))

      return { blocks, total }
    } catch (error) {
      logger.error('Error getting content blocks:', error)
      throw error
    }
  }

  async updateBlock(id: string, data: UpdateContentBlockData): Promise<ContentBlock | null> {
    try {
      const updates: string[] = []
      const values: any[] = []
      let paramCount = 0

      if (data.name !== undefined) {
        updates.push(`name = $${++paramCount}`)
        values.push(data.name)
      }

      if (data.html !== undefined) {
        updates.push(`html = $${++paramCount}`)
        values.push(data.html)
      }

      if (data.css !== undefined) {
        updates.push(`css = $${++paramCount}`)
        values.push(data.css)
      }

      if (data.variables !== undefined) {
        updates.push(`variables = $${++paramCount}`)
        values.push(JSON.stringify(data.variables))
      }

      if (data.category !== undefined) {
        updates.push(`category = $${++paramCount}`)
        values.push(data.category)
      }

      if (data.isReusable !== undefined) {
        updates.push(`is_reusable = $${++paramCount}`)
        values.push(data.isReusable)
      }

      if (updates.length === 0) {
        return this.getBlock(id)
      }

      updates.push(`updated_at = NOW()`)
      values.push(id)

      const query = `
        UPDATE content_blocks
        SET ${updates.join(', ')}
        WHERE id = $${++paramCount}
        RETURNING *
      `

      const result = await database.queryOne<any>(query, values)

      if (result) {
        // Invalidate caches
        await redis.del(`content_block:${id}`)
        await this.invalidateBlockCaches()

        logger.info('Content block updated', {
          blockId: id,
          updates: Object.keys(data),
        })
      }

      return result ? this.mapToContentBlock(result) : null
    } catch (error) {
      logger.error('Error updating content block:', error)
      throw error
    }
  }

  async deleteBlock(id: string): Promise<boolean> {
    try {
      const query = `DELETE FROM content_blocks WHERE id = $1`
      const result = await database.query(query, [id])

      if (result.length > 0) {
        // Invalidate caches
        await redis.del(`content_block:${id}`)
        await this.invalidateBlockCaches()

        logger.info('Content block deleted', { blockId: id })
        return true
      }

      return false
    } catch (error) {
      logger.error('Error deleting content block:', error)
      throw error
    }
  }

  async getBlocksByCategory(category: string): Promise<ContentBlock[]> {
    try {
      const cacheKey = `blocks_by_category:${category}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const query = `
        SELECT * FROM content_blocks
        WHERE category = $1 AND is_reusable = true
        ORDER BY created_at DESC
      `
      const results = await database.query<any>(query, [category])
      const blocks = results.map(result => this.mapToContentBlock(result))

      // Cache for 30 minutes
      await redis.set(cacheKey, JSON.stringify(blocks), 1800)

      return blocks
    } catch (error) {
      logger.error('Error getting blocks by category:', error)
      throw error
    }
  }

  async getReusableBlocks(): Promise<ContentBlock[]> {
    try {
      const cacheKey = 'reusable_blocks'
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const query = `
        SELECT * FROM content_blocks
        WHERE is_reusable = true
        ORDER BY category, name
      `
      const results = await database.query<any>(query)
      const blocks = results.map(result => this.mapToContentBlock(result))

      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(blocks), 3600)

      return blocks
    } catch (error) {
      logger.error('Error getting reusable blocks:', error)
      throw error
    }
  }

  async duplicateBlock(id: string, userId: string): Promise<ContentBlock> {
    try {
      const original = await this.getBlock(id)
      if (!original) {
        throw new Error('Content block not found')
      }

      const duplicateData: CreateContentBlockData = {
        name: `${original.name} (Copy)`,
        html: original.html,
        css: original.css,
        variables: [...original.variables],
        category: original.category,
        isReusable: original.isReusable,
        createdBy: userId,
      }

      const duplicate = await this.createBlock(duplicateData)

      logger.info('Content block duplicated', {
        originalId: id,
        duplicateId: duplicate.id,
        userId,
      })

      return duplicate
    } catch (error) {
      logger.error('Error duplicating content block:', error)
      throw error
    }
  }

  async renderBlock(id: string, variables: Record<string, any> = {}): Promise<string> {
    try {
      const block = await this.getBlock(id)
      if (!block) {
        throw new Error('Content block not found')
      }

      let html = block.html

      // Replace variables in HTML
      block.variables.forEach(variable => {
        const value = variables[variable.name] !== undefined
          ? variables[variable.name]
          : variable.defaultValue

        const placeholder = `{{${variable.name}}}`
        html = html.replace(new RegExp(placeholder, 'g'), String(value))
      })

      // Apply CSS if present
      if (block.css) {
        html = `<style>${block.css}</style>${html}`
      }

      return html
    } catch (error) {
      logger.error('Error rendering content block:', error)
      throw error
    }
  }

  async getBlockCategories(): Promise<string[]> {
    try {
      const cacheKey = 'block_categories'
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const query = `
        SELECT DISTINCT category
        FROM content_blocks
        ORDER BY category
      `
      const results = await database.query<{ category: string }>(query)
      const categories = results.map(result => result.category)

      // Cache for 2 hours
      await redis.set(cacheKey, JSON.stringify(categories), 7200)

      return categories
    } catch (error) {
      logger.error('Error getting block categories:', error)
      throw error
    }
  }

  async getBlockStats(): Promise<{
    total: number
    byCategory: Record<string, number>
    reusableCount: number
  }> {
    try {
      const cacheKey = 'block_stats'
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const query = `
        SELECT
          category,
          is_reusable,
          COUNT(*) as count
        FROM content_blocks
        GROUP BY category, is_reusable
      `
      const results = await database.query<{
        category: string
        is_reusable: boolean
        count: string
      }>(query)

      const stats = {
        total: 0,
        byCategory: {} as Record<string, number>,
        reusableCount: 0,
      }

      results.forEach(result => {
        const count = parseInt(result.count, 10)
        stats.total += count

        stats.byCategory[result.category] = (stats.byCategory[result.category] || 0) + count

        if (result.is_reusable) {
          stats.reusableCount += count
        }
      })

      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(stats), 3600)

      return stats
    } catch (error) {
      logger.error('Error getting block stats:', error)
      throw error
    }
  }

  private async invalidateBlockCaches(): Promise<void> {
    try {
      const keys = [
        'reusable_blocks',
        'block_categories',
        'block_stats',
      ]

      await Promise.all(keys.map(key => redis.del(key)))

      logger.debug('Content block caches invalidated')
    } catch (error) {
      logger.error('Error invalidating block caches:', error)
    }
  }

  private mapToContentBlock(row: any): ContentBlock {
    return {
      id: row.id,
      name: row.name,
      html: row.html,
      css: row.css,
      variables: row.variables || [],
      category: row.category,
      isReusable: row.is_reusable,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
