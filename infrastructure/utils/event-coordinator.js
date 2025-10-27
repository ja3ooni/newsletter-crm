"use strict";
/**
 * Event-Driven Architecture Coordinator
 * Orchestrates inter-service communication, events, and workflows
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultEventCoordinatorConfig = exports.createEventCoordinator = exports.EventCoordinator = void 0;
const circuit_breaker_1 = require("./circuit-breaker");
const logger_1 = require("./logger");
const message_bus_1 = require("./message-bus");
const service_discovery_1 = require("./service-discovery");
class EventCoordinator {
    messageBus;
    config;
    workflows = new Map();
    eventHandlers = new Map();
    constructor(config) {
        this.config = config;
        this.messageBus = new message_bus_1.MessageBus({
            ...message_bus_1.defaultMessageBusConfig,
            url: config.messagebus.url,
            serviceName: config.serviceName,
        });
        this.setupMessageBusHandlers();
    }
    /**
     * Initialize the event coordinator
     */
    async initialize() {
        try {
            await this.messageBus.connect();
            logger_1.logger.info('Event coordinator initialized', {
                serviceName: this.config.serviceName,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize event coordinator:', error);
            throw error;
        }
    }
    /**
     * Publish an event to the message bus
     */
    async publishEvent(event) {
        try {
            await this.messageBus.publishEvent(event);
            // Check for workflow triggers
            await this.checkWorkflowTriggers(event);
        }
        catch (error) {
            logger_1.logger.error('Failed to publish event:', error);
            throw error;
        }
    }
    /**
     * Subscribe to events
     */
    async subscribeToEvent(eventType, handler, options) {
        const eventHandler = {
            eventType,
            handler: async (event) => {
                // Add circuit breaker protection if enabled
                if (this.config.circuitBreaker.enabled) {
                    await circuit_breaker_1.circuitBreakerManager.execute(`event-handler-${eventType}`, () => handler(event), {
                        timeout: this.config.circuitBreaker.defaultTimeout,
                        failureThreshold: this.config.circuitBreaker.defaultFailureThreshold,
                    });
                }
                else {
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
        this.eventHandlers.get(eventType).push(eventHandler);
        await this.messageBus.subscribe(eventHandler);
        logger_1.logger.info('Subscribed to event', {
            eventType,
            serviceName: this.config.serviceName,
        });
    }
    /**
     * Register a workflow trigger
     */
    registerWorkflowTrigger(trigger) {
        this.workflows.set(trigger.id, trigger);
        logger_1.logger.info('Workflow trigger registered', {
            triggerId: trigger.id,
            triggerName: trigger.name,
            eventType: trigger.eventType,
        });
    }
    /**
     * Unregister a workflow trigger
     */
    unregisterWorkflowTrigger(triggerId) {
        const removed = this.workflows.delete(triggerId);
        if (removed) {
            logger_1.logger.info('Workflow trigger unregistered', { triggerId });
        }
        return removed;
    }
    /**
     * Make HTTP request to another service with circuit breaker protection
     */
    async callService(serviceName, path, options = {}) {
        const { method = 'GET', data, headers = {}, timeout = 10000, retries = 3, circuitBreaker = this.config.circuitBreaker.enabled, } = options;
        const requestFn = () => service_discovery_1.serviceDiscoveryClient.request(serviceName, path, {
            method,
            data,
            headers,
            timeout,
            retries,
        });
        if (circuitBreaker) {
            return await circuit_breaker_1.circuitBreakerManager.execute(`service-${serviceName}`, requestFn, {
                timeout: timeout,
                failureThreshold: this.config.circuitBreaker.defaultFailureThreshold,
            });
        }
        else {
            return await requestFn();
        }
    }
    /**
     * Publish event and wait for response (request-response pattern)
     */
    async publishEventAndWaitForResponse(event, responseEventType, timeout = 30000) {
        return new Promise(async (resolve, reject) => {
            const correlationId = `${this.config.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            // Set up response handler
            const responseHandler = (responseEvent) => {
                if (responseEvent.correlationId === correlationId) {
                    resolve(responseEvent.data);
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
            }
            catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }
    /**
     * Get event coordinator health status
     */
    getHealthStatus() {
        return {
            messageBus: this.messageBus.getHealthStatus(),
            circuitBreakers: circuit_breaker_1.circuitBreakerManager.getHealthStatus(),
            workflows: this.workflows.size,
            eventHandlers: Array.from(this.eventHandlers.values()).reduce((sum, handlers) => sum + handlers.length, 0),
        };
    }
    /**
     * Shutdown the event coordinator
     */
    async shutdown() {
        try {
            await this.messageBus.disconnect();
            circuit_breaker_1.circuitBreakerManager.destroy();
            logger_1.logger.info('Event coordinator shutdown completed', {
                serviceName: this.config.serviceName,
            });
        }
        catch (error) {
            logger_1.logger.error('Error during event coordinator shutdown:', error);
        }
    }
    /**
     * Setup message bus event handlers
     */
    setupMessageBusHandlers() {
        this.messageBus.on('connected', () => {
            logger_1.logger.info('Message bus connected');
        });
        this.messageBus.on('disconnected', () => {
            logger_1.logger.warn('Message bus disconnected');
        });
        this.messageBus.on('error', (error) => {
            logger_1.logger.error('Message bus error:', error);
        });
        this.messageBus.on('maxReconnectAttemptsReached', () => {
            logger_1.logger.error('Message bus max reconnect attempts reached');
        });
    }
    /**
     * Check and execute workflow triggers
     */
    async checkWorkflowTriggers(event) {
        for (const [triggerId, trigger] of this.workflows) {
            if (trigger.eventType === event.type) {
                try {
                    const shouldTrigger = this.evaluateConditions(trigger.conditions, event.data);
                    if (shouldTrigger) {
                        logger_1.logger.info('Workflow trigger activated', {
                            triggerId,
                            triggerName: trigger.name,
                            eventType: event.type,
                        });
                        await this.executeWorkflowActions(trigger.actions, event);
                    }
                }
                catch (error) {
                    logger_1.logger.error('Failed to execute workflow trigger:', error);
                }
            }
        }
    }
    /**
     * Evaluate trigger conditions
     */
    evaluateConditions(conditions, eventData) {
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
    async executeWorkflowActions(actions, originalEvent) {
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
                        logger_1.logger.warn('Unknown workflow action type', { actionType: action.type });
                }
            }
            catch (error) {
                logger_1.logger.error('Failed to execute workflow action:', error);
            }
        }
    }
    /**
     * Execute HTTP request action
     */
    async executeHttpRequestAction(config, originalEvent) {
        const { serviceName, path, method = 'POST', data } = config;
        await this.callService(serviceName, path, {
            method,
            data: data || originalEvent.data,
        });
    }
    /**
     * Execute publish event action
     */
    async executePublishEventAction(config, originalEvent) {
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
    async executeDelayAction(config) {
        const { duration } = config;
        await new Promise(resolve => setTimeout(resolve, duration));
    }
    /**
     * Execute condition action
     */
    async executeConditionAction(config, originalEvent) {
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
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
}
exports.EventCoordinator = EventCoordinator;
/**
 * Create event coordinator instance
 */
function createEventCoordinator(config) {
    return new EventCoordinator(config);
}
exports.createEventCoordinator = createEventCoordinator;
/**
 * Default event coordinator configuration
 */
exports.defaultEventCoordinatorConfig = {
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
//# sourceMappingURL=event-coordinator.js.map