import {
  EngagementEvent,
  EngagementEventType,
  PaginatedResponse,
  PaginationOptions,
} from '@/types';
import logger from '@/utils/logger';
import { Pool } from 'pg';

export interface CreateEngagementEventRequest {
  contactId: string;
  eventType: EngagementEventType;
  eventName?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
  score?: number;
  newsletterId?: string;
  campaignId?: string;
  workflowId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface EngagementEventFilter {
  contactId?: string;
  eventType?: EngagementEventType[];
  dateFrom?: Date;
  dateTo?: Date;
  newsletterId?: string;
  campaignId?: string;
  workflowId?: string;
}

export class EngagementEventRepository {
  constructor(private db: Pool) {}

  async create(data: CreateEngagementEventRequest): Promise<EngagementEvent> {
    try {
      const result = await this.db.query(
        `INSERT INTO engagement_events (
          contact_id, event_type, event_name, timestamp, metadata, score,
          newsletter_id, campaign_id, workflow_id, session_id, ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING *`,
        [
          data.contactId,
          data.eventType,
          data.eventName,
          data.timestamp || new Date(),
          JSON.stringify(data.metadata || {}),
          data.score || 0,
          data.newsletterId,
          data.campaignId,
          data.workflowId,
          data.sessionId,
          data.ipAddress,
          data.userAgent,
        ]
      );

      logger.info('Engagement event created', {
        eventId: result.rows[0].id,
        contactId: data.contactId,
        eventType: data.eventType,
      });

      return this.mapDatabaseToEvent(result.rows[0]);
    } catch (error) {
      logger.error('Error creating engagement event:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<EngagementEvent | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM engagement_events WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseToEvent(result.rows[0]);
    } catch (error) {
      logger.error('Error finding engagement event by ID:', { id, error });
      throw error;
    }
  }

  async findByContact(
    contactId: string,
    options: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<PaginatedResponse<EngagementEvent>> {
    try {
      const offset = (options.page - 1) * options.limit;
      const sortBy = options.sortBy || 'timestamp';
      const sortOrder = options.sortOrder || 'desc';

      // Get total count
      const countResult = await this.db.query(
        'SELECT COUNT(*) FROM engagement_events WHERE contact_id = $1',
        [contactId]
      );
      const total = parseInt(countResult.rows[0].count);

      // Get events
      const result = await this.db.query(
        `SELECT * FROM engagement_events
         WHERE contact_id = $1
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $2 OFFSET $3`,
        [contactId, options.limit, offset]
      );

      const events = result.rows.map(row => this.mapDatabaseToEvent(row));

      return {
        data: events,
        total,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(total / options.limit),
        hasNext: options.page < Math.ceil(total / options.limit),
        hasPrev: options.page > 1,
      };
    } catch (error) {
      logger.error('Error finding engagement events by contact:', {
        contactId,
        error,
      });
      throw error;
    }
  }

  async findByFilter(
    filter: EngagementEventFilter,
    options: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<PaginatedResponse<EngagementEvent>> {
    try {
      const offset = (options.page - 1) * options.limit;
      const sortBy = options.sortBy || 'timestamp';
      const sortOrder = options.sortOrder || 'desc';

      // Build WHERE clause
      const whereConditions = [];
      const values = [];
      let paramCount = 1;

      if (filter.contactId) {
        whereConditions.push(`contact_id = $${paramCount++}`);
        values.push(filter.contactId);
      }

      if (filter.eventType && filter.eventType.length > 0) {
        whereConditions.push(`event_type = ANY($${paramCount++})`);
        values.push(filter.eventType);
      }

      if (filter.dateFrom) {
        whereConditions.push(`timestamp >= $${paramCount++}`);
        values.push(filter.dateFrom);
      }

      if (filter.dateTo) {
        whereConditions.push(`timestamp <= $${paramCount++}`);
        values.push(filter.dateTo);
      }

      if (filter.newsletterId) {
        whereConditions.push(`newsletter_id = $${paramCount++}`);
        values.push(filter.newsletterId);
      }

      if (filter.campaignId) {
        whereConditions.push(`campaign_id = $${paramCount++}`);
        values.push(filter.campaignId);
      }

      if (filter.workflowId) {
        whereConditions.push(`workflow_id = $${paramCount++}`);
        values.push(filter.workflowId);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      // Get total count
      const countResult = await this.db.query(
        `SELECT COUNT(*) FROM engagement_events ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get events
      const result = await this.db.query(
        `SELECT * FROM engagement_events
         ${whereClause}
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $${paramCount++} OFFSET $${paramCount++}`,
        [...values, options.limit, offset]
      );

      const events = result.rows.map(row => this.mapDatabaseToEvent(row));

      return {
        data: events,
        total,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(total / options.limit),
        hasNext: options.page < Math.ceil(total / options.limit),
        hasPrev: options.page > 1,
      };
    } catch (error) {
      logger.error('Error finding engagement events by filter:', {
        filter,
        error,
      });
      throw error;
    }
  }

  async getEventStats(contactId: string): Promise<{
    totalEvents: number;
    eventsByType: Record<EngagementEventType, number>;
    totalScore: number;
    lastActivity: Date | null;
    engagementTrend: Array<{ date: string; count: number; score: number }>;
  }> {
    try {
      // Total events and score
      const totalResult = await this.db.query(
        `SELECT COUNT(*) as total_events, SUM(score) as total_score, MAX(timestamp) as last_activity
         FROM engagement_events WHERE contact_id = $1`,
        [contactId]
      );

      const totalEvents = parseInt(totalResult.rows[0].total_events);
      const totalScore = parseFloat(totalResult.rows[0].total_score) || 0;
      const lastActivity = totalResult.rows[0].last_activity;

      // Events by type
      const typeResult = await this.db.query(
        `SELECT event_type, COUNT(*) as count
         FROM engagement_events WHERE contact_id = $1
         GROUP BY event_type`,
        [contactId]
      );

      const eventsByType = typeResult.rows.reduce(
        (acc, row) => {
          acc[row.event_type as EngagementEventType] = parseInt(row.count);
          return acc;
        },
        {} as Record<EngagementEventType, number>
      );

      // Engagement trend (last 30 days)
      const trendResult = await this.db.query(
        `SELECT
           DATE(timestamp) as date,
           COUNT(*) as count,
           SUM(score) as score
         FROM engagement_events
         WHERE contact_id = $1 AND timestamp >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(timestamp)
         ORDER BY date DESC`,
        [contactId]
      );

      const engagementTrend = trendResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count),
        score: parseFloat(row.score) || 0,
      }));

      return {
        totalEvents,
        eventsByType,
        totalScore,
        lastActivity,
        engagementTrend,
      };
    } catch (error) {
      logger.error('Error getting event stats:', { contactId, error });
      throw error;
    }
  }

  async getTopEvents(
    limit: number = 10,
    timeRange?: { start: Date; end: Date }
  ): Promise<
    Array<{
      eventType: EngagementEventType;
      count: number;
      totalScore: number;
      avgScore: number;
    }>
  > {
    try {
      let whereClause = '';
      const values = [];

      if (timeRange) {
        whereClause = 'WHERE timestamp >= $1 AND timestamp <= $2';
        values.push(timeRange.start, timeRange.end);
      }

      const result = await this.db.query(
        `SELECT
           event_type,
           COUNT(*) as count,
           SUM(score) as total_score,
           AVG(score) as avg_score
         FROM engagement_events ${whereClause}
         GROUP BY event_type
         ORDER BY count DESC
         LIMIT $${values.length + 1}`,
        [...values, limit]
      );

      return result.rows.map(row => ({
        eventType: row.event_type as EngagementEventType,
        count: parseInt(row.count),
        totalScore: parseFloat(row.total_score) || 0,
        avgScore: parseFloat(row.avg_score) || 0,
      }));
    } catch (error) {
      logger.error('Error getting top events:', error);
      throw error;
    }
  }

  async getEngagementTimeline(
    contactId: string,
    limit: number = 50
  ): Promise<EngagementEvent[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM engagement_events
         WHERE contact_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [contactId, limit]
      );

      return result.rows.map(row => this.mapDatabaseToEvent(row));
    } catch (error) {
      logger.error('Error getting engagement timeline:', { contactId, error });
      throw error;
    }
  }

  async deleteOldEvents(olderThanDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.db.query(
        'DELETE FROM engagement_events WHERE timestamp < $1',
        [cutoffDate]
      );

      logger.info('Old engagement events deleted', {
        deletedCount: result.rowCount,
        cutoffDate,
      });

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error deleting old events:', error);
      throw error;
    }
  }

  private mapDatabaseToEvent(row: any): EngagementEvent {
    return {
      id: row.id,
      contactId: row.contact_id,
      eventType: row.event_type as EngagementEventType,
      eventName: row.event_name,
      timestamp: row.timestamp,
      metadata: JSON.parse(row.metadata || '{}'),
      score: row.score,
      newsletterId: row.newsletter_id,
      campaignId: row.campaign_id,
      workflowId: row.workflow_id,
      sessionId: row.session_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    };
  }
}
