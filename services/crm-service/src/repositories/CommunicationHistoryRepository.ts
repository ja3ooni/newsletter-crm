// @ts-nocheck
import { PaginatedResponse, PaginationOptions } from '@/types';
import logger from '@/utils/logger';
import { Pool } from 'pg';

export interface CommunicationRecord {
  id: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  opportunityId?: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'sms' | 'social';
  direction?: 'inbound' | 'outbound';
  subject?: string;
  content?: string;
  metadata: Record<string, any>;
  timestamp: Date;
  durationMinutes?: number;
  outcome?: string;
  createdBy?: string;
  createdAt: Date;
}

export interface CreateCommunicationRecordRequest {
  contactId?: string;
  companyId?: string;
  dealId?: string;
  opportunityId?: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'sms' | 'social';
  direction?: 'inbound' | 'outbound';
  subject?: string;
  content?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  durationMinutes?: number;
  outcome?: string;
}

export interface CommunicationSearchRequest {
  contactId?: string;
  companyId?: string;
  dealId?: string;
  opportunityId?: string;
  type?: string[];
  direction?: 'inbound' | 'outbound';
  startDate?: Date;
  endDate?: Date;
  query?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export class CommunicationHistoryRepository {
  constructor(private db: Pool) {}

  async create(
    data: CreateCommunicationRecordRequest,
    createdBy?: string
  ): Promise<CommunicationRecord> {
    try {
      const result = await this.db.query(
        `INSERT INTO communication_history (
          contact_id, company_id, deal_id, opportunity_id, type, direction,
          subject, content, metadata, timestamp, duration_minutes, outcome, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          data.contactId,
          data.companyId,
          data.dealId,
          data.opportunityId,
          data.type,
          data.direction,
          data.subject,
          data.content,
          JSON.stringify(data.metadata || {}),
          data.timestamp || new Date(),
          data.durationMinutes,
          data.outcome,
          createdBy,
        ]
      );

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error creating communication record:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<CommunicationRecord | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM communication_history WHERE id = $1',
        [id]
      );

      return result.rows.length > 0 ? this.mapFromDb(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding communication record by ID:', { id, error });
      throw error;
    }
  }

  async search(
    searchParams: CommunicationSearchRequest
  ): Promise<PaginatedResponse<CommunicationRecord>> {
    try {
      const {
        contactId,
        companyId,
        dealId,
        opportunityId,
        type,
        direction,
        startDate,
        endDate,
        query,
        sortBy = 'timestamp',
        sortOrder = 'desc',
        page = 1,
        limit = 50,
      } = searchParams;

      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (contactId) {
        conditions.push(`contact_id = $${paramIndex++}`);
        values.push(contactId);
      }

      if (companyId) {
        conditions.push(`company_id = $${paramIndex++}`);
        values.push(companyId);
      }

      if (dealId) {
        conditions.push(`deal_id = $${paramIndex++}`);
        values.push(dealId);
      }

      if (opportunityId) {
        conditions.push(`opportunity_id = $${paramIndex++}`);
        values.push(opportunityId);
      }

      if (type && type.length > 0) {
        conditions.push(`type = ANY($${paramIndex++})`);
        values.push(type);
      }

      if (direction) {
        conditions.push(`direction = $${paramIndex++}`);
        values.push(direction);
      }

      if (startDate) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        values.push(startDate);
      }

      if (endDate) {
        conditions.push(`timestamp <= $${paramIndex++}`);
        values.push(endDate);
      }

      if (query) {
        conditions.push(
          `(subject ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`
        );
        values.push(`%${query}%`);
        paramIndex++;
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const offset = (page - 1) * limit;

      // Count total
      const countResult = await this.db.query(
        `SELECT COUNT(*) FROM communication_history ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get records
      const recordsResult = await this.db.query(
        `SELECT * FROM communication_history ${whereClause}
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset]
      );

      const records = recordsResult.rows.map(this.mapFromDb);

      return {
        data: records,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error searching communication history:', error);
      throw error;
    }
  }

  async findByContact(
    contactId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<CommunicationRecord>> {
    return this.search({
      contactId,
      ...options,
    });
  }

  async findByCompany(
    companyId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<CommunicationRecord>> {
    return this.search({
      companyId,
      ...options,
    });
  }

  async findByDeal(
    dealId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<CommunicationRecord>> {
    return this.search({
      dealId,
      ...options,
    });
  }

  async findByOpportunity(
    opportunityId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<CommunicationRecord>> {
    return this.search({
      opportunityId,
      ...options,
    });
  }

  async getRecentActivity(
    entityType: 'contact' | 'company' | 'deal' | 'opportunity',
    entityId: string,
    limit: number = 10
  ): Promise<CommunicationRecord[]> {
    try {
      const fieldMap = {
        contact: 'contact_id',
        company: 'company_id',
        deal: 'deal_id',
        opportunity: 'opportunity_id',
      };

      const field = fieldMap[entityType];
      const result = await this.db.query(
        `SELECT * FROM communication_history
         WHERE ${field} = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [entityId, limit]
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error getting recent activity:', {
        entityType,
        entityId,
        error,
      });
      throw error;
    }
  }

  async getCommunicationStats(
    entityType: 'contact' | 'company' | 'deal' | 'opportunity',
    entityId: string
  ): Promise<{
    total: number;
    byType: Record<string, number>;
    byDirection: Record<string, number>;
    lastCommunication?: Date;
  }> {
    try {
      const fieldMap = {
        contact: 'contact_id',
        company: 'company_id',
        deal: 'deal_id',
        opportunity: 'opportunity_id',
      };

      const field = fieldMap[entityType];

      const totalResult = await this.db.query(
        `SELECT COUNT(*) FROM communication_history WHERE ${field} = $1`,
        [entityId]
      );
      const total = parseInt(totalResult.rows[0].count);

      const typeResult = await this.db.query(
        `SELECT type, COUNT(*) as count FROM communication_history WHERE ${field} = $1 GROUP BY type`,
        [entityId]
      );
      const byType = typeResult.rows.reduce((acc, row) => {
        acc[row.type] = parseInt(row.count);
        return acc;
      }, {});

      const directionResult = await this.db.query(
        `SELECT direction, COUNT(*) as count FROM communication_history WHERE ${field} = $1 AND direction IS NOT NULL GROUP BY direction`,
        [entityId]
      );
      const byDirection = directionResult.rows.reduce((acc, row) => {
        acc[row.direction] = parseInt(row.count);
        return acc;
      }, {});

      const lastResult = await this.db.query(
        `SELECT MAX(timestamp) as last_communication FROM communication_history WHERE ${field} = $1`,
        [entityId]
      );
      const lastCommunication = lastResult.rows[0].last_communication;

      return {
        total,
        byType,
        byDirection,
        lastCommunication,
      };
    } catch (error) {
      logger.error('Error getting communication stats:', {
        entityType,
        entityId,
        error,
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.db.query(
        'DELETE FROM communication_history WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Communication record not found');
      }
    } catch (error) {
      logger.error('Error deleting communication record:', { id, error });
      throw error;
    }
  }

  private mapFromDb(row: any): CommunicationRecord {
    return {
      id: row.id,
      contactId: row.contact_id,
      companyId: row.company_id,
      dealId: row.deal_id,
      opportunityId: row.opportunity_id,
      type: row.type,
      direction: row.direction,
      subject: row.subject,
      content: row.content,
      metadata: row.metadata || {},
      timestamp: row.timestamp,
      durationMinutes: row.duration_minutes,
      outcome: row.outcome,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}
