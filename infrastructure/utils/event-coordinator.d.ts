/**
 * Event-Driven Architecture Coordinator
 * Orchestrates inter-service communication, events, and workflows
 */
import { ServiceEvent } from './message-bus';
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
export declare class EventCoordinator {
    private messageBus;
    private config;
    private workflows;
    private eventHandlers;
    constructor(config: EventCoordinatorConfig);
    /**
     * Initialize the event coordinator
     */
    initialize(): Promise<void>;
    /**
     * Publish an event to the message bus
     */
    publishEvent(event: Omit<ServiceEvent, 'id' | 'timestamp'>): Promise<void>;
    /**
     * Subscribe to events
     */
    subscribeToEvent(eventType: string, handler: (event: ServiceEvent) => Promise<void>, options?: {
        retry?: boolean;
        maxRetries?: number;
        deadLetterQueue?: boolean;
    }): Promise<void>;
    /**
     * Register a workflow trigger
     */
    registerWorkflowTrigger(trigger: WorkflowTrigger): void;
    /**
     * Unregister a workflow trigger
     */
    unregisterWorkflowTrigger(triggerId: string): boolean;
    /**
     * Make HTTP request to another service with circuit breaker protection
     */
    callService<T = any>(serviceName: string, path: string, options?: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
        data?: any;
        headers?: Record<string, string>;
        timeout?: number;
        retries?: number;
        circuitBreaker?: boolean;
    }): Promise<T>;
    /**
     * Publish event and wait for response (request-response pattern)
     */
    publishEventAndWaitForResponse<T = any>(event: Omit<ServiceEvent, 'id' | 'timestamp'>, responseEventType: string, timeout?: number): Promise<T>;
    /**
     * Get event coordinator health status
     */
    getHealthStatus(): {
        messageBus: any;
        circuitBreakers: any;
        workflows: number;
        eventHandlers: number;
    };
    /**
     * Shutdown the event coordinator
     */
    shutdown(): Promise<void>;
    /**
     * Setup message bus event handlers
     */
    private setupMessageBusHandlers;
    /**
     * Check and execute workflow triggers
     */
    private checkWorkflowTriggers;
    /**
     * Evaluate trigger conditions
     */
    private evaluateConditions;
    /**
     * Execute workflow actions
     */
    private executeWorkflowActions;
    /**
     * Execute HTTP request action
     */
    private executeHttpRequestAction;
    /**
     * Execute publish event action
     */
    private executePublishEventAction;
    /**
     * Execute delay action
     */
    private executeDelayAction;
    /**
     * Execute condition action
     */
    private executeConditionAction;
    /**
     * Get nested value from object
     */
    private getNestedValue;
}
/**
 * Create event coordinator instance
 */
export declare function createEventCoordinator(config: EventCoordinatorConfig): EventCoordinator;
/**
 * Default event coordinator configuration
 */
export declare const defaultEventCoordinatorConfig: Omit<EventCoordinatorConfig, 'serviceName' | 'messagebus'>;
//# sourceMappingURL=event-coordinator.d.ts.map