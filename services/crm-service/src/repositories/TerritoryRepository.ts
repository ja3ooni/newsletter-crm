import {
  NotFoundError,
  PaginatedResponse,
  PaginationOptions,
  Territory,
  TerritoryAssignment,
  TerritoryRole,
  TerritoryRule,
  TerritoryType,
  ValidationError,
} from '@/types';
import logger from '@/utils/logger';
import { Pool } from 'pg';

export interface CreateTerritoryRequest {
  name: string;
  description?: string;
  type: TerritoryType;
  rules: TerritoryRule[];
  assignedUsers?: string[];
  priority?: number;
}

export interface UpdateTerritoryRequest {
  name?: string;
  description?: string;
  type?: TerritoryType;
  rules?: TerritoryRule[];
  assignedUsers?: string[];
  priority?: number;
  isActive?: boolean;
}

export class TerritoryRepository {
  constructor(private db: Pool) {}

  async create(
    data: CreateTerritoryRequest,
    createdBy?: string
  ): Promise<Territory> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Insert territory
      const territoryResult = await client.query(
        `INSERT INTO territories (name, description, type, rules, priority, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
          data.name,
          data.description,
          data.type,
          JSON.stringify(data.rules),
          data.priority || 1,
          true,
          createdBy,
        ]
      );

      const territory = this.mapDatabaseToTerritory(territoryResult.rows[0]);

      // Assign users if provided
      if (data.assignedUsers && data.assignedUsers.length > 0) {
        for (const userId of data.assignedUsers) {
          await client.query(
            `INSERT INTO territory_assignments (territory_id, user_id, role, assigned_at, assigned_by)
             VALUES ($1, $2, $3, NOW(), $4)`,
            [territory.id, userId, 'member', createdBy]
          );
        }
        territory.assignedUsers = data.assignedUsers;
      }

      await client.query('COMMIT');
      logger.info('Territory created', {
        territoryId: territory.id,
        name: data.name,
      });
      return territory;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating territory:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<Territory | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM territories WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const territory = this.mapDatabaseToTerritory(result.rows[0]);

      // Get assigned users
      const assignmentsResult = await this.db.query(
        'SELECT user_id FROM territory_assignments WHERE territory_id = $1',
        [id]
      );
      territory.assignedUsers = assignmentsResult.rows.map(row => row.user_id);

      return territory;
    } catch (error) {
      logger.error('Error finding territory by ID:', { id, error });
      throw error;
    }
  }

  async findAll(
    options: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<PaginatedResponse<Territory>> {
    try {
      const offset = (options.page - 1) * options.limit;
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder || 'desc';

      // Get total count
      const countResult = await this.db.query(
        'SELECT COUNT(*) FROM territories WHERE is_active = true'
      );
      const total = parseInt(countResult.rows[0].count);

      // Get territories
      const result = await this.db.query(
        `SELECT * FROM territories
         WHERE is_active = true
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $1 OFFSET $2`,
        [options.limit, offset]
      );

      const territories = await Promise.all(
        result.rows.map(async row => {
          const territory = this.mapDatabaseToTerritory(row);

          // Get assigned users for each territory
          const assignmentsResult = await this.db.query(
            'SELECT user_id FROM territory_assignments WHERE territory_id = $1',
            [territory.id]
          );
          territory.assignedUsers = assignmentsResult.rows.map(r => r.user_id);

          return territory;
        })
      );

      return {
        data: territories,
        total,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(total / options.limit),
        hasNext: options.page < Math.ceil(total / options.limit),
        hasPrev: options.page > 1,
      };
    } catch (error) {
      logger.error('Error finding all territories:', error);
      throw error;
    }
  }

  async update(
    id: string,
    updates: UpdateTerritoryRequest
  ): Promise<Territory> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

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
      if (updates.type !== undefined) {
        updateFields.push(`type = $${paramCount++}`);
        values.push(updates.type);
      }
      if (updates.rules !== undefined) {
        updateFields.push(`rules = $${paramCount++}`);
        values.push(JSON.stringify(updates.rules));
      }
      if (updates.priority !== undefined) {
        updateFields.push(`priority = $${paramCount++}`);
        values.push(updates.priority);
      }
      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramCount++}`);
        values.push(updates.isActive);
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await client.query(
        `UPDATE territories SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Territory');
      }

      const territory = this.mapDatabaseToTerritory(result.rows[0]);

      // Update assigned users if provided
      if (updates.assignedUsers !== undefined) {
        // Remove existing assignments
        await client.query(
          'DELETE FROM territory_assignments WHERE territory_id = $1',
          [id]
        );

        // Add new assignments
        for (const userId of updates.assignedUsers) {
          await client.query(
            `INSERT INTO territory_assignments (territory_id, user_id, role, assigned_at)
             VALUES ($1, $2, $3, NOW())`,
            [id, userId, 'member']
          );
        }
        territory.assignedUsers = updates.assignedUsers;
      } else {
        // Get current assigned users
        const assignmentsResult = await client.query(
          'SELECT user_id FROM territory_assignments WHERE territory_id = $1',
          [id]
        );
        territory.assignedUsers = assignmentsResult.rows.map(
          row => row.user_id
        );
      }

      await client.query('COMMIT');
      logger.info('Territory updated', { territoryId: id });
      return territory;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating territory:', { id, error });
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Check if territory has active assignments
      const assignmentsResult = await client.query(
        'SELECT COUNT(*) FROM territory_assignments WHERE territory_id = $1',
        [id]
      );

      if (parseInt(assignmentsResult.rows[0].count) > 0) {
        // Soft delete - just mark as inactive
        await client.query(
          'UPDATE territories SET is_active = false, updated_at = NOW() WHERE id = $1',
          [id]
        );
      } else {
        // Hard delete if no assignments
        await client.query('DELETE FROM territories WHERE id = $1', [id]);
      }

      await client.query('COMMIT');
      logger.info('Territory deleted', { territoryId: id });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting territory:', { id, error });
      throw error;
    } finally {
      client.release();
    }
  }

  async getAssignments(territoryId: string): Promise<TerritoryAssignment[]> {
    try {
      const result = await this.db.query(
        `SELECT ta.*, u.email, u.first_name, u.last_name
         FROM territory_assignments ta
         LEFT JOIN users u ON ta.user_id = u.id
         WHERE ta.territory_id = $1
         ORDER BY ta.assigned_at DESC`,
        [territoryId]
      );

      return result.rows.map(row => ({
        id: row.id,
        territoryId: row.territory_id,
        userId: row.user_id,
        role: row.role as TerritoryRole,
        assignedAt: row.assigned_at,
        assignedBy: row.assigned_by,
        userDetails: {
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
        },
      }));
    } catch (error) {
      logger.error('Error getting territory assignments:', {
        territoryId,
        error,
      });
      throw error;
    }
  }

  async assignUser(
    territoryId: string,
    userId: string,
    role: TerritoryRole = 'member',
    assignedBy?: string
  ): Promise<TerritoryAssignment> {
    try {
      // Check if assignment already exists
      const existingResult = await this.db.query(
        'SELECT * FROM territory_assignments WHERE territory_id = $1 AND user_id = $2',
        [territoryId, userId]
      );

      if (existingResult.rows.length > 0) {
        throw new ValidationError('User is already assigned to this territory');
      }

      const result = await this.db.query(
        `INSERT INTO territory_assignments (territory_id, user_id, role, assigned_at, assigned_by)
         VALUES ($1, $2, $3, NOW(), $4)
         RETURNING *`,
        [territoryId, userId, role, assignedBy]
      );

      logger.info('User assigned to territory', { territoryId, userId, role });
      return {
        id: result.rows[0].id,
        territoryId: result.rows[0].territory_id,
        userId: result.rows[0].user_id,
        role: result.rows[0].role as TerritoryRole,
        assignedAt: result.rows[0].assigned_at,
        assignedBy: result.rows[0].assigned_by,
      };
    } catch (error) {
      logger.error('Error assigning user to territory:', {
        territoryId,
        userId,
        error,
      });
      throw error;
    }
  }

  async unassignUser(territoryId: string, userId: string): Promise<void> {
    try {
      const result = await this.db.query(
        'DELETE FROM territory_assignments WHERE territory_id = $1 AND user_id = $2',
        [territoryId, userId]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('Territory assignment');
      }

      logger.info('User unassigned from territory', { territoryId, userId });
    } catch (error) {
      logger.error('Error unassigning user from territory:', {
        territoryId,
        userId,
        error,
      });
      throw error;
    }
  }

  async findByUser(userId: string): Promise<Territory[]> {
    try {
      const result = await this.db.query(
        `SELECT t.* FROM territories t
         INNER JOIN territory_assignments ta ON t.id = ta.territory_id
         WHERE ta.user_id = $1 AND t.is_active = true
         ORDER BY t.priority ASC, t.name ASC`,
        [userId]
      );

      return result.rows.map(row => this.mapDatabaseToTerritory(row));
    } catch (error) {
      logger.error('Error finding territories by user:', { userId, error });
      throw error;
    }
  }

  async findByType(type: TerritoryType): Promise<Territory[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM territories WHERE type = $1 AND is_active = true ORDER BY priority ASC',
        [type]
      );

      return result.rows.map(row => this.mapDatabaseToTerritory(row));
    } catch (error) {
      logger.error('Error finding territories by type:', { type, error });
      throw error;
    }
  }

  async getTerritoryCoverage(): Promise<
    {
      territoryId: string;
      name: string;
      contactCount: number;
      assignedUsers: number;
    }[]
  > {
    try {
      const result = await this.db.query(`
        SELECT
          t.id as territory_id,
          t.name,
          COUNT(DISTINCT c.id) as contact_count,
          COUNT(DISTINCT ta.user_id) as assigned_users
        FROM territories t
        LEFT JOIN territory_assignments ta ON t.id = ta.territory_id
        LEFT JOIN contacts c ON c.owner_id = ta.user_id
        WHERE t.is_active = true
        GROUP BY t.id, t.name
        ORDER BY contact_count DESC
      `);

      return result.rows.map(row => ({
        territoryId: row.territory_id,
        name: row.name,
        contactCount: parseInt(row.contact_count),
        assignedUsers: parseInt(row.assigned_users),
      }));
    } catch (error) {
      logger.error('Error getting territory coverage:', error);
      throw error;
    }
  }

  private mapDatabaseToTerritory(row: any): Territory {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type as TerritoryType,
      rules: JSON.parse(row.rules || '[]') as TerritoryRule[],
      assignedUsers: [], // Will be populated separately
      isActive: row.is_active,
      priority: row.priority,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
