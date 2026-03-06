// @ts-nocheck
import {
  LeadScoreHistory,
  LeadScoringRule,
  NotFoundError,
  PaginatedResponse,
  PaginationOptions,
  ScoringTrigger,
} from '@/types';
import logger from '@/utils/logger';
import { Pool } from 'pg';

export interface CreateLeadScoringRuleRequest {
  name: string;
  description?: string;
  trigger: ScoringTrigger;
  points: number;
  decayRate?: number;
}

export interface UpdateLeadScoringRuleRequest {
  name?: string;
  description?: string;
  trigger?: ScoringTrigger;
  points?: number;
  decayRate?: number;
  isActive?: boolean;
}

export class LeadScoringRepository {
  constructor(private db: Pool) {}

  async create(
    data: CreateLeadScoringRuleRequest,
    createdBy?: string
  ): Promise<LeadScoringRule> {
    try {
      const result = await this.db.query(
        `INSERT INTO lead_scoring_rules (name, description, trigger, points, decay_rate, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
          data.name,
          data.description,
          JSON.stringify(data.trigger),
          data.points,
          data.decayRate || 0,
          true,
          createdBy,
        ]
      );

      logger.info('Lead scoring rule created', {
        ruleId: result.rows[0].id,
        name: data.name,
      });

      return this.mapDatabaseToRule(result.rows[0]);
    } catch (error) {
      logger.error('Error creating lead scoring rule:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<LeadScoringRule | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM lead_scoring_rules WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseToRule(result.rows[0]);
    } catch (error) {
      logger.error('Error finding lead scoring rule by ID:', { id, error });
      throw error;
    }
  }

  async findAll(
    options: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<PaginatedResponse<LeadScoringRule>> {
    try {
      const offset = (options.page - 1) * options.limit;
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder || 'desc';

      // Get total count
      const countResult = await this.db.query(
        'SELECT COUNT(*) FROM lead_scoring_rules WHERE is_active = true'
      );
      const total = parseInt(countResult.rows[0].count);

      // Get rules
      const result = await this.db.query(
        `SELECT * FROM lead_scoring_rules
         WHERE is_active = true
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $1 OFFSET $2`,
        [options.limit, offset]
      );

      const rules = result.rows.map(row => this.mapDatabaseToRule(row));

      return {
        data: rules,
        total,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(total / options.limit),
        hasNext: options.page < Math.ceil(total / options.limit),
        hasPrev: options.page > 1,
      };
    } catch (error) {
      logger.error('Error finding all lead scoring rules:', error);
      throw error;
    }
  }

  async findActive(): Promise<LeadScoringRule[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM lead_scoring_rules WHERE is_active = true ORDER BY points DESC'
      );

      return result.rows.map(row => this.mapDatabaseToRule(row));
    } catch (error) {
      logger.error('Error finding active lead scoring rules:', error);
      throw error;
    }
  }

  async update(
    id: string,
    updates: UpdateLeadScoringRuleRequest
  ): Promise<LeadScoringRule> {
    try {
      // Build update query dynamically
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        values.push(updates.description);
      }
      if (updates.trigger !== undefined) {
        updateFields.push(`trigger = $${paramCount++}`);
        values.push(JSON.stringify(updates.trigger));
      }
      if (updates.points !== undefined) {
        updateFields.push(`points = $${paramCount++}`);
        values.push(updates.points);
      }
      if (updates.decayRate !== undefined) {
        updateFields.push(`decay_rate = $${paramCount++}`);
        values.push(updates.decayRate);
      }
      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramCount++}`);
        values.push(updates.isActive);
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await this.db.query(
        `UPDATE lead_scoring_rules SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Lead Scoring Rule');
      }

      logger.info('Lead scoring rule updated', { ruleId: id });
      return this.mapDatabaseToRule(result.rows[0]);
    } catch (error) {
      logger.error('Error updating lead scoring rule:', { id, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Soft delete - just mark as inactive
      const result = await this.db.query(
        'UPDATE lead_scoring_rules SET is_active = false, updated_at = NOW() WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('Lead Scoring Rule');
      }

      logger.info('Lead scoring rule deleted', { ruleId: id });
    } catch (error) {
      logger.error('Error deleting lead scoring rule:', { id, error });
      throw error;
    }
  }

  async recordScoreChange(
    contactId: string,
    ruleId: string,
    pointsAwarded: number,
    previousScore: number,
    newScore: number,
    reason: string
  ): Promise<LeadScoreHistory> {
    try {
      const result = await this.db.query(
        `INSERT INTO lead_score_history (contact_id, rule_id, points_awarded, previous_score, new_score, reason, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [contactId, ruleId, pointsAwarded, previousScore, newScore, reason]
      );

      logger.info('Lead score change recorded', {
        contactId,
        ruleId,
        pointsAwarded,
        newScore,
      });

      return {
        id: result.rows[0].id,
        contactId: result.rows[0].contact_id,
        ruleId: result.rows[0].rule_id,
        pointsAwarded: result.rows[0].points_awarded,
        previousScore: result.rows[0].previous_score,
        newScore: result.rows[0].new_score,
        reason: result.rows[0].reason,
        timestamp: result.rows[0].timestamp,
      };
    } catch (error) {
      logger.error('Error recording score change:', {
        contactId,
        ruleId,
        error,
      });
      throw error;
    }
  }

  async getScoreHistory(
    contactId: string,
    options: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<PaginatedResponse<LeadScoreHistory>> {
    try {
      const offset = (options.page - 1) * options.limit;

      // Get total count
      const countResult = await this.db.query(
        'SELECT COUNT(*) FROM lead_score_history WHERE contact_id = $1',
        [contactId]
      );
      const total = parseInt(countResult.rows[0].count);

      // Get history
      const result = await this.db.query(
        `SELECT lsh.*, lsr.name as rule_name
         FROM lead_score_history lsh
         LEFT JOIN lead_scoring_rules lsr ON lsh.rule_id = lsr.id
         WHERE lsh.contact_id = $1
         ORDER BY lsh.timestamp DESC
         LIMIT $2 OFFSET $3`,
        [contactId, options.limit, offset]
      );

      const history = result.rows.map(row => ({
        id: row.id,
        contactId: row.contact_id,
        ruleId: row.rule_id,
        pointsAwarded: row.points_awarded,
        previousScore: row.previous_score,
        newScore: row.new_score,
        reason: row.reason,
        timestamp: row.timestamp,
        ruleName: row.rule_name,
      }));

      return {
        data: history,
        total,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(total / options.limit),
        hasNext: options.page < Math.ceil(total / options.limit),
        hasPrev: options.page > 1,
      };
    } catch (error) {
      logger.error('Error getting score history:', { contactId, error });
      throw error;
    }
  }

  async getScoreBreakdown(contactId: string): Promise<{
    totalScore: number;
    ruleBreakdown: Array<{
      ruleId: string;
      ruleName: string;
      points: number;
      lastAwarded: Date;
    }>;
  }> {
    try {
      const result = await this.db.query(
        `SELECT
           lsh.rule_id,
           lsr.name as rule_name,
           SUM(lsh.points_awarded) as total_points,
           MAX(lsh.timestamp) as last_awarded
         FROM lead_score_history lsh
         LEFT JOIN lead_scoring_rules lsr ON lsh.rule_id = lsr.id
         WHERE lsh.contact_id = $1
         GROUP BY lsh.rule_id, lsr.name
         ORDER BY total_points DESC`,
        [contactId]
      );

      const ruleBreakdown = result.rows.map(row => ({
        ruleId: row.rule_id,
        ruleName: row.rule_name,
        points: parseInt(row.total_points),
        lastAwarded: row.last_awarded,
      }));

      const totalScore = ruleBreakdown.reduce(
        (sum, rule) => sum + rule.points,
        0
      );

      return {
        totalScore,
        ruleBreakdown,
      };
    } catch (error) {
      logger.error('Error getting score breakdown:', { contactId, error });
      throw error;
    }
  }

  async applyScoreDecay(): Promise<void> {
    try {
      // Apply decay to all contacts based on rule decay rates
      // This would typically be run as a scheduled job
      const result = await this.db.query(`
        UPDATE contacts
        SET lead_score = GREATEST(0, lead_score * 0.95),
            updated_at = NOW()
        WHERE last_activity_at < NOW() - INTERVAL '30 days'
        AND lead_score > 0
      `);

      logger.info('Score decay applied', { affectedContacts: result.rowCount });
    } catch (error) {
      logger.error('Error applying score decay:', error);
      throw error;
    }
  }

  private mapDatabaseToRule(row: any): LeadScoringRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      trigger: JSON.parse(row.trigger),
      points: row.points,
      decayRate: row.decay_rate,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
