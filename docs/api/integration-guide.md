# DatatechtonCRM API Integration Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Error Handling](#error-handling)
5. [Pagination](#pagination)
6. [Webhooks](#webhooks)
7. [SDK Usage](#sdk-usage)
8. [Common Integration Patterns](#common-integration-patterns)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Getting Started

The DatatechtonCRM Platform API provides comprehensive access to newsletter
management, CRM functionality, marketing automation, and analytics. This guide
will help you integrate with our API effectively.

### Base URLs

| Environment | URL                                         |
| ----------- | ------------------------------------------- |
| Production  | `https://api.datatechtoncrm.com/v1`         |
| Staging     | `https://staging-api.datatechtoncrm.com/v1` |
| Development | `http://localhost:8000/v1`                  |

### API Versions

We use URL versioning for our REST API. The current version is `v1`. GraphQL
uses a single endpoint with schema evolution.

- REST API: `/v1/...`
- GraphQL: `/graphql`

## Authentication

### JWT Bearer Tokens (Recommended)

For web applications and user-specific operations:

```javascript
// 1. Login to get tokens
const loginResponse = await fetch(
  'https://api.datatechtoncrm.com/v1/users/login',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'user@example.com',
      password: 'your-password',
    }),
  }
);

const { accessToken, refreshToken } = await loginResponse.json();

// 2. Use access token for API calls
const response = await fetch('https://api.datatechtoncrm.com/v1/newsletters', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

### API Keys

For server-to-server integrations:

```javascript
const response = await fetch(
  'https://api.datatechtoncrm.com/v1/api/newsletters',
  {
    headers: {
      'X-API-Key': 'your-api-key',
    },
  }
);
```

### Token Refresh

JWT tokens expire after 1 hour. Use the refresh token to get new access tokens:

```javascript
async function refreshAccessToken(refreshToken) {
  const response = await fetch(
    'https://api.datatechtoncrm.com/v1/users/refresh',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    }
  );

  if (response.ok) {
    const { accessToken, refreshToken: newRefreshToken } =
      await response.json();
    // Store new tokens
    return { accessToken, refreshToken: newRefreshToken };
  }

  throw new Error('Token refresh failed');
}
```

## Rate Limiting

Rate limits are applied based on your subscription tier:

| Tier       | Requests/Hour | Burst Limit |
| ---------- | ------------- | ----------- |
| Free       | 100           | 10/minute   |
| Pro        | 1,000         | 50/minute   |
| Enterprise | 10,000        | 200/minute  |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

### Handling Rate Limits

```javascript
async function apiCall(url, options = {}) {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);

    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return apiCall(url, options);
  }

  return response;
}
```

## Error Handling

### Standard Error Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "requestId": "req_1234567890"
  }
}
```

### Common Error Codes

| Code                  | Status | Description               |
| --------------------- | ------ | ------------------------- |
| `VALIDATION_ERROR`    | 400    | Request validation failed |
| `UNAUTHORIZED`        | 401    | Authentication required   |
| `FORBIDDEN`           | 403    | Insufficient permissions  |
| `NOT_FOUND`           | 404    | Resource not found        |
| `CONFLICT`            | 409    | Resource already exists   |
| `RATE_LIMIT_EXCEEDED` | 429    | Rate limit exceeded       |
| `INTERNAL_ERROR`      | 500    | Server error              |

### Error Handling Best Practices

```javascript
async function handleApiResponse(response) {
  if (!response.ok) {
    const error = await response.json();

    switch (error.error.code) {
      case 'VALIDATION_ERROR':
        // Handle validation errors
        console.error('Validation failed:', error.error.details);
        break;

      case 'UNAUTHORIZED':
        // Redirect to login or refresh token
        await refreshToken();
        break;

      case 'RATE_LIMIT_EXCEEDED':
        // Implement exponential backoff
        await exponentialBackoff();
        break;

      default:
        console.error('API Error:', error.error.message);
    }

    throw new Error(error.error.message);
  }

  return response.json();
}
```

## Pagination

### Cursor-based Pagination

We use cursor-based pagination for consistent results:

```javascript
async function getAllNewsletters() {
  let newsletters = [];
  let cursor = null;

  do {
    const params = new URLSearchParams({
      pageSize: '50',
      ...(cursor && { cursor }),
    });

    const response = await fetch(`/v1/newsletters?${params}`);
    const data = await response.json();

    newsletters.push(...data.data);
    cursor = data.pagination.nextCursor;
  } while (data.pagination.hasNext);

  return newsletters;
}
```

### GraphQL Pagination

```graphql
query GetNewsletters($first: Int!, $after: String) {
  newsletters(pagination: { first: $first, after: $after }) {
    edges {
      node {
        id
        title
        status
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

## Webhooks

### Setting Up Webhooks

Configure webhooks to receive real-time notifications:

```javascript
// Register a webhook endpoint
const webhook = await fetch('/v1/webhooks', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://your-app.com/webhooks/datatechtoncrm',
    events: ['newsletter.sent', 'contact.created', 'engagement.tracked'],
    secret: 'your-webhook-secret',
  }),
});
```

### Webhook Payload Example

```json
{
  "id": "evt_1234567890",
  "type": "newsletter.sent",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "newsletter": {
      "id": "newsletter-uuid",
      "title": "Weekly Update",
      "status": "sent",
      "sentAt": "2024-01-15T10:30:00Z",
      "recipientCount": 1250
    }
  },
  "signature": "sha256=..."
}
```

### Webhook Verification

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return `sha256=${expectedSignature}` === signature;
}

// Express.js webhook handler
app.post('/webhooks/datatechtoncrm', (req, res) => {
  const signature = req.headers['x-datatechtoncrm-signature'];
  const payload = JSON.stringify(req.body);

  if (!verifyWebhook(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook
  handleWebhookEvent(req.body);
  res.status(200).send('OK');
});
```

## SDK Usage

### JavaScript/TypeScript SDK

```bash
npm install @datatechtoncrm/sdk
```

```javascript
import { DatatechtonCRM } from '@datatechtoncrm/sdk';

const client = new DatatechtonCRM({
  apiKey: 'your-api-key',
  // or use JWT token
  // token: 'your-jwt-token',
  environment: 'production', // 'staging' or 'development'
});

// Create a newsletter
const newsletter = await client.newsletters.create({
  title: 'Weekly Update',
  templateId: 'template-uuid',
  content: {
    sections: [
      {
        id: 'section-1',
        type: 'news',
        title: 'Latest News',
        items: [
          {
            id: 'item-1',
            title: 'AI Breakthrough',
            summary: 'New developments in AI...',
            url: 'https://example.com/article',
            source: 'TechNews',
          },
        ],
        order: 1,
      },
    ],
  },
});

// Send newsletter
const sendResult = await client.newsletters.send(newsletter.id, {
  segments: ['segment-uuid-1'],
});

console.log(`Newsletter queued with job ID: ${sendResult.jobId}`);
```

### Python SDK

```bash
pip install datatechtoncrm-python
```

```python
from datatechtoncrm import DatatechtonCRM

client = DatatechtonCRM(
    api_key='your-api-key',
    environment='production'
)

# Create a contact
contact = client.contacts.create({
    'email': 'contact@example.com',
    'first_name': 'Jane',
    'last_name': 'Doe',
    'company': 'Acme Corp',
    'tags': ['lead', 'enterprise']
})

# Create a segment
segment = client.segments.create({
    'name': 'High Value Leads',
    'conditions': [
        {
            'field': 'lead_score',
            'operator': 'greater_than',
            'value': 80
        }
    ]
})

print(f"Created segment: {segment['id']}")
```

## Common Integration Patterns

### Newsletter Automation Workflow

```javascript
class NewsletterAutomation {
  constructor(client) {
    this.client = client;
  }

  async createWeeklyNewsletter() {
    // 1. Fetch latest content
    const content = await this.fetchLatestContent();

    // 2. Create newsletter
    const newsletter = await this.client.newsletters.create({
      title: `Weekly Update - ${new Date().toISOString().split('T')[0]}`,
      templateId: 'weekly-template-uuid',
      content: this.formatContent(content),
    });

    // 3. Schedule for optimal send time
    const sendTime = await this.calculateOptimalSendTime();

    // 4. Send to active segments
    const activeSegments = await this.getActiveSegments();

    return this.client.newsletters.send(newsletter.id, {
      segments: activeSegments.map(s => s.id),
      scheduledAt: sendTime,
    });
  }

  async calculateOptimalSendTime() {
    // Use analytics to determine best send time
    const analytics = await this.client.analytics.getOptimalSendTimes();
    return analytics.recommendedTime;
  }
}
```

### Contact Synchronization

```javascript
class ContactSync {
  constructor(client, externalCRM) {
    this.client = client;
    this.externalCRM = externalCRM;
  }

  async syncContacts() {
    // Get contacts from external CRM
    const externalContacts = await this.externalCRM.getContacts();

    for (const contact of externalContacts) {
      try {
        // Check if contact exists
        const existing = await this.client.contacts.findByEmail(contact.email);

        if (existing) {
          // Update existing contact
          await this.client.contacts.update(existing.id, {
            customFields: {
              ...existing.customFields,
              external_id: contact.id,
              last_sync: new Date().toISOString(),
            },
          });
        } else {
          // Create new contact
          await this.client.contacts.create({
            email: contact.email,
            firstName: contact.firstName,
            lastName: contact.lastName,
            company: contact.company,
            customFields: {
              external_id: contact.id,
              source: 'crm_sync',
            },
          });
        }
      } catch (error) {
        console.error(`Failed to sync contact ${contact.email}:`, error);
      }
    }
  }
}
```

### Real-time Analytics Dashboard

```javascript
// Using GraphQL subscriptions for real-time updates
import { createClient } from 'graphql-ws';

const wsClient = createClient({
  url: 'wss://api.datatechtoncrm.com/graphql',
  connectionParams: {
    Authorization: `Bearer ${token}`,
  },
});

// Subscribe to newsletter sending progress
const unsubscribe = wsClient.subscribe(
  {
    query: `
      subscription NewsletterProgress($newsletterId: UUID!) {
        newsletterSendProgress(newsletterId: $newsletterId) {
          status
          progress
          sent
          failed
        }
      }
    `,
    variables: { newsletterId: 'newsletter-uuid' },
  },
  {
    next: data => {
      updateProgressBar(data.newsletterSendProgress);
    },
    error: error => {
      console.error('Subscription error:', error);
    },
    complete: () => {
      console.log('Newsletter sending completed');
    },
  }
);
```

## Best Practices

### 1. Authentication Management

```javascript
class AuthManager {
  constructor() {
    this.token = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  async getValidToken() {
    if (!this.token || this.isTokenExpired(this.token)) {
      await this.refreshAccessToken();
    }
    return this.token;
  }

  isTokenExpired(token) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  }

  async refreshAccessToken() {
    const response = await fetch('/v1/users/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (response.ok) {
      const { accessToken, refreshToken } = await response.json();
      this.token = accessToken;
      this.refreshToken = refreshToken;

      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      // Redirect to login
      window.location.href = '/login';
    }
  }
}
```

### 2. Error Handling and Retry Logic

```javascript
class ApiClient {
  constructor(baseURL, authManager) {
    this.baseURL = baseURL;
    this.authManager = authManager;
  }

  async request(endpoint, options = {}) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const token = await this.authManager.getValidToken();

        const response = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (response.status === 429) {
          // Rate limited - exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
          continue;
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error.message);
        }

        return response.json();
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}
```

### 3. Batch Operations

```javascript
// Batch create contacts
async function batchCreateContacts(contacts) {
  const batchSize = 100;
  const results = [];

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);

    const batchPromises = batch.map(contact =>
      client.contacts.create(contact).catch(error => ({
        error: error.message,
        contact,
      }))
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Rate limiting - wait between batches
    if (i + batchSize < contacts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
```

### 4. Caching Strategy

```javascript
class CachedApiClient {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.cache = new Map();
  }

  async get(endpoint, options = {}) {
    const cacheKey = `${endpoint}:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 300000) {
      // 5 minutes
      return cached.data;
    }

    const data = await this.apiClient.request(endpoint, {
      method: 'GET',
      ...options,
    });

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  invalidateCache(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Problem**: Getting 401 Unauthorized errors

**Solutions**:

- Check if JWT token is expired
- Verify API key is correct and active
- Ensure proper Authorization header format: `Bearer <token>`

#### 2. Rate Limiting

**Problem**: Getting 429 Too Many Requests

**Solutions**:

- Implement exponential backoff
- Reduce request frequency
- Use batch operations where possible
- Consider upgrading subscription tier

#### 3. Validation Errors

**Problem**: Getting 400 Bad Request with validation errors

**Solutions**:

- Check required fields are provided
- Validate email formats
- Ensure UUIDs are properly formatted
- Review API documentation for field constraints

#### 4. Webhook Issues

**Problem**: Webhooks not being received

**Solutions**:

- Verify webhook URL is accessible from internet
- Check webhook signature verification
- Ensure proper HTTP response (200 OK)
- Review webhook logs in dashboard

### Debug Mode

Enable debug mode to see detailed request/response information:

```javascript
const client = new DatatechtonCRM({
  apiKey: 'your-api-key',
  debug: true, // Enables request/response logging
});
```

### Support Resources

- **API Documentation**: https://docs.datatechtoncrm.com/api
- **Status Page**: https://status.datatechtoncrm.com
- **Support Email**: api-support@datatechtoncrm.com
- **Community Forum**: https://community.datatechtoncrm.com
- **GitHub Issues**: https://github.com/datatechtoncrm/platform/issues

### Rate Limit Monitoring

Monitor your API usage to avoid hitting limits:

```javascript
function logRateLimitInfo(response) {
  const limit = response.headers.get('X-RateLimit-Limit');
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');

  console.log(
    `Rate Limit: ${remaining}/${limit}, resets at ${new Date(reset * 1000)}`
  );

  if (remaining < 10) {
    console.warn('Approaching rate limit!');
  }
}
```

This integration guide provides comprehensive information for successfully
integrating with the DatatechtonCRM Platform API. For additional help, please
refer to our support resources or contact our API support team.
