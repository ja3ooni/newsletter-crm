# API Documentation

## Overview

The Newsletter CRM API is a RESTful API that provides access to all platform functionality. All endpoints return JSON responses and use standard HTTP status codes.

## Base URL

```
Production: https://api.newsletter-crm.com
Development: http://localhost:8000
```

## Authentication

All API requests require authentication using JWT tokens.

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Using the Token
Include the token in the Authorization header:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## User Management

### Get Current User
```http
GET /api/users/me
Authorization: Bearer {token}
```

### Update User Profile
```http
PUT /api/users/me
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

## CRM Endpoints

### Contacts

#### List Contacts
```http
GET /api/crm/contacts?page=1&limit=20&search=john
Authorization: Bearer {token}
```

Query Parameters:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `search` (optional): Search term
- `segment` (optional): Filter by segment ID
- `tags` (optional): Filter by tags (comma-separated)

Response:
```json
{
  "contacts": [
    {
      "id": "contact-123",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "company": "Acme Corp",
      "tags": ["customer", "vip"],
      "leadScore": 85,
      "lifecycle": "customer",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### Create Contact
```http
POST /api/crm/contacts
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "company": "Tech Corp",
  "customFields": {
    "department": "Engineering"
  }
}
```

#### Get Contact
```http
GET /api/crm/contacts/{id}
Authorization: Bearer {token}
```

#### Update Contact
```http
PUT /api/crm/contacts/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Doe",
  "tags": ["customer", "enterprise"]
}
```

#### Delete Contact
```http
DELETE /api/crm/contacts/{id}
Authorization: Bearer {token}
```

### Segments

#### List Segments
```http
GET /api/crm/segments
Authorization: Bearer {token}
```

#### Create Segment
```http
POST /api/crm/segments
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "High Value Customers",
  "description": "Customers with high engagement",
  "conditions": [
    {
      "field": "leadScore",
      "operator": "greater_than",
      "value": 80
    }
  ]
}
```

## Newsletter Endpoints

### Newsletters

#### List Newsletters
```http
GET /api/newsletters?status=draft&page=1&limit=20
Authorization: Bearer {token}
```

#### Create Newsletter
```http
POST /api/newsletters
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Weekly Update",
  "subject": "This Week's Updates",
  "content": {
    "sections": [
      {
        "type": "header",
        "content": {
          "title": "Weekly Newsletter",
          "subtitle": "Stay updated with our latest news"
        }
      }
    ]
  }
}
```

#### Send Newsletter
```http
POST /api/newsletters/{id}/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "segmentIds": ["segment-123", "segment-456"],
  "scheduleAt": "2024-01-15T10:00:00Z"
}
```

### Templates

#### List Templates
```http
GET /api/newsletters/templates
Authorization: Bearer {token}
```

#### Create Template
```http
POST /api/newsletters/templates
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Basic Newsletter",
  "category": "newsletter",
  "content": {
    "sections": [...]
  }
}
```

## Marketing Automation

### Workflows

#### List Workflows
```http
GET /api/marketing/workflows
Authorization: Bearer {token}
```

#### Create Workflow
```http
POST /api/marketing/workflows
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Welcome Series",
  "trigger": {
    "type": "contact_created",
    "conditions": {}
  },
  "steps": [
    {
      "type": "email",
      "delay": 0,
      "config": {
        "templateId": "welcome-email"
      }
    }
  ]
}
```

### Drip Campaigns

#### List Campaigns
```http
GET /api/marketing/drip-campaigns
Authorization: Bearer {token}
```

#### Create Campaign
```http
POST /api/marketing/drip-campaigns
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Onboarding Series",
  "emails": [
    {
      "subject": "Welcome!",
      "templateId": "welcome-template",
      "delayDays": 0
    },
    {
      "subject": "Getting Started",
      "templateId": "getting-started-template",
      "delayDays": 3
    }
  ]
}
```

## Analytics

### Campaign Analytics
```http
GET /api/analytics/campaigns/{campaignId}
Authorization: Bearer {token}
```

Response:
```json
{
  "campaignId": "campaign-123",
  "metrics": {
    "sent": 1000,
    "delivered": 980,
    "opened": 245,
    "clicked": 89,
    "unsubscribed": 5,
    "bounced": 20
  },
  "rates": {
    "deliveryRate": 0.98,
    "openRate": 0.25,
    "clickRate": 0.089,
    "unsubscribeRate": 0.005,
    "bounceRate": 0.02
  }
}
```

### Contact Analytics
```http
GET /api/analytics/contacts/{contactId}
Authorization: Bearer {token}
```

## Error Handling

The API uses standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

Error Response Format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

## Rate Limiting

API requests are rate limited:
- 1000 requests per hour for authenticated users
- 100 requests per hour for unauthenticated requests

Rate limit headers:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Webhooks

Configure webhooks to receive real-time notifications:

### Webhook Events
- `contact.created`
- `contact.updated`
- `newsletter.sent`
- `email.opened`
- `email.clicked`
- `contact.unsubscribed`

### Webhook Payload
```json
{
  "event": "contact.created",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "contact": {
      "id": "contact-123",
      "email": "john@example.com"
    }
  }
}
```

## SDKs and Libraries

Official SDKs are available for:
- JavaScript/Node.js
- Python
- PHP
- Ruby

Example (JavaScript):
```javascript
import { NewsletterCRM } from '@newsletter-crm/sdk';

const client = new NewsletterCRM({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.newsletter-crm.com'
});

const contacts = await client.contacts.list();
```

## Support

For API support:
- Documentation: https://docs.newsletter-crm.com
- Support: api-support@newsletter-crm.com
- Status Page: https://status.newsletter-crm.com
