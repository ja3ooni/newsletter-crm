// @ts-nocheck
import {
  CreateOpportunityRequest,
  NotFoundError,
  Opportunity,
  OpportunitySearchRequest,
  OpportunitySearchResponse,
  PaginatedResponse,
  PaginationOptions,
  UpdateOpportunityRequest,
} from '@/types';
import logger from '@/utils/logger';
import { Pool } from 'pg';

export class OpportunityRepository {
  constructor(private db: Pool) {}

  async create(
    data: CreateOpportunityRequest,
    createdBy?: string
  ): Promise<Opportunity> {
    try {
      const result = await this.db.query(
        `INSERT INTO opportunities (
          name, contact_id, company_id, deal_id, value, currency, probability,
          stage, source, description, expected_close_date, owner_id,
          custom_fields, tags, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          data.name,
          data.contactId,
          data.companyId,
          data.dealId,
          data.value,
          data.currency || 'USD',
          data.probability || 0,
          data.stage || 'identified',
          data.source,
          data.description,
          data.expectedCloseDate,
          data.ownerId,
          JSON.stringify(data.customFields || {}),
          data.tags || [],
          createdBy,
        ]
      );

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error creating opportunity:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Opportunity | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM opportunities WHERE id = $1',
        [id]
      );

      return result.rows.length > 0 ? this.mapFromDb(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding opportunity by ID:', { id, error });
      throw error;
    }
  }

  async search(
    searchParams: OpportunitySearchRequest
  ): Promise<OpportunitySearchResponse> {
    try {
      const {
        query,
        stage,
        ownerId,
        contactId,
        companyId,
        dealId,
        valueMin,
        valueMax,
        probabilityMin,
        probabilityMax,
        tags,
        expectedCloseBefore,
        expectedCloseAfter,
        createdAfter,
        createdBefore,
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        limit = 50,
      } = searchParams;

      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (query) {
        conditions.push(
          `(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
        );
        values.push(`%${query}%`);
        paramIndex++;
      }

      if (stage && stage.length > 0) {
        conditions.push(`stage = ANY($${paramIndex++})`);
        values.push(stage);
      }

      if (ownerId && ownerId.length > 0) {
        conditions.push(`owner_id = ANY($${paramIndex++})`);
        values.push(ownerId);
      }

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

      if (valueMin !== undefined) {
        conditions.push(`value >= $${paramIndex++}`);
        values.push(valueMin);
      }

      if (valueMax !== undefined) {
        conditions.push(`value <= $${paramIndex++}`);
        values.push(valueMax);
      }

      if (probabilityMin !== undefined) {
        conditions.push(`probability >= $${paramIndex++}`);
        values.push(probabilityMin);
      }

      if (probabilityMax !== undefined) {
        conditions.push(`probability <= $${paramIndex++}`);
        values.push(probabilityMax);
      }

      if (tags && tags.length > 0) {
        conditions.push(`tags && $${paramIndex++}`);
        values.push(tags);
      }

      if (expectedCloseBefore) {
        conditions.push(`expected_close_date <= $${paramIndex++}`);
        values.push(expectedCloseBefore);
      }

      if (expectedCloseAfter) {
        conditions.push(`expected_close_date >= $${paramIndex++}`);
        values.push(expectedCloseAfter);
      }

      if (createdAfter) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(createdAfter);
      }

      if (createdBefore) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(createdBefore);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const offset = (page - 1) * limit;

      // Count total
      const countResult = await this.db.query(
        `SELECT COUNT(*) FROM opportunities ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get opportunities
      const opportunitiesResult = await this.db.query(
        `SELECT * FROM opportunities ${whereClause}
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset]
      );

      const opportunities = opportunitiesResult.rows.map(this.mapFromDb);

      return {
        opportunities,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error searching opportunities:', error);
      throw error;
    }
  }

  async update(
    id: string,
    updates: UpdateOpportunityRequest
  ): Promise<Opportunity> {
    try {
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      const updateableFields = [
        'name',
        'contact_id',
        'company_id',
        'deal_id',
        'value',
        'currency',
        'probability',
        'stage',
        'source',
        'description',
        'expected_close_date',
        'actual_close_date',
        'owner_id',
        'custom_fields',
        'tags',
      ];

      for (const [key, value] of Object.entries(updates)) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (updateableFields.includes(dbField)) {
          setParts.push(`${dbField} = $${paramIndex++}`);
          if (key === 'customFields') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
        }
      }

      if (setParts.length === 0) {
        const opportunity = await this.findById(id);
        if (!opportunity) throw new NotFoundError('Opportunity');
        return opportunity;
      }

      setParts.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      values.push(id);

      const result = await this.db.query(
        `UPDATE opportunities SET ${setParts.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Opportunity');
      }

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error updating opportunity:', { id, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.db.query(
        'DELETE FROM opportunities WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('Opportunity');
      }
    } catch (error) {
      logger.error('Error deleting opportunity:', { id, error });
      throw error;
    }
  }

  async findAll(
    options?: PaginationOptions
  ): Promise<PaginatedResponse<Opportunity>> {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = options || {};
      const offset = (page - 1) * limit;

      const countResult = await this.db.query(
        'SELECT COUNT(*) FROM opportunities'
      );
      const total = parseInt(countResult.rows[0].count);

      const opportunitiesResult = await this.db.query(
        `SELECT * FROM opportunities
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const opportunities = opportunitiesResult.rows.map(this.mapFromDb);

      return {
        data: opportunities,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error finding all opportunities:', error);
      throw error;
    }
  }

  async findByContact(contactId: string): Promise<Opportunity[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM opportunities WHERE contact_id = $1 ORDER BY created_at DESC',
        [contactId]
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding opportunities by contact:', {
        contactId,
        error,
      });
      throw error;
    }
  }

  async findByCompany(companyId: string): Promise<Opportunity[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM opportunities WHERE company_id = $1 ORDER BY created_at DESC',
        [companyId]
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding opportunities by company:', {
        companyId,
        error,
      });
      throw error;
    }
  }

  async findByDeal(dealId: string): Promise<Opportunity[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM opportunities WHERE deal_id = $1 ORDER BY created_at DESC',
        [dealId]
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding opportunities by deal:', { dealId, error });
      throw error;
    }
  }

  async getOpportunityStats(ownerId?: string): Promise<{
    total: number;
    byStage: Record<string, number>;
    totalValue: number;
    averageValue: number;
    winRate: number;
  }> {
    try {
      const whereClause = ownerId ? 'WHERE owner_id = $1' : '';
      const params = ownerId ? [ownerId] : [];

      const totalResult = await this.db.query(
        `SELECT COUNT(*) FROM opportunities ${whereClause}`,
        params
      );
      const total = parseInt(totalResult.rows[0].count);

      const stageResult = await this.db.query(
        `SELECT stage, COUNT(*) as count FROM opportunities ${whereClause} GROUP BY stage`,
        params
      );
      const byStage = stageResult.rows.reduce((acc, row) => {
        acc[row.stage] = parseInt(row.count);
        return acc;
      }, {});

      const valueResult = await this.db.query(
        `SELECT SUM(value) as total_value, AVG(value) as avg_value FROM opportunities ${whereClause}`,
        params
      );
      const totalValue = parseFloat(valueResult.rows[0].total_value) || 0;
      const averageValue = parseFloat(valueResult.rows[0].avg_value) || 0;

      const wonCount = byStage['closed_won'] || 0;
      const lostCount = byStage['closed_lost'] || 0;
      const closedTotal = wonCount + lostCount;
      const winRate = closedTotal > 0 ? (wonCount / closedTotal) * 100 : 0;

      return {
        total,
        byStage,
        totalValue,
        averageValue,
        winRate,
      };
    } catch (error) {
      logger.error('Error getting opportunity stats:', { ownerId, error });
      throw error;
    }
  }

  private mapFromDb(row: any): Opportunity {
    return {
      id: row.id,
      name: row.name,
      contactId: row.contact_id,
      companyId: row.company_id,
      dealId: row.deal_id,
      value: row.value,
      currency: row.currency,
      probability: row.probability,
      stage: row.stage,
      source: row.source,
      description: row.description,
      expectedCloseDate: row.expected_close_date,
      actualCloseDate: row.actual_close_date,
      ownerId: row.owner_id,
      customFields: row.custom_fields || {},
      tags: row.tags || [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
