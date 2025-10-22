import { WorkflowService } from '@/services/WorkflowService';
import {
    CreateWorkflowRequest,
    FilterParams,
    PaginationParams,
    TriggerWorkflowRequest,
    UpdateWorkflowRequest
} from '@/types';
import { logger } from '@/utils/logger';
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';

export class WorkflowController {
  private workflowService: WorkflowService;

  constructor() {
    this.workflowService = new WorkflowService();
  }

  // ============================================================================
  // WORKFLOW MANAGEMENT ENDPOINTS
  // ============================================================================

  async createWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const workflowData: CreateWorkflowRequest = req.body;
      const createdBy = req.user?.id || 'system';

      const workflow = await this.workflowService.createWorkflow(workflowData, createdBy);

      res.status(201).json({
        success: true,
        message: 'Workflow created successfully',
        data: workflow
      });

      logger.info('Workflow created via API', {
        workflowId: workflow.id,
        name: workflow.name,
        createdBy,
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in createWorkflow controller', { error, body: req.body });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async getWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const workflow = await this.workflowService.getWorkflow(id);

      if (!workflow) {
        res.status(404).json({
          success: false,
          message: 'Workflow not found'
        });
        return;
      }

      res.json({
        success: true,
        data: workflow
      });

    } catch (error) {
      logger.error('Error in getWorkflow controller', { error, workflowId: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getWorkflows(req: Request, res: Response): Promise<void> {
    try {
      const pagination: PaginationParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
      };

      const filters: FilterParams = {};

      if (req.query.status) {
        filters.status = Array.isArray(req.query.status)
          ? req.query.status as string[]
          : [req.query.status as string];
      }

      if (req.query.createdBy) {
        filters.createdBy = req.query.createdBy as string;
      }

      if (req.query.startDate && req.query.endDate) {
        filters.dateRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string)
        };
      }

      const result = await this.workflowService.getWorkflows(pagination, filters);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });

    } catch (error) {
      logger.error('Error in getWorkflows controller', { error, query: req.query });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async updateWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const updateData: UpdateWorkflowRequest = req.body;

      const workflow = await this.workflowService.updateWorkflow(id, updateData);

      if (!workflow) {
        res.status(404).json({
          success: false,
          message: 'Workflow not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Workflow updated successfully',
        data: workflow
      });

      logger.info('Workflow updated via API', {
        workflowId: id,
        updatedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in updateWorkflow controller', {
        error,
        workflowId: req.params.id,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async deleteWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const deleted = await this.workflowService.deleteWorkflow(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Workflow not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Workflow deleted successfully'
      });

      logger.info('Workflow deleted via API', {
        workflowId: id,
        deletedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in deleteWorkflow controller', {
        error,
        workflowId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async activateWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const workflow = await this.workflowService.activateWorkflow(id);

      if (!workflow) {
        res.status(404).json({
          success: false,
          message: 'Workflow not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Workflow activated successfully',
        data: workflow
      });

      logger.info('Workflow activated via API', {
        workflowId: id,
        activatedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in activateWorkflow controller', {
        error,
        workflowId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async pauseWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const workflow = await this.workflowService.pauseWorkflow(id);

      if (!workflow) {
        res.status(404).json({
          success: false,
          message: 'Workflow not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Workflow paused successfully',
        data: workflow
      });

      logger.info('Workflow paused via API', {
        workflowId: id,
        pausedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in pauseWorkflow controller', {
        error,
        workflowId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  // ============================================================================
  // WORKFLOW EXECUTION ENDPOINTS
  // ============================================================================

  async triggerWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const triggerData: TriggerWorkflowRequest = req.body;

      const execution = await this.workflowService.triggerWorkflow(id, triggerData);

      res.status(202).json({
        success: true,
        message: 'Workflow triggered successfully',
        data: execution
      });

      logger.info('Workflow triggered via API', {
        workflowId: id,
        executionId: execution.id,
        contactId: triggerData.contactId,
        triggeredBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in triggerWorkflow controller', {
        error,
        workflowId: req.params.id,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async getWorkflowExecution(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;

      const execution = await this.workflowService.getWorkflowExecution(executionId);

      if (!execution) {
        res.status(404).json({
          success: false,
          message: 'Workflow execution not found'
        });
        return;
      }

      res.json({
        success: true,
        data: execution
      });

    } catch (error) {
      logger.error('Error in getWorkflowExecution controller', {
        error,
        executionId: req.params.executionId
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getWorkflowExecutions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const pagination: PaginationParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
      };

      const result = await this.workflowService.getWorkflowExecutions(id, pagination);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });

    } catch (error) {
      logger.error('Error in getWorkflowExecutions controller', {
        error,
        workflowId: req.params.id,
        query: req.query
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async pauseExecution(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;

      const execution = await this.workflowService.pauseExecution(executionId);

      if (!execution) {
        res.status(404).json({
          success: false,
          message: 'Workflow execution not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Workflow execution paused successfully',
        data: execution
      });

      logger.info('Workflow execution paused via API', {
        executionId,
        pausedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in pauseExecution controller', {
        error,
        executionId: req.params.executionId
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async resumeExecution(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;

      const execution = await this.workflowService.resumeExecution(executionId);

      if (!execution) {
        res.status(404).json({
          success: false,
          message: 'Workflow execution not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Workflow execution resumed successfully',
        data: execution
      });

      logger.info('Workflow execution resumed via API', {
        executionId,
        resumedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in resumeExecution controller', {
        error,
        executionId: req.params.executionId
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  // ============================================================================
  // ANALYTICS ENDPOINTS
  // ============================================================================

  async getWorkflowAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const analytics = await this.workflowService.getWorkflowAnalytics(id);

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Error in getWorkflowAnalytics controller', {
        error,
        workflowId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }
}

export default WorkflowController;
