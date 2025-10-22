import {
    CreateWorkflowRequest,
    ExecutionLogEntry,
    FilterParams,
    PaginatedResponse,
    PaginationParams,
    UpdateWorkflowRequest,
    Workflow,
    WorkflowExecution,
    WorkflowMetrics
} from '@/types';
import { database } from '@/utils/database';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowRepository {
  async create(data: CreateWorkflowRequest, createdBy: string): Promise<Workflow> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO workflows (
        id, name, description, trigger, steps, status, metrics, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      id,
      data.name,
      data.description,
      JSON.stringify(data.trigger),
      JSON.stringify(data.steps),
      'draft',
      JSON.stringify({
        totalExecutions: 0,
        completedExecutions: 0,
        failedExecutions: 0,
        averageCompletionTime: 0,
        conversionRate: 0,
        stepMetrics: {}
      }),
      createdBy,
      now,
      now
    ];

    try {
      const result = await database.query(query, values);
      const workflow = this.mapRowToWorkflow(result.rows[0]);
      logger.info('Workflow created', { workflowId: id, name: data.name });
      return workflow;
    } catch (error) {
      logger.error('Error creating workflow', { error, data });
      throw error;
    }
  }

  async findById(id: string): Promise<Workflow | null> {
    const query = 'SELECT * FROM workflows WHERE id = $1';

    try {
      const result = await database.query(query, [id]);
      return result.rows[0] ? this.mapRowToWorkflow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding workflow by ID', { error, id });
      throw error;
    }
  }

  async findAll(
    pagination: PaginationParams,
    filters?: FilterParams
  ): Promise<PaginatedResponse<Workflow>> {
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      whereClause += ` AND status = ANY($${paramIndex})`;
      queryParams.push(filters.status);
      paramIndex++;
    }

    if (filters?.createdBy) {
      whereClause += ` AND created_by = $${paramIndex}`;
      queryParams.push(filters.createdBy);
      paramIndex++;
    }

    if (filters?.dateRange) {
      whereClause += ` AND created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      queryParams.push(filters.dateRange.start, filters.dateRange.end);
      paramIndex += 2;
    }

    // Count query
    const countQuery = `SELECT COUNT(*) FROM workflows ${whereClause}`;
    const countResult = await database.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Data query with pagination
    const offset = (pagination.page - 1) * pagination.limit;
    const orderBy = pagination.sortBy ?
      `ORDER BY ${pagination.sortBy} ${pagination.sortOrder}` :
      'ORDER BY created_at DESC';

    const dataQuery = `
      SELECT * FROM workflows
      ${whereClause}
      ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(pagination.limit, offset);

    try {
      const result = await database.query(dataQuery, queryParams);
      const workflows = result.rows.map(row => this.mapRowToWorkflow(row));

      return {
        data: workflows,
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
      logger.error('Error finding workflows', { error, pagination, filters });
      throw error;
    }
  }

  async update(id: string, data: UpdateWorkflowRequest): Promise<Workflow | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(data.name);
      paramIndex++;
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(data.description);
      paramIndex++;
    }

    if (data.trigger !== undefined) {
      updates.push(`trigger = $${paramIndex}`);
      values.push(JSON.stringify(data.trigger));
      paramIndex++;
    }

    if (data.steps !== undefined) {
      updates.push(`steps = $${paramIndex}`);
      values.push(JSON.stringify(data.steps));
      paramIndex++;
    }

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(data.status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(id);

    const query = `
      UPDATE workflows
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await database.query(query, values);
      if (result.rows[0]) {
        const workflow = this.mapRowToWorkflow(result.rows[0]);
        logger.info('Workflow updated', { workflowId: id });
        return workflow;
      }
      return null;
    } catch (error) {
      logger.error('Error updating workflow', { error, id, data });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM workflows WHERE id = $1';

    try {
      const result = await database.query(query, [id]);
      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.info('Workflow deleted', { workflowId: id });
      }
      return deleted;
    } catch (error) {
      logger.error('Error deleting workflow', { error, id });
      throw error;
    }
  }

  async updateMetrics(id: string, metrics: WorkflowMetrics): Promise<void> {
    const query = `
      UPDATE workflows
      SET metrics = $1, updated_at = $2
      WHERE id = $3
    `;

    try {
      await database.query(query, [JSON.stringify(metrics), new Date(), id]);
      logger.debug('Workflow metrics updated', { workflowId: id });
    } catch (error) {
      logger.error('Error updating workflow metrics', { error, id, metrics });
      throw error;
    }
  }

  // Workflow execution methods
  async createExecution(
    workflowId: string,
    contactId: string,
    metadata?: Record<string, any>
  ): Promise<WorkflowExecution> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO workflow_executions (
        id, workflow_id, contact_id, current_step, status, started_at, metadata, execution_log
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id,
      workflowId,
      contactId,
      null, // Will be set when first step starts
      'running',
      now,
      JSON.stringify(metadata || {}),
      JSON.stringify([])
    ];

    try {
      const result = await database.query(query, values);
      const execution = this.mapRowToExecution(result.rows[0]);
      logger.info('Workflow execution created', { executionId: id, workflowId, contactId });
      return execution;
    } catch (error) {
      logger.error('Error creating workflow execution', { error, workflowId, contactId });
      throw error;
    }
  }

  async findExecutionById(id: string): Promise<WorkflowExecution | null> {
    const query = 'SELECT * FROM workflow_executions WHERE id = $1';

    try {
      const result = await database.query(query, [id]);
      return result.rows[0] ? this.mapRowToExecution(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding execution by ID', { error, id });
      throw error;
    }
  }

  async updateExecution(
    id: string,
    updates: Partial<Pick<WorkflowExecution, 'currentStep' | 'status' | 'completedAt' | 'metadata'>>
  ): Promise<WorkflowExecution | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.currentStep !== undefined) {
      updateFields.push(`current_step = $${paramIndex}`);
      values.push(updates.currentStep);
      paramIndex++;
    }

    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }

    if (updates.completedAt !== undefined) {
      updateFields.push(`completed_at = $${paramIndex}`);
      values.push(updates.completedAt);
      paramIndex++;
    }

    if (updates.metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(updates.metadata));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return this.findExecutionById(id);
    }

    values.push(id);

    const query = `
      UPDATE workflow_executions
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await database.query(query, values);
      return result.rows[0] ? this.mapRowToExecution(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error updating execution', { error, id, updates });
      throw error;
    }
  }

  async addExecutionLogEntry(executionId: string, logEntry: ExecutionLogEntry): Promise<void> {
    const query = `
      UPDATE workflow_executions
      SET execution_log = execution_log || $1::jsonb
      WHERE id = $2
    `;

    try {
      await database.query(query, [JSON.stringify(logEntry), executionId]);
      logger.debug('Execution log entry added', { executionId, stepId: logEntry.stepId });
    } catch (error) {
      logger.error('Error adding execution log entry', { error, executionId, logEntry });
      throw error;
    }
  }

  async findExecutionsByWorkflow(
    workflowId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<WorkflowExecution>> {
    const offset = (pagination.page - 1) * pagination.limit;

    // Count query
    const countQuery = 'SELECT COUNT(*) FROM workflow_executions WHERE workflow_id = $1';
    const countResult = await database.query(countQuery, [workflowId]);
    const total = parseInt(countResult.rows[0].count);

    // Data query
    const dataQuery = `
      SELECT * FROM workflow_executions
      WHERE workflow_id = $1
      ORDER BY started_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await database.query(dataQuery, [workflowId, pagination.limit, offset]);
      const executions = result.rows.map(row => this.mapRowToExecution(row));

      return {
        data: executions,
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
      logger.error('Error finding executions by workflow', { error, workflowId });
      throw error;
    }
  }

  private mapRowToWorkflow(row: Record<string, any>): Workflow {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      trigger: JSON.parse(row.trigger),
      steps: JSON.parse(row.steps),
      status: row.status,
      metrics: JSON.parse(row.metrics),
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToExecution(row: Record<string, any>): WorkflowExecution {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      contactId: row.contact_id,
      currentStep: row.current_step,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      metadata: JSON.parse(row.metadata),
      executionLog: JSON.parse(row.execution_log),
    };
  }
}

export default WorkflowRepository;
