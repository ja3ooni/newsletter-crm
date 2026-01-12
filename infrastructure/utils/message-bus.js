"use strict";
/**
 * Inter-Service Message Bus
 * Provides event-driven communication between microservices
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultMessageBusConfig = exports.createMessageBus = exports.MessageBus = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
const events_1 = require("events");
const logger_1 = require("./logger");
class MessageBus extends events_1.EventEmitter {
    connection = null;
    channel = null;
    config;
    handlers = new Map();
    isConnected = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    constructor(config) {
        super();
        this.config = config;
    }
    /**
     * Connect to RabbitMQ
     */
    async connect() {
        try {
            logger_1.logger.info('Connecting to message bus...', { url: this.config.url });
            this.connection = await amqplib_1.default.connect(this.config.url);
            this.channel = await this.connection.createChannel();
            // Set up connection event handlers
            this.connection.on('error', this.handleConnectionError.bind(this));
            this.connection.on('close', this.handleConnectionClose.bind(this));
            // Set up channel event handlers
            this.channel.on('error', this.handleChannelError.bind(this));
            this.channel.on('close', this.handleChannelClose.bind(this));
            // Create exchanges
            await this.setupExchanges();
            // Set up dead letter queue
            await this.setupDeadLetterQueue();
            this.isConnected = true;
            this.reconnectAttempts = 0;
            logger_1.logger.info('Connected to message bus successfully');
            this.emit('connected');
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to message bus:', error);
            await this.handleReconnect();
            throw error;
        }
    }
    /**
     * Disconnect from RabbitMQ
     */
    async disconnect() {
        try {
            this.isConnected = false;
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
            logger_1.logger.info('Disconnected from message bus');
            this.emit('disconnected');
        }
        catch (error) {
            logger_1.logger.error('Error disconnecting from message bus:', error);
        }
    }
    /**
     * Publish an event to the message bus
     */
    async publishEvent(event) {
        if (!this.isConnected || !this.channel) {
            throw new Error('Message bus not connected');
        }
        const fullEvent = {
            ...event,
            id: this.generateEventId(),
            timestamp: new Date(),
        };
        try {
            const routingKey = `${event.source}.${event.type}`;
            const message = Buffer.from(JSON.stringify(fullEvent));
            const published = this.channel.publish(this.config.exchanges.events, routingKey, message, {
                persistent: true,
                messageId: fullEvent.id,
                timestamp: fullEvent.timestamp.getTime(),
                correlationId: fullEvent.correlationId,
                headers: {
                    source: fullEvent.source,
                    type: fullEvent.type,
                    userId: fullEvent.userId,
                },
            });
            if (!published) {
                throw new Error('Failed to publish event - channel buffer full');
            }
            logger_1.logger.info('Event published', {
                eventId: fullEvent.id,
                eventType: fullEvent.type,
                source: fullEvent.source,
                routingKey,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to publish event:', error);
            throw error;
        }
    }
    /**
     * Subscribe to events
     */
    async subscribe(eventHandler) {
        if (!this.isConnected || !this.channel) {
            throw new Error('Message bus not connected');
        }
        const { eventType, handler, options = {} } = eventHandler;
        // Store handler for reconnection
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }
        this.handlers.get(eventType).push(eventHandler);
        try {
            // Create queue for this service and event type
            const queueName = `${this.config.queues.prefix}.${this.config.serviceName}.${eventType}`;
            const queueOptions = {
                ...this.config.queues.options,
                arguments: {
                    'x-dead-letter-exchange': this.config.exchanges.deadLetter,
                    'x-dead-letter-routing-key': `${this.config.serviceName}.${eventType}.failed`,
                },
            };
            await this.channel.assertQueue(queueName, queueOptions);
            // Bind queue to exchange with routing pattern
            const routingPattern = `*.${eventType}`;
            await this.channel.bindQueue(queueName, this.config.exchanges.events, routingPattern);
            // Set up consumer
            await this.channel.consume(queueName, async (message) => {
                if (!message)
                    return;
                try {
                    const event = JSON.parse(message.content.toString());
                    logger_1.logger.info('Processing event', {
                        eventId: event.id,
                        eventType: event.type,
                        source: event.source,
                        queueName,
                    });
                    await handler(event);
                    // Acknowledge message
                    this.channel.ack(message);
                    logger_1.logger.info('Event processed successfully', {
                        eventId: event.id,
                        eventType: event.type,
                    });
                }
                catch (error) {
                    logger_1.logger.error('Failed to process event:', error);
                    // Handle retry logic
                    const retryCount = this.getRetryCount(message);
                    const maxRetries = options.maxRetries || this.config.retry.maxRetries;
                    if (options.retry !== false && retryCount < maxRetries) {
                        // Reject and requeue with delay
                        await this.retryMessage(message, retryCount);
                    }
                    else {
                        // Send to dead letter queue
                        this.channel.nack(message, false, false);
                        logger_1.logger.error('Event sent to dead letter queue', {
                            eventId: message.properties.messageId,
                            retryCount,
                            maxRetries,
                        });
                    }
                }
            });
            logger_1.logger.info('Subscribed to event', {
                eventType,
                queueName,
                routingPattern,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to subscribe to event:', error);
            throw error;
        }
    }
    /**
     * Unsubscribe from events
     */
    async unsubscribe(eventType) {
        if (!this.isConnected || !this.channel) {
            return;
        }
        try {
            const queueName = `${this.config.queues.prefix}.${this.config.serviceName}.${eventType}`;
            await this.channel.deleteQueue(queueName);
            // Remove handlers
            this.handlers.delete(eventType);
            logger_1.logger.info('Unsubscribed from event', { eventType, queueName });
        }
        catch (error) {
            logger_1.logger.error('Failed to unsubscribe from event:', error);
        }
    }
    /**
     * Get message bus health status
     */
    getHealthStatus() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            handlersCount: Array.from(this.handlers.values()).reduce((sum, handlers) => sum + handlers.length, 0),
        };
    }
    /**
     * Setup exchanges
     */
    async setupExchanges() {
        if (!this.channel)
            return;
        // Events exchange (topic)
        await this.channel.assertExchange(this.config.exchanges.events, 'topic', {
            durable: true,
        });
        // Dead letter exchange (direct)
        await this.channel.assertExchange(this.config.exchanges.deadLetter, 'direct', {
            durable: true,
        });
        logger_1.logger.info('Exchanges created', {
            events: this.config.exchanges.events,
            deadLetter: this.config.exchanges.deadLetter,
        });
    }
    /**
     * Setup dead letter queue
     */
    async setupDeadLetterQueue() {
        if (!this.channel)
            return;
        const dlqName = `${this.config.queues.prefix}.${this.config.serviceName}.dead-letter`;
        await this.channel.assertQueue(dlqName, {
            durable: true,
            exclusive: false,
            autoDelete: false,
        });
        await this.channel.bindQueue(dlqName, this.config.exchanges.deadLetter, `${this.config.serviceName}.*.failed`);
        logger_1.logger.info('Dead letter queue created', { queueName: dlqName });
    }
    /**
     * Handle connection errors
     */
    handleConnectionError(error) {
        logger_1.logger.error('Message bus connection error:', error);
        this.isConnected = false;
        this.emit('error', error);
    }
    /**
     * Handle connection close
     */
    handleConnectionClose() {
        logger_1.logger.warn('Message bus connection closed');
        this.isConnected = false;
        this.emit('disconnected');
        this.handleReconnect();
    }
    /**
     * Handle channel errors
     */
    handleChannelError(error) {
        logger_1.logger.error('Message bus channel error:', error);
        this.emit('error', error);
    }
    /**
     * Handle channel close
     */
    handleChannelClose() {
        logger_1.logger.warn('Message bus channel closed');
    }
    /**
     * Handle reconnection
     */
    async handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger_1.logger.error('Max reconnection attempts reached');
            this.emit('maxReconnectAttemptsReached');
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        logger_1.logger.info('Attempting to reconnect to message bus', {
            attempt: this.reconnectAttempts,
            delay,
        });
        setTimeout(async () => {
            try {
                await this.connect();
                // Re-subscribe to all handlers
                for (const [eventType, handlers] of this.handlers) {
                    for (const handler of handlers) {
                        await this.subscribe(handler);
                    }
                }
            }
            catch (error) {
                logger_1.logger.error('Reconnection failed:', error);
                this.handleReconnect();
            }
        }, delay);
    }
    /**
     * Get retry count from message
     */
    getRetryCount(message) {
        const headers = message.properties.headers || {};
        return headers['x-retry-count'] || 0;
    }
    /**
     * Retry message with exponential backoff
     */
    async retryMessage(message, retryCount) {
        if (!this.channel)
            return;
        const delay = this.config.retry.initialDelay * Math.pow(this.config.retry.backoffMultiplier, retryCount);
        // Create delayed retry queue
        const retryQueueName = `${message.fields.routingKey}.retry.${retryCount + 1}`;
        await this.channel.assertQueue(retryQueueName, {
            durable: true,
            exclusive: false,
            autoDelete: true,
            arguments: {
                'x-message-ttl': delay,
                'x-dead-letter-exchange': this.config.exchanges.events,
                'x-dead-letter-routing-key': message.fields.routingKey,
            },
        });
        // Publish to retry queue with updated retry count
        const retryMessage = Buffer.from(message.content);
        const headers = { ...message.properties.headers, 'x-retry-count': retryCount + 1 };
        this.channel.publish('', retryQueueName, retryMessage, {
            ...message.properties,
            headers,
        });
        // Acknowledge original message
        this.channel.ack(message);
        logger_1.logger.info('Message scheduled for retry', {
            messageId: message.properties.messageId,
            retryCount: retryCount + 1,
            delay,
        });
    }
    /**
     * Generate unique event ID
     */
    generateEventId() {
        return `${this.config.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.MessageBus = MessageBus;
/**
 * Create message bus instance
 */
function createMessageBus(config) {
    return new MessageBus(config);
}
exports.createMessageBus = createMessageBus;
/**
 * Default message bus configuration
 */
exports.defaultMessageBusConfig = {
    exchanges: {
        events: 'datatechtoncrm.events',
        deadLetter: 'datatechtoncrm.dead-letter',
    },
    queues: {
        prefix: 'datatechtoncrm.queue',
        options: {
            durable: true,
            exclusive: false,
            autoDelete: false,
        },
    },
    retry: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000,
    },
};
//# sourceMappingURL=message-bus.js.map