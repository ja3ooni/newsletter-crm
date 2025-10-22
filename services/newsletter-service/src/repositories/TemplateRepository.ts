import { NewsletterTemplate, TemplateVariable } from '@/types'
import { database } from '@/utils/database'
import { logger } from '@/utils/logger'

export interface CreateTemplateData {
  name: string
  category: 'business' | 'tech' | 'creative' | 'minimal'
  html: string
  css?: string
  variables: TemplateVariable[]
  previewImage?: string
  isPublic: boolean
  createdBy: string
}

export interface UpdateTemplateData {
  name?: string
  category?: 'business' | 'tech' | 'creative' | 'minimal'
  html?: string
  css?: string
  variables?: TemplateVariable[]
  previewImage?: string
  isPublic?: boolean
}

export class TemplateRepository {
  async create(data: CreateTemplateData): Promise<NewsletterTemplate> {
    const query = `
      INSERT INTO newsletter_templates (
        name, category, html, css, variables, preview_image, is_public, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `

    const values = [
      data.name,
      data.category,
      data.html,
      data.css || null,
      JSON.stringify(data.variables),
      data.previewImage || null,
      data.isPublic,
      data.createdBy,
    ]

    try {
      const result = await database.queryOne<any>(query, values)
      return this.mapToTemplate(result)
    } catch (error) {
      logger.error('Error creating template:', error)
      throw error
    }
  }

  async findById(id: string): Promise<NewsletterTemplate | null> {
    const query = `SELECT * FROM newsletter_templates WHERE id = $1`

    try {
      const result = await database.queryOne<any>(query, [id])
      return result ? this.mapToTemplate(result) : null
    } catch (error) {
      logger.error('Error finding template by id:', error)
      throw error
    }
  }

  async findMany(filters: {
    category?: 'business' | 'tech' | 'creative' | 'minimal'
    isPublic?: boolean
    createdBy?: string
    search?: string
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<{ templates: NewsletterTemplate[]; total: number }> {
    const conditions: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (filters.category) {
      conditions.push(`category = $${++paramCount}`)
      values.push(filters.category)
    }

    if (filters.isPublic !== undefined) {
      conditions.push(`is_public = $${++paramCount}`)
      values.push(filters.isPublic)
    }

    if (filters.createdBy) {
      conditions.push(`created_by = $${++paramCount}`)
      values.push(filters.createdBy)
    }

    if (filters.search) {
      conditions.push(`name ILIKE $${++paramCount}`)
      values.push(`%${filters.search}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM newsletter_templates ${whereClause}`
    const countResult = await database.queryOne<{ total: string }>(countQuery, values)
    const total = parseInt(countResult?.total || '0', 10)

    // Data query
    const sortBy = filters.sortBy || 'created_at'
    const sortOrder = filters.sortOrder || 'desc'
    const limit = filters.limit || 20
    const offset = ((filters.page || 1) - 1) * limit

    const dataQuery = `
      SELECT * FROM newsletter_templates
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `
    values.push(limit, offset)

    try {
      const results = await database.query<any>(dataQuery, values)
      const templates = results.map(result => this.mapToTemplate(result))

      return { templates, total }
    } catch (error) {
      logger.error('Error finding templates:', error)
      throw error
    }
  }

  async update(id: string, data: UpdateTemplateData): Promise<NewsletterTemplate | null> {
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (data.name !== undefined) {
      updates.push(`name = $${++paramCount}`)
      values.push(data.name)
    }

    if (data.category !== undefined) {
      updates.push(`category = $${++paramCount}`)
      values.push(data.category)
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

    if (data.previewImage !== undefined) {
      updates.push(`preview_image = $${++paramCount}`)
      values.push(data.previewImage)
    }

    if (data.isPublic !== undefined) {
      updates.push(`is_public = $${++paramCount}`)
      values.push(data.isPublic)
    }

    if (updates.length === 0) {
      return this.findById(id)
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)

    const query = `
      UPDATE newsletter_templates
      SET ${updates.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `

    try {
      const result = await database.queryOne<any>(query, values)
      return result ? this.mapToTemplate(result) : null
    } catch (error) {
      logger.error('Error updating template:', error)
      throw error
    }
  }

  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM newsletter_templates WHERE id = $1`

    try {
      const result = await database.query(query, [id])
      return result.length > 0
    } catch (error) {
      logger.error('Error deleting template:', error)
      throw error
    }
  }

  async findByCategory(category: string): Promise<NewsletterTemplate[]> {
    const query = `
      SELECT * FROM newsletter_templates
      WHERE category = $1 AND is_public = true
      ORDER BY created_at DESC
    `

    try {
      const results = await database.query<any>(query, [category])
      return results.map(result => this.mapToTemplate(result))
    } catch (error) {
      logger.error('Error finding templates by category:', error)
      throw error
    }
  }

  async findPublicTemplates(): Promise<NewsletterTemplate[]> {
    const query = `
      SELECT * FROM newsletter_templates
      WHERE is_public = true
      ORDER BY created_at DESC
    `

    try {
      const results = await database.query<any>(query)
      return results.map(result => this.mapToTemplate(result))
    } catch (error) {
      logger.error('Error finding public templates:', error)
      throw error
    }
  }

  async findByCreator(createdBy: string): Promise<NewsletterTemplate[]> {
    const query = `
      SELECT * FROM newsletter_templates
      WHERE created_by = $1
      ORDER BY created_at DESC
    `

    try {
      const results = await database.query<any>(query, [createdBy])
      return results.map(result => this.mapToTemplate(result))
    } catch (error) {
      logger.error('Error finding templates by creator:', error)
      throw error
    }
  }

  async getDuplicatesByName(name: string, excludeId?: string): Promise<NewsletterTemplate[]> {
    const query = excludeId
      ? `SELECT * FROM newsletter_templates WHERE name = $1 AND id != $2`
      : `SELECT * FROM newsletter_templates WHERE name = $1`

    const values = excludeId ? [name, excludeId] : [name]

    try {
      const results = await database.query<any>(query, values)
      return results.map(result => this.mapToTemplate(result))
    } catch (error) {
      logger.error('Error finding duplicate templates:', error)
      throw error
    }
  }

  async getUsageCount(templateId: string): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM newsletters WHERE template_id = $1`

    try {
      const result = await database.queryOne<{ count: string }>(query, [templateId])
      return parseInt(result?.count || '0', 10)
    } catch (error) {
      logger.error('Error getting template usage count:', error)
      throw error
    }
  }

  private mapToTemplate(row: any): NewsletterTemplate {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      html: row.html,
      css: row.css,
      variables: row.variables || [],
      previewImage: row.preview_image,
      isPublic: row.is_public,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
