// @ts-nocheck
import { config } from '@/config';
import { EventRepository } from '@/repositories/EventRepository';
import { WorkflowRepository } from '@/repositories/WorkflowRepository';
import {
  CreateWorkflowRequest,
  ExecutionLogEntry,
  FilterParams,
  PaginatedResponse,
  PaginationParams,
  TriggerWorkflowRequest,
  UpdateWorkflowRequest,
  Workflow,
  WorkflowAnalyticsResponse,
  WorkflowExecution,
  WorkflowStep,
} from '@/types';
import { logger } from '@/utils/logger';
import { queueManager } from '@/utils/queue';
import axios from 'axios';

export class WorkflowService {
  private workflowRepository: WorkflowRepository;
  private eventRepository: EventRepository;

  constructor() {
    this.workflowRepository = new WorkflowRepository();
    this.eventRepository = new EventRepository();
  }

  // ============================================================================
  // WORKFLOW MANAGEMENT
  // ============================================================================

  async createWorkflow(
    data: CreateWorkflowRequest,
    createdBy: string
  ): Promise<Workflow> {
    try {
      // Validate workflow structure
      this.validateWorkflowStructure(data);

      const workflow = await this.workflowRepository.create(data, createdBy);

      logger.info('Workflow created successfully', {
        workflowId: workflow.id,
        name: workflow.name,
        createdBy,
      });

      return workflow;
    } catch (error) {
      logger.error('Error creating workflow', { error, data, createdBy });
      throw error;
    }
  }

  async getWorkflow(id: string): Promise<Workflow | null> {
    try {
      return await this.workflowRepository.findById(id);
    } catch (error) {
      logger.error('Error getting workflow', { error, id });
      throw error;
    }
  }

  async getWorkflows(
    pagination: PaginationParams,
    filters?: FilterParams
  ): Promise<PaginatedResponse<Workflow>> {
    try {
      return await this.workflowRepository.findAll(pagination, filters);
    } catch (error) {
      logger.error('Error getting workflows', { error, pagination, filters });
      throw error;
    }
  }

  async updateWorkflow(
    id: string,
    data: UpdateWorkflowRequest
  ): Promise<Workflow | null> {
    try {
      // Validate workflow structure if steps are being updated
      if (data.steps) {
        this.validateWorkflowStructure({
          name: '',
          description: '',
          trigger: data.trigger || {
            type: 'manual',
            conditions: [],
            settings: {},
          },
          steps: data.steps,
        });
      }

      const workflow = await this.workflowRepository.update(id, data);

      if (workflow) {
        logger.info('Workflow updated successfully', { workflowId: id });
      }

      return workflow;
    } catch (error) {
      logger.error('Error updating workflow', { error, id, data });
      throw error;
    }
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    try {
      // Check if workflow has active executions
      const activeExecutions =
        await this.workflowRepository.findExecutionsByWorkflow(id, {
          page: 1,
          limit: 1,
        });

      if (activeExecutions.data.some(exec => exec.status === 'running')) {
        throw new Error('Cannot delete workflow with active executions');
      }

      const deleted = await this.workflowRepository.delete(id);

      if (deleted) {
        logger.info('Workflow deleted successfully', { workflowId: id });
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting workflow', { error, id });
      throw error;
    }
  }

  async activateWorkflow(id: string): Promise<Workflow | null> {
    try {
      const workflow = await this.workflowRepository.update(id, {
        status: 'active',
      });

      if (workflow) {
        logger.info('Workflow activated', { workflowId: id });
      }

      return workflow;
    } catch (error) {
      logger.error('Error activating workflow', { error, id });
      throw error;
    }
  }

  async pauseWorkflow(id: string): Promise<Workflow | null> {
    try {
      const workflow = await this.workflowRepository.update(id, {
        status: 'paused',
      });

      if (workflow) {
        // Pause all running executions
        const activeExecutions =
          await this.workflowRepository.findExecutionsByWorkflow(id, {
            page: 1,
            limit: 100,
          });

        for (const execution of activeExecutions.data) {
          if (execution.status === 'running') {
            await queueManager.pauseWorkflowExecution(execution.id);
            await this.workflowRepository.updateExecution(execution.id, {
              status: 'paused',
            });
          }
        }

        logger.info('Workflow paused', { workflowId: id });
      }

      return workflow;
    } catch (error) {
      logger.error('Error pausing workflow', { error, id });
      throw error;
    }
  }

  // ============================================================================
  // WORKFLOW EXECUTION
  // ============================================================================

  async triggerWorkflow(
    workflowId: string,
    data: TriggerWorkflowRequest
  ): Promise<WorkflowExecution> {
    try {
      const workflow = await this.workflowRepository.findById(workflowId);

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      if (workflow.status !== 'active') {
        throw new Error(`Workflow ${workflowId} is not active`);
      }

      // Create execution record
      const execution = await this.workflowRepository.createExecution(
        workflowId,
        data.contactId,
        data.metadata
      );

      // Start workflow execution
      await this.startWorkflowExecution(execution, workflow);

      logger.info('Workflow triggered successfully', {
        workflowId,
        executionId: execution.id,
        contactId: data.contactId,
      });

      return execution;
    } catch (error) {
      logger.error('Error triggering workflow', { error, workflowId, data });
      throw error;
    }
  }

  async getWorkflowExecution(id: string): Promise<WorkflowExecution | null> {
    try {
      return await this.workflowRepository.findExecutionById(id);
    } catch (error) {
      logger.error('Error getting workflow execution', { error, id });
      throw error;
    }
  }

  async getWorkflowExecutions(
    workflowId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<WorkflowExecution>> {
    try {
      return await this.workflowRepository.findExecutionsByWorkflow(
        workflowId,
        pagination
      );
    } catch (error) {
      logger.error('Error getting workflow executions', { error, workflowId });
      throw error;
    }
  }

  async pauseExecution(executionId: string): Promise<WorkflowExecution | null> {
    try {
      await queueManager.pauseWorkflowExecution(executionId);
      const execution = await this.workflowRepository.updateExecution(
        executionId,
        { status: 'paused' }
      );

      if (execution) {
        logger.info('Workflow execution paused', { executionId });
      }

      return execution;
    } catch (error) {
      logger.error('Error pausing execution', { error, executionId });
      throw error;
    }
  }

  async resumeExecution(
    executionId: string
  ): Promise<WorkflowExecution | null> {
    try {
      const execution =
        await this.workflowRepository.findExecutionById(executionId);

      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      if (execution.status !== 'paused') {
        throw new Error(`Execution ${executionId} is not paused`);
      }

      await queueManager.resumeWorkflowExecution(
        executionId,
        execution.currentStep || '',
        execution.contactId,
        execution.workflowId
      );

      const updatedExecution = await this.workflowRepository.updateExecution(
        executionId,
        { status: 'running' }
      );

      if (updatedExecution) {
        logger.info('Workflow execution resumed', { executionId });
      }

      return updatedExecution;
    } catch (error) {
      logger.error('Error resuming execution', { error, executionId });
      throw error;
    }
  }

  // ============================================================================
  // WORKFLOW EXECUTION ENGINE
  // ============================================================================

  async executeWorkflowStep(
    executionId: string,
    stepId: string
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const execution =
        await this.workflowRepository.findExecutionById(executionId);

      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      if (execution.status !== 'running') {
        logger.warn('Skipping step execution for non-running execution', {
          executionId,
          status: execution.status,
        });

        return;
      }

      const workflow = await this.workflowRepository.findById(
        execution.workflowId
      );

      if (!workflow) {
        throw new Error(`Workflow ${execution.workflowId} not found`);
      }

      const step = workflow.steps.find(s => s.id === stepId);

      if (!step) {
        throw new Error(`Step ${stepId} not found in workflow ${workflow.id}`);
      }

      // Log step start
      const logEntry: ExecutionLogEntry = {
        stepId,
        timestamp: new Date(),
        status: 'started',
        metadata: { stepType: step.type },
      };

      await this.workflowRepository.addExecutionLogEntry(executionId, logEntry);
      await this.workflowRepository.updateExecution(executionId, {
        currentStep: stepId,
      });

      // Execute step based on type
      await this.executeStepByType(step, execution, workflow);

      // Log step completion
      const completionTime = Date.now() - startTime;
      const completionLogEntry: ExecutionLogEntry = {
        stepId,
        timestamp: new Date(),
        status: 'completed',
        duration: completionTime,
        metadata: { stepType: step.type },
      };

      await this.workflowRepository.addExecutionLogEntry(
        executionId,
        completionLogEntry
      );

      // Determine next steps
      await this.processNextSteps(step, execution, workflow);

      logger.debug('Workflow step executed successfully', {
        executionId,
        stepId,
        stepType: step.type,
        duration: completionTime,
      });
    } catch (error) {
      // Log step failure
      const failureTime = Date.now() - startTime;
      const failureLogEntry: ExecutionLogEntry = {
        stepId,
        timestamp: new Date(),
        status: 'failed',
        duration: failureTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      await this.workflowRepository.addExecutionLogEntry(
        executionId,
        failureLogEntry
      );
      await this.workflowRepository.updateExecution(executionId, {
        status: 'failed',
        completedAt: new Date(),
      });

      logger.error('Workflow step execution failed', {
        error,
        executionId,
        stepId,
        duration: failureTime,
      });

      throw error;
    }
  }

  private async executeStepByType(
    step: WorkflowStep,
    execution: WorkflowExecution,
    workflow: Workflow
  ): Promise<void> {
    switch (step.type) {
      case 'email':
        await this.executeEmailStep(step, execution);
        break;
      case 'wait':
        await this.executeWaitStep(step, execution);
        break;
      case 'condition':
        await this.executeConditionStep(step, execution);
        break;
      case 'webhook':
        await this.executeWebhookStep(step, execution);
        break;
      case 'tag':
        await this.executeTagStep(step, execution);
        break;
      case 'score':
        await this.executeScoreStep(step, execution);
        break;
      case 'segment':
        await this.executeSegmentStep(step, execution);
        break;
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async executeEmailStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    const config = step.config;

    if (!config.templateId && !config.content) {
      throw new Error('Email step requires either templateId or content');
    }

    // Call newsletter service to send email
    try {
      await axios.post(
        `${config.services.newsletterService.baseUrl}/api/v1/emails/send`,
        {
          to: execution.contactId,
          subject: config.subject,
          content: config.content,
          templateId: config.templateId,
          metadata: {
            workflowId: execution.workflowId,
            executionId: execution.id,
            stepId: step.id,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${config.services.newsletterService.apiKey || ''}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Email sent successfully', {
        executionId: execution.id,
        stepId: step.id,
        contactId: execution.contactId,
      });
    } catch (error) {
      logger.error('Failed to send email', {
        error,
        executionId: execution.id,
        stepId: step.id,
      });
      throw error;
    }
  }

  private async executeWaitStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    const config = step.config;
    const duration = config.duration || 1;
    const unit = config.unit || 'hours';

    let delayMs = 0;

    switch (unit) {
      case 'minutes':
        delayMs = duration * 60 * 1000;
        break;
      case 'hours':
        delayMs = duration * 60 * 60 * 1000;
        break;
      case 'days':
        delayMs = duration * 24 * 60 * 60 * 1000;
        break;
      case 'weeks':
        delayMs = duration * 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        throw new Error(`Invalid time unit: ${unit}`);
    }

    // Schedule next steps with delay
    for (const nextStepId of step.nextSteps) {
      await queueManager.addDelayedWorkflowStep(
        {
          executionId: execution.id,
          workflowId: execution.workflowId,
          contactId: execution.contactId,
          currentStep: nextStepId,
          metadata: execution.metadata,
        },
        delayMs
      );
    }

    logger.info('Wait step scheduled', {
      executionId: execution.id,
      stepId: step.id,
      duration,
      unit,
      delayMs,
    });
  }

  private async executeConditionStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    const config = step.config;
    const conditions = config.conditions || [];

    // Get contact data for evaluation
    const contactData = await this.getContactData(execution.contactId);

    // Evaluate conditions
    const conditionMet = this.evaluateConditions(
      conditions,
      contactData,
      execution.metadata
    );

    logger.info('Condition step evaluated', {
      executionId: execution.id,
      stepId: step.id,
      conditionMet,
      conditions: conditions.length,
    });

    // Conditions are handled in processNextSteps based on the evaluation result
    execution.metadata = {
      ...execution.metadata,
      [`${step.id}_condition_result`]: conditionMet,
    };
    await this.workflowRepository.updateExecution(execution.id, {
      metadata: execution.metadata,
    });
  }

  private async executeWebhookStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    const config = step.config;

    if (!config.url) {
      throw new Error('Webhook step requires URL');
    }

    // Add webhook to queue for reliable delivery
    await queueManager.addWebhook({
      url: config.url,
      method: config.method || 'POST',
      headers: config.headers || {},
      payload: {
        ...config.payload,
        workflowId: execution.workflowId,
        executionId: execution.id,
        contactId: execution.contactId,
        stepId: step.id,
        timestamp: new Date().toISOString(),
      },
      executionId: execution.id,
      stepId: step.id,
    });

    logger.info('Webhook queued', {
      executionId: execution.id,
      stepId: step.id,
      url: config.url,
      method: config.method,
    });
  }

  private async executeTagStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    const config = step.config;
    const action = config.action || 'add';
    const tags = config.tags || [];

    if (tags.length === 0) {
      throw new Error('Tag step requires at least one tag');
    }

    try {
      // Call CRM service to update contact tags
      await axios.post(
        `${config.services.crmService.baseUrl}/api/v1/contacts/${execution.contactId}/tags`,
        {
          action,
          tags,
        },
        {
          headers: {
            Authorization: `Bearer ${config.services.crmService.apiKey || ''}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Contact tags updated', {
        executionId: execution.id,
        stepId: step.id,
        contactId: execution.contactId,
        action,
        tags,
      });
    } catch (error) {
      logger.error('Failed to update contact tags', {
        error,
        executionId: execution.id,
        stepId: step.id,
      });
      throw error;
    }
  }

  private async executeScoreStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    const config = step.config;
    const points = config.points || 0;
    const reason = config.reason || 'Workflow automation';

    try {
      // Call CRM service to update lead score
      await axios.post(
        `${config.services.crmService.baseUrl}/api/v1/contacts/${execution.contactId}/score`,
        {
          points,
          reason,
          metadata: {
            workflowId: execution.workflowId,
            executionId: execution.id,
            stepId: step.id,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${config.services.crmService.apiKey || ''}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Contact score updated', {
        executionId: execution.id,
        stepId: step.id,
        contactId: execution.contactId,
        points,
        reason,
      });
    } catch (error) {
      logger.error('Failed to update contact score', {
        error,
        executionId: execution.id,
        stepId: step.id,
      });
      throw error;
    }
  }

  private async executeSegmentStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    const config = step.config;
    const segmentId = config.segmentId;
    const action = config.segmentAction || 'add';

    if (!segmentId) {
      throw new Error('Segment step requires segmentId');
    }

    try {
      // Call CRM service to update contact segment
      await axios.post(
        `${config.services.crmService.baseUrl}/api/v1/segments/${segmentId}/contacts`,
        {
          contactId: execution.contactId,
          action,
        },
        {
          headers: {
            Authorization: `Bearer ${config.services.crmService.apiKey || ''}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Contact segment updated', {
        executionId: execution.id,
        stepId: step.id,
        contactId: execution.contactId,
        segmentId,
        action,
      });
    } catch (error) {
      logger.error('Failed to update contact segment', {
        error,
        executionId: execution.id,
        stepId: step.id,
      });
      throw error;
    }
  }

  private async processNextSteps(
    currentStep: WorkflowStep,
    execution: WorkflowExecution,
    workflow: Workflow
  ): Promise<void> {
    let nextStepIds = currentStep.nextSteps;

    // Handle conditional logic for condition steps
    if (currentStep.type === 'condition') {
      const conditionResult =
        execution.metadata[`${currentStep.id}_condition_result`];

      if (typeof conditionResult === 'boolean') {
        // Assume first next step is for true condition, second for false
        if (conditionResult && nextStepIds.length > 0) {
          nextStepIds = [nextStepIds[0]];
        } else if (!conditionResult && nextStepIds.length > 1) {
          nextStepIds = [nextStepIds[1]];
        } else {
          nextStepIds = [];
        }
      }
    }

    if (nextStepIds.length === 0) {
      // Workflow execution completed
      await this.workflowRepository.updateExecution(execution.id, {
        status: 'completed',
        completedAt: new Date(),
      });

      logger.info('Workflow execution completed', {
        executionId: execution.id,
        workflowId: execution.workflowId,
      });

      return;
    }

    // Queue next steps for execution
    for (const nextStepId of nextStepIds) {
      await queueManager.addWorkflowExecution({
        executionId: execution.id,
        workflowId: execution.workflowId,
        contactId: execution.contactId,
        currentStep: nextStepId,
        metadata: execution.metadata,
      });
    }
  }

  private async startWorkflowExecution(
    execution: WorkflowExecution,
    workflow: Workflow
  ): Promise<void> {
    // Find the first step (step with no incoming connections)
    const allNextSteps = workflow.steps.flatMap(step => step.nextSteps);
    const firstSteps = workflow.steps.filter(
      step => !allNextSteps.includes(step.id)
    );

    if (firstSteps.length === 0) {
      throw new Error('Workflow has no starting step');
    }

    // Start with the first step
    const firstStep = firstSteps[0];

    if (!firstStep) {
      throw new Error('No valid first step found');
    }

    await queueManager.addWorkflowExecution({
      executionId: execution.id,
      workflowId: execution.workflowId,
      contactId: execution.contactId,
      currentStep: firstStep.id,
      metadata: execution.metadata,
    });

    logger.info('Workflow execution started', {
      executionId: execution.id,
      workflowId: workflow.id,
      firstStepId: firstStep.id,
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private validateWorkflowStructure(data: CreateWorkflowRequest): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Workflow name is required');
    }

    if (!data.steps || data.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    // Validate step IDs are unique
    const stepIds = data.steps.map(step => step.id);
    const uniqueStepIds = new Set(stepIds);

    if (stepIds.length !== uniqueStepIds.size) {
      throw new Error('Step IDs must be unique');
    }

    // Validate next step references
    for (const step of data.steps) {
      for (const nextStepId of step.nextSteps) {
        if (!stepIds.includes(nextStepId)) {
          throw new Error(
            `Step ${step.id} references non-existent step ${nextStepId}`
          );
        }
      }
    }

    // Validate step configurations
    for (const step of data.steps) {
      this.validateStepConfig(step);
    }
  }

  private validateStepConfig(step: WorkflowStep): void {
    switch (step.type) {
      case 'email':
        if (!step.config.templateId && !step.config.content) {
          throw new Error(
            `Email step ${step.id} requires either templateId or content`
          );
        }
        break;
      case 'wait':
        if (!step.config.duration || step.config.duration <= 0) {
          throw new Error(`Wait step ${step.id} requires positive duration`);
        }
        break;
      case 'webhook':
        if (!step.config.url) {
          throw new Error(`Webhook step ${step.id} requires URL`);
        }
        break;
      case 'tag':
        if (!step.config.tags || step.config.tags.length === 0) {
          throw new Error(`Tag step ${step.id} requires at least one tag`);
        }
        break;
      case 'segment':
        if (!step.config.segmentId) {
          throw new Error(`Segment step ${step.id} requires segmentId`);
        }
        break;
    }
  }

  private async getContactData(contactId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${config.services.crmService.baseUrl}/api/v1/contacts/${contactId}`,
        {
          headers: {
            Authorization: `Bearer ${config.services.crmService.apiKey || ''}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get contact data', { error, contactId });
      throw error;
    }
  }

  private evaluateConditions(
    conditions: any[],
    contactData: any,
    metadata: any
  ): boolean {
    if (conditions.length === 0) {
      return true;
    }

    let result = true;
    let currentOperator = 'AND';

    for (const condition of conditions) {
      const conditionResult = this.evaluateSingleCondition(
        condition,
        contactData,
        metadata
      );

      if (currentOperator === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }

      currentOperator = condition.logicalOperator || 'AND';
    }

    return result;
  }

  private evaluateSingleCondition(
    condition: any,
    contactData: any,
    metadata: any
  ): boolean {
    const fieldValue = this.getFieldValue(
      condition.field,
      contactData,
      metadata
    );

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue)
          .toLowerCase()
          .includes(String(condition.value).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'in':
        return (
          Array.isArray(condition.value) && condition.value.includes(fieldValue)
        );
      case 'not_in':
        return (
          Array.isArray(condition.value) &&
          !condition.value.includes(fieldValue)
        );
      default:
        return false;
    }
  }

  private getFieldValue(field: string, contactData: any, metadata: any): any {
    if (field.startsWith('contact.')) {
      const contactField = field.substring(8);

      return this.getNestedValue(contactData, contactField);
    }

    if (field.startsWith('metadata.')) {
      const metadataField = field.substring(9);

      return this.getNestedValue(metadata, metadataField);
    }

    return contactData[field] || metadata[field];
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // ============================================================================
  // ANALYTICS AND REPORTING
  // ============================================================================

  async getWorkflowAnalytics(
    workflowId: string
  ): Promise<WorkflowAnalyticsResponse> {
    try {
      const workflow = await this.workflowRepository.findById(workflowId);

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const executions = await this.workflowRepository.findExecutionsByWorkflow(
        workflowId,
        { page: 1, limit: 1000 }
      );

      const completionRate =
        executions.data.length > 0
          ? (executions.data.filter(e => e.status === 'completed').length /
              executions.data.length) *
            100
          : 0;

      const completedExecutions = executions.data.filter(
        e => e.status === 'completed' && e.completedAt
      );
      const averageTime =
        completedExecutions.length > 0
          ? completedExecutions.reduce((sum, e) => {
              const duration = e.completedAt!.getTime() - e.startedAt.getTime();

              return sum + duration;
            }, 0) / completedExecutions.length
          : 0;

      // Calculate dropoff points
      const stepExecutions: Record<string, number> = {};
      const stepCompletions: Record<string, number> = {};

      for (const execution of executions.data) {
        for (const logEntry of execution.executionLog) {
          if (logEntry.status === 'started') {
            stepExecutions[logEntry.stepId] =
              (stepExecutions[logEntry.stepId] || 0) + 1;
          }
          if (logEntry.status === 'completed') {
            stepCompletions[logEntry.stepId] =
              (stepCompletions[logEntry.stepId] || 0) + 1;
          }
        }
      }

      const dropoffPoints = workflow.steps
        .map(step => {
          const executions = stepExecutions[step.id] || 0;
          const completions = stepCompletions[step.id] || 0;
          const dropoffRate =
            executions > 0
              ? ((executions - completions) / executions) * 100
              : 0;

          return {
            stepId: step.id,
            stepName: `${step.type} - ${step.id}`,
            dropoffRate,
          };
        })
        .sort((a, b) => b.dropoffRate - a.dropoffRate);

      return {
        workflow,
        metrics: workflow.metrics,
        executionHistory: executions.data,
        performanceData: {
          completionRate,
          averageTime,
          dropoffPoints,
        },
      };
    } catch (error) {
      logger.error('Error getting workflow analytics', { error, workflowId });
      throw error;
    }
  }
}

export default WorkflowService;
