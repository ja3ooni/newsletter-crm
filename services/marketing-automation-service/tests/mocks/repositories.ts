import { DripCampaignRepository } from '../../src/repositories/DripCampaignRepository';
import { EventRepository } from '../../src/repositories/EventRepository';
import { WorkflowRepository } from '../../src/repositories/WorkflowRepository';

export const createMockEventRepository = (): jest.Mocked<EventRepository> => {
  return {
    createEvent: jest.fn(),
    findEventById: jest.fn(),
    findEventsByContact: jest.fn(),
    findEventsByType: jest.fn(),
    findUnprocessedEvents: jest.fn(),
    markEventAsProcessed: jest.fn(),
    deleteOldEvents: jest.fn(),
    createEventTrigger: jest.fn(),
    findEventTriggerById: jest.fn(),
    findEventTriggersByType: jest.fn(),
    findAllEventTriggers: jest.fn(),
    updateEventTrigger: jest.fn(),
    deleteEventTrigger: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn()
  } as any;
};

export const createMockWorkflowRepository = (): jest.Mocked<WorkflowRepository> => {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createExecution: jest.fn(),
    findExecutionById: jest.fn(),
    findExecutionsByWorkflow: jest.fn(),
    updateExecution: jest.fn(),
    addExecutionLogEntry: jest.fn(),
    count: jest.fn()
  } as any;
};

export const createMockDripCampaignRepository = (): jest.Mocked<DripCampaignRepository> => {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createSubscription: jest.fn(),
    findSubscriptionById: jest.fn(),
    findSubscriptionsByCampaign: jest.fn(),
    updateSubscription: jest.fn(),
    findActiveSubscriptions: jest.fn(),
    count: jest.fn()
  } as any;
};

export const createMockQueueManager = () => ({
  addEventProcessing: jest.fn(),
  addWorkflowExecution: jest.fn(),
  addDelayedWorkflowStep: jest.fn(),
  addWebhook: jest.fn(),
  addDripEmail: jest.fn(),
  scheduleDripCampaign: jest.fn(),
  cancelDripSubscription: jest.fn(),
  pauseWorkflowExecution: jest.fn(),
  resumeWorkflowExecution: jest.fn()
});
