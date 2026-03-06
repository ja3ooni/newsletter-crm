// @ts-nocheck
import {
  AutomationEvent,
  EventTrigger,
  FilterParams,
  PaginatedResponse,
  PaginationParams,
} from '@/types';
import { database } from '@/utils/database';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class EventRepository {
  // ============================================================================
  // AUTOMATION EVENT METHODS
  // ============================================================================

  async createEvent(
    type: string,
    contactId: string,
    data: Record<string, any>,
    source: string = 'system'
  ): Promise<AutomationEvent> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO automation_events (
        id, type, contact_id, timestamp, data, source, processed, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id,
      type,
      contactId,
      now,
      JSON.stringify(data),
      source,
      false,
      null,
    ];

    try {
      const result = await database.query(query, values);
      const event = this.mapRowToEvent(result.rows[0]);

      logger.info('Automation event created', {
        eventId: id,
        type,
        contactId,
        source,
      });

      return event;
    } catch (error) {
      logger.error('Error creating automation event', {
        error,
        type,
        contactId,
        data,
      });
      throw error;
    }
  }

  async findEventById(id: string): Promise<AutomationEvent | null> {
    const query = 'SELECT * FROM automation_events WHERE id = $1';

    try {
      const result = await database.query(query, [id]);

      return result.rows[0] ? this.mapRowToEvent(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding event by ID', { error, id });
      throw error;
    }
  }

  async findUnprocessedEvents(limit: number = 100): Promise<AutomationEvent[]> {
    const query = `
      SELECT * FROM automation_events
      WHERE processed = false
      ORDER BY timestamp ASC
      LIMIT $1
    `;

    try {
      const result = await database.query(query, [limit]);

      return result.rows.map(row => this.mapRowToEvent(row));
    } catch (error) {
      logger.error('Error finding unprocessed events', { error, limit });
      throw error;
    }
  }

  async findEventsByContact(
    contactId: string,
    pagination: PaginationParams,
    filters?: FilterParams
  ): Promise<PaginatedResponse<AutomationEvent>> {
    let whereClause = 'WHERE contact_id = $1';
    const queryParams: any[] = [contactId];
    let paramIndex = 2;

    // Apply filters
    if (filters?.dateRange) {
      whereClause += ` AND timestamp BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      queryParams.push(filters.dateRange.start, filters.dateRange.end);
      paramIndex += 2;
    }

    // Count query
    const countQuery = `SELECT COUNT(*) FROM automation_events ${whereClause}`;
    const countResult = await database.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Data query with pagination
    const offset = (pagination.page - 1) * pagination.limit;
    const orderBy = pagination.sortBy
      ? `ORDER BY ${pagination.sortBy} ${pagination.sortOrder}`
      : 'ORDER BY timestamp DESC';

    const dataQuery = `
      SELECT * FROM automation_events
      ${whereClause}
      ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(pagination.limit, offset);

    try {
      const result = await database.query(dataQuery, queryParams);
      const events = result.rows.map(row => this.mapRowToEvent(row));

      return {
        data: events,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
          hasNext: pagination.page < Math.ceil(total / pagination.limit),
          hasPrev: pagination.page > 1,
        },
      };
    } catch (error) {
      logger.error('Error finding events by contact', {
        error,
        contactId,
        pagination,
        filters,
      });
      throw error;
    }
  }

  async findEventsByType(
    eventType: string,
    pagination: PaginationParams,
    filters?: FilterParams
  ): Promise<PaginatedResponse<AutomationEvent>> {
    let whereClause = 'WHERE type = $1';
    const queryParams: any[] = [eventType];
    let paramIndex = 2;

    // Apply filters
    if (filters?.dateRange) {
      whereClause += ` AND timestamp BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      queryParams.push(filters.dateRange.start, filters.dateRange.end);
      paramIndex += 2;
    }

    // Count query
    const countQuery = `SELECT COUNT(*) FROM automation_events ${whereClause}`;
    const countResult = await database.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Data query with pagination
    const offset = (pagination.page - 1) * pagination.limit;
    const orderBy = pagination.sortBy
      ? `ORDER BY ${pagination.sortBy} ${pagination.sortOrder}`
      : 'ORDER BY timestamp DESC';

    const dataQuery = `
      SELECT * FROM automation_events
      ${whereClause}
      ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(pagination.limit, offset);

    try {
      const result = await database.query(dataQuery, queryParams);
      const events = result.rows.map(row => this.mapRowToEvent(row));

      return {
        data: events,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
          hasNext: pagination.page < Math.ceil(total / pagination.limit),
          hasPrev: pagination.page > 1,
        },
      };
    } catch (error) {
      logger.error('Error finding events by type', {
        error,
        eventType,
        pagination,
        filters,
      });
      throw error;
    }
  }

  async markEventAsProcessed(id: string): Promise<void> {
    const query = `
      UPDATE automation_events
      SET processed = true, processed_at = $1
      WHERE id = $2
    `;

    try {
      await database.query(query, [new Date(), id]);
      logger.debug('Event marked as processed', { eventId: id });
    } catch (error) {
      logger.error('Error marking event as processed', { error, id });
      throw error;
    }
  }

  async deleteOldEvents(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();

    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const query = `
      DELETE FROM automation_events
      WHERE timestamp < $1 AND processed = true
    `;

    try {
      const result = await database.query(query, [cutoffDate]);
      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        logger.info('Old events deleted', { deletedCount, cutoffDate });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Error deleting old events', { error, olderThanDays });
      throw error;
    }
  }

  // ============================================================================
  // EVENT TRIGGER METHODS
  // ============================================================================

  async createEventTrigger(
    name: string,
    eventType: string,
    conditions: any[],
    workflowId?: string,
    campaignId?: string
  ): Promise<EventTrigger> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO event_triggers (
        id, name, event_type, conditions, workflow_id, campaign_id, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      id,
      name,
      eventType,
      JSON.stringify(conditions),
      workflowId || null,
      campaignId || null,
      true,
      now,
      now,
    ];

    try {
      const result = await database.query(query, values);
      const trigger = this.mapRowToEventTrigger(result.rows[0]);

      logger.info('Event trigger created', { triggerId: id, name, eventType });

      return trigger;
    } catch (error) {
      logger.error('Error creating event trigger', {
        error,
        name,
        eventType,
        conditions,
      });
      throw error;
    }
  }

  async findEventTriggerById(id: string): Promise<EventTrigger | null> {
    const query = 'SELECT * FROM event_triggers WHERE id = $1';

    try {
      const result = await database.query(query, [id]);

      return result.rows[0] ? this.mapRowToEventTrigger(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding event trigger by ID', { error, id });
      throw error;
    }
  }

  async findEventTriggersByType(eventType: string): Promise<EventTrigger[]> {
    const query = `
      SELECT * FROM event_triggers
      WHERE event_type = $1 AND is_active = true
      ORDER BY created_at ASC
    `;

    try {
      const result = await database.query(query, [eventType]);

      return result.rows.map(row => this.mapRowToEventTrigger(row));
    } catch (error) {
      logger.error('Error finding event triggers by type', {
        error,
        eventType,
      });
      throw error;
    }
  }

  async findAllEventTriggers(
    pagination: PaginationParams,
    filters?: FilterParams
  ): Promise<PaginatedResponse<EventTrigger>> {
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Apply filters
    if (filters?.dateRange) {
      whereClause += ` AND created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      queryParams.push(filters.dateRange.start, filters.dateRange.end);
      paramIndex += 2;
    }

    // Count query
    const countQuery = `SELECT COUNT(*) FROM event_triggers ${whereClause}`;
    const countResult = await database.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Data query with pagination
    const offset = (pagination.page - 1) * pagination.limit;
    const orderBy = pagination.sortBy
      ? `ORDER BY ${pagination.sortBy} ${pagination.sortOrder}`
      : 'ORDER BY created_at DESC';

    const dataQuery = `
      SELECT * FROM event_triggers
      ${whereClause}
      ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(pagination.limit, offset);

    try {
      const result = await database.query(dataQuery, queryParams);
      const triggers = result.rows.map(row => this.mapRowToEventTrigger(row));

      return {
        data: triggers,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
          hasNext: pagination.page < Math.ceil(total / pagination.limit),
          hasPrev: pagination.page > 1,
        },
      };
    } catch (error) {
      logger.error('Error finding all event triggers', {
        error,
        pagination,
        filters,
      });
      throw error;
    }
  }

  async updateEventTrigger(
    id: string,
    updates: Partial<Pick<EventTrigger, 'name' | 'conditions' | 'isActive'>>
  ): Promise<EventTrigger | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }

    if (updates.conditions !== undefined) {
      updateFields.push(`conditions = $${paramIndex}`);
      values.push(JSON.stringify(updates.conditions));
      paramIndex++;
    }

    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      values.push(updates.isActive);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return this.findEventTriggerById(id);
    }

    updateFields.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(id);

    const query = `
      UPDATE event_triggers
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await database.query(query, values);

      if (result.rows[0]) {
        const trigger = this.mapRowToEventTrigger(result.rows[0]);

        logger.info('Event trigger updated', { triggerId: id });

        return trigger;
      }

      return null;
    } catch (error) {
      logger.error('Error updating event trigger', { error, id, updates });
      throw error;
    }
  }

  async deleteEventTrigger(id: string): Promise<boolean> {
    const query = 'DELETE FROM event_triggers WHERE id = $1';

    try {
      const result = await database.query(query, [id]);
      const deleted = result.rowCount > 0;

      if (deleted) {
        logger.info('Event trigger deleted', { triggerId: id });
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting event trigger', { error, id });
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private mapRowToEvent(row: Record<string, any>): AutomationEvent {
    return {
      id: row.id,
      type: row.type,
      contactId: row.contact_id,
      timestamp: new Date(row.timestamp),
      data: JSON.parse(row.data),
      source: row.source,
      processed: row.processed,
      processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
    };
  }

  private mapRowToEventTrigger(row: Record<string, any>): EventTrigger {
    return {
      id: row.id,
      name: row.name,
      eventType: row.event_type,
      conditions: JSON.parse(row.conditions),
      workflowId: row.workflow_id,
      campaignId: row.campaign_id,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export default EventRepository;
