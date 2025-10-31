# DatatechtonCRM SDK Documentation

## Overview

The DatatechtonCRM SDKs provide easy-to-use interfaces for integrating with the
DatatechtonCRM Platform API. We offer SDKs for multiple programming languages
with consistent APIs and comprehensive error handling.

## Available SDKs

- [JavaScript/TypeScript SDK](#javascripttypescript-sdk)
- [Python SDK](#python-sdk)
- [PHP SDK](#php-sdk)
- [Ruby SDK](#ruby-sdk)
- [Go SDK](#go-sdk)
- [C# SDK](#c-sdk)

## JavaScript/TypeScript SDK

### Installation

```bash
npm install @datatechtoncrm/sdk
# or
yarn add @datatechtoncrm/sdk
```

### Quick Start

```typescript
import { DatatechtonCRM } from '@datatechtoncrm/sdk';

// Initialize with API key
const client = new DatatechtonCRM({
  apiKey: 'your-api-key',
  environment: 'production', // 'staging' or 'development'
});

// Or initialize with JWT token
const client = new DatatechtonCRM({
  token: 'your-jwt-token',
  environment: 'production',
});
```

### Configuration Options

```typescript
interface DatatechtonCRMConfig {
  apiKey?: string;
  token?: string;
  environment: 'production' | 'staging' | 'development';
  baseURL?: string;
  timeout?: number;
  retries?: number;
  debug?: boolean;
}

const client = new DatatechtonCRM({
  apiKey: 'your-api-key',
  environment: 'production',
  timeout: 30000, // 30 seconds
  retries: 3,
  debug: process.env.NODE_ENV === 'development',
});
```

### Authentication

```typescript
// Login and get tokens
const auth = await client.auth.login({
  email: 'user@example.com',
  password: 'password',
});

// The client will automatically use the returned token
console.log('Logged in as:', auth.user.email);

// Refresh token when needed
await client.auth.refreshToken();

// Logout
await client.auth.logout();
```

### Newsletter Management

```typescript
// Create a newsletter
const newsletter = await client.newsletters.create({
  title: 'Weekly Tech Update',
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
            title: 'AI Breakthrough in Healthcare',
            summary:
              'New AI model shows promising results in medical diagnosis...',
            url: 'https://example.com/article',
            source: 'TechNews',
            tags: ['ai', 'healthcare'],
            score: 0.95,
          },
        ],
        order: 1,
      },
    ],
  },
  segments: ['segment-uuid-1', 'segment-uuid-2'],
});

// Get newsletters with pagination
const newsletters = await client.newsletters.list({
  pageSize: 20,
  status: 'sent',
  search: 'weekly',
});

// Get specific newsletter
const newsletter = await client.newsletters.get('newsletter-uuid');

// Update newsletter
const updated = await client.newsletters.update('newsletter-uuid', {
  title: 'Updated Title',
  content: updatedContent,
});

// Send newsletter
const sendResult = await client.newsletters.send('newsletter-uuid', {
  segments: ['segment-uuid'],
  scheduledAt: new Date('2024-01-20T09:00:00Z'),
});

// Track sending progress
const progress = await client.newsletters.getSendProgress(sendResult.jobId);

// Get analytics
const analytics = await client.newsletters.getAnalytics('newsletter-uuid', {
  timeRange: '7d',
});
```

### CRM Operations

```typescript
// Create a contact
const contact = await client.contacts.create({
  email: 'contact@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  company: 'Acme Corp',
  jobTitle: 'Marketing Manager',
  tags: ['lead', 'enterprise'],
  customFields: {
    industry: 'Technology',
    company_size: '500-1000',
    lead_source: 'website',
  },
  preferences: {
    emailFrequency: 'weekly',
    contentTypes: ['news', 'research'],
    timezone: 'America/New_York',
  },
});

// Search contacts
const contacts = await client.contacts.search({
  query: 'jane@example.com',
  filters: {
    lifecycle: 'lead',
    tags: ['enterprise'],
  },
});

// Update contact
const updated = await client.contacts.update('contact-uuid', {
  customFields: {
    lead_score: 85,
    last_interaction: new Date().toISOString(),
  },
});

// Create segment
const segment = await client.segments.create({
  name: 'High Value Leads',
  description: 'Leads with high engagement and company size > 100',
  conditions: [
    {
      field: 'customFields.lead_score',
      operator: 'greater_than',
      value: 70,
    },
    {
      field: 'customFields.company_size',
      operator: 'in',
      value: ['100-500', '500-1000', '1000+'],
      logicalOperator: 'AND',
    },
  ],
  isAutoUpdating: true,
});

// Get segment contacts
const segmentContacts = await client.segments.getContacts('segment-uuid', {
  pageSize: 50,
});
```

### Template Management

```typescript
// Create template
const template = await client.templates.create({
  name: 'Modern Newsletter',
  category: 'business',
  html: templateHTML,
  css: templateCSS,
  variables: [
    {
      name: 'primaryColor',
      type: 'color',
      defaultValue: '#667eea',
      description: 'Primary brand color',
    },
    {
      name: 'companyName',
      type: 'text',
      defaultValue: 'Your Company',
      description: 'Company name for header',
    },
  ],
  isPublic: false,
});

// Get marketplace templates
const marketplaceTemplates = await client.templates.getMarketplace({
  category: 'tech',
  pageSize: 20,
});

// Customize template
const customized = await client.templates.customize('template-uuid', {
  variables: {
    primaryColor: '#ff6b6b',
    companyName: 'Acme Corp',
  },
});
```

### Analytics and Reporting

```typescript
// Get dashboard metrics
const metrics = await client.analytics.getDashboardMetrics({
  timeRange: '30d',
});

// Get newsletter performance
const performance = await client.analytics.getNewsletterPerformance({
  newsletterIds: ['newsletter-1', 'newsletter-2'],
  timeRange: '7d',
});

// Get contact engagement
const engagement = await client.analytics.getContactEngagement('contact-uuid');

// Track custom event
await client.analytics.trackEvent({
  contactId: 'contact-uuid',
  eventType: 'website_visit',
  metadata: {
    page: '/pricing',
    source: 'newsletter',
    campaign: 'weekly-update',
  },
});
```

### Real-time Subscriptions

```typescript
// Subscribe to newsletter sending progress
const unsubscribe = client.subscriptions.newsletterProgress(
  'newsletter-uuid',
  progress => {
    console.log(`Progress: ${progress.progress}%`);
    console.log(`Sent: ${progress.sent}, Failed: ${progress.failed}`);
  }
);

// Subscribe to contact engagement
const unsubscribeEngagement = client.subscriptions.contactEngagement(
  'contact-uuid',
  event => {
    console.log('New engagement:', event.type, event.metadata);
  }
);

// Unsubscribe when done
unsubscribe();
unsubscribeEngagement();
```

### Error Handling

```typescript
import {
  DatatechtonCRMError,
  ValidationError,
  RateLimitError,
} from '@datatechtoncrm/sdk';

try {
  const newsletter = await client.newsletters.create(invalidData);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.details);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited. Retry after:', error.retryAfter);
  } else if (error instanceof DatatechtonCRMError) {
    console.error('API Error:', error.message, error.code);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Python SDK

### Installation

```bash
pip install datatechtoncrm-python
```

### Quick Start

```python
from datatechtoncrm import DatatechtonCRM
from datatechtoncrm.exceptions import ValidationError, RateLimitError

# Initialize client
client = DatatechtonCRM(
    api_key='your-api-key',
    environment='production'
)

# Or with JWT token
client = DatatechtonCRM(
    token='your-jwt-token',
    environment='production'
)
```

### Configuration

```python
client = DatatechtonCRM(
    api_key='your-api-key',
    environment='production',
    timeout=30,
    retries=3,
    debug=True
)
```

### Newsletter Operations

```python
# Create newsletter
newsletter = client.newsletters.create({
    'title': 'Weekly Python Update',
    'template_id': 'template-uuid',
    'content': {
        'sections': [
            {
                'id': 'section-1',
                'type': 'news',
                'title': 'Python News',
                'items': [
                    {
                        'id': 'item-1',
                        'title': 'Python 3.12 Released',
                        'summary': 'New features and improvements...',
                        'url': 'https://python.org/news',
                        'source': 'Python.org'
                    }
                ],
                'order': 1
            }
        ]
    }
})

# List newsletters
newsletters = client.newsletters.list(
    page_size=20,
    status='sent'
)

# Send newsletter
send_result = client.newsletters.send(newsletter['id'], {
    'segments': ['segment-uuid'],
    'scheduled_at': '2024-01-20T09:00:00Z'
})

print(f"Newsletter queued with job ID: {send_result['job_id']}")
```

### Contact Management

```python
# Create contact
contact = client.contacts.create({
    'email': 'contact@example.com',
    'first_name': 'John',
    'last_name': 'Doe',
    'company': 'Tech Corp',
    'custom_fields': {
        'industry': 'Technology',
        'lead_score': 75
    },
    'tags': ['lead', 'python-developer']
})

# Update contact
updated_contact = client.contacts.update(contact['id'], {
    'custom_fields': {
        'lead_score': 85,
        'last_interaction': '2024-01-15T10:30:00Z'
    }
})

# Search contacts
results = client.contacts.search(
    query='python developer',
    filters={
        'lifecycle': 'lead',
        'tags': ['python-developer']
    }
)
```

### Batch Operations

```python
# Batch create contacts
contacts_data = [
    {'email': 'user1@example.com', 'first_name': 'User', 'last_name': 'One'},
    {'email': 'user2@example.com', 'first_name': 'User', 'last_name': 'Two'},
    # ... more contacts
]

results = client.contacts.batch_create(contacts_data)

# Check results
successful = [r for r in results if 'error' not in r]
failed = [r for r in results if 'error' in r]

print(f"Created {len(successful)} contacts, {len(failed)} failed")
```

### Error Handling

```python
try:
    newsletter = client.newsletters.create(invalid_data)
except ValidationError as e:
    print(f"Validation error: {e.message}")
    for detail in e.details:
        print(f"  {detail['field']}: {detail['message']}")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after} seconds")
    time.sleep(e.retry_after)
except Exception as e:
    print(f"Unexpected error: {e}")
```

## PHP SDK

### Installation

```bash
composer require datatechtoncrm/php-sdk
```

### Quick Start

```php
<?php
require_once 'vendor/autoload.php';

use DatatechtonCRM\Client;
use DatatechtonCRM\Exceptions\ValidationException;

$client = new Client([
    'api_key' => 'your-api-key',
    'environment' => 'production'
]);
```

### Newsletter Management

```php
// Create newsletter
$newsletter = $client->newsletters()->create([
    'title' => 'Weekly PHP Update',
    'template_id' => 'template-uuid',
    'content' => [
        'sections' => [
            [
                'id' => 'section-1',
                'type' => 'news',
                'title' => 'PHP News',
                'items' => [
                    [
                        'id' => 'item-1',
                        'title' => 'PHP 8.3 Features',
                        'summary' => 'New features in PHP 8.3...',
                        'url' => 'https://php.net/news',
                        'source' => 'PHP.net'
                    ]
                ],
                'order' => 1
            ]
        ]
    ]
]);

// Send newsletter
$sendResult = $client->newsletters()->send($newsletter['id'], [
    'segments' => ['segment-uuid']
]);

echo "Newsletter queued with job ID: " . $sendResult['job_id'];
```

### Contact Operations

```php
// Create contact
$contact = $client->contacts()->create([
    'email' => 'contact@example.com',
    'first_name' => 'Jane',
    'last_name' => 'Smith',
    'company' => 'Web Agency',
    'custom_fields' => [
        'industry' => 'Web Development',
        'lead_score' => 80
    ]
]);

// Update contact
$client->contacts()->update($contact['id'], [
    'custom_fields' => [
        'lead_score' => 90
    ]
]);
```

### Error Handling

```php
try {
    $newsletter = $client->newsletters()->create($invalidData);
} catch (ValidationException $e) {
    echo "Validation error: " . $e->getMessage() . "\n";
    foreach ($e->getDetails() as $detail) {
        echo "  {$detail['field']}: {$detail['message']}\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
```

## Ruby SDK

### Installation

```bash
gem install datatechtoncrm
```

### Quick Start

```ruby
require 'datatechtoncrm'

client = DatatechtonCRM::Client.new(
  api_key: 'your-api-key',
  environment: 'production'
)
```

### Newsletter Management

```ruby
# Create newsletter
newsletter = client.newsletters.create(
  title: 'Weekly Ruby Update',
  template_id: 'template-uuid',
  content: {
    sections: [
      {
        id: 'section-1',
        type: 'news',
        title: 'Ruby News',
        items: [
          {
            id: 'item-1',
            title: 'Ruby 3.3 Released',
            summary: 'Performance improvements and new features...',
            url: 'https://ruby-lang.org/news',
            source: 'Ruby Lang'
          }
        ],
        order: 1
      }
    ]
  }
)

# Send newsletter
send_result = client.newsletters.send(newsletter[:id], {
  segments: ['segment-uuid']
})

puts "Newsletter queued with job ID: #{send_result[:job_id]}"
```

### Contact Management

```ruby
# Create contact
contact = client.contacts.create(
  email: 'contact@example.com',
  first_name: 'Bob',
  last_name: 'Johnson',
  company: 'Ruby Shop',
  custom_fields: {
    industry: 'Software Development',
    lead_score: 75
  },
  tags: ['lead', 'ruby-developer']
)

# Search contacts
results = client.contacts.search(
  query: 'ruby developer',
  filters: {
    lifecycle: 'lead'
  }
)
```

## Go SDK

### Installation

```bash
go get github.com/datatechtoncrm/go-sdk
```

### Quick Start

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/datatechtoncrm/go-sdk/datatechtoncrm"
)

func main() {
    client := datatechtoncrm.NewClient(&datatechtoncrm.Config{
        APIKey:      "your-api-key",
        Environment: "production",
    })

    ctx := context.Background()

    // Create newsletter
    newsletter, err := client.Newsletters.Create(ctx, &datatechtoncrm.CreateNewsletterRequest{
        Title:      "Weekly Go Update",
        TemplateID: "template-uuid",
        Content: &datatechtoncrm.NewsletterContent{
            Sections: []datatechtoncrm.ContentSection{
                {
                    ID:    "section-1",
                    Type:  "news",
                    Title: "Go News",
                    Items: []datatechtoncrm.ContentItem{
                        {
                            ID:      "item-1",
                            Title:   "Go 1.22 Released",
                            Summary: "New features and improvements...",
                            URL:     "https://golang.org/news",
                            Source:  "Go Team",
                        },
                    },
                    Order: 1,
                },
            },
        },
    })

    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Created newsletter: %s\n", newsletter.ID)
}
```

### Contact Management

```go
// Create contact
contact, err := client.Contacts.Create(ctx, &datatechtoncrm.CreateContactRequest{
    Email:     "contact@example.com",
    FirstName: "Alice",
    LastName:  "Wilson",
    Company:   "Go Corp",
    CustomFields: map[string]interface{}{
        "industry":   "Technology",
        "lead_score": 80,
    },
    Tags: []string{"lead", "go-developer"},
})

if err != nil {
    log.Fatal(err)
}

fmt.Printf("Created contact: %s\n", contact.ID)
```

## C# SDK

### Installation

```bash
dotnet add package DatatechtonCRM.SDK
```

### Quick Start

```csharp
using DatatechtonCRM;
using DatatechtonCRM.Models;

var client = new DatatechtonCRMClient(new DatatechtonCRMConfig
{
    ApiKey = "your-api-key",
    Environment = "production"
});
```

### Newsletter Management

```csharp
// Create newsletter
var newsletter = await client.Newsletters.CreateAsync(new CreateNewsletterRequest
{
    Title = "Weekly C# Update",
    TemplateId = "template-uuid",
    Content = new NewsletterContent
    {
        Sections = new List<ContentSection>
        {
            new ContentSection
            {
                Id = "section-1",
                Type = "news",
                Title = "C# News",
                Items = new List<ContentItem>
                {
                    new ContentItem
                    {
                        Id = "item-1",
                        Title = ".NET 8 Released",
                        Summary = "Performance improvements and new features...",
                        Url = "https://dotnet.microsoft.com/news",
                        Source = "Microsoft"
                    }
                },
                Order = 1
            }
        }
    }
});

// Send newsletter
var sendResult = await client.Newsletters.SendAsync(newsletter.Id, new SendNewsletterRequest
{
    Segments = new[] { "segment-uuid" }
});

Console.WriteLine($"Newsletter queued with job ID: {sendResult.JobId}");
```

### Contact Management

```csharp
// Create contact
var contact = await client.Contacts.CreateAsync(new CreateContactRequest
{
    Email = "contact@example.com",
    FirstName = "Charlie",
    LastName = "Brown",
    Company = ".NET Solutions",
    CustomFields = new Dictionary<string, object>
    {
        ["industry"] = "Software Development",
        ["lead_score"] = 85
    },
    Tags = new[] { "lead", "dotnet-developer" }
});

// Update contact
await client.Contacts.UpdateAsync(contact.Id, new UpdateContactRequest
{
    CustomFields = new Dictionary<string, object>
    {
        ["lead_score"] = 95,
        ["last_interaction"] = DateTime.UtcNow
    }
});
```

### Error Handling

```csharp
try
{
    var newsletter = await client.Newsletters.CreateAsync(invalidRequest);
}
catch (ValidationException ex)
{
    Console.WriteLine($"Validation error: {ex.Message}");
    foreach (var detail in ex.Details)
    {
        Console.WriteLine($"  {detail.Field}: {detail.Message}");
    }
}
catch (RateLimitException ex)
{
    Console.WriteLine($"Rate limited. Retry after {ex.RetryAfter} seconds");
    await Task.Delay(TimeSpan.FromSeconds(ex.RetryAfter));
}
catch (DatatechtonCRMException ex)
{
    Console.WriteLine($"API error: {ex.Message} (Code: {ex.Code})");
}
```

## Common Patterns

### Pagination Helper

```typescript
// JavaScript/TypeScript
async function getAllItems<T>(
  fetchFunction: (cursor?: string) => Promise<{ data: T[]; pagination: any }>,
  pageSize = 100
): Promise<T[]> {
  const allItems: T[] = [];
  let cursor: string | undefined;

  do {
    const response = await fetchFunction(cursor);
    allItems.push(...response.data);
    cursor = response.pagination.nextCursor;
  } while (response.pagination.hasNext);

  return allItems;
}

// Usage
const allNewsletters = await getAllItems(cursor =>
  client.newsletters.list({ pageSize: 100, cursor })
);
```

### Retry with Exponential Backoff

```python
# Python
import time
import random
from datatechtoncrm.exceptions import RateLimitError

def retry_with_backoff(func, max_retries=3):
    def wrapper(*args, **kwargs):
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except RateLimitError as e:
                if attempt == max_retries - 1:
                    raise

                # Exponential backoff with jitter
                delay = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(delay)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                time.sleep(1)

    return wrapper

# Usage
@retry_with_backoff
def create_newsletter_with_retry(data):
    return client.newsletters.create(data)
```

### Webhook Verification

```php
// PHP
function verifyWebhook($payload, $signature, $secret) {
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    return hash_equals($expectedSignature, $signature);
}

// Usage in webhook handler
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_DATATECHTONCRM_SIGNATURE'];

if (!verifyWebhook($payload, $signature, $webhookSecret)) {
    http_response_code(401);
    exit('Invalid signature');
}

$event = json_decode($payload, true);
// Process webhook event
```

## Testing

### Mock Client for Testing

```typescript
// JavaScript/TypeScript
import { DatatechtonCRM } from '@datatechtoncrm/sdk';

// Create mock client for testing
const mockClient = {
  newsletters: {
    create: jest.fn().mockResolvedValue({ id: 'mock-newsletter-id' }),
    send: jest.fn().mockResolvedValue({ jobId: 'mock-job-id' }),
  },
  contacts: {
    create: jest.fn().mockResolvedValue({ id: 'mock-contact-id' }),
  },
} as jest.Mocked<DatatechtonCRM>;

// Use in tests
test('should create newsletter', async () => {
  const result = await mockClient.newsletters.create({
    title: 'Test Newsletter',
  });

  expect(result.id).toBe('mock-newsletter-id');
  expect(mockClient.newsletters.create).toHaveBeenCalledWith({
    title: 'Test Newsletter',
  });
});
```

## Support and Resources

- **SDK Documentation**: https://docs.datatechtoncrm.com/sdks
- **API Reference**: https://docs.datatechtoncrm.com/api
- **GitHub Repositories**:
  - JavaScript: https://github.com/datatechtoncrm/js-sdk
  - Python: https://github.com/datatechtoncrm/python-sdk
  - PHP: https://github.com/datatechtoncrm/php-sdk
- **Support**: sdk-support@datatechtoncrm.com
- **Community**: https://community.datatechtoncrm.com

For additional help or feature requests, please open an issue in the respective
SDK repository or contact our support team.
