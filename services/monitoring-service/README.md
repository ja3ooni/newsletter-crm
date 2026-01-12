# DatatechtonCRM Monitoring Service

Comprehensive monitoring and observability service for the DatatechtonCRM platform,
providing metrics collection, alerting, distributed tracing, and log analysis.

## Features

### 📊 Metrics Collection

- **Prometheus Integration**: Automatic metrics collection and exposure
- **Business Metrics**: Newsletter generation, email delivery, user
  registrations
- **System Metrics**: CPU, memory, database connections, queue sizes
- **HTTP Metrics**: Request rates, response times, error rates
- **Custom Metrics**: Flexible metric recording API

### 🚨 Alerting System

- **Rule-Based Alerts**: Configurable alert rules with thresholds
- **Multi-Channel Notifications**: Email, Slack, webhooks
- **Alert Grouping**: Intelligent alert deduplication and grouping
- **Severity Levels**: Critical, warning, info alert classifications
- **Alert Management**: Create, update, delete alert rules via API

### 🔍 Distributed Tracing

- **Jaeger Integration**: Complete request flow tracing
- **Automatic Instrumentation**: HTTP requests, database operations, queue jobs
- **Context Propagation**: Trace context across service boundaries
- **Performance Analysis**: Request latency and bottleneck identification

### 📝 Structured Logging

- **Centralized Logging**: ELK stack integration (Elasticsearch, Logstash,
  Kibana)
- **Correlation IDs**: Request tracking across services
- **Log Analysis**: Anomaly detection and pattern recognition
- **Error Tracking**: Automatic error capture and notification

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Configure environment variables
PROMETHEUS_URL=http://prometheus:9090
JAEGER_AGENT_HOST=jaeger
JAEGER_AGENT_PORT=6832
ELASTICSEARCH_URL=http://elasticsearch:9200
SLACK_WEBHOOK_URL=your_slack_webhook_url
LOG_LEVEL=info
```

### 2. Start Monitoring Stack

```bash
# Start all monitoring services
docker-compose -f infrastructure/monitoring/docker-compose.monitoring.yml up -d

# Or start individual services
docker-compose up prometheus grafana jaeger
```

### 3. Access Dashboards

- **Grafana**: http://localhost:3000 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **Monitoring API**: http://localhost:3006

## API Endpoints

### Metrics

```bash
# Get Prometheus metrics
GET /metrics

# Get business metrics
GET /metrics/business

# Record custom metric
POST /metrics/record
{
  "type": "email_sent",
  "data": {
    "type": "newsletter",
    "status": "sent"
  }
}
```

### Alerts

```bash
# Get all alerts
GET /alerts

# Get alert rules
GET /alerts/rules

# Create alert rule
POST /alerts/rules
{
  "id": "high-error-rate",
  "name": "High Error Rate",
  "query": "rate(http_requests_total{status_code=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
  "threshold": 0.05,
  "operator": "gt",
  "duration": "5m",
  "severity": "critical"
}
```

### Health Checks

```bash
# Basic health check
GET /health

# Detailed health check
GET /health/detailed

# Readiness probe
GET /health/ready

# Liveness probe
GET /health/live
```

## Integration Guide

### Service Integration

```typescript
import { createLoggingMiddleware } from '@datatechtoncrm/shared/logging';
import { createMonitoringMiddleware } from '@datatechtoncrm/shared/monitoring';

const app = express();

// Initialize logging
const logging = createLoggingMiddleware({
  serviceName: 'my-service',
  enableErrorTracking: true,
  enableLogAnalysis: true,
});

// Initialize monitoring
const monitoring = createMonitoringMiddleware({
  serviceName: 'my-service',
  monitoringServiceUrl: 'http://monitoring-service:3006',
});

// Apply middleware
app.use(logging.requestLogger());
app.use(monitoring.httpMetrics());

// Error handling
app.use(logging.errorHandler());
```

### Custom Metrics

```typescript
// Record business events
logging.logBusinessEvent('user_registered', {
  plan: 'premium',
  source: 'website',
});

// Record performance metrics
logging.logPerformance('newsletter_generation', 1500, {
  sections: 5,
  subscribers: 1000,
});

// Record security events
logging.logSecurityEvent('failed_login_attempt', 'medium', {
  ip: '192.168.1.1',
  attempts: 3,
});
```

### Database Operations

```typescript
// Automatic logging and monitoring
const user = await logging.logDbOperation(
  'get_user_by_id',
  async () => {
    return await userRepository.findById(userId);
  },
  { userId }
);
```

### External API Calls

```typescript
// Automatic logging and error tracking
const result = await logging.logApiCall(
  'https://api.external.com/data',
  'GET',
  async () => {
    return await axios.get('https://api.external.com/data');
  }
);
```

## Configuration

### Alert Rules

Alert rules are defined in YAML format and can be managed via API:

```yaml
groups:
  - name: datatechtoncrm_alerts
    rules:
      - alert: HighErrorRate
        expr:
          rate(http_requests_total{status_code=~"5.."}[5m]) /
          rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'High error rate detected'
          description: 'Error rate is above 5% for more than 5 minutes'
```

### Notification Channels

Configure notification channels for alerts:

```typescript
{
  "id": "slack-alerts",
  "name": "Slack Alerts",
  "type": "slack",
  "config": {
    "webhookUrl": "https://hooks.slack.com/...",
    "channel": "#alerts"
  },
  "enabled": true
}
```

### Log Patterns

Define patterns for log analysis and anomaly detection:

```typescript
{
  "id": "authentication-failures",
  "pattern": "message:*authentication*failed*",
  "description": "Multiple authentication failures",
  "severity": "warning",
  "threshold": 5,
  "timeWindow": 10
}
```

## Dashboards

### System Overview

- Service health status
- HTTP request rates and response times
- Error rates and trends
- Resource utilization (CPU, memory)
- Database and queue metrics

### Business Metrics

- Newsletter generation and delivery rates
- User registration trends
- Subscription changes
- Revenue metrics
- Conversion funnels

### Performance Monitoring

- Response time percentiles
- Throughput metrics
- Database query performance
- Cache hit rates
- Queue processing times

## Troubleshooting

### Common Issues

1. **Metrics not appearing in Prometheus**
   - Check service `/metrics` endpoint
   - Verify Prometheus scrape configuration
   - Check network connectivity

2. **Alerts not firing**
   - Verify alert rule syntax
   - Check Prometheus rule evaluation
   - Confirm AlertManager configuration

3. **Traces not appearing in Jaeger**
   - Check Jaeger agent connectivity
   - Verify tracing initialization
   - Check sampling configuration

4. **Logs not in Elasticsearch**
   - Verify Elasticsearch connectivity
   - Check Logstash configuration
   - Confirm log format compatibility

### Debug Commands

```bash
# Check service health
curl http://monitoring-service:3006/health/detailed

# Test metrics endpoint
curl http://monitoring-service:3006/metrics

# Check Prometheus targets
curl http://prometheus:9090/api/v1/targets

# Test alert rules
curl http://prometheus:9090/api/v1/rules
```

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Local Development

```bash
npm run dev
```

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Follow semantic versioning

## License

MIT License - see LICENSE file for details.
