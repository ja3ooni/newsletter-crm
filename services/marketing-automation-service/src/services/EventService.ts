import { DripCampaignRepository } from '@/repositories/DripCampaignRepository';
import { EventRepository } from '@/repositories/EventRepository';
import { WorkflowRepository } from '@/repositories/WorkflowRepository';
import {
  AutomationEvent,
  EventTrigger,
  FilterParams,
  PaginatedResponse,
  PaginationParams,
  TriggerCondition,
} from '@/types';
import { logger } from '@/utils/logger';
import { queueManager } from '@/utils/queue';

export class EventService {
  private eventRepository: EventRepository;
  private workflowRepository: WorkflowRepository;
  private dripCampaignRepository: DripCampaignRepository;

  constructor() {
    this.eventRepository = new EventRepository();
    this.workflowRepository = new WorkflowRepository();
    this.dripCampaignRepository = new DripCampaignRepository();
  }

  // ============================================================================
  // EVENT CREATION AND PROCESSING
  // ============================================================================

  async createEvent(
    type: string,
    contactId: string,
    data: Record<string, any>,
    source: string = 'system'
  ): Promise<AutomationEvent> {
    try {
      const event = await this.eventRepository.createEvent(
        type,
        contactId,
        data,
        source
      );

      // Queue event for processing
      await queueManager.addEventProcessing({
        eventId: event.id,
        eventType: event.type,
        contactId: event.contactId,
        eventData: event.data,
      });

      logger.info('Event created and queued for processing', {
        eventId: event.id,
        type,
        contactId,
        source,
      });

      return event;
    } catch (error) {
      logger.error('Error creating event', {
        error,
        type,
        contactId,
        data,
        source,
      });
      throw error;
    }
  }

  async processEvent(eventId: string): Promise<void> {
    try {
      const event = await this.eventRepository.findEventById(eventId);

      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }

      if (event.processed) {
        logger.warn('Event already processed', { eventId });

        return;
      }

      // Find matching triggers for this event type
      const triggers = await this.eventRepository.findEventTriggersByType(
        event.type
      );

      logger.debug('Processing event', {
        eventId,
        eventType: event.type,
        triggersFound: triggers.length,
      });

      // Process each matching trigger
      for (const trigger of triggers) {
        try {
          await this.processTrigger(trigger, event);
        } catch (error) {
          logger.error('Error processing trigger', {
            error,
            triggerId: trigger.id,
            eventId: event.id,
          });
          // Continue processing other triggers even if one fails
        }
      }

      // Mark event as processed
      await this.eventRepository.markEventAsProcessed(eventId);

      logger.info('Event processed successfully', {
        eventId,
        eventType: event.type,
        triggersProcessed: triggers.length,
      });
    } catch (error) {
      logger.error('Error processing event', { error, eventId });
      throw error;
    }
  }

  async processUnprocessedEvents(batchSize: number = 100): Promise<number> {
    try {
      const events =
        await this.eventRepository.findUnprocessedEvents(batchSize);

      if (events.length === 0) {
        return 0;
      }

      logger.info('Processing batch of unprocessed events', {
        count: events.length,
      });

      let processedCount = 0;

      for (const event of events) {
        try {
          await this.processEvent(event.id);
          processedCount++;
        } catch (error) {
          logger.error('Error processing event in batch', {
            error,
            eventId: event.id,
            eventType: event.type,
          });
          // Continue processing other events
        }
      }

      logger.info('Batch processing completed', {
        totalEvents: events.length,
        processedCount,
        failedCount: events.length - processedCount,
      });

      return processedCount;
    } catch (error) {
      logger.error('Error processing unprocessed events', { error, batchSize });
      throw error;
    }
  }

  private async processTrigger(
    trigger: EventTrigger,
    event: AutomationEvent
  ): Promise<void> {
    // Evaluate trigger conditions
    const conditionsMet = await this.evaluateTriggerConditions(
      trigger.conditions,
      event
    );

    if (!conditionsMet) {
      logger.debug('Trigger conditions not met', {
        triggerId: trigger.id,
        eventId: event.id,
      });

      return;
    }

    logger.info('Trigger conditions met, executing action', {
      triggerId: trigger.id,
      triggerName: trigger.name,
      eventId: event.id,
      eventType: event.type,
    });

    // Execute trigger action
    if (trigger.workflowId) {
      await this.triggerWorkflow(trigger.workflowId, event);
    }

    if (trigger.campaignId) {
      await this.triggerDripCampaign(trigger.campaignId, event);
    }
  }

  private async evaluateTriggerConditions(
    conditions: TriggerCondition[],
    event: AutomationEvent
  ): Promise<boolean> {
    if (conditions.length === 0) {
      return true;
    }

    let result = true;
    let currentOperator = 'AND';

    for (const condition of conditions) {
      const conditionResult = this.evaluateSingleTriggerCondition(
        condition,
        event
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

  private evaluateSingleTriggerCondition(
    condition: TriggerCondition,
    event: AutomationEvent
  ): boolean {
    const fieldValue = this.getEventFieldValue(condition.field, event);

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

  private getEventFieldValue(field: string, event: AutomationEvent): any {
    if (field.startsWith('data.')) {
      const dataField = field.substring(5);

      return this.getNestedValue(event.data, dataField);
    }

    switch (field) {
      case 'type':
        return event.type;
      case 'contactId':
        return event.contactId;
      case 'source':
        return event.source;
      case 'timestamp':
        return event.timestamp;
      default:
        return event.data[field];
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async triggerWorkflow(
    workflowId: string,
    event: AutomationEvent
  ): Promise<void> {
    try {
      const workflow = await this.workflowRepository.findById(workflowId);

      if (!workflow) {
        logger.error('Workflow not found for trigger', {
          workflowId,
          eventId: event.id,
        });

        return;
      }

      if (workflow.status !== 'active') {
        logger.warn('Workflow is not active, skipping trigger', {
          workflowId,
          status: workflow.status,
          eventId: event.id,
        });

        return;
      }

      // Create workflow execution
      const execution = await this.workflowRepository.createExecution(
        workflowId,
        event.contactId,
        {
          triggeredBy: 'event',
          eventId: event.id,
          eventType: event.type,
          eventData: event.data,
        }
      );

      // Start workflow execution
      const firstSteps = this.findFirstSteps(workflow.steps);

      if (firstSteps.length === 0) {
        throw new Error('Workflow has no starting step');
      }

      // Queue first step for execution
      await queueManager.addWorkflowExecution({
        executionId: execution.id,
        workflowId: workflow.id,
        contactId: event.contactId,
        currentStep: firstSteps[0].id,
        metadata: execution.metadata,
      });

      logger.info('Workflow triggered by event', {
        workflowId,
        executionId: execution.id,
        eventId: event.id,
        contactId: event.contactId,
      });
    } catch (error) {
      logger.error('Error triggering workflow', {
        error,
        workflowId,
        eventId: event.id,
      });
      throw error;
    }
  }

  private async triggerDripCampaign(
    campaignId: string,
    event: AutomationEvent
  ): Promise<void> {
    try {
      const campaign = await this.dripCampaignRepository.findById(campaignId);

      if (!campaign) {
        logger.error('Drip campaign not found for trigger', {
          campaignId,
          eventId: event.id,
        });

        return;
      }

      if (campaign.status !== 'active') {
        logger.warn('Drip campaign is not active, skipping trigger', {
          campaignId,
          status: campaign.status,
          eventId: event.id,
        });

        return;
      }

      // Create campaign subscription
      const subscription = await this.dripCampaignRepository.createSubscription(
        campaignId,
        event.contactId,
        {
          triggeredBy: 'event',
          eventId: event.id,
          eventType: event.type,
          eventData: event.data,
        }
      );

      // Schedule first email
      await queueManager.scheduleDripCampaign(subscription, campaign);

      logger.info('Drip campaign triggered by event', {
        campaignId,
        subscriptionId: subscription.id,
        eventId: event.id,
        contactId: event.contactId,
      });
    } catch (error) {
      logger.error('Error triggering drip campaign', {
        error,
        campaignId,
        eventId: event.id,
      });
      throw error;
    }
  }

  private findFirstSteps(steps: any[]): any[] {
    const allNextSteps = steps.flatMap(step => step.nextSteps);

    return steps.filter(step => !allNextSteps.includes(step.id));
  }

  // ============================================================================
  // EVENT TRIGGER MANAGEMENT
  // ============================================================================

  async createEventTrigger(
    name: string,
    eventType: string,
    conditions: TriggerCondition[],
    workflowId?: string,
    campaignId?: string
  ): Promise<EventTrigger> {
    try {
      if (!workflowId && !campaignId) {
        throw new Error(
          'Event trigger must have either workflowId or campaignId'
        );
      }

      const trigger = await this.eventRepository.createEventTrigger(
        name,
        eventType,
        conditions,
        workflowId,
        campaignId
      );

      logger.info('Event trigger created', {
        triggerId: trigger.id,
        name,
        eventType,
        workflowId,
        campaignId,
      });

      return trigger;
    } catch (error) {
      logger.error('Error creating event trigger', {
        error,
        name,
        eventType,
        conditions,
        workflowId,
        campaignId,
      });
      throw error;
    }
  }

  async getEventTrigger(id: string): Promise<EventTrigger | null> {
    try {
      return await this.eventRepository.findEventTriggerById(id);
    } catch (error) {
      logger.error('Error getting event trigger', { error, id });
      throw error;
    }
  }

  async getEventTriggers(
    pagination: PaginationParams,
    filters?: FilterParams
  ): Promise<PaginatedResponse<EventTrigger>> {
    try {
      return await this.eventRepository.findAllEventTriggers(
        pagination,
        filters
      );
    } catch (error) {
      logger.error('Error getting event triggers', {
        error,
        pagination,
        filters,
      });
      throw error;
    }
  }

  async updateEventTrigger(
    id: string,
    updates: Partial<Pick<EventTrigger, 'name' | 'conditions' | 'isActive'>>
  ): Promise<EventTrigger | null> {
    try {
      const trigger = await this.eventRepository.updateEventTrigger(
        id,
        updates
      );

      if (trigger) {
        logger.info('Event trigger updated', { triggerId: id });
      }

      return trigger;
    } catch (error) {
      logger.error('Error updating event trigger', { error, id, updates });
      throw error;
    }
  }

  async deleteEventTrigger(id: string): Promise<boolean> {
    try {
      const deleted = await this.eventRepository.deleteEventTrigger(id);

      if (deleted) {
        logger.info('Event trigger deleted', { triggerId: id });
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting event trigger', { error, id });
      throw error;
    }
  }

  async activateEventTrigger(id: string): Promise<EventTrigger | null> {
    try {
      return await this.eventRepository.updateEventTrigger(id, {
        isActive: true,
      });
    } catch (error) {
      logger.error('Error activating event trigger', { error, id });
      throw error;
    }
  }

  async deactivateEventTrigger(id: string): Promise<EventTrigger | null> {
    try {
      return await this.eventRepository.updateEventTrigger(id, {
        isActive: false,
      });
    } catch (error) {
      logger.error('Error deactivating event trigger', { error, id });
      throw error;
    }
  }

  // ============================================================================
  // EVENT QUERYING AND ANALYTICS
  // ============================================================================

  async getEvent(id: string): Promise<AutomationEvent | null> {
    try {
      return await this.eventRepository.findEventById(id);
    } catch (error) {
      logger.error('Error getting event', { error, id });
      throw error;
    }
  }

  async getEventsByContact(
    contactId: string,
    pagination: PaginationParams,
    filters?: FilterParams
  ): Promise<PaginatedResponse<AutomationEvent>> {
    try {
      return await this.eventRepository.findEventsByContact(
        contactId,
        pagination,
        filters
      );
    } catch (error) {
      logger.error('Error getting events by contact', {
        error,
        contactId,
        pagination,
        filters,
      });
      throw error;
    }
  }

  async getEventsByType(
    eventType: string,
    pagination: PaginationParams,
    filters?: FilterParams
  ): Promise<PaginatedResponse<AutomationEvent>> {
    try {
      return await this.eventRepository.findEventsByType(
        eventType,
        pagination,
        filters
      );
    } catch (error) {
      logger.error('Error getting events by type', {
        error,
        eventType,
        pagination,
        filters,
      });
      throw error;
    }
  }

  async getEventStats(dateRange?: {
    start: Date;
    end: Date;
  }): Promise<Record<string, any>> {
    try {
      // This would typically involve more complex queries
      // For now, return basic stats structure
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsPerDay: [],
        processingStats: {
          processed: 0,
          pending: 0,
          failed: 0,
        },
      };
    } catch (error) {
      logger.error('Error getting event stats', { error, dateRange });
      throw error;
    }
  }

  // ============================================================================
  // MAINTENANCE AND CLEANUP
  // ============================================================================

  async cleanupOldEvents(olderThanDays: number = 90): Promise<number> {
    try {
      const deletedCount =
        await this.eventRepository.deleteOldEvents(olderThanDays);

      logger.info('Old events cleanup completed', {
        deletedCount,
        olderThanDays,
      });

      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old events', { error, olderThanDays });
      throw error;
    }
  }
}

export default EventService;
