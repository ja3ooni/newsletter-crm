import {
  CreateSalesPipelineRequest,
  Deal,
  DealSearchRequest,
  DealSearchResponse,
  NotFoundError,
  PaginatedResponse,
  PaginationOptions,
  SalesPipeline,
  UpdateSalesPipelineRequest,
} from '@/types';
import logger from '@/utils/logger';
import { Pool } from 'pg';

export class SalesPipelineRepository {
  constructor(private db: Pool) {}

  // ============================================================================
  // SALES PIPELINE METHODS
  // ============================================================================

  async createPipeline(
    data: CreateSalesPipelineRequest,
    createdBy?: string
  ): Promise<SalesPipeline> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Create pipeline
      const pipelineResult = await client.query(
        `INSERT INTO sales_pipelines (name, description, is_default, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.name, data.description, data.isDefault || false, createdBy]
      );

      const pipeline = pipelineResult.rows[0];

      // Create stages
      const stages = [];
      for (const stageData of data.stages) {
        const stageResult = await client.query(
          `INSERT INTO pipeline_stages (pipeline_id, name, stage_order, probability, is_closed_won, is_closed_lost, color, rotten_days)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            pipeline.id,
            stageData.name,
            stageData.order,
            stageData.probability,
            stageData.isClosedWon || false,
            stageData.isClosedLost || false,
            stageData.color,
            stageData.rottenDays,
          ]
        );
        stages.push(this.mapStageFromDb(stageResult.rows[0]));
      }

      await client.query('COMMIT');

      return this.mapPipelineFromDb(pipeline, stages);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating sales pipeline:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findPipelineById(id: string): Promise<SalesPipeline | null> {
    try {
      const pipelineResult = await this.db.query(
        'SELECT * FROM sales_pipelines WHERE id = $1 AND is_active = true',
        [id]
      );

      if (pipelineResult.rows.length === 0) {
        return null;
      }

      const stagesResult = await this.db.query(
        'SELECT * FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY stage_order',
        [id]
      );

      const stages = stagesResult.rows.map(this.mapStageFromDb);
      return this.mapPipelineFromDb(pipelineResult.rows[0], stages);
    } catch (error) {
      logger.error('Error finding pipeline by ID:', { id, error });
      throw error;
    }
  }

  async findAllPipelines(
    options?: PaginationOptions
  ): Promise<PaginatedResponse<SalesPipeline>> {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = options || {};
      const offset = (page - 1) * limit;

      const countResult = await this.db.query(
        'SELECT COUNT(*) FROM sales_pipelines WHERE is_active = true'
      );
      const total = parseInt(countResult.rows[0].count);

      const pipelinesResult = await this.db.query(
        `SELECT * FROM sales_pipelines
         WHERE is_active = true
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const pipelines = [];
      for (const pipelineRow of pipelinesResult.rows) {
        const stagesResult = await this.db.query(
          'SELECT * FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY stage_order',
          [pipelineRow.id]
        );
        const stages = stagesResult.rows.map(this.mapStageFromDb);
        pipelines.push(this.mapPipelineFromDb(pipelineRow, stages));
      }

      return {
        data: pipelines,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error finding all pipelines:', error);
      throw error;
    }
  }

  async updatePipeline(
    id: string,
    updates: UpdateSalesPipelineRequest
  ): Promise<SalesPipeline> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Update pipeline
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setParts.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setParts.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.isDefault !== undefined) {
        setParts.push(`is_default = $${paramIndex++}`);
        values.push(updates.isDefault);
      }
      if (updates.isActive !== undefined) {
        setParts.push(`is_active = $${paramIndex++}`);
        values.push(updates.isActive);
      }

      setParts.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      values.push(id);

      const pipelineResult = await client.query(
        `UPDATE sales_pipelines SET ${setParts.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (pipelineResult.rows.length === 0) {
        throw new NotFoundError('Sales Pipeline');
      }

      // Update stages if provided
      if (updates.stages) {
        // Delete existing stages
        await client.query(
          'DELETE FROM pipeline_stages WHERE pipeline_id = $1',
          [id]
        );

        // Create new stages
        for (const stageData of updates.stages) {
          await client.query(
            `INSERT INTO pipeline_stages (pipeline_id, name, stage_order, probability, is_closed_won, is_closed_lost, color, rotten_days)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              id,
              stageData.name,
              stageData.order,
              stageData.probability,
              stageData.isClosedWon || false,
              stageData.isClosedLost || false,
              stageData.color,
              stageData.rottenDays,
            ]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch updated pipeline with stages
      const updatedPipeline = await this.findPipelineById(id);
      if (!updatedPipeline) {
        throw new NotFoundError('Sales Pipeline');
      }

      return updatedPipeline;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating sales pipeline:', { id, error });
      throw error;
    } finally {
      client.release();
    }
  }

  async deletePipeline(id: string): Promise<void> {
    try {
      const result = await this.db.query(
        'UPDATE sales_pipelines SET is_active = false, updated_at = NOW() WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('Sales Pipeline');
      }
    } catch (error) {
      logger.error('Error deleting sales pipeline:', { id, error });
      throw error;
    }
  }

  // ============================================================================
  // DEAL METHODS
  // ============================================================================

  async createDeal(data: any, createdBy?: string): Promise<Deal> {
    try {
      const result = await this.db.query(
        `INSERT INTO deals (
          name, contact_id, company_id, pipeline_id, stage_id, value, currency,
          probability, expected_close_date, owner_id, custom_fields, tags,
          source, priority, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          data.name,
          data.contactId,
          data.companyId,
          data.pipelineId,
          data.stageId,
          data.value,
          data.currency || 'USD',
          data.probability || 0,
          data.expectedCloseDate,
          data.ownerId,
          JSON.stringify(data.customFields || {}),
          data.tags || [],
          data.source,
          data.priority || 'medium',
          createdBy,
        ]
      );

      return this.mapDealFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error creating deal:', error);
      throw error;
    }
  }

  async findDealById(id: string): Promise<Deal | null> {
    try {
      const result = await this.db.query('SELECT * FROM deals WHERE id = $1', [
        id,
      ]);

      return result.rows.length > 0 ? this.mapDealFromDb(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding deal by ID:', { id, error });
      throw error;
    }
  }

  async searchDeals(
    searchParams: DealSearchRequest
  ): Promise<DealSearchResponse> {
    try {
      const {
        query,
        pipelineId,
        stageId,
        status,
        ownerId,
        contactId,
        companyId,
        valueMin,
        valueMax,
        priority,
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
          `(name ILIKE $${paramIndex} OR CAST(custom_fields AS TEXT) ILIKE $${paramIndex})`
        );
        values.push(`%${query}%`);
        paramIndex++;
      }

      if (pipelineId) {
        conditions.push(`pipeline_id = $${paramIndex++}`);
        values.push(pipelineId);
      }

      if (stageId) {
        conditions.push(`stage_id = $${paramIndex++}`);
        values.push(stageId);
      }

      if (status && status.length > 0) {
        conditions.push(`status = ANY($${paramIndex++})`);
        values.push(status);
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

      if (valueMin !== undefined) {
        conditions.push(`value >= $${paramIndex++}`);
        values.push(valueMin);
      }

      if (valueMax !== undefined) {
        conditions.push(`value <= $${paramIndex++}`);
        values.push(valueMax);
      }

      if (priority && priority.length > 0) {
        conditions.push(`priority = ANY($${paramIndex++})`);
        values.push(priority);
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
        `SELECT COUNT(*) FROM deals ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get deals
      const dealsResult = await this.db.query(
        `SELECT * FROM deals ${whereClause}
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset]
      );

      const deals = dealsResult.rows.map(this.mapDealFromDb);

      return {
        deals,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error searching deals:', error);
      throw error;
    }
  }

  async updateDeal(id: string, updates: any): Promise<Deal> {
    try {
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      const updateableFields = [
        'name',
        'contact_id',
        'company_id',
        'stage_id',
        'value',
        'currency',
        'probability',
        'expected_close_date',
        'actual_close_date',
        'status',
        'lost_reason',
        'won_reason',
        'owner_id',
        'custom_fields',
        'tags',
        'priority',
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
        const deal = await this.findDealById(id);
        if (!deal) throw new NotFoundError('Deal');
        return deal;
      }

      setParts.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      values.push(id);

      const result = await this.db.query(
        `UPDATE deals SET ${setParts.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Deal');
      }

      return this.mapDealFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error updating deal:', { id, error });
      throw error;
    }
  }

  async deleteDeal(id: string): Promise<void> {
    try {
      const result = await this.db.query('DELETE FROM deals WHERE id = $1', [
        id,
      ]);

      if (result.rowCount === 0) {
        throw new NotFoundError('Deal');
      }
    } catch (error) {
      logger.error('Error deleting deal:', { id, error });
      throw error;
    }
  }

  async getDealsByPipeline(pipelineId: string): Promise<Deal[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM deals WHERE pipeline_id = $1 ORDER BY created_at DESC',
        [pipelineId]
      );

      return result.rows.map(this.mapDealFromDb);
    } catch (error) {
      logger.error('Error getting deals by pipeline:', { pipelineId, error });
      throw error;
    }
  }

  async getDealsByStage(stageId: string): Promise<Deal[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM deals WHERE stage_id = $1 ORDER BY created_at DESC',
        [stageId]
      );

      return result.rows.map(this.mapDealFromDb);
    } catch (error) {
      logger.error('Error getting deals by stage:', { stageId, error });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private mapPipelineFromDb(row: any, stages: any[]): SalesPipeline {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      stages,
      isDefault: row.is_default,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapStageFromDb(row: any): any {
    return {
      id: row.id,
      name: row.name,
      order: row.stage_order,
      probability: row.probability,
      isClosedWon: row.is_closed_won,
      isClosedLost: row.is_closed_lost,
      color: row.color,
      rottenDays: row.rotten_days,
    };
  }

  private mapDealFromDb(row: any): Deal {
    return {
      id: row.id,
      name: row.name,
      contactId: row.contact_id,
      companyId: row.company_id,
      pipelineId: row.pipeline_id,
      stageId: row.stage_id,
      value: row.value,
      currency: row.currency,
      probability: row.probability,
      expectedCloseDate: row.expected_close_date,
      actualCloseDate: row.actual_close_date,
      status: row.status,
      lostReason: row.lost_reason,
      wonReason: row.won_reason,
      ownerId: row.owner_id,
      customFields: row.custom_fields || {},
      tags: row.tags || [],
      source: row.source,
      priority: row.priority,
      lastActivityAt: row.last_activity_at,
      rottenDate: row.rotten_date,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
