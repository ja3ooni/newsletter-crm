import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for email performance
const emailSendRate = new Rate('email_send_success');
const emailSendTime = new Trend('email_send_duration');
const emailQueueTime = new Trend('email_queue_duration');
const emailsProcessed = new Counter('emails_processed');
const emailErrors = new Rate('email_errors');

export const options = {
  scenarios: {
    // Test bulk email sending capacity
    bulk_email_sending: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 5 }, // Ramp up to 5 concurrent senders
        { duration: '3m', target: 10 }, // Increase to 10 concurrent senders
        { duration: '5m', target: 15 }, // Peak at 15 concurrent senders
        { duration: '2m', target: 5 }, // Ramp down to 5
        { duration: '1m', target: 0 }, // Ramp down to 0
      ],
    },
    // Test newsletter generation under load
    newsletter_generation: {
      executor: 'constant-vus',
      vus: 3,
      duration: '10m',
      startTime: '2m', // Start after bulk email test begins
    },
    // Test email template rendering performance
    template_rendering: {
      executor: 'constant-arrival-rate',
      rate: 20, // 20 requests per second
      timeUnit: '1s',
      duration: '8m',
      preAllocatedVUs: 5,
      maxVUs: 20,
      startTime: '1m',
    },
  },
  thresholds: {
    email_send_duration: ['p(95)<5000'], // 95% of email sends complete within 5s
    email_queue_duration: ['p(95)<1000'], // 95% of queue operations complete within 1s
    email_send_success: ['rate>0.95'], // 95% success rate for email sending
    email_errors: ['rate<0.05'], // Less than 5% error rate
    http_req_duration: ['p(95)<3000'], // API response times
    http_req_failed: ['rate<0.1'], // API error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME;

  switch (scenario) {
    case 'bulk_email_sending':
      testBulkEmailSending();
      break;
    case 'newsletter_generation':
      testNewsletterGeneration();
      break;
    case 'template_rendering':
      testTemplateRendering();
      break;
    default:
      testBulkEmailSending();
  }

  sleep(1);
}

function testBulkEmailSending() {
  // Test sending emails to multiple recipients
  const batchSizes = [10, 25, 50, 100];
  const batchSize = batchSizes[Math.floor(Math.random() * batchSizes.length)];

  const recipients = [];
  for (let i = 0; i < batchSize; i++) {
    recipients.push({
      email: `perf-test-${Math.random()}@example.com`,
      firstName: `User${i}`,
      lastName: 'Test',
      preferences: {
        topics: ['technology', 'ai'],
        format: 'html',
      },
    });
  }

  const emailPayload = {
    newsletterId: 'test-newsletter-123',
    recipients: recipients,
    sendOptions: {
      enableTracking: true,
      respectTimezones: false, // Disable for performance testing
      batchSize: Math.min(batchSize, 25), // Limit batch size
      priority: 'normal',
    },
  };

  const startTime = Date.now();

  const response = http.post(
    `${BASE_URL}/api/v1/newsletters/send-bulk`,
    JSON.stringify(emailPayload),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      timeout: '30s',
    }
  );

  const sendDuration = Date.now() - startTime;
  emailSendTime.add(sendDuration);

  const success = check(response, {
    'bulk email send status is 202': r => r.status === 202,
    'bulk email send has job ID': r => {
      try {
        const body = JSON.parse(r.body);
        return body.jobId !== undefined;
      } catch (e) {
        return false;
      }
    },
    'bulk email send response time < 10s': r => r.timings.duration < 10000,
  });

  emailSendRate.add(success);
  emailErrors.add(!success);
  emailsProcessed.add(batchSize);

  if (success && response.status === 202) {
    const jobId = JSON.parse(response.body).jobId;

    // Monitor job progress
    let jobComplete = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!jobComplete && attempts < maxAttempts) {
      sleep(2);

      const statusResponse = http.get(
        `${BASE_URL}/api/v1/newsletters/jobs/${jobId}`,
        {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
          timeout: '10s',
        }
      );

      if (statusResponse.status === 200) {
        const status = JSON.parse(statusResponse.body);
        if (status.status === 'completed' || status.status === 'failed') {
          jobComplete = true;

          const queueDuration = Date.now() - startTime;
          emailQueueTime.add(queueDuration);

          check(status, {
            'email job completed successfully': s => s.status === 'completed',
            'email job has results': s => s.result !== undefined,
          });
        }
      }

      attempts++;
    }
  }
}

function testNewsletterGeneration() {
  // Test newsletter generation performance under load
  const generationPayload = {
    sections: ['news', 'research', 'github', 'events'],
    personalization: {
      userId: `perf-user-${Math.random()}`,
      preferences: {
        topics: ['artificial-intelligence', 'web-development', 'startups'],
        difficulty: 'intermediate',
        contentTypes: ['articles', 'tutorials', 'news'],
      },
    },
    contentFilters: {
      minScore: 0.6,
      maxAge: 48, // hours
      sources: ['techcrunch', 'github', 'arxiv', 'hackernews'],
    },
    template: 'modern-tech',
  };

  const startTime = Date.now();

  const response = http.post(
    `${BASE_URL}/api/v1/newsletters/generate`,
    JSON.stringify(generationPayload),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      timeout: '60s',
    }
  );

  const success = check(response, {
    'newsletter generation status is 202': r => r.status === 202,
    'newsletter generation has job ID': r => {
      try {
        const body = JSON.parse(r.body);
        return body.jobId !== undefined;
      } catch (e) {
        return false;
      }
    },
    'newsletter generation response time < 5s': r => r.timings.duration < 5000,
  });

  if (success && response.status === 202) {
    const jobId = JSON.parse(response.body).jobId;

    // Monitor generation progress
    let generationComplete = false;
    let attempts = 0;
    const maxAttempts = 20; // Newsletter generation can take longer

    while (!generationComplete && attempts < maxAttempts) {
      sleep(3);

      const statusResponse = http.get(
        `${BASE_URL}/api/v1/newsletters/jobs/${jobId}`,
        {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
          timeout: '10s',
        }
      );

      if (statusResponse.status === 200) {
        const status = JSON.parse(statusResponse.body);
        if (status.status === 'completed' || status.status === 'failed') {
          generationComplete = true;

          const generationDuration = Date.now() - startTime;

          check(status, {
            'newsletter generation completed successfully': s =>
              s.status === 'completed',
            'newsletter generation has content': s =>
              s.result && s.result.content,
            'newsletter generation time < 60s': () =>
              generationDuration < 60000,
          });
        }
      }

      attempts++;
    }
  }
}

function testTemplateRendering() {
  // Test email template rendering performance
  const templates = ['modern-tech', 'classic', 'minimal', 'newsletter-pro'];
  const template = templates[Math.floor(Math.random() * templates.length)];

  const renderPayload = {
    templateId: template,
    data: {
      user: {
        firstName: 'Performance',
        lastName: 'Test',
        email: 'perf@test.com',
      },
      newsletter: {
        title: 'Performance Test Newsletter',
        sections: [
          {
            type: 'news',
            title: 'Tech News',
            items: Array.from({ length: 10 }, (_, i) => ({
              title: `Article ${i + 1}`,
              summary: 'This is a test article for performance testing.',
              url: `https://example.com/article-${i + 1}`,
              source: 'Test Source',
              publishedAt: new Date().toISOString(),
            })),
          },
          {
            type: 'research',
            title: 'Research Papers',
            items: Array.from({ length: 5 }, (_, i) => ({
              title: `Research Paper ${i + 1}`,
              summary: 'This is a test research paper for performance testing.',
              url: `https://example.com/paper-${i + 1}`,
              source: 'ArXiv',
              publishedAt: new Date().toISOString(),
            })),
          },
        ],
      },
      personalization: {
        topics: ['ai', 'technology'],
        recommendations: Array.from({ length: 3 }, (_, i) => ({
          title: `Recommended Article ${i + 1}`,
          url: `https://example.com/rec-${i + 1}`,
        })),
      },
    },
    options: {
      format: 'html',
      includeTracking: true,
      minify: true,
    },
  };

  const response = http.post(
    `${BASE_URL}/api/v1/templates/render`,
    JSON.stringify(renderPayload),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      timeout: '15s',
    }
  );

  const success = check(response, {
    'template rendering status is 200': r => r.status === 200,
    'template rendering has HTML': r => {
      try {
        const body = JSON.parse(r.body);
        return body.html && body.html.length > 0;
      } catch (e) {
        return false;
      }
    },
    'template rendering response time < 2s': r => r.timings.duration < 2000,
    'template rendering HTML size > 1KB': r => {
      try {
        const body = JSON.parse(r.body);
        return body.html && body.html.length > 1024;
      } catch (e) {
        return false;
      }
    },
  });

  emailErrors.add(!success);
}

export function handleSummary(data) {
  const emailsSent = data.metrics.emails_processed
    ? data.metrics.emails_processed.values.count
    : 0;
  const avgSendTime = data.metrics.email_send_duration
    ? data.metrics.email_send_duration.values.avg
    : 0;
  const avgQueueTime = data.metrics.email_queue_duration
    ? data.metrics.email_queue_duration.values.avg
    : 0;
  const successRate = data.metrics.email_send_success
    ? data.metrics.email_send_success.values.rate * 100
    : 0;

  return {
    'email-performance-results.json': JSON.stringify(data, null, 2),
    stdout: `
    ========================================
    Email Performance Test Summary
    ========================================
    Total Emails Processed: ${emailsSent}
    Email Success Rate: ${successRate.toFixed(2)}%
    Average Send Time: ${avgSendTime.toFixed(2)}ms
    Average Queue Time: ${avgQueueTime.toFixed(2)}ms

    Email Throughput: ${emailsSent > 0 ? (emailsSent / (data.state.testRunDurationMs / 1000)).toFixed(2) : 0} emails/second

    API Performance:
    - Total API Requests: ${data.metrics.http_reqs.values.count}
    - API Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
    - Average API Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
    - 95th Percentile API Response: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
    ========================================
    `,
  };
}
