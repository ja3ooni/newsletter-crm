import {
    CreateNewsletterRequest,
    Newsletter,
    NewsletterAnalytics,
    NewsletterMetrics,
    UpdateNewsletterRequest
} from '@/types'
import { database } from '@/utils/database'
import { logger } from '@/utils/logger'

export class NewsletterRepository {
  async create(data: CreateNewsletterRequest & { createdBy: string }): Promise<Newsletter> {
    const query = `
      INSERT INTO newsletters (
        title, template_id, status, scheduled_at, segments,
        personalization, deliverability_settings, ab_test, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `

    const values = [
      data.title,
      data.templateId || null,
      'draft',
      data.scheduledAt || null,
      data.segments,
      JSON.stringify(data.personalization || {}),
      JSON.stringify(data.deliverabilitySettings || {}),
      data.abTest ? JSON.stringify(data.abTest) : null,
      data.createdBy,
    ]

    try {
      const result = await database.queryOne<any>(query, values)
      return this.mapToNewsletter(result)
    } catch (error) {
      logger.error('Error creating newsletter:', error)
      throw error
    }
  }

  async findById(id: string): Promise<Newsletter | null> {
    const query = `
      SELECT * FROM newsletters
      WHERE id = $1
    `

    try {
      const result = await database.queryOne<any>(query, [id])
      return result ? this.mapToNewsletter(result) : null
    } catch (error) {
      logger.error('Error finding newsletter by id:', error)
      throw error
    }
  }

  async findMany(filters: {
    status?: Newsletter['status']
    createdBy?: string
    templateId?: string
    search?: string
    dateFrom?: Date
    dateTo?: Date
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<{ newsletters: Newsletter[]; total: number }> {
    const conditions: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (filters.status) {
      conditions.push(`status = $${++paramCount}`)
      values.push(filters.status)
    }

    if (filters.createdBy) {
      conditions.push(`created_by = $${++paramCount}`)
      values.push(filters.createdBy)
    }

    if (filters.templateId) {
      conditions.push(`template_id = $${++paramCount}`)
      values.push(filters.templateId)
    }

    if (filters.search) {
      conditions.push(`title ILIKE $${++paramCount}`)
      values.push(`%${filters.search}%`)
    }

    if (filters.dateFrom) {
      conditions.push(`created_at >= $${++paramCount}`)
      values.push(filters.dateFrom)
    }

    if (filters.dateTo) {
      conditions.push(`created_at <= $${++paramCount}`)
      values.push(filters.dateTo)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM newsletters ${whereClause}`
    const countResult = await database.queryOne<{ total: string }>(countQuery, values)
    const total = parseInt(countResult?.total || '0', 10)

    // Data query
    const sortBy = filters.sortBy || 'created_at'
    const sortOrder = filters.sortOrder || 'desc'
    const limit = filters.limit || 20
    const offset = ((filters.page || 1) - 1) * limit

    const dataQuery = `
      SELECT * FROM newsletters
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `
    values.push(limit, offset)

    try {
      const results = await database.query<any>(dataQuery, values)
      const newsletters = results.map(result => this.mapToNewsletter(result))

      return { newsletters, total }
    } catch (error) {
      logger.error('Error finding newsletters:', error)
      throw error
    }
  }

  async update(id: string, data: UpdateNewsletterRequest): Promise<Newsletter | null> {
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (data.title !== undefined) {
      updates.push(`title = $${++paramCount}`)
      values.push(data.title)
    }

    if (data.content !== undefined) {
      updates.push(`content = $${++paramCount}`)
      values.push(JSON.stringify(data.content))
    }

    if (data.status !== undefined) {
      updates.push(`status = $${++paramCount}`)
      values.push(data.status)
    }

    if (data.scheduledAt !== undefined) {
      updates.push(`scheduled_at = $${++paramCount}`)
      values.push(data.scheduledAt)
    }

    if (data.personalization !== undefined) {
      updates.push(`personalization = $${++paramCount}`)
      values.push(JSON.stringify(data.personalization))
    }

    if (data.deliverabilitySettings !== undefined) {
      updates.push(`deliverability_settings = $${++paramCount}`)
      values.push(JSON.stringify(data.deliverabilitySettings))
    }

    if (updates.length === 0) {
      return this.findById(id)
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)

    const query = `
      UPDATE newsletters
      SET ${updates.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `

    try {
      const result = await database.queryOne<any>(query, values)
      return result ? this.mapToNewsletter(result) : null
    } catch (error) {
      logger.error('Error updating newsletter:', error)
      throw error
    }
  }

  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM newsletters WHERE id = $1`

    try {
      const result = await database.query(query, [id])
      return result.length > 0
    } catch (error) {
      logger.error('Error deleting newsletter:', error)
      throw error
    }
  }

  async updateMetrics(id: string, metrics: Partial<NewsletterMetrics>): Promise<void> {
    const query = `
      UPDATE newsletters
      SET metrics = metrics || $1, updated_at = NOW()
      WHERE id = $2
    `

    try {
      await database.query(query, [JSON.stringify(metrics), id])
    } catch (error) {
      logger.error('Error updating newsletter metrics:', error)
      throw error
    }
  }

  async markAsSent(id: string): Promise<void> {
    const query = `
      UPDATE newsletters
      SET status = 'sent', sent_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `

    try {
      await database.query(query, [id])
    } catch (error) {
      logger.error('Error marking newsletter as sent:', error)
      throw error
    }
  }

  async markAsFailed(id: string, error?: string): Promise<void> {
    const query = `
      UPDATE newsletters
      SET status = 'failed', updated_at = NOW()
      WHERE id = $1
    `

    try {
      await database.query(query, [id])
      if (error) {
        logger.error('Newsletter marked as failed:', { newsletterId: id, error })
      }
    } catch (dbError) {
      logger.error('Error marking newsletter as failed:', dbError)
      throw dbError
    }
  }

  async getScheduledNewsletters(limit: number = 100): Promise<Newsletter[]> {
    const query = `
      SELECT * FROM newsletters
      WHERE status = 'scheduled'
        AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT $1
    `

    try {
      const results = await database.query<any>(query, [limit])
      return results.map(result => this.mapToNewsletter(result))
    } catch (error) {
      logger.error('Error getting scheduled newsletters:', error)
      throw error
    }
  }

  async getAnalytics(id: string, timeRange: { start: Date; end: Date }): Promise<NewsletterAnalytics | null> {
    // This would typically involve complex queries across multiple tables
    // For now, returning basic structure
    const newsletter = await this.findById(id)
    if (!newsletter) {
      return null
    }

    // In a real implementation, this would query engagement_events, clicks, etc.
    const analytics: NewsletterAnalytics = {
      newsletterId: id,
      timeRange,
      metrics: newsletter.metrics,
      engagement: {
        opensByHour: {},
        clicksByDevice: {},
        geographicDistribution: {},
        topLinks: [],
      },
      comparisons: {},
    }

    return analytics
  }

  async getDuplicatesByTitle(title: string, excludeId?: string): Promise<Newsletter[]> {
    const query = excludeId
      ? `SELECT * FROM newsletters WHERE title = $1 AND id != $2`
      : `SELECT * FROM newsletters WHERE title = $1`

    const values = excludeId ? [title, excludeId] : [title]

    try {
      const results = await database.query<any>(query, values)
      return results.map(result => this.mapToNewsletter(result))
    } catch (error) {
      logger.error('Error finding duplicate newsletters:', error)
      throw error
    }
  }

  private mapToNewsletter(row: any): Newsletter {
    return {
      id: row.id,
      title: row.title,
      content: row.content || { sections: [], personalization: {}, metadata: {}, dynamicContent: [] },
      templateId: row.template_id,
      status: row.status,
      scheduledAt: row.scheduled_at,
      sentAt: row.sent_at,
      metrics: row.metrics || {
        sent: 0,
        delivered: 0,
        opens: 0,
        uniqueOpens: 0,
        clicks: 0,
        uniqueClicks: 0,
        unsubscribes: 0,
        bounces: 0,
        complaints: 0,
        openRate: 0,
        clickRate: 0,
        unsubscribeRate: 0,
        bounceRate: 0,
      },
      abTest: row.ab_test,
      segments: row.segments || [],
      personalization: row.personalization || { enabled: false, rules: [], fallbackContent: '' },
      deliverabilitySettings: row.deliverability_settings || {
        fromName: 'AiLert Newsletter',
        fromEmail: 'noreply@ailert.com',
        replyTo: 'support@ailert.com',
        trackOpens: true,
        trackClicks: true,
        unsubscribeLink: true,
        customHeaders: {},
      },
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
