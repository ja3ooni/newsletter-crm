import { ContentLibraryItem } from '@/types'
import { database } from '@/utils/database'
import { logger } from '@/utils/logger'

export interface CreateContentLibraryItemData {
  title: string
  content: string
  type: 'article' | 'block' | 'template' | 'image'
  tags: string[]
  category: string
  metadata: Record<string, any>
  createdBy: string
}

export interface UpdateContentLibraryItemData {
  title?: string
  content?: string
  type?: 'article' | 'block' | 'template' | 'image'
  tags?: string[]
  category?: string
  status?: 'draft' | 'approved' | 'archived'
  metadata?: Record<string, any>
  approvedBy?: string
}

export class ContentLibraryRepository {
  async create(data: CreateContentLibraryItemData): Promise<ContentLibraryItem> {
    const query = `
      INSERT INTO content_library_items (
        title, content, type, tags, category, metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `

    const values = [
      data.title,
      data.content,
      data.type,
      data.tags,
      data.category,
      JSON.stringify(data.metadata),
      data.createdBy,
    ]

    try {
      const result = await database.queryOne<any>(query, values)
      return this.mapToContentLibraryItem(result)
    } catch (error) {
      logger.error('Error creating content library item:', error)
      throw error
    }
  }

  async findById(id: string): Promise<ContentLibraryItem | null> {
    const query = `SELECT * FROM content_library_items WHERE id = $1`

    try {
      const result = await database.queryOne<any>(query, [id])
      return result ? this.mapToContentLibraryItem(result) : null
    } catch (error) {
      logger.error('Error finding content library item by id:', error)
      throw error
    }
  }

  async findMany(filters: {
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
    const conditions: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (filters.type) {
      conditions.push(`type = $${++paramCount}`)
      values.push(filters.type)
    }

    if (filters.status) {
      conditions.push(`status = $${++paramCount}`)
      values.push(filters.status)
    }

    if (filters.category) {
      conditions.push(`category = $${++paramCount}`)
      values.push(filters.category)
    }

    if (filters.tags && filters.tags.length > 0) {
      conditions.push(`tags && $${++paramCount}`)
      values.push(filters.tags)
    }

    if (filters.search) {
      conditions.push(`(title ILIKE $${++paramCount} OR content ILIKE $${paramCount})`)
      values.push(`%${filters.search}%`)
    }

    if (filters.createdBy) {
      conditions.push(`created_by = $${++paramCount}`)
      values.push(filters.createdBy)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM content_library_items ${whereClause}`
    const countResult = await database.queryOne<{ total: string }>(countQuery, values)
    const total = parseInt(countResult?.total || '0', 10)

    // Data query
    const sortBy = filters.sortBy || 'created_at'
    const sortOrder = filters.sortOrder || 'desc'
    const limit = filters.limit || 20
    const offset = ((filters.page || 1) - 1) * limit

    const dataQuery = `
      SELECT * FROM content_library_items
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `
    values.push(limit, offset)

    try {
      const results = await database.query<any>(dataQuery, values)
      const items = results.map(result => this.mapToContentLibraryItem(result))

      return { items, total }
    } catch (error) {
      logger.error('Error finding content library items:', error)
      throw error
    }
  }

  async update(id: string, data: UpdateContentLibraryItemData): Promise<ContentLibraryItem | null> {
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (data.title !== undefined) {
      updates.push(`title = $${++paramCount}`)
      values.push(data.title)
    }

    if (data.content !== undefined) {
      updates.push(`content = $${++paramCount}`)
      values.push(data.content)
    }

    if (data.type !== undefined) {
      updates.push(`type = $${++paramCount}`)
      values.push(data.type)
    }

    if (data.tags !== undefined) {
      updates.push(`tags = $${++paramCount}`)
      values.push(data.tags)
    }

    if (data.category !== undefined) {
      updates.push(`category = $${++paramCount}`)
      values.push(data.category)
    }

    if (data.status !== undefined) {
      updates.push(`status = $${++paramCount}`)
      values.push(data.status)

      if (data.status === 'approved' && data.approvedBy) {
        updates.push(`approved_by = $${++paramCount}`)
        values.push(data.approvedBy)
        updates.push(`approved_at = NOW()`)
      }
    }

    if (data.metadata !== undefined) {
      updates.push(`metadata = $${++paramCount}`)
      values.push(JSON.stringify(data.metadata))
    }

    if (updates.length === 0) {
      return this.findById(id)
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)

    const query = `
      UPDATE content_library_items
      SET ${updates.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `

    try {
      const result = await database.queryOne<any>(query, values)
      return result ? this.mapToContentLibraryItem(result) : null
    } catch (error) {
      logger.error('Error updating content library item:', error)
      throw error
    }
  }

  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM content_library_items WHERE id = $1`

    try {
      const result = await database.query(query, [id])
      return result.length > 0
    } catch (error) {
      logger.error('Error deleting content library item:', error)
      throw error
    }
  }

  async findByTags(tags: string[]): Promise<ContentLibraryItem[]> {
    const query = `
      SELECT * FROM content_library_items
      WHERE tags && $1 AND status = 'approved'
      ORDER BY created_at DESC
    `

    try {
      const results = await database.query<any>(query, [tags])
      return results.map(result => this.mapToContentLibraryItem(result))
    } catch (error) {
      logger.error('Error finding content library items by tags:', error)
      throw error
    }
  }

  async findByCategory(category: string): Promise<ContentLibraryItem[]> {
    const query = `
      SELECT * FROM content_library_items
      WHERE category = $1 AND status = 'approved'
      ORDER BY created_at DESC
    `

    try {
      const results = await database.query<any>(query, [category])
      return results.map(result => this.mapToContentLibraryItem(result))
    } catch (error) {
      logger.error('Error finding content library items by category:', error)
      throw error
    }
  }

  async findApproved(): Promise<ContentLibraryItem[]> {
    const query = `
      SELECT * FROM content_library_items
      WHERE status = 'approved'
      ORDER BY created_at DESC
    `

    try {
      const results = await database.query<any>(query)
      return results.map(result => this.mapToContentLibraryItem(result))
    } catch (error) {
      logger.error('Error finding approved content library items:', error)
      throw error
    }
  }

  async findPendingApproval(): Promise<ContentLibraryItem[]> {
    const query = `
      SELECT * FROM content_library_items
      WHERE status = 'draft'
      ORDER BY created_at ASC
    `

    try {
      const results = await database.query<any>(query)
      return results.map(result => this.mapToContentLibraryItem(result))
    } catch (error) {
      logger.error('Error finding pending approval content library items:', error)
      throw error
    }
  }

  async searchContent(searchTerm: string, filters?: {
    type?: string
    category?: string
    tags?: string[]
  }): Promise<ContentLibraryItem[]> {
    const conditions = [`(title ILIKE $1 OR content ILIKE $1)`]
    const values: any[] = [`%${searchTerm}%`]
    let paramCount = 1

    if (filters?.type) {
      conditions.push(`type = $${++paramCount}`)
      values.push(filters.type)
    }

    if (filters?.category) {
      conditions.push(`category = $${++paramCount}`)
      values.push(filters.category)
    }

    if (filters?.tags && filters.tags.length > 0) {
      conditions.push(`tags && $${++paramCount}`)
      values.push(filters.tags)
    }

    conditions.push(`status = 'approved'`)

    const query = `
      SELECT * FROM content_library_items
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT 50
    `

    try {
      const results = await database.query<any>(query, values)
      return results.map(result => this.mapToContentLibraryItem(result))
    } catch (error) {
      logger.error('Error searching content library items:', error)
      throw error
    }
  }

  async getAllTags(): Promise<string[]> {
    const query = `
      SELECT DISTINCT unnest(tags) as tag
      FROM content_library_items
      WHERE status = 'approved'
      ORDER BY tag
    `

    try {
      const results = await database.query<{ tag: string }>(query)
      return results.map(result => result.tag)
    } catch (error) {
      logger.error('Error getting all tags:', error)
      throw error
    }
  }

  async getAllCategories(): Promise<string[]> {
    const query = `
      SELECT DISTINCT category
      FROM content_library_items
      WHERE status = 'approved'
      ORDER BY category
    `

    try {
      const results = await database.query<{ category: string }>(query)
      return results.map(result => result.category)
    } catch (error) {
      logger.error('Error getting all categories:', error)
      throw error
    }
  }

  private mapToContentLibraryItem(row: any): ContentLibraryItem {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      type: row.type,
      tags: row.tags || [],
      category: row.category,
      status: row.status,
      createdBy: row.created_by,
      approvedBy: row.approved_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvedAt: row.approved_at,
      metadata: row.metadata || {},
    }
  }
}
