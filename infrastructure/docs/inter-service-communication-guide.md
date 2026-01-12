# Inter-Service Communication Guide

This guide explains how to use the inter-service communication system implemented for the DatatechtonCRM platform.

## Overview

The inter-service communication system provides:

- **Event-driven architecture** with RabbitMQ message bus
- **Circuit breaker pattern** for fault tolerance
- **Service discovery** and health checking
- **Automatic retry mechanisms** with exponential backoff
- **Dead letter queues** for failed messages
- **Workflow triggers** for complex automation

## Architecture Components

### 1. Message Bus (`infrastructure/utils/message-bus.ts`)

Handles asynchronous event publishing and subscription between services.

```typescript
import { MessageBus, createMessageBus } from '../infrastructure/utils/message-bus';

const messageBus = createMessageBus({
  url: 'amqp://user:pass@rabbitmq:5672',
  serviceName: 'my-service',
  exchanges: {
    events: 'datatechtoncrm.events',
    deadLetter: 'datatechtoncrm.dead-letter',
  },
  // ... other config
});

// Publish event
await messageBus.publishEvent({
  type: 'user.registered',
  source: 'user-service',
  data: { userId: '123', email: 'user@example.com' },
});

// Subscribe to events
await messageBus.subscribe({
  eventType: 'user.registered',
  handler: async (event) => {
    console.log('User registered:', event.data);
  },
});
```

### 2. Circuit Breaker (`infrastructure/utils/circuit-breaker.ts`)

Provides fault tolerance for service-to-service HTTP calls.

```typescript
import { circuitBreakerManager } from '../infrastructure/utils/circuit-breaker';

// Execute with circuit breaker protection
const result = await circuitBreakerManager.execute(
  'user-service',
  () => axios.get('http://user-service/api/users/123')
);

// Or use decorator
class MyService {
  @withCircuitBreaker('external-api')
  async callExternalAPI() {
    return await axios.get('http://external-api/data');
  }
}
```

### 3. Service Discovery (`infrastructure/utils/service-discovery.ts`)

Manages service registration, discovery, and health checking.

```typescript
import { initializeServiceDiscovery, serviceDiscoveryClient } from '../infrastructure/utils/service-discovery';

// Register service
const instance = initializeServiceDiscovery({
  serviceName: 'my-service',
  version: '1.0.0',
  host: 'localhost',
  port: 3001,
  protocol: 'http',
  healthCheckPath: '/health',
  healthCheckInterval: 30000,
  healthCheckTimeout: 5000,
  unhealthyThreshold: 3,
});

// Make requests to other services
const userData = await serviceDiscoveryClient.request(
  'user-service',
  '/api/users/123',
  { method: 'GET' }
);
```

### 4. Event Coordinator (`infrastructure/utils/event-coordinator.ts`)

High-level orchestration of events, workflows, and service communication.

```typescript
import { createEventCoordinator } from '../infrastructure/utils/event-coordinator';

const coordinator = createEventCoordinator({
  serviceName: 'my-service',
  messagebus: { url: 'amqp://rabbitmq:5672' },
  circuitBreaker: { enabled: true },
  events: { retryEnabled: true, maxRetries: 3 },
});

await coordinator.initialize();

// Publish events
await coordinator.publishEvent({
  type: 'order.created',
  source: 'order-service',
  data: { orderId: '123', amount: 99.99 },
});

// Subscribe to events
await coordinator.subscribeToEvent('payment.completed', async (event) => {
  console.log('Payment completed:', event.data);
});

// Call other services with circuit breaker
const result = await coordinator.callService('payment-service', '/api/charge', {
  method: 'POST',
  data: { amount: 99.99, token: 'tok_123' },
});
```

## Service Integration Examples

### User Service Integration

```typescript
// services/user-service/src/utils/inter-service.ts
import { userServiceCommunication } from './inter-service';

// Initialize in your app startup
await userServiceCommunication.initialize();

// Publish events when users are created/updated
await userServiceCommunication.publishUserRegistered(userId, userData);
await userServiceCommunication.publishUserUpdated(userId, updatedData);

// Call other services
await userServiceCommunication.createCRMContact(userData);
await userServiceCommunication.sendWelcomeEmail(userId, userData);
```

### CRM Service Integration

```typescript
// services/crm-service/src/utils/inter-service.ts
import { crmServiceCommunication } from './inter-service';

// Initialize in your app startup
await crmServiceCommunication.initialize();

// Publish CRM events
await crmServiceCommunication.publishContactCreated(contactId, contactData);
await crmServiceCommunication.publishLeadScoreChanged(contactId, scoreData);

// Trigger marketing automation
await crmServiceCommunication.triggerMarketingAutomation(contactId, 'lead_qualified', data);
```

### Marketing Automation Integration

```typescript
// services/marketing-automation-service/src/utils/inter-service.ts
import { marketingAutomationServiceCommunication } from './inter-service';

// Initialize in your app startup
await marketingAutomationServiceCommunication.initialize();

// Publish workflow events
await marketingAutomationServiceCommunication.publishWorkflowStarted(workflowId, executionId, contactId);
await marketingAutomationServiceCommunication.publishWorkflowCompleted(workflowId, executionId, contactId, result);

// Send emails through newsletter service
await marketingAutomationServiceCommunication.sendEmail(contactId, emailData);
```

## Event Types and Data Structures

### User Events

```typescript
// user.registered
{
  type: 'user.registered',
  source: 'user-service',
  data: {
    userId: string,
    email: string,
    profile: UserProfile,
    subscription: Subscription,
    registeredAt: Date,
  },
  userId: string,
}

// user.updated
{
  type: 'user.updated',
  source: 'user-service',
  data: {
    userId: string,
    updatedFields: Partial<User>,
    updatedAt: Date,
  },
  userId: string,
}

// user.subscription_changed
{
  type: 'user.subscription_changed',
  source: 'user-service',
  data: {
    userId: string,
    oldPlan: string,
    newPlan: string,
    changedAt: Date,
  },
  userId: string,
}
```

### CRM Events

```typescript
// crm.contact_created
{
  type: 'crm.contact_created',
  source: 'crm-service',
  data: {
    contactId: string,
    email: string,
    firstName?: string,
    lastName?: string,
    source: string,
    lifecycle: string,
    createdAt: Date,
  },
  userId?: string,
}

// crm.lead_score_changed
{
  type: 'crm.lead_score_changed',
  source: 'crm-service',
  data: {
    contactId: string,
    oldScore: number,
    newScore: number,
    reason: string,
    changedAt: Date,
  },
  userId?: string,
}

// crm.contact_segment_changed
{
  type: 'crm.contact_segment_changed',
  source: 'crm-service',
  data: {
    contactId: string,
    addedSegments: string[],
    removedSegments: string[],
    changedAt: Date,
  },
  userId?: string,
}
```

### Marketing Automation Events

```typescript
// automation.workflow_started
{
  type: 'automation.workflow_started',
  source: 'marketing-automation-service',
  data: {
    workflowId: string,
    executionId: string,
    contactId: string,
    startedAt: Date,
  },
}

// automation.drip_email_sent
{
  type: 'automation.drip_email_sent',
  source: 'marketing-automation-service',
  data: {
    campaignId: string,
    contactId: string,
    emailId: string,
    sentAt: Date,
  },
}
```

## Workflow Triggers

The event coordinator supports workflow triggers that automatically execute actions based on events:

```typescript
// Register a workflow trigger
coordinator.registerWorkflowTrigger({
  id: 'welcome-sequence',
  name: 'Welcome Email Sequence',
  eventType: 'user.registered',
  conditions: [
    { field: 'subscription.plan', operator: 'equals', value: 'premium' }
  ],
  actions: [
    {
      type: 'http_request',
      config: {
        serviceName: 'marketing-automation-service',
        path: '/api/v1/workflows/welcome/start',
        method: 'POST',
      }
    },
    {
      type: 'publish_event',
      config: {
        eventType: 'automation.workflow_triggered',
        data: { workflowName: 'welcome-sequence' }
      }
    }
  ]
});
```

## Error Handling and Resilience

### Circuit Breaker States

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service is failing, requests are blocked or use fallback
- **HALF_OPEN**: Testing if service has recovered

### Retry Mechanisms

- Automatic retry with exponential backoff
- Configurable retry limits per event type
- Dead letter queues for permanently failed messages

### Health Checking

- Automatic health checks for all registered services
- Configurable health check intervals and thresholds
- Automatic service deregistration on health check failures

## Monitoring and Observability

### Health Status Endpoints

Each service integration provides health status:

```typescript
// Get health status
const health = coordinator.getHealthStatus();
console.log(health);
// {
//   messageBus: { connected: true, reconnectAttempts: 0, handlersCount: 5 },
//   circuitBreakers: { healthy: ['user-service'], unhealthy: [], total: 1 },
//   workflows: 3,
//   eventHandlers: 8
// }
```

### Circuit Breaker Metrics

```typescript
// Get circuit breaker statistics
const stats = circuitBreakerManager.getAllStats();
console.log(stats);
// {
//   'user-service': {
//     state: 'CLOSED',
//     failures: 0,
//     successes: 150,
//     requests: 150,
//     lastSuccessTime: Date,
//   }
// }
```

## Best Practices

### 1. Event Design

- Use clear, descriptive event names (`service.entity.action`)
- Include all necessary data in the event payload
- Use correlation IDs for request tracing
- Keep events immutable and append-only

### 2. Error Handling

- Always handle event processing errors gracefully
- Use circuit breakers for external service calls
- Implement proper retry logic with exponential backoff
- Monitor dead letter queues for failed messages

### 3. Service Discovery

- Register services with meaningful metadata and tags
- Implement proper health check endpoints
- Use load balancing strategies appropriate for your use case
- Handle service unavailability gracefully

### 4. Performance

- Use appropriate message queue configurations
- Implement proper connection pooling
- Monitor queue depths and processing times
- Use batch processing where appropriate

### 5. Security

- Validate all incoming event data
- Use proper authentication for service-to-service calls
- Implement rate limiting and request validation
- Audit sensitive operations and data access

## Troubleshooting

### Common Issues

1. **Message Bus Connection Failures**
   - Check RabbitMQ connectivity and credentials
   - Verify exchange and queue configurations
   - Monitor connection logs for errors

2. **Circuit Breaker Tripping**
   - Check target service health and response times
   - Review failure thresholds and timeout settings
   - Monitor service logs for errors

3. **Service Discovery Issues**
   - Verify service registration and health check endpoints
   - Check network connectivity between services
   - Review service discovery logs

4. **Event Processing Delays**
   - Monitor queue depths and processing rates
   - Check for resource constraints (CPU, memory)
   - Review event handler performance

### Debugging Tools

- Use the Kong CLI tool for API gateway monitoring
- Check circuit breaker statistics regularly
- Monitor RabbitMQ management interface
- Review service logs for error patterns

## Configuration Examples

### Development Environment

```typescript
const config = {
  serviceName: 'my-service',
  messagebus: {
    url: 'amqp://datatechtoncrm:datatechtoncrm_rabbitmq_password@localhost:5672',
  },
  circuitBreaker: {
    enabled: true,
    defaultTimeout: 5000,
    defaultFailureThreshold: 3,
  },
  events: {
    retryEnabled: true,
    maxRetries: 2,
    deadLetterEnabled: true,
  },
};
```

### Production Environment

```typescript
const config = {
  serviceName: 'my-service',
  messagebus: {
    url: process.env.RABBITMQ_URL,
  },
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
```

This inter-service communication system provides a robust foundation for building scalable, resilient microservices that can communicate effectively while handling failures gracefully.
