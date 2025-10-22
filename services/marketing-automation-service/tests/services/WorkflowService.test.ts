import axios from 'axios';
import { EventRepository } from '../../src/repositories/EventRepository';
import { WorkflowRepository } from '../../src/repositories/WorkflowRepository';
import { WorkflowService } from '../../src/services/WorkflowService';
import {
    CreateWorkflowRequest,
    TriggerWorkflowRequest,
    Workflow,
    WorkflowExecution,
    WorkflowStep
} from '../../src/types';
import { queueManager } from '../../src/utils/queue';

// Mock dependencies
jest.mock('../../src/repositories/WorkflowRepository');
jest.mock('../../src/repositories/EventRepository');
jest.mock('../../src/utils/queue');
jest.mock('../../src/utils/logger');
jest.mock('axios');

describe('WorkflowService', () => {
  let workflowService: WorkflowService;
  let mockWorkflowRepository: jest.Mocked<WorkflowRepository>;
  let mockEventRepository: jest.Mocked<EventRepository>;
  let mockQueueManager: jest.Mocked<typeof queueManager>;
  let mockAxios: jest.Mocked<typeof axios>;

  beforeEach(() => {
    mockWorkflowRepository = new WorkflowRepository() as jest.Mocked<WorkflowRepository>;
    mockEventRepository = new EventRepository() as jest.Mocked<EventRepository>;
    mockQueueManager = queueManager as jest.Mocked<typeof queueManager>;
    mockAxios = axios as jest.Mocked<typeof axios>;

    // Mock the constructor dependencies
    (WorkflowRepository as jest.Mock).mockImplementation(() => mockWorkflowRepository);
    (EventRepository as jest.Mock).mockImplementation(() => mockEventRepository);

    workflowService = new WorkflowService();
    jest.clearAllMocks();
  });

  describe('createWorkflow', () => {
    const validWorkflowData: CreateWorkflowRequest = {
      name: 'Welcome Workflow',
      description: 'Onboard new users',
      trigger: {
        type: 'event',
        conditions: [],
        settings: {}
      },
      steps: [
        {
          id: 'step-1',
          type: 'email',
          config: {
            templateId: 'welcome-template',
            subject: 'Welcome!'
          },
          nextSteps: ['step-2']
        },
        {
          id: 'step-2',
          type: 'wait',
          config: {
            duration: 24,
            unit: 'hours'
          },
          nextSteps: []
        }
      ]
    };

    it('should create workflow with valid data', async () => {
      const expectedWorkflow: Workflow = {
        id: 'workflow-123',
        name: validWorkflowData.name,
        description: validWorkflowData.description,
        trigger: validWorkflowData.trigger,
        steps: validWorkflowData.steps,
        status: 'draft',
        metrics: {
          totalExecutions: 0,
          completedExecutions: 0,
          failedExecutions: 0,
          averageCompletionTime: 0
        },
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockWorkflowRepository.create.mockResolvedValue(expectedWorkflow);

      const result = await workflowService.createWorkflow(validWorkflowData, 'user-123');

      expect(result).toEqual(expectedWorkflow);
      expect(mockWorkflowRepository.create).toHaveBeenCalledWith(validWorkflowData, 'user-123');
    });

    it('should validate workflow structure', async () => {
      const invalidWorkflow = {
        ...validWorkflowData,
        name: '' // Invalid empty name
      };

      await expect(workflowService.createWorkflow(invalidWorkflow, 'user-123'))
        .rejects.toThrow('Workflow name is required');
    });

    it('should validate step references', async () => {
      const invalidWorkflow = {
        ...validWorkflowData,
        steps: [
          {
            id: 'step-1',
            type: 'email',
            config: { templateId: 'template-1' },
            nextSteps: ['non-existent-step'] // Invalid reference
          }
        ]
      };

      await expect(workflowService.createWorkflow(invalidWorkflow, 'user-123'))
        .rejects.toThrow('Step step-1 references non-existent step non-existent-step');
    });

    it('should validate step configurations', async () => {
      const invalidWorkflow = {
        ...validWorkflowData,
        steps: [
          {
            id: 'step-1',
            type: 'email',
            config: {}, // Missing required templateId or content
            nextSteps: []
          }
        ]
      };

      await expect(workflowService.createWorkflow(invalidWorkflow, 'user-123'))
        .rejects.toThrow('Email step step-1 requires either templateId or content');
    });
  });

  describe('triggerWorkflow', () => {
    const workflow: Workflow = {
      id: 'workflow-123',
      name: 'Test Workflow',
      description: 'Test',
      trigger: { type: 'manual', conditions: [], settings: {} },
      steps: [
        {
          id: 'step-1',
          type: 'email',
          config: { templateId: 'template-1' },
          nextSteps: []
        }
      ],
      status: 'active',
      metrics: {
        totalExecutions: 0,
        completedExecutions: 0,
        failedExecutions: 0,
        averageCompletionTime: 0
      },
      createdBy: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const triggerData: TriggerWorkflowRequest = {
      contactId: 'contact-123',
      metadata: { source: 'manual' }
    };

    it('should trigger workflow successfully', async () => {
      const execution: WorkflowExecution = {
        id: 'execution-123',
        workflowId: workflow.id,
        contactId: triggerData.contactId,
        status: 'running',
        currentStep: 'step-1',
        metadata: triggerData.metadata,
        executionLog: [],
        startedAt: new Date()
      };

      mockWorkflowRepository.findById.mockResolvedValue(workflow);
      mockWorkflowRepository.createExecution.mockResolvedValue(execution);
      mockQueueManager.addWorkflowExecution.mockResolvedValue(undefined);

      const result = await workflowService.triggerWorkflow(workflow.id, triggerData);

      expect(result).toEqual(execution);
      expect(mockWorkflowRepository.createExecution).toHaveBeenCalledWith(
        workflow.id,
        triggerData.contactId,
        triggerData.metadata
      );
      expect(mockQueueManager.addWorkflowExecution).toHaveBeenCalled();
    });

    it('should throw error if workflow not found', async () => {
      mockWorkflowRepository.findById.mockResolvedValue(null);

      await expect(workflowService.triggerWorkflow('non-existent', triggerData))
        .rejects.toThrow('Workflow non-existent not found');
    });

    it('should throw error if workflow not active', async () => {
      const inactiveWorkflow = { ...workflow, status: 'paused' as const };
      mockWorkflowRepository.findById.mockResolvedValue(inactiveWorkflow);

      await expect(workflowService.triggerWorkflow(workflow.id, triggerData))
        .rejects.toThrow(`Workflow ${workflow.id} is not active`);
    });
  });

  describe('executeWorkflowStep', () => {
    const execution: WorkflowExecution = {
      id: 'execution-123',
      workflowId: 'workflow-123',
      contactId: 'contact-123',
      status: 'running',
      currentStep: 'step-1',
      metadata: {},
      executionLog: [],
      startedAt: new Date()
    };

    const workflow: Workflow = {
      id: 'workflow-123',
      name: 'Test Workflow',
      description: 'Test',
      trigger: { type: 'manual', conditions: [], settings: {} },
      steps: [
        {
          id: 'step-1',
          type: 'email',
          config: {
            templateId: 'template-1',
            subject: 'Test Email'
          },
          nextSteps: []
        }
      ],
      status: 'active',
      metrics: {
        totalExecutions: 0,
        completedExecutions: 0,
        failedExecutions: 0,
        averageCompletionTime: 0
      },
      createdBy: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    beforeEach(() => {
      mockWorkflowRepository.findExecutionById.mockResolvedValue(execution);
      mockWorkflowRepository.findById.mockResolvedValue(workflow);
      mockWorkflowRepository.addExecutionLogEntry.mockResolvedValue(undefined);
      mockWorkflowRepository.updateExecution.mockResolvedValue(execution);
    });

    it('should execute email step successfully', async () => {
      mockAxios.post.mockResolvedValue({ data: { success: true } });

      await workflowService.executeWorkflowStep(execution.id, 'step-1');

      expect(mockWorkflowRepository.addExecutionLogEntry).toHaveBeenCalledWith(
        execution.id,
        expect.objectContaining({
          stepId: 'step-1',
          status: 'started'
        })
      );
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/emails/send'),
        expect.objectContaining({
          to: execution.contactId,
          subject: 'Test Email',
          templateId: 'template-1'
        }),
        expect.any(Object)
      );
      expect(mockWorkflowRepository.addExecutionLogEntry).toHaveBeenCalledWith(
        execution.id,
        expect.objectContaining({
          stepId: 'step-1',
          status: 'completed'
        })
      );
    });

    it('should execute wait step successfully', async () => {
      const waitStep: WorkflowStep = {
        id: 'step-2',
        type: 'wait',
        config: {
          duration: 2,
          unit: 'hours'
        },
        nextSteps: ['step-3']
      };

      const workflowWithWait = {
        ...workflow,
        steps: [waitStep]
      };

      mockWorkflowRepository.findById.mockResolvedValue(workflowWithWait);
      mockQueueManager.addDelayedWorkflowStep.mockResolvedValue(undefined);

      await workflowService.executeWorkflowStep(execution.id, 'step-2');

      expect(mockQueueManager.addDelayedWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: execution.id,
          currentStep: 'step-3'
        }),
        2 * 60 * 60 * 1000 // 2 hours in milliseconds
      );
    });

    it('should execute webhook step successfully', async () => {
      const webhookStep: WorkflowStep = {
        id: 'step-3',
        type: 'webhook',
        config: {
          url: 'https://api.example.com/webhook',
          method: 'POST',
          payload: { event: 'workflow_step' }
        },
        nextSteps: []
      };

      const workflowWithWebhook = {
        ...workflow,
        steps: [webhookStep]
      };

      mockWorkflowRepository.findById.mockResolvedValue(workflowWithWebhook);
      mockQueueManager.addWebhook.mockResolvedValue(undefined);

      await workflowService.executeWorkflowStep(execution.id, 'step-3');

      expect(mockQueueManager.addWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/webhook',
          method: 'POST',
          payload: expect.objectContaining({
            event: 'workflow_step',
            workflowId: execution.workflowId,
            executionId: execution.id
          })
        })
      );
    });

    it('should handle step execution failure', async () => {
      mockAxios.post.mockRejectedValue(new Error('Email service error'));

      await expect(workflowService.executeWorkflowStep(execution.id, 'step-1'))
        .rejects.toThrow('Email service error');

      expect(mockWorkflowRepository.addExecutionLogEntry).toHaveBeenCalledWith(
        execution.id,
        expect.objectContaining({
          stepId: 'step-1',
          status: 'failed',
          error: 'Email service error'
        })
      );
      expect(mockWorkflowRepository.updateExecution).toHaveBeenCalledWith(
        execution.id,
        expect.objectContaining({
          status: 'failed'
        })
      );
    });

    it('should skip execution for non-running workflow', async () => {
      const pausedExecution = { ...execution, status: 'paused' as const };
      mockWorkflowRepository.findExecutionById.mockResolvedValue(pausedExecution);

      await workflowService.executeWorkflowStep(execution.id, 'step-1');

      expect(mockWorkflowRepository.addExecutionLogEntry).not.toHaveBeenCalled();
    });

    it('should throw error if execution not found', async () => {
      mockWorkflowRepository.findExecutionById.mockResolvedValue(null);

      await expect(workflowService.executeWorkflowStep('non-existent', 'step-1'))
        .rejects.toThrow('Execution non-existent not found');
    });

    it('should throw error if step not found', async () => {
      await expect(workflowService.executeWorkflowStep(execution.id, 'non-existent-step'))
        .rejects.toThrow('Step non-existent-step not found in workflow workflow-123');
    });
  });

  describe('pauseWorkflow', () => {
    const workflow: Workflow = {
      id: 'workflow-123',
      name: 'Test Workflow',
      description: 'Test',
      trigger: { type: 'manual', conditions: [], settings: {} },
      steps: [],
      status: 'active',
      metrics: {
        totalExecutions: 0,
        completedExecutions: 0,
        failedExecutions: 0,
        averageCompletionTime: 0
      },
      createdBy: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should pause workflow and active executions', async () => {
      const pausedWorkflow = { ...workflow, status: 'paused' as const };
      const activeExecution: WorkflowExecution = {
        id: 'execution-123',
        workflowId: workflow.id,
        contactId: 'contact-123',
        status: 'running',
        metadata: {},
        executionLog: [],
        startedAt: new Date()
      };

      mockWorkflowRepository.update.mockResolvedValue(pausedWorkflow);
      mockWorkflowRepository.findExecutionsByWorkflow.mockResolvedValue({
        data: [activeExecution],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1
      });
      mockQueueManager.pauseWorkflowExecution.mockResolvedValue(undefined);
      mockWorkflowRepository.updateExecution.mockResolvedValue({
        ...activeExecution,
        status: 'paused'
      });

      const result = await workflowService.pauseWorkflow(workflow.id);

      expect(result).toEqual(pausedWorkflow);
      expect(mockQueueManager.pauseWorkflowExecution).toHaveBeenCalledWith(activeExecution.id);
      expect(mockWorkflowRepository.updateExecution).toHaveBeenCalledWith(
        activeExecution.id,
        { status: 'paused' }
      );
    });
  });

  describe('getWorkflowAnalytics', () => {
    const workflow: Workflow = {
      id: 'workflow-123',
      name: 'Test Workflow',
      description: 'Test',
      trigger: { type: 'manual', conditions: [], settings: {} },
      steps: [
        { id: 'step-1', type: 'email', config: {}, nextSteps: ['step-2'] },
        { id: 'step-2', type: 'wait', config: {}, nextSteps: [] }
      ],
      status: 'active',
      metrics: {
        totalExecutions: 10,
        completedExecutions: 8,
        failedExecutions: 2,
        averageCompletionTime: 3600000
      },
      createdBy: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should return workflow analytics', async () => {
      const executions: WorkflowExecution[] = [
        {
          id: 'execution-1',
          workflowId: workflow.id,
          contactId: 'contact-1',
          status: 'completed',
          metadata: {},
          executionLog: [
            { stepId: 'step-1', timestamp: new Date(), status: 'started' },
            { stepId: 'step-1', timestamp: new Date(), status: 'completed' },
            { stepId: 'step-2', timestamp: new Date(), status: 'started' },
            { stepId: 'step-2', timestamp: new Date(), status: 'completed' }
          ],
          startedAt: new Date(Date.now() - 3600000),
          completedAt: new Date()
        },
        {
          id: 'execution-2',
          workflowId: workflow.id,
          contactId: 'contact-2',
          status: 'failed',
          metadata: {},
          executionLog: [
            { stepId: 'step-1', timestamp: new Date(), status: 'started' },
            { stepId: 'step-1', timestamp: new Date(), status: 'failed', error: 'Email error' }
          ],
          startedAt: new Date(Date.now() - 1800000)
        }
      ];

      mockWorkflowRepository.findById.mockResolvedValue(workflow);
      mockWorkflowRepository.findExecutionsByWorkflow.mockResolvedValue({
        data: executions,
        total: 2,
        page: 1,
        limit: 1000,
        totalPages: 1
      });

      const result = await workflowService.getWorkflowAnalytics(workflow.id);

      expect(result.workflow).toEqual(workflow);
      expect(result.metrics).toEqual(workflow.metrics);
      expect(result.executionHistory).toEqual(executions);
      expect(result.performanceData.completionRate).toBe(50); // 1 completed out of 2
      expect(result.performanceData.dropoffPoints).toHaveLength(2);
    });

    it('should throw error if workflow not found', async () => {
      mockWorkflowRepository.findById.mockResolvedValue(null);

      await expect(workflowService.getWorkflowAnalytics('non-existent'))
        .rejects.toThrow('Workflow non-existent not found');
    });
  });

  describe('deleteWorkflow', () => {
    it('should delete workflow if no active executions', async () => {
      mockWorkflowRepository.findExecutionsByWorkflow.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 1,
        totalPages: 0
      });
      mockWorkflowRepository.delete.mockResolvedValue(true);

      const result = await workflowService.deleteWorkflow('workflow-123');

      expect(result).toBe(true);
      expect(mockWorkflowRepository.delete).toHaveBeenCalledWith('workflow-123');
    });

    it('should throw error if workflow has active executions', async () => {
      const activeExecution: WorkflowExecution = {
        id: 'execution-123',
        workflowId: 'workflow-123',
        contactId: 'contact-123',
        status: 'running',
        metadata: {},
        executionLog: [],
        startedAt: new Date()
      };

      mockWorkflowRepository.findExecutionsByWorkflow.mockResolvedValue({
        data: [activeExecution],
        total: 1,
        page: 1,
        limit: 1,
        totalPages: 1
      });

      await expect(workflowService.deleteWorkflow('workflow-123'))
        .rejects.toThrow('Cannot delete workflow with active executions');
    });
  });
});
