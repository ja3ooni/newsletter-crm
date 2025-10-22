import { ScheduledNewsletter } from '@/types'
import { database } from '@/utils/database'
import { logger } from '@/utils/logger'
import { QUEUE_NAMES, queueService } from '@/utils/queue'

export interface ScheduleNewsletterData {
  newsletterId: string
  scheduledAt: Date
  timezone: string
}

export class SchedulingService {
  async scheduleNewsletter(data: ScheduleNewsletterData): Promise<ScheduledNewsletter> {
    try {
      // Validate schedule time is in the future
      if (data.scheduledAt <= new Date()) {
        throw new Error('Scheduled time must be in the future')
      }

      // Create scheduled newsletter record
      const query = `
        INSERT INTO scheduled_newsletters (
          newsletter_id, scheduled_at, timezone, status
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `

      const values = [
        data.newsletterId,
        data.scheduledAt,
        data.timezone,
        'scheduled',
      ]

      const result = await database.queryOne<any>(query, values)
      const scheduledNewsletter = this.mapToScheduledNewsletter(result)

      // Add job to queue with delay
      const delay = data.scheduledAt.getTime() - Date.now()
      const job = await queueService.addJob(
        QUEUE_NAMES.EMAIL_SENDING,
        'send-scheduled-newsletter',
        {
          newsletterId: data.newsletterId,
          scheduledNewsletterIds: scheduledNewsletter.id,
        },
        {
          delay: delay,
          priority: 'normal',
        } as any
      )

      // Update with job ID
      await database.query(
        `UPDATE scheduled_newsletters SET job_id = $1 WHERE id = $2`,
        [job.id, scheduledNewsletter.id]
      )

      scheduledNewsletter.jobId = job.id.toString()

      logger.info('Newsletter scheduled successfully', {
        newsletterId: data.newsletterId,
        scheduledAt: data.scheduledAt,
        timezone: data.timezone,
        jobId: job.id,
      })

      return scheduledNewsletter
    } catch (error) {
      logger.error('Error scheduling newsletter:', error)
      throw error
    }
  }

  async cancelScheduledNewsletter(newsletterId: string): Promise<boolean> {
    try {
      // Find scheduled newsletter
      const query = `
        SELECT * FROM scheduled_newsletters
        WHERE newsletter_id = $1 AND status = 'scheduled'
      `
      const scheduledNewsletter = await database.queryOne<any>(query, [newsletterId])

      if (!scheduledNewsletter) {
        return false
      }

      // Cancel the job if it exists
      if (scheduledNewsletter.job_id) {
        const job = await queueService.getJob(QUEUE_NAMES.EMAIL_SENDING, scheduledNewsletter.job_id)
        if (job) {
          await job.remove()
        }
      }

      // Update status to cancelled
      await database.query(
        `UPDATE scheduled_newsletters SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [scheduledNewsletter.id]
      )

      logger.info('Scheduled newsletter cancelled', {
        newsletterId,
        scheduledNewsletterIds: scheduledNewsletter.id,
      })

      return true
    } catch (error) {
      logger.error('Error cancelling scheduled newsletter:', error)
      throw error
    }
  }

  async rescheduleNewsletter(
    newsletterId: string,
    newScheduledAt: Date,
    timezone: string = 'UTC'
  ): Promise<ScheduledNewsletter | null> {
    try {
      // Cancel existing schedule
      await this.cancelScheduledNewsletter(newsletterId)

      // Create new schedule
      return await this.scheduleNewsletter({
        newsletterId,
        scheduledAt: newScheduledAt,
        timezone,
      })
    } catch (error) {
      logger.error('Error rescheduling newsletter:', error)
      throw error
    }
  }

  async getScheduledNewsletter(newsletterId: string): Promise<ScheduledNewsletter | null> {
    try {
      const query = `
        SELECT * FROM scheduled_newsletters
        WHERE newsletter_id = $1 AND status = 'scheduled'
        ORDER BY created_at DESC
        LIMIT 1
      `
      const result = await database.queryOne<any>(query, [newsletterId])
      return result ? this.mapToScheduledNewsletter(result) : null
    } catch (error) {
      logger.error('Error getting scheduled newsletter:', error)
      throw error
    }
  }

  async getScheduledNewsletters(filters: {
    status?: 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled'
    scheduledBefore?: Date
    scheduledAfter?: Date
    limit?: number
  } = {}): Promise<ScheduledNewsletter[]> {
    try {
      const conditions: string[] = []
      const values: any[] = []
      let paramCount = 0

      if (filters.status) {
        conditions.push(`status = $${++paramCount}`)
        values.push(filters.status)
      }

      if (filters.scheduledBefore) {
        conditions.push(`scheduled_at <= $${++paramCount}`)
        values.push(filters.scheduledBefore)
      }

      if (filters.scheduledAfter) {
        conditions.push(`scheduled_at >= $${++paramCount}`)
        values.push(filters.scheduledAfter)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const limit = filters.limit || 100

      const query = `
        SELECT * FROM scheduled_newsletters
        ${whereClause}
        ORDER BY scheduled_at ASC
        LIMIT $${++paramCount}
      `
      values.push(limit)

      const results = await database.query<any>(query, values)
      return results.map(result => this.mapToScheduledNewsletter(result))
    } catch (error) {
      logger.error('Error getting scheduled newsletters:', error)
      throw error
    }
  }

  async markAsProcessing(id: string): Promise<void> {
    try {
      await database.query(
        `UPDATE scheduled_newsletters SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [id]
      )
    } catch (error) {
      logger.error('Error marking scheduled newsletter as processing:', error)
      throw error
    }
  }

  async markAsSent(id: string): Promise<void> {
    try {
      await database.query(
        `UPDATE scheduled_newsletters SET status = 'sent', updated_at = NOW() WHERE id = $1`,
        [id]
      )
    } catch (error) {
      logger.error('Error marking scheduled newsletter as sent:', error)
      throw error
    }
  }

  async markAsFailed(id: string, error?: string): Promise<void> {
    try {
      await database.query(
        `UPDATE scheduled_newsletters SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [id]
      )

      if (error) {
        logger.error('Scheduled newsletter failed:', { scheduledNewsletterIds: id, error })
      }
    } catch (dbError) {
      logger.error('Error marking scheduled newsletter as failed:', dbError)
      throw dbError
    }
  }

  async getDueNewsletters(): Promise<ScheduledNewsletter[]> {
    try {
      const query = `
        SELECT * FROM scheduled_newsletters
        WHERE status = 'scheduled'
          AND scheduled_at <= NOW()
        ORDER BY scheduled_at ASC
        LIMIT 50
      `
      const results = await database.query<any>(query)
      return results.map(result => this.mapToScheduledNewsletter(result))
    } catch (error) {
      logger.error('Error getting due newsletters:', error)
      throw error
    }
  }

  async cleanupOldSchedules(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

      const query = `
        DELETE FROM scheduled_newsletters
        WHERE status IN ('sent', 'failed', 'cancelled')
          AND updated_at < $1
      `
      const result = await database.query(query, [cutoffDate])

      const deletedCount = result.length
      logger.info('Cleaned up old scheduled newsletters', {
        deletedCount,
        olderThanDays
      })

      return deletedCount
    } catch (error) {
      logger.error('Error cleaning up old schedules:', error)
      throw error
    }
  }

  async getScheduleStats(): Promise<{
    scheduled: number
    processing: number
    sent: number
    failed: number
    cancelled: number
  }> {
    try {
      const query = `
        SELECT
          status,
          COUNT(*) as count
        FROM scheduled_newsletters
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY status
      `
      const results = await database.query<{ status: string; count: string }>(query)

      const stats = {
        scheduled: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
      }

      results.forEach(result => {
        const status = result.status as keyof typeof stats
        if (status in stats) {
          stats[status] = parseInt(result.count, 10)
        }
      })

      return stats
    } catch (error) {
      logger.error('Error getting schedule stats:', error)
      throw error
    }
  }

  private mapToScheduledNewsletter(row: any): ScheduledNewsletter {
    return {
      id: row.id,
      newsletterId: row.newsletter_id,
      scheduledAt: row.scheduled_at,
      timezone: row.timezone,
      status: row.status,
      jobId: row.job_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
