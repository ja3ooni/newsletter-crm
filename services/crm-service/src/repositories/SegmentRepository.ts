// @ts-nocheck
import {
    CreateSegmentRequest,
    DatabaseSegment,
    NotFoundError,
    PaginatedResponse,
    PaginationOptions,
    Segment,
    SegmentCondition,
    UpdateSegmentRequest,
    ValidationError
} from '@/types';
import database from '@/utils/database';
import logger from '@/utils/logger';
import redis from '@/utils/redis';

export class SegmentRepository {
  private readonly CACHE_TTL = 600; // 10 minutes
  private readonly CACHE_PREFIX = 'segment:';
  private readonly CONTACT_CACHE_PREFIX = 'segment_contacts:';

  // Convert database row to Segment object
  private mapDatabaseToSegment(row: DatabaseSegment): Segment {
    const segment: Segment = {
      id: row.id,
      name: row.name,
      conditions: Array.isArray(row.conditions) ? row.conditions : [],
      contactCount: row.contact_count,
      isAutoUpdating: row.is_auto_updating,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Only add optional properties if they have values
    if (row.description) segment.description = row.description;
    if (row.created_by) segment.createdBy = row.created_by;

    return segment;
  }

  // Convert Segment object to database format
  private mapSegmentToDatabase(segment: Partial<Segment>): Partial<DatabaseSegment> {
    const result: Partial<DatabaseSegment> = {};

    if (segment.name !== undefined) result.name = segment.name;
    if (segment.description !== undefined) result.description = segment.description;
    if (segment.conditions !== undefined) result.conditions = segment.conditions;
    if (segment.contactCount !== undefined) result.contact_count = segment.contactCount;
    if (segment.isAutoUpdating !== undefined) result.is_auto_updating = segment.isAutoUpdating;
    if (segment.isActive !== undefined) result.is_active = segment.isActive;
    if (segment.createdBy !== undefined) result.created_by = segment.createdBy;

    return result;
  }

  async create(segmentData: CreateSegmentRequest, createdBy?: string): Promise<Segment> {
    try {
      // Validate conditions
      this.validateConditions(segmentData.conditions);

      const query = `
        INSERT INTO segments (
          name, description, conditions, is_auto_updating, created_by
        ) VALUES (
          $1, $2, $3, $4, $5
        ) RETURNING *
      `;

      const values = [
        segmentData.name,
        segmentData.description,
        JSON.stringify(segmentData.conditions),
        segmentData.isAutoUpdating ?? true,
        createdBy,
      ];

      const result = await database.query<DatabaseSegment>(query, values);
      const segment = this.mapDatabaseToSegment(result.rows[0]!);

      // Cache the new segment
      await this.cacheSegment(segment);

      // Calculate initial contact count
      await this.updateContactCount(segment.id);

      logger.info('Segment created', { segmentId: segment.id, name: segment.name });
      return segment;
    } catch (error) {
      logger.error('Error creating segment:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Segment | null> {
    try {
      // Try cache first
      const cached = await redis.cacheGet<Segment>(`${this.CACHE_PREFIX}${id}`);
      if (cached) {
        return cached;
      }

      const query = 'SELECT * FROM segments WHERE id = $1';
      const result = await database.query<DatabaseSegment>(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const segment = this.mapDatabaseToSegment(result.rows[0]!);
      await this.cacheSegment(segment);

      return segment;
    } catch (error) {
      logger.error('Error finding segment by ID:', { id, error });
      throw error;
    }
  }

  async findAll(options: PaginationOptions = { page: 1, limit: 50 }): Promise<PaginatedResponse<Segment>> {
    try {
      const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = options;
      const offset = (page - 1) * limit;

      // Count query
      const countQuery = 'SELECT COUNT(*) FROM segments WHERE is_active = true';
      const countResult = await database.query<{ count: string }>(countQuery);
      const total = parseInt(countResult.rows[0]!.count, 10);

      // Data query
      const dataQuery = `
        SELECT * FROM segments
        WHERE is_active = true
        ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
        LIMIT $1 OFFSET $2
      `;

      const dataResult = await database.query<DatabaseSegment>(dataQuery, [limit, offset]);
      const segments = dataResult.rows.map(row => this.mapDatabaseToSegment(row));

      const totalPages = Math.ceil(total / limit);

      return {
        data: segments,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error finding all segments:', error);
      throw error;
    }
  }

  async update(id: string, updates: UpdateSegmentRequest): Promise<Segment> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError('Segment');
      }

      // Validate conditions if provided
      if (updates.conditions) {
        this.validateConditions(updates.conditions);
      }

      const dbData = this.mapSegmentToDatabase(updates);

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.entries(dbData).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          if (key === 'conditions') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        return existing;
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE segments
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await database.query<DatabaseSegment>(query, values);
      const segment = this.mapDatabaseToSegment(result.rows[0]!);

      // Update cache
      await this.cacheSegment(segment);

      // Recalculate contact count if conditions changed
      if (updates.conditions) {
        await this.updateContactCount(segment.id);
      }

      logger.info('Segment updated', { segmentId: id });
      return segment;
    } catch (error) {
      logger.error('Error updating segment:', { id, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Soft delete by setting is_active to false
      const query = `
        UPDATE segments
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `;

      const result = await database.query(query, [id]);

      if (result.rowCount === 0) {
        throw new NotFoundError('Segment');
      }

      // Remove from cache
      await redis.del(`${this.CACHE_PREFIX}${id}`);
      await redis.del(`${this.CONTACT_CACHE_PREFIX}${id}`);

      logger.info('Segment deleted', { segmentId: id });
    } catch (error) {
      logger.error('Error deleting segment:', { id, error });
      throw error;
    }
  }

  async getContactIds(segmentId: string): Promise<string[]> {
    try {
      // Try cache first
      const cached = await redis.cacheGet<string[]>(`${this.CONTACT_CACHE_PREFIX}${segmentId}`);
      if (cached) {
        return cached;
      }

      const segment = await this.findById(segmentId);
      if (!segment) {
        throw new NotFoundError('Segment');
      }

      const contactIds = await this.calculateSegmentContacts(segment.conditions);

      // Cache the result
      await redis.cacheSet(`${this.CONTACT_CACHE_PREFIX}${segmentId}`, contactIds, this.CACHE_TTL);

      return contactIds;
    } catch (error) {
      logger.error('Error getting segment contact IDs:', { segmentId, error });
      throw error;
    }
  }

  async addContactsToSegment(segmentId: string, contactIds: string[], addedBy?: string): Promise<void> {
    return database.transaction(async (client) => {
      try {
        // Remove existing associations first
        await client.query(
          'DELETE FROM contact_segments WHERE segment_id = $1 AND contact_id = ANY($2)',
          [segmentId, contactIds]
        );

        // Add new associations
        const insertValues = contactIds.map((contactId, index) => {
          const baseIndex = index * 3;
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`;
        }).join(', ');

        const insertParams = contactIds.flatMap(contactId => [
          contactId,
          segmentId,
          addedBy || null
        ]);

        const insertQuery = `
          INSERT INTO contact_segments (contact_id, segment_id, added_by)
          VALUES ${insertValues}
          ON CONFLICT (contact_id, segment_id) DO NOTHING
        `;

        await client.query(insertQuery, insertParams);

        // Update contact count
        await this.updateContactCount(segmentId);

        // Invalidate cache
        await redis.del(`${this.CONTACT_CACHE_PREFIX}${segmentId}`);

        logger.info('Contacts added to segment', {
          segmentId,
          contactCount: contactIds.length
        });
      } catch (error) {
        logger.error('Error adding contacts to segment:', { segmentId, contactIds, error });
        throw error;
      }
    });
  }

  async removeContactsFromSegment(segmentId: string, contactIds: string[]): Promise<void> {
    return database.transaction(async (client) => {
      try {
        const query = `
          DELETE FROM contact_segments
          WHERE segment_id = $1 AND contact_id = ANY($2)
        `;

        await client.query(query, [segmentId, contactIds]);

        // Update contact count
        await this.updateContactCount(segmentId);

        // Invalidate cache
        await redis.del(`${this.CONTACT_CACHE_PREFIX}${segmentId}`);

        logger.info('Contacts removed from segment', {
          segmentId,
          contactCount: contactIds.length
        });
      } catch (error) {
        logger.error('Error removing contacts from segment:', { segmentId, contactIds, error });
        throw error;
      }
    });
  }

  async updateContactCount(segmentId: string): Promise<number> {
    try {
      const segment = await this.findById(segmentId);
      if (!segment) {
        throw new NotFoundError('Segment');
      }

      let contactCount: number;

      if (segment.isAutoUpdating) {
        // Calculate based on conditions
        const contactIds = await this.calculateSegmentContacts(segment.conditions);
        contactCount = contactIds.length;

        // Update the contact_segments table
        await this.syncSegmentContacts(segmentId, contactIds);
      } else {
        // Count from contact_segments table
        const countQuery = `
          SELECT COUNT(*) FROM contact_segments WHERE segment_id = $1
        `;
        const result = await database.query<{ count: string }>(countQuery, [segmentId]);
        contactCount = parseInt(result.rows[0]!.count, 10);
      }

      // Update the segment's contact count
      const updateQuery = `
        UPDATE segments
        SET contact_count = $1, updated_at = NOW()
        WHERE id = $2
      `;

      await database.query(updateQuery, [contactCount, segmentId]);

      // Invalidate cache
      await redis.del(`${this.CACHE_PREFIX}${segmentId}`);
      await redis.del(`${this.CONTACT_CACHE_PREFIX}${segmentId}`);

      logger.info('Segment contact count updated', { segmentId, contactCount });
      return contactCount;
    } catch (error) {
      logger.error('Error updating segment contact count:', { segmentId, error });
      throw error;
    }
  }

  async updateAllAutoSegments(): Promise<void> {
    try {
      const query = `
        SELECT id FROM segments
        WHERE is_auto_updating = true AND is_active = true
      `;

      const result = await database.query<{ id: string }>(query);
      const segmentIds = result.rows.map(row => row.id);

      logger.info('Updating auto segments', { count: segmentIds.length });

      // Update segments in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < segmentIds.length; i += batchSize) {
        const batch = segmentIds.slice(i, i + batchSize);
        await Promise.all(batch.map(segmentId => this.updateContactCount(segmentId)));
      }

      logger.info('Auto segments update completed');
    } catch (error) {
      logger.error('Error updating auto segments:', error);
      throw error;
    }
  }

  private async calculateSegmentContacts(conditions: SegmentCondition[]): Promise<string[]> {
    try {
      if (conditions.length === 0) {
        return [];
      }

      // Build WHERE clause from conditions
      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      conditions.forEach((condition, index) => {
        const conditionClause = this.buildConditionClause(condition, paramIndex);
        whereConditions.push(conditionClause.clause);
        queryParams.push(...conditionClause.params);
        paramIndex += conditionClause.params.length;

        // Add logical operator for next condition
        if (index < conditions.length - 1) {
          const logicalOp = condition.logicalOperator || 'AND';
          whereConditions.push(logicalOp);
        }
      });

      const whereClause = whereConditions.join(' ');
      const query = `SELECT id FROM contacts WHERE ${whereClause}`;

      const result = await database.query<{ id: string }>(query, queryParams);
      return result.rows.map(row => row.id);
    } catch (error) {
      logger.error('Error calculating segment contacts:', { conditions, error });
      throw error;
    }
  }

  private buildConditionClause(condition: SegmentCondition, paramIndex: number): { clause: string; params: any[] } {
    const { field, operator, value } = condition;

    switch (operator) {
      case 'equals':
        return { clause: `${field} = $${paramIndex}`, params: [value] };
      case 'not_equals':
        return { clause: `${field} != $${paramIndex}`, params: [value] };
      case 'contains':
        return { clause: `${field} ILIKE $${paramIndex}`, params: [`%${value}%`] };
      case 'not_contains':
        return { clause: `${field} NOT ILIKE $${paramIndex}`, params: [`%${value}%`] };
      case 'starts_with':
        return { clause: `${field} ILIKE $${paramIndex}`, params: [`${value}%`] };
      case 'ends_with':
        return { clause: `${field} ILIKE $${paramIndex}`, params: [`%${value}`] };
      case 'greater_than':
        return { clause: `${field} > $${paramIndex}`, params: [value] };
      case 'less_than':
        return { clause: `${field} < $${paramIndex}`, params: [value] };
      case 'greater_than_or_equal':
        return { clause: `${field} >= $${paramIndex}`, params: [value] };
      case 'less_than_or_equal':
        return { clause: `${field} <= $${paramIndex}`, params: [value] };
      case 'in':
        return { clause: `${field} = ANY($${paramIndex})`, params: [Array.isArray(value) ? value : [value]] };
      case 'not_in':
        return { clause: `${field} != ALL($${paramIndex})`, params: [Array.isArray(value) ? value : [value]] };
      case 'is_empty':
        return { clause: `(${field} IS NULL OR ${field} = '')`, params: [] };
      case 'is_not_empty':
        return { clause: `(${field} IS NOT NULL AND ${field} != '')`, params: [] };
      case 'date_before':
        return { clause: `${field} < $${paramIndex}`, params: [value] };
      case 'date_after':
        return { clause: `${field} > $${paramIndex}`, params: [value] };
      case 'date_between':
        return {
          clause: `${field} BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
          params: Array.isArray(value) ? value : [value, value]
        };
      default:
        throw new Error(`Unsupported segment operator: ${operator}`);
    }
  }

  private async syncSegmentContacts(segmentId: string, contactIds: string[]): Promise<void> {
    return database.transaction(async (client) => {
      try {
        // Remove all existing associations
        await client.query(
          'DELETE FROM contact_segments WHERE segment_id = $1',
          [segmentId]
        );

        if (contactIds.length > 0) {
          // Add new associations
          const insertValues = contactIds.map((_, index) => {
            const baseIndex = index * 2;
            return `($${baseIndex + 1}, $${baseIndex + 2})`;
          }).join(', ');

          const insertParams = contactIds.flatMap(contactId => [contactId, segmentId]);

          const insertQuery = `
            INSERT INTO contact_segments (contact_id, segment_id)
            VALUES ${insertValues}
          `;

          await client.query(insertQuery, insertParams);
        }

        logger.info('Segment contacts synced', { segmentId, contactCount: contactIds.length });
      } catch (error) {
        logger.error('Error syncing segment contacts:', { segmentId, error });
        throw error;
      }
    });
  }

  private validateConditions(conditions: SegmentCondition[]): void {
    if (!Array.isArray(conditions) || conditions.length === 0) {
      throw new ValidationError('Segment must have at least one condition');
    }

    conditions.forEach((condition, index) => {
      if (!condition.field || !condition.operator || condition.value === undefined) {
        throw new ValidationError(`Invalid condition at index ${index}: field, operator, and value are required`);
      }

      // Validate operator
      const validOperators = [
        'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with',
        'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
        'in', 'not_in', 'is_empty', 'is_not_empty', 'date_before', 'date_after', 'date_between'
      ];

      if (!validOperators.includes(condition.operator)) {
        throw new ValidationError(`Invalid operator at index ${index}: ${condition.operator}`);
      }

      // Validate logical operator
      if (condition.logicalOperator && !['AND', 'OR'].includes(condition.logicalOperator)) {
        throw new ValidationError(`Invalid logical operator at index ${index}: ${condition.logicalOperator}`);
      }
    });
  }

  private async cacheSegment(segment: Segment): Promise<void> {
    try {
      await redis.cacheSet(`${this.CACHE_PREFIX}${segment.id}`, segment, this.CACHE_TTL);
    } catch (error) {
      logger.warn('Failed to cache segment:', { segmentId: segment.id, error });
    }
  }
}
