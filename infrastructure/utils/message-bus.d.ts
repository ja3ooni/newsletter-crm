/**
 * Inter-Service Message Bus
 * Provides event-driven communication between microservices
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
export interface ServiceEvent {
    id: string;
    type: string;
    source: string;
    timestamp: Date;
    data: Record<string, any>;
    correlationId?: string;
    userId?: string;
    metadata?: Record<string, any>;
}
export interface EventHandler {
    eventType: string;
    handler: (event: ServiceEvent) => Promise<void>;
    options?: {
        retry?: boolean;
        maxRetries?: number;
        deadLetterQueue?: boolean;
    };
}
export interface MessageBusConfig {
    url: string;
    serviceName: string;
    exchanges: {
        events: string;
        deadLetter: string;
    };
    queues: {
        prefix: string;
        options: {
            durable: boolean;
            exclusive: boolean;
            autoDelete: boolean;
        };
    };
    retry: {
        maxRetries: number;
        backoffMultiplier: number;
        initialDelay: number;
    };
}
export declare class MessageBus extends EventEmitter {
    private connection;
    private channel;
    private config;
    private handlers;
    private isConnected;
    private reconnectAttempts;
    private maxReconnectAttempts;
    constructor(config: MessageBusConfig);
    /**
     * Connect to RabbitMQ
     */
    connect(): Promise<void>;
    /**
     * Disconnect from RabbitMQ
     */
    disconnect(): Promise<void>;
    /**
     * Publish an event to the message bus
     */
    publishEvent(event: Omit<ServiceEvent, 'id' | 'timestamp'>): Promise<void>;
    /**
     * Subscribe to events
     */
    subscribe(eventHandler: EventHandler): Promise<void>;
    /**
     * Unsubscribe from events
     */
    unsubscribe(eventType: string): Promise<void>;
    /**
     * Get message bus health status
     */
    getHealthStatus(): {
        connected: boolean;
        reconnectAttempts: number;
        handlersCount: number;
    };
    /**
     * Setup exchanges
     */
    private setupExchanges;
    /**
     * Setup dead letter queue
     */
    private setupDeadLetterQueue;
    /**
     * Handle connection errors
     */
    private handleConnectionError;
    /**
     * Handle connection close
     */
    private handleConnectionClose;
    /**
     * Handle channel errors
     */
    private handleChannelError;
    /**
     * Handle channel close
     */
    private handleChannelClose;
    /**
     * Handle reconnection
     */
    private handleReconnect;
    /**
     * Get retry count from message
     */
    private getRetryCount;
    /**
     * Retry message with exponential backoff
     */
    private retryMessage;
    /**
     * Generate unique event ID
     */
    private generateEventId;
}
/**
 * Create message bus instance
 */
export declare function createMessageBus(config: MessageBusConfig): MessageBus;
/**
 * Default message bus configuration
 */
export declare const defaultMessageBusConfig: Omit<MessageBusConfig, 'url' | 'serviceName'>;
//# sourceMappingURL=message-bus.d.ts.map