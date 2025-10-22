import { EventService } from '../../src/services/EventService';
import { AutomationEvent, EventTrigger, PaginationParams, TriggerCondition } from '../../src/types';
import {
    mockAutomationEvent
} from '../fixtures/testData';
import {
    createMockDripCampaignRepository,
    createMockEventRepository,
    createMockQueueManager,
    createMockWorkflowRepository
} from '../mocks/repositories';

// Mock dependencies
jest.mock('../../src/repositories/EventRepository');
jest.mock('../../src/repositories/WorkflowRepository');
jest.mock('../../src/repositories/DripCampaignRepository');
jest.mock('../../src/utils/queue');
jest.mock('../../src/utils/logger');

describe('EventService', () => {
  let eventService: EventService;
  let mockEventRepository: any;
  let mockWorkflowRepository: any;
  let mockDripCampaignRepository: any;
  let mockQueueManager: any;

  beforeEach(() => {
    mockEventRepository = createMockEventRepository();
    mockWorkflowRepository = createMockWorkflowRepository();
    mockDripCampaignRepository = createMockDripCampaignRepository();
    mockQueueManager = createMockQueueManager();

    // Mock the constructor dependencies
    require('../../src/repositories/EventRepository').EventRepository.mockImplementation(() => mockEventRepository);
    require('../../src/repositories/WorkflowRepository').WorkflowRepository.mockImplementation(() => mockWorkflowRepository);
    require('../../src/repositories/DripCampaignRepository').DripCampaignRepository.mockImplementation(() => mockDripCampaignRepository);
    require('../../src/utils/queue').queueManager = mockQueueManager;

    eventService = new EventService();
    jest.clearAllMocks();
  });

  describe('createEvent', () => {
    const eventData = {
      type: 'user_signup',
      contactId: 'contact-123',
      data: { source: 'website', plan: 'premium' },
      source: 'user-service'
    };

    it('should create event and queue for processing', async () => {
      mockEventRepository.createEvent.mockResolvedValue(mockAutomationEvent);
      mockQueueManager.addEventProcessing.mockResolvedValue(undefined);

      const result = await eventService.createEvent(
        eventData.type,
        eventData.contactId,
        eventData.data,
        eventData.source
      );

      expect(result).toEqual(mockAutomationEvent);
      expect(mockEventRepository.createEvent).toHaveBeenCalledWith(
        eventData.type,
        eventData.contactId,
        eventData.data,
        eventData.source
      );
      expect(mockQueueManager.addEventProcessing).toHaveBeenCalledWith({
        eventId: mockAutomationEvent.id,
        eventType: mockAutomationEvent.type,
        contactId: mockAutomationEvent.contactId,
        eventData: mockAutomationEvent.data
      });
    });

    it('should handle repository errors gracefully', async () => {
      mockEventRepository.createEvent.mockRejectedValue(new Error('Database connection failed'));

      await expect(eventService.createEvent(
        eventData.type,
        eventData.contactId,
        eventData.data,
        eventData.source
      )).rejects.toThrow('Database connection failed');

      expect(mockQueueManager.addEventProcessing).not.toHaveBeenCalled();
    });

    it('should use default source when not provided', async () => {
      mockEventRepository.createEvent.mockResolvedValue(mockAutomationEvent);
      mockQueueManager.addEventProcessing.mockResolvedValue(undefined);

      await eventService.createEvent(
        eventData.type,
        eventData.contactId,
        eventData.data
      );

      expect(mockEventRepository.createEvent).toHaveBeenCalledWith(
        eventData.type,
        eventData.contactId,
        eventData.data,
        'system'
      );
    });

    it('should handle queue manager errors', async () => {
      mockEventRepository.createEvent.mockResolvedValue(mockAutomationEvent);
      mockQueueManager.addEventProcessing.mockRejectedValue(new Error('Queue service unavailable'));

      await expect(eventService.createEvent(
        eventData.type,
        eventData.contactId,
        eventData.data,
        eventData.source
      )).rejects.toThrow('Queue service unavailable');
    });
  });

  describe('processEvent', () => {
    const event: AutomationEvent = {
      id: 'event-123',
      type: 'user_signup',
      contactId: 'contact-123',
      data: { source: 'website' },
      source: 'user-service',
      processed: false,
      processedAt: null,
      timestamp: new Date()
    };

    const trigger: EventTrigger = {
      id: 'trigger-123',
      name: 'Welcome Workflow',
      eventType: 'user_signup',
      conditions: [],
      workflowId: 'workflow-123',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should process event and trigger matching workflows', async () => {
      const workflow = {
        id: 'workflow-123',
        name: 'Welcome Workflow',
        status: 'active',
        steps: [{ id: 'step-1', type: 'email', nextSteps: [] }]
      };

      const execution = {
        id: 'execution-123',
        workflowId: workflow.id,
        contactId: event.contactId,
        status: 'running',
        metadata: {}
      };

      mockEventRepository.findEventById.mockResolvedValue(event);
      mockEventRepository.findEventTriggersByType.mockResolvedValue([trigger]);
      mockEventRepository.markEventAsProcessed.mockResolvedValue(undefined);
      mockWorkflowRepository.findById.mockResolvedValue(workflow);
      mockWorkflowRepository.createExecution.mockResolvedValue(execution);
      mockQueueManager.addWorkflowExecution.mockResolvedValue(undefined);

      await eventService.processEvent(event.id);

      expect(mockEventRepository.findEventById).toHaveBeenCalledWith(event.id);
      expect(mockEventRepository.findEventTriggersByType).toHaveBeenCalledWith(event.type);
      expect(mockWorkflowRepository.createExecution).toHaveBeenCalled();
      expect(mockQueueManager.addWorkflowExecution).toHaveBeenCalled();
      expect(mockEventRepository.markEventAsProcessed).toHaveBeenCalledWith(event.id);
    });

    it('should skip processing if event already processed', async () => {
      const processedEvent = { ...event, processed: true };
      mockEventRepository.findEventById.mockResolvedValue(processedEvent);

      await eventService.processEvent(event.id);

      expect(mockEventRepository.findEventTriggersByType).not.toHaveBeenCalled();
      expect(mockEventRepository.markEventAsProcessed).not.toHaveBeenCalled();
    });

    it('should throw error if event not found', async () => {
      mockEventRepository.findEventById.mockResolvedValue(null);

      await expect(eventService.processEvent('non-existent'))
        .rejects.toThrow('Event non-existent not found');
    });

    it('should continue processing other triggers if one fails', async () => {
      const trigger2: EventTrigger = {
        ...trigger,
        id: 'trigger-456',
        campaignId: 'campaign-123'
      };

      mockEventRepository.findEventById.mockResolvedValue(event);
      mockEventRepository.findEventTriggersByType.mockResolvedValue([trigger, trigger2]);
      mockEventRepository.markEventAsProcessed.mockResolvedValue(undefined);

      // First trigger fails
      mockWorkflowRepository.findById.mockRejectedValueOnce(new Error('Workflow error'));

      // Second trigger succeeds
      const campaign = { id: 'campaign-123', status: 'active' };
      const subscription = { id: 'sub-123' };
      mockDripCampaignRepository.findById.mockResolvedValue(campaign);
      mockDripCampaignRepository.createSubscription.mockResolvedValue(subscription);
      mockQueueManager.scheduleDripCampaign.mockResolvedValue(undefined);

      await eventService.processEvent(event.id);

      expect(mockEventRepository.markEventAsProcessed).toHaveBeenCalledWith(event.id);
    });
  });

  describe('createEventTrigger', () => {
    const triggerData = {
      name: 'Welcome Trigger',
      eventType: 'user_signup',
      conditions: [] as TriggerCondition[],
      workflowId: 'workflow-123'
    };

    it('should create event trigger successfully', async () => {
      const expectedTrigger: EventTrigger = {
        id: 'trigger-123',
        name: triggerData.name,
        eventType: triggerData.eventType,
        conditions: triggerData.conditions,
        workflowId: triggerData.workflowId,
        isActive: true
      };

      mockEventRepository.createEventTrigger.mockResolvedValue(expectedTrigger);

      const result = await eventService.createEventTrigger(
        triggerData.name,
        triggerData.eventType,
        triggerData.conditions,
        triggerData.workflowId
      );

      expect(result).toEqual(expectedTrigger);
      expect(mockEventRepository.createEventTrigger).toHaveBeenCalledWith(
        triggerData.name,
        triggerData.eventType,
        triggerData.conditions,
        triggerData.workflowId,
        undefined
      );
    });

    it('should throw error if neither workflowId nor campaignId provided', async () => {
      await expect(eventService.createEventTrigger(
        triggerData.name,
        triggerData.eventType,
        triggerData.conditions
      )).rejects.toThrow('Event trigger must have either workflowId or campaignId');
    });
  });

  describe('processUnprocessedEvents', () => {
    it('should process batch of unprocessed events', async () => {
      const unprocessedEvents: AutomationEvent[] = [
        {
          id: 'event-1',
          type: 'user_signup',
          contactId: 'contact-1',
          data: {},
          source: 'system',
          processed: false,
          timestamp: new Date()
        },
        {
          id: 'event-2',
          type: 'email_open',
          contactId: 'contact-2',
          data: {},
          source: 'system',
          processed: false,
          timestamp: new Date()
        }
      ];

      mockEventRepository.findUnprocessedEvents.mockResolvedValue(unprocessedEvents);
      mockEventRepository.findEventById
        .mockResolvedValueOnce(unprocessedEvents[0])
        .mockResolvedValueOnce(unprocessedEvents[1]);
      mockEventRepository.findEventTriggersByType.mockResolvedValue([]);
      mockEventRepository.markEventAsProcessed.mockResolvedValue(undefined);

      const result = await eventService.processUnprocessedEvents(10);

      expect(result).toBe(2);
      expect(mockEventRepository.findUnprocessedEvents).toHaveBeenCalledWith(10);
      expect(mockEventRepository.markEventAsProcessed).toHaveBeenCalledTimes(2);
    });

    it('should return 0 if no unprocessed events', async () => {
      mockEventRepository.findUnprocessedEvents.mockResolvedValue([]);

      const result = await eventService.processUnprocessedEvents();

      expect(result).toBe(0);
    });

    it('should continue processing even if some events fail', async () => {
      const unprocessedEvents: AutomationEvent[] = [
        {
          id: 'event-1',
          type: 'user_signup',
          contactId: 'contact-1',
          data: {},
          source: 'system',
          processed: false,
          timestamp: new Date()
        },
        {
          id: 'event-2',
          type: 'email_open',
          contactId: 'contact-2',
          data: {},
          source: 'system',
          processed: false,
          timestamp: new Date()
        }
      ];

      mockEventRepository.findUnprocessedEvents.mockResolvedValue(unprocessedEvents);
      mockEventRepository.findEventById
        .mockRejectedValueOnce(new Error('Event 1 error'))
        .mockResolvedValueOnce(unprocessedEvents[1]);
      mockEventRepository.findEventTriggersByType.mockResolvedValue([]);
      mockEventRepository.markEventAsProcessed.mockResolvedValue(undefined);

      const result = await eventService.processUnprocessedEvents();

      expect(result).toBe(1); // Only one event processed successfully
    });
  });

  describe('evaluateTriggerConditions', () => {
    const event: AutomationEvent = {
      id: 'event-123',
      type: 'user_signup',
      contactId: 'contact-123',
      data: { plan: 'premium', source: 'website' },
      source: 'user-service',
      processed: false,
      timestamp: new Date()
    };

    it('should return true for empty conditions', async () => {
      const conditions: TriggerCondition[] = [];

      const result = await (eventService as any).evaluateTriggerConditions(conditions, event);

      expect(result).toBe(true);
    });

    it('should evaluate single condition correctly', async () => {
      const conditions: TriggerCondition[] = [
        {
          field: 'data.plan',
          operator: 'equals',
          value: 'premium'
        }
      ];

      const result = await (eventService as any).evaluateTriggerConditions(conditions, event);

      expect(result).toBe(true);
    });

    it('should evaluate multiple conditions with AND logic', async () => {
      const conditions: TriggerCondition[] = [
        {
          field: 'data.plan',
          operator: 'equals',
          value: 'premium'
        },
        {
          field: 'data.source',
          operator: 'equals',
          value: 'website',
          logicalOperator: 'AND'
        }
      ];

      const result = await (eventService as any).evaluateTriggerConditions(conditions, event);

      expect(result).toBe(true);
    });

    it('should evaluate multiple conditions with OR logic', async () => {
      const conditions: TriggerCondition[] = [
        {
          field: 'data.plan',
          operator: 'equals',
          value: 'basic'
        },
        {
          field: 'data.source',
          operator: 'equals',
          value: 'website',
          logicalOperator: 'OR'
        }
      ];

      const result = await (eventService as any).evaluateTriggerConditions(conditions, event);

      expect(result).toBe(true); // Second condition is true
    });

    it('should handle different operators correctly', async () => {
      const testCases = [
        {
          condition: { field: 'data.plan', operator: 'contains', value: 'prem' },
          expected: true
        },
        {
          condition: { field: 'data.plan', operator: 'in', value: ['premium', 'enterprise'] },
          expected: true
        },
        {
          condition: { field: 'data.plan', operator: 'not_in', value: ['basic', 'free'] },
          expected: true
        }
      ];

      for (const testCase of testCases) {
        const result = await (eventService as any).evaluateTriggerConditions([testCase.condition], event);
        expect(result).toBe(testCase.expected);
      }
    });
  });

  describe('getEventsByContact', () => {
    it('should return paginated events for contact', async () => {
      const contactId = 'contact-123';
      const pagination: PaginationParams = { page: 1, limit: 10 };
      const expectedResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0
      };

      mockEventRepository.findEventsByContact.mockResolvedValue(expectedResponse);

      const result = await eventService.getEventsByContact(contactId, pagination);

      expect(result).toEqual(expectedResponse);
      expect(mockEventRepository.findEventsByContact).toHaveBeenCalledWith(
        contactId,
        pagination,
        undefined
      );
    });
  });

  describe('cleanupOldEvents', () => {
    it('should delete old events and return count', async () => {
      const deletedCount = 150;
      mockEventRepository.deleteOldEvents.mockResolvedValue(deletedCount);

      const result = await eventService.cleanupOldEvents(90);

      expect(result).toBe(deletedCount);
      expect(mockEventRepository.deleteOldEvents).toHaveBeenCalledWith(90);
    });

    it('should use default retention period if not specified', async () => {
      mockEventRepository.deleteOldEvents.mockResolvedValue(0);

      await eventService.cleanupOldEvents();

      expect(mockEventRepository.deleteOldEvents).toHaveBeenCalledWith(90);
    });
  });

  describe('getEvent', () => {
    it('should return event when found', async () => {
      const eventId = 'event-123';
      const event: AutomationEvent = {
        id: eventId,
        type: 'user_signup',
        contactId: 'contact-123',
        data: { source: 'website' },
        source: 'user-service',
        processed: false,
        timestamp: new Date()
      };

      mockEventRepository.findEventById.mockResolvedValue(event);

      const result = await eventService.getEvent(eventId);

      expect(result).toEqual(event);
      expect(mockEventRepository.findEventById).toHaveBeenCalledWith(eventId);
    });

    it('should return null when event not found', async () => {
      const eventId = 'non-existent';
      mockEventRepository.findEventById.mockResolvedValue(null);

      const result = await eventService.getEvent(eventId);

      expect(result).toBeNull();
    });
  });

  describe('getEventTrigger', () => {
    it('should return event trigger when found', async () => {
      const triggerId = 'trigger-123';
      const trigger: EventTrigger = {
        id: triggerId,
        name: 'Test Trigger',
        eventType: 'user_signup',
        conditions: [],
        workflowId: 'workflow-123',
        isActive: true
      };

      mockEventRepository.findEventTriggerById.mockResolvedValue(trigger);

      const result = await eventService.getEventTrigger(triggerId);

      expect(result).toEqual(trigger);
      expect(mockEventRepository.findEventTriggerById).toHaveBeenCalledWith(triggerId);
    });
  });

  describe('activateEventTrigger', () => {
    it('should activate event trigger', async () => {
      const triggerId = 'trigger-123';
      const activatedTrigger: EventTrigger = {
        id: triggerId,
        name: 'Test Trigger',
        eventType: 'user_signup',
        conditions: [],
        workflowId: 'workflow-123',
        isActive: true
      };

      mockEventRepository.updateEventTrigger.mockResolvedValue(activatedTrigger);

      const result = await eventService.activateEventTrigger(triggerId);

      expect(result).toEqual(activatedTrigger);
      expect(mockEventRepository.updateEventTrigger).toHaveBeenCalledWith(triggerId, { isActive: true });
    });
  });

  describe('deactivateEventTrigger', () => {
    it('should deactivate event trigger', async () => {
      const triggerId = 'trigger-123';
      const deactivatedTrigger: EventTrigger = {
        id: triggerId,
        name: 'Test Trigger',
        eventType: 'user_signup',
        conditions: [],
        workflowId: 'workflow-123',
        isActive: false
      };

      mockEventRepository.updateEventTrigger.mockResolvedValue(deactivatedTrigger);

      const result = await eventService.deactivateEventTrigger(triggerId);

      expect(result).toEqual(deactivatedTrigger);
      expect(mockEventRepository.updateEventTrigger).toHaveBeenCalledWith(triggerId, { isActive: false });
    });
  });
});
