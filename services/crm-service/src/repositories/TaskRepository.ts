// @ts-nocheck
import {
  CreateTaskRequest,
  NotFoundError,
  PaginatedResponse,
  PaginationOptions,
  Task,
  TaskSearchRequest,
  TaskSearchResponse,
  UpdateTaskRequest,
} from '@/types';
import logger from '@/utils/logger';
import { Pool } from 'pg';

export class TaskRepository {
  constructor(private db: Pool) {}

  async create(data: CreateTaskRequest, createdBy?: string): Promise<Task> {
    try {
      const result = await this.db.query(
        `INSERT INTO tasks (
          title, description, type, priority, due_date, assigned_to, contact_id,
          company_id, deal_id, opportunity_id, reminder_at, is_recurring,
          recurring_pattern, custom_fields, tags, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          data.title,
          data.description,
          data.type,
          data.priority || 'medium',
          data.dueDate,
          data.assignedTo,
          data.contactId,
          data.companyId,
          data.dealId,
          data.opportunityId,
          data.reminderAt,
          data.isRecurring || false,
          JSON.stringify(data.recurringPattern || null),
          JSON.stringify(data.customFields || {}),
          data.tags || [],
          createdBy,
        ]
      );

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error creating task:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Task | null> {
    try {
      const result = await this.db.query('SELECT * FROM tasks WHERE id = $1', [
        id,
      ]);

      return result.rows.length > 0 ? this.mapFromDb(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding task by ID:', { id, error });
      throw error;
    }
  }

  async search(searchParams: TaskSearchRequest): Promise<TaskSearchResponse> {
    try {
      const {
        query,
        type,
        status,
        priority,
        assignedTo,
        contactId,
        companyId,
        dealId,
        opportunityId,
        dueBefore,
        dueAfter,
        tags,
        isOverdue,
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
          `(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
        );
        values.push(`%${query}%`);
        paramIndex++;
      }

      if (type && type.length > 0) {
        conditions.push(`type = ANY($${paramIndex++})`);
        values.push(type);
      }

      if (status && status.length > 0) {
        conditions.push(`status = ANY($${paramIndex++})`);
        values.push(status);
      }

      if (priority && priority.length > 0) {
        conditions.push(`priority = ANY($${paramIndex++})`);
        values.push(priority);
      }

      if (assignedTo && assignedTo.length > 0) {
        conditions.push(`assigned_to = ANY($${paramIndex++})`);
        values.push(assignedTo);
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

      if (opportunityId) {
        conditions.push(`opportunity_id = $${paramIndex++}`);
        values.push(opportunityId);
      }

      if (dueBefore) {
        conditions.push(`due_date <= $${paramIndex++}`);
        values.push(dueBefore);
      }

      if (dueAfter) {
        conditions.push(`due_date >= $${paramIndex++}`);
        values.push(dueAfter);
      }

      if (tags && tags.length > 0) {
        conditions.push(`tags && $${paramIndex++}`);
        values.push(tags);
      }

      if (isOverdue) {
        conditions.push(
          `due_date < NOW() AND status NOT IN ('completed', 'cancelled')`
        );
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
        `SELECT COUNT(*) FROM tasks ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get tasks
      const tasksResult = await this.db.query(
        `SELECT * FROM tasks ${whereClause}
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset]
      );

      const tasks = tasksResult.rows.map(this.mapFromDb);

      return {
        tasks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error searching tasks:', error);
      throw error;
    }
  }

  async update(id: string, updates: UpdateTaskRequest): Promise<Task> {
    try {
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      const updateableFields = [
        'title',
        'description',
        'type',
        'priority',
        'status',
        'due_date',
        'completed_at',
        'assigned_to',
        'contact_id',
        'company_id',
        'deal_id',
        'opportunity_id',
        'reminder_at',
        'is_recurring',
        'recurring_pattern',
        'custom_fields',
        'tags',
      ];

      for (const [key, value] of Object.entries(updates)) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (updateableFields.includes(dbField)) {
          setParts.push(`${dbField} = $${paramIndex++}`);
          if (key === 'recurringPattern' || key === 'customFields') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
        }
      }

      if (setParts.length === 0) {
        const task = await this.findById(id);
        if (!task) throw new NotFoundError('Task');
        return task;
      }

      setParts.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      values.push(id);

      const result = await this.db.query(
        `UPDATE tasks SET ${setParts.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Task');
      }

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error updating task:', { id, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.db.query('DELETE FROM tasks WHERE id = $1', [
        id,
      ]);

      if (result.rowCount === 0) {
        throw new NotFoundError('Task');
      }
    } catch (error) {
      logger.error('Error deleting task:', { id, error });
      throw error;
    }
  }

  async findAll(options?: PaginationOptions): Promise<PaginatedResponse<Task>> {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = options || {};
      const offset = (page - 1) * limit;

      const countResult = await this.db.query('SELECT COUNT(*) FROM tasks');
      const total = parseInt(countResult.rows[0].count);

      const tasksResult = await this.db.query(
        `SELECT * FROM tasks
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const tasks = tasksResult.rows.map(this.mapFromDb);

      return {
        data: tasks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error finding all tasks:', error);
      throw error;
    }
  }

  async findByAssignee(
    assigneeId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<Task>> {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'due_date',
        sortOrder = 'asc',
      } = options || {};
      const offset = (page - 1) * limit;

      const countResult = await this.db.query(
        'SELECT COUNT(*) FROM tasks WHERE assigned_to = $1',
        [assigneeId]
      );
      const total = parseInt(countResult.rows[0].count);

      const tasksResult = await this.db.query(
        `SELECT * FROM tasks WHERE assigned_to = $1
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $2 OFFSET $3`,
        [assigneeId, limit, offset]
      );

      const tasks = tasksResult.rows.map(this.mapFromDb);

      return {
        data: tasks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error finding tasks by assignee:', { assigneeId, error });
      throw error;
    }
  }

  async findOverdueTasks(): Promise<Task[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM tasks
         WHERE due_date < NOW()
         AND status NOT IN ('completed', 'cancelled')
         ORDER BY due_date ASC`
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding overdue tasks:', error);
      throw error;
    }
  }

  async findTasksDueToday(): Promise<Task[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM tasks
         WHERE DATE(due_date) = CURRENT_DATE
         AND status NOT IN ('completed', 'cancelled')
         ORDER BY due_date ASC`
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding tasks due today:', error);
      throw error;
    }
  }

  async findTasksWithReminders(): Promise<Task[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM tasks
         WHERE reminder_at <= NOW()
         AND status NOT IN ('completed', 'cancelled')
         ORDER BY reminder_at ASC`
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding tasks with reminders:', error);
      throw error;
    }
  }

  async markAsCompleted(id: string): Promise<Task> {
    try {
      const result = await this.db.query(
        `UPDATE tasks
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Task');
      }

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error marking task as completed:', { id, error });
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<Task> {
    try {
      const updates: any = { status };

      if (status === 'completed') {
        updates.completedAt = new Date();
      }

      return this.update(id, updates);
    } catch (error) {
      logger.error('Error updating task status:', { id, status, error });
      throw error;
    }
  }

  async getTaskStats(assigneeId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    dueToday: number;
  }> {
    try {
      const whereClause = assigneeId ? 'WHERE assigned_to = $1' : '';
      const params = assigneeId ? [assigneeId] : [];

      const totalResult = await this.db.query(
        `SELECT COUNT(*) FROM tasks ${whereClause}`,
        params
      );
      const total = parseInt(totalResult.rows[0].count);

      const statusResult = await this.db.query(
        `SELECT status, COUNT(*) as count FROM tasks ${whereClause} GROUP BY status`,
        params
      );
      const byStatus = statusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {});

      const priorityResult = await this.db.query(
        `SELECT priority, COUNT(*) as count FROM tasks ${whereClause} GROUP BY priority`,
        params
      );
      const byPriority = priorityResult.rows.reduce((acc, row) => {
        acc[row.priority] = parseInt(row.count);
        return acc;
      }, {});

      const overdueCondition = assigneeId
        ? "WHERE assigned_to = $1 AND due_date < NOW() AND status NOT IN ('completed', 'cancelled')"
        : "WHERE due_date < NOW() AND status NOT IN ('completed', 'cancelled')";

      const overdueResult = await this.db.query(
        `SELECT COUNT(*) FROM tasks ${overdueCondition}`,
        params
      );
      const overdue = parseInt(overdueResult.rows[0].count);

      const dueTodayCondition = assigneeId
        ? "WHERE assigned_to = $1 AND DATE(due_date) = CURRENT_DATE AND status NOT IN ('completed', 'cancelled')"
        : "WHERE DATE(due_date) = CURRENT_DATE AND status NOT IN ('completed', 'cancelled')";

      const dueTodayResult = await this.db.query(
        `SELECT COUNT(*) FROM tasks ${dueTodayCondition}`,
        params
      );
      const dueToday = parseInt(dueTodayResult.rows[0].count);

      return {
        total,
        byStatus,
        byPriority,
        overdue,
        dueToday,
      };
    } catch (error) {
      logger.error('Error getting task stats:', { assigneeId, error });
      throw error;
    }
  }

  private mapFromDb(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      priority: row.priority,
      status: row.status,
      dueDate: row.due_date,
      completedAt: row.completed_at,
      assignedTo: row.assigned_to,
      contactId: row.contact_id,
      companyId: row.company_id,
      dealId: row.deal_id,
      opportunityId: row.opportunity_id,
      reminderAt: row.reminder_at,
      isRecurring: row.is_recurring,
      recurringPattern: row.recurring_pattern,
      customFields: row.custom_fields || {},
      tags: row.tags || [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
