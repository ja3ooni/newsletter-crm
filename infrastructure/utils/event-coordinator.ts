/**
 * Event-Driven Architecture Coordinator
 * Orchestrates inter-service communication, events, and workflows
 */

import { circuitBreakerManager } from './circuit-breaker';
import { logger } from './logger';
import { EventHandler, MessageBus, ServiceEvent, defaultMessageBusConfig } from './message-bus';
import { serviceDiscoveryClient } from './service-discovery';

export interface EventCoordinatorConfig {
  serviceName: string;
  messagebus: {
    url: string;
  };
  circuitBreaker: {
    enabled: boolean;
    defaultTimeout: number;
    defaultFailureThreshold: number;
  };
  events: {
    retryEnabled: boolean;
    maxRetries: number;
    deadLetterEnabled: boolean;
  };
}

export interface WorkflowTrigger {
  id: string;
  name: string;
  eventType: string;
  conditions: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  }>;
  actions: Array<{
    type: 'http_request' | 'publish_event' | 'delay' | 'condition';
    config: Record<string, any>;
  }>;
}

export class EventCoordinator {
  private messageBus: MessageBus;
  private config: EventCoordinatorConfig;
  private workflows: Map<string, WorkflowTrigger> = new Map();
  private eventHandlers: Map<string, EventHandler[]> = new Map();

  constructor(config: EventCoordinatorConfig) {
    this.config = config;
    this.messageBus = new MessageBus({
      ...defaultMessageBusConfig,
      url: config.messagebus.url,
      serviceName: config.serviceName,
    });

    this.setupMessageBusHandlers();
  }

  /**
   * Initialize the event coordinator
   */
  async initialize(): Promise<void> {
    try {
      await this.messageBus.connect();
      logger.info('Event coordinator initialized', {
        serviceName: this.config.serviceName,
      });
    } catch (error) {
      logger.error('Failed to initialize event coordinator:', error);
      throw error;
    }
  }

  /**
   * Publish an event to the message bus
   */
  async publishEvent(event: Omit<ServiceEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      await this.messageBus.publishEvent(event);

      // Check for workflow triggers
      await this.checkWorkflowTriggers(event);

    } catch (error) {
      logger.error('Failed to publish event:', error);
      throw error;
    }
  }

  /**
   * Subscribe to events
   */
  async subscribeToEvent(
    eventType: string,
    handler: (event: ServiceEvent) => Promise<void>,
    options?: {
      retry?: boolean;
      maxRetries?: number;
      deadLetterQueue?: boolean;
    }
  ): Promise<void> {
    const eventHandler: EventHandler = {
      eventType,
      handler: async (event: ServiceEvent) => {
        // Add circuit breaker protection if enabled
        if (this.config.circuitBreaker.enabled) {
          await circuitBreakerManager.execute(
            `event-handler-${eventType}`,
            () => handler(event),
            {
              timeout: this.config.circuitBreaker.defaultTimeout,
              failureThreshold: this.config.circuitBreaker.defaultFailureThreshold,
            }
          );
        } else {
          await handler(event);
        }
      },
      options: {
        retry: options?.retry ?? this.config.events.retryEnabled,
        maxRetries: options?.maxRetries ?? this.config.events.maxRetries,
        deadLetterQueue: options?.deadLetterQueue ?? this.config.events.deadLetterEnabled,
      },
    };

    // Store handler for management
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(eventHandler);

    await this.messageBus.subscribe(eventHandler);

    logger.info('Subscribed to event', {
      eventType,
      serviceName: this.config.serviceName,
    });
  }

  /**
   * Register a workflow trigger
   */
  registerWorkflowTrigger(trigger: WorkflowTrigger): void {
    this.workflows.set(trigger.id, trigger);

    logger.info('Workflow trigger registered', {
      triggerId: trigger.id,
      triggerName: trigger.name,
      eventType: trigger.eventType,
    });
  }

  /**
   * Unregister a workflow trigger
   */
  unregisterWorkflowTrigger(triggerId: string): boolean {
    const removed = this.workflows.delete(triggerId);

    if (removed) {
      logger.info('Workflow trigger unregistered', { triggerId });
    }

    return removed;
  }

  /**
   * Make HTTP request to another service with circuit breaker protection
   */
  async callService<T = any>(
    serviceName: string,
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      data?: any;
      headers?: Record<string, string>;
      timeout?: number;
      retries?: number;
      circuitBreaker?: boolean;
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      data,
      headers = {},
      timeout = 10000,
      retries = 3,
      circuitBreaker = this.config.circuitBreaker.enabled,
    } = options;

    const requestFn = () => serviceDiscoveryClient.request<T>(serviceName, path, {
      method,
      data,
      headers,
      timeout,
      retries,
    });

    if (circuitBreaker) {
      return await circuitBreakerManager.execute(
        `service-${serviceName}`,
        requestFn,
        {
          timeout: timeout,
          failureThreshold: this.config.circuitBreaker.defaultFailureThreshold,
        }
      );
    } else {
      return await requestFn();
    }
  }

  /**
   * Publish event and wait for response (request-response pattern)
   */
  async publishEventAndWaitForResponse<T = any>(
    event: Omit<ServiceEvent, 'id' | 'timestamp'>,
    responseEventType: string,
    timeout: number = 30000
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const correlationId = `${this.config.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Set up response handler
      const responseHandler = (responseEvent: ServiceEvent) => {
        if (responseEvent.correlationId === correlationId) {
          resolve(responseEvent.data as T);
        }
      };

      // Subscribe to response event
      await this.subscribeToEvent(responseEventType, responseHandler);

      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for response event: ${responseEventType}`));
      }, timeout);

      try {
        // Publish request event with correlation ID
        await this.publishEvent({
          ...event,
          correlationId,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Get event coordinator health status
   */
  getHealthStatus(): {
    messageBus: any;
    circuitBreakers: any;
    workflows: number;
    eventHandlers: number;
  } {
    return {
      messageBus: this.messageBus.getHealthStatus(),
      circuitBreakers: circuitBreakerManager.getHealthStatus(),
      workflows: this.workflows.size,
      eventHandlers: Array.from(this.eventHandlers.values()).reduce((sum, handlers) => sum + handlers.length, 0),
    };
  }

  /**
   * Shutdown the event coordinator
   */
  async shutdown(): Promise<void> {
    try {
      await this.messageBus.disconnect();
      circuitBreakerManager.destroy();

      logger.info('Event coordinator shutdown completed', {
        serviceName: this.config.serviceName,
      });
    } catch (error) {
      logger.error('Error during event coordinator shutdown:', error);
    }
  }

  /**
   * Setup message bus event handlers
   */
  private setupMessageBusHandlers(): void {
    this.messageBus.on('connected', () => {
      logger.info('Message bus connected');
    });

    this.messageBus.on('disconnected', () => {
      logger.warn('Message bus disconnected');
    });

    this.messageBus.on('error', (error) => {
      logger.error('Message bus error:', error);
    });

    this.messageBus.on('maxReconnectAttemptsReached', () => {
      logger.error('Message bus max reconnect attempts reached');
    });
  }

  /**
   * Check and execute workflow triggers
   */
  private async checkWorkflowTriggers(event: Omit<ServiceEvent, 'id' | 'timestamp'>): Promise<void> {
    for (const [triggerId, trigger] of this.workflows) {
      if (trigger.eventType === event.type) {
        try {
          const shouldTrigger = this.evaluateConditions(trigger.conditions, event.data);

          if (shouldTrigger) {
            logger.info('Workflow trigger activated', {
              triggerId,
              triggerName: trigger.name,
              eventType: event.type,
            });

            await this.executeWorkflowActions(trigger.actions, event);
          }
        } catch (error) {
          logger.error('Failed to execute workflow trigger:', error);
        }
      }
    }
  }

  /**
   * Evaluate trigger conditions
   */
  private evaluateConditions(
    conditions: WorkflowTrigger['conditions'],
    eventData: Record<string, any>
  ): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(eventData, condition.field);

      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        default:
          return false;
      }
    });
  }

  /**
   * Execute workflow actions
   */
  private async executeWorkflowActions(
    actions: WorkflowTrigger['actions'],
    originalEvent: Omit<ServiceEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'http_request':
            await this.executeHttpRequestAction(action.config, originalEvent);
            break;

          case 'publish_event':
            await this.executePublishEventAction(action.config, originalEvent);
            break;

          case 'delay':
            await this.executeDelayAction(action.config);
            break;

          case 'condition':
            await this.executeConditionAction(action.config, originalEvent);
            break;

          default:
            logger.warn('Unknown workflow action type', { actionType: action.type });
        }
      } catch (error) {
        logger.error('Failed to execute workflow action:', error);
      }
    }
  }

  /**
   * Execute HTTP request action
   */
  private async executeHttpRequestAction(
    config: Record<string, any>,
    originalEvent: Omit<ServiceEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    const { serviceName, path, method = 'POST', data } = config;

    await this.callService(serviceName, path, {
      method,
      data: data || originalEvent.data,
    });
  }

  /**
   * Execute publish event action
   */
  private async executePublishEventAction(
    config: Record<string, any>,
    originalEvent: Omit<ServiceEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    const { eventType, data } = config;

    await this.publishEvent({
      type: eventType,
      source: this.config.serviceName,
      data: data || originalEvent.data,
      correlationId: originalEvent.correlationId,
      userId: originalEvent.userId,
    });
  }

  /**
   * Execute delay action
   */
  private async executeDelayAction(config: Record<string, any>): Promise<void> {
    const { duration } = config;
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Execute condition action
   */
  private async executeConditionAction(
    config: Record<string, any>,
    originalEvent: Omit<ServiceEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    const { conditions, trueActions, falseActions } = config;

    const conditionMet = this.evaluateConditions(conditions, originalEvent.data);
    const actionsToExecute = conditionMet ? trueActions : falseActions;

    if (actionsToExecute) {
      await this.executeWorkflowActions(actionsToExecute, originalEvent);
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

/**
 * Create event coordinator instance
 */
export function createEventCoordinator(config: EventCoordinatorConfig): EventCoordinator {
  return new EventCoordinator(config);
}

/**
 * Default event coordinator configuration
 */
export const defaultEventCoordinatorConfig: Omit<EventCoordinatorConfig, 'serviceName' | 'messagebus'> = {
  circuitBreaker: {
    enabled: true,
    defaultTimeout: 10000,
    defaultFailureThreshold: 5,
  },
  events: {
    retryEnabled: true,
    maxRetries: 3,
    deadLetterEnabled: true,
  },
};
