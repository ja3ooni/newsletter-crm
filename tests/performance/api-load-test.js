import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for load testing
const apiCalls = new Counter('api_calls');
const apiErrors = new Rate('api_errors');
const apiResponseTime = new Trend('api_response_time');
const serviceMetrics = new Counter('service_calls');

export const options = {
  scenarios: {
    // Health check scenario - basic system availability
    health_check: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
    },
    // User operations load testing
    user_operations: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 25 },
        { duration: '1m', target: 0 },
      ],
      startTime: '30s',
    },
    // Newsletter operations load testing
    newsletter_operations: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 15 },
        { duration: '4m', target: 30 },
        { duration: '1m', target: 0 },
      ],
      startTime: '1m',
    },
    // Content operations load testing
    content_operations: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5m',
      startTime: '2m',
    },
    // CRM operations load testing
    crm_operations: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '3m', target: 35 },
        { duration: '1m', target: 5 },
      ],
      startTime: '1m30s',
    },
    // Analytics operations load testing
    analytics_operations: {
      executor: 'constant-vus',
      vus: 10,
      duration: '6m',
      startTime: '3m',
    },
  },
  thresholds: {
    api_response_time: ['p(95)<2000'], // 95% of API calls under 2s
    api_errors: ['rate<0.05'], // Less than 5% error rate
    http_req_duration: ['p(95)<3000'], // Overall response time
    http_req_failed: ['rate<0.1'], // Overall error rate
    checks: ['rate>0.9'], // 90% of checks should pass
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME;

  switch (scenario) {
    case 'health_check':
      testHealthEndpoints();
      break;
    case 'user_operations':
      testUserOperations();
      break;
    case 'newsletter_operations':
      testNewsletterOperations();
      break;
    case 'content_operations':
      testContentOperations();
      break;
    case 'crm_operations':
      testCRMOperations();
      break;
    case 'analytics_operations':
      testAnalyticsOperations();
      break;
    default:
      testHealthEndpoints();
  }

  sleep(1);
}

function testHealthEndpoints() {
  // Test basic system health and availability
  const healthResponse = http.get(`${BASE_URL}/health`);

  const success = check(healthResponse, {
    'health check status is 200': r => r.status === 200,
    'health check response time < 500ms': r => r.timings.duration < 500,
  });

  apiCalls.add(1);
  apiErrors.add(!success);
  apiResponseTime.add(healthResponse.timings.duration);
  serviceMetrics.add(1, { service: 'health' });

  // Test service-specific health endpoints
  const services = [
    'user-service',
    'newsletter-service',
    'content-service',
    'crm-service',
    'analytics-service',
  ];
  const service = services[Math.floor(Math.random() * services.length)];

  const serviceHealthResponse = http.get(
    `${BASE_URL}/api/v1/${service}/health`
  );

  check(serviceHealthResponse, {
    [`${service} health status is 200`]: r => r.status === 200,
    [`${service} health response time < 1s`]: r => r.timings.duration < 1000,
  });

  apiCalls.add(1);
  serviceMetrics.add(1, { service });
}

function testUserOperations() {
  // Test user-related API operations
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  // Get user profile
  const profileResponse = http.get(`${BASE_URL}/api/v1/users/profile`, {
    headers,
  });

  const profileSuccess = check(profileResponse, {
    'user profile status is 200': r => r.status === 200,
    'user profile response time < 500ms': r => r.timings.duration < 500,
  });

  apiCalls.add(1);
  apiErrors.add(!profileSuccess);
  apiResponseTime.add(profileResponse.timings.duration);
  serviceMetrics.add(1, { service: 'user' });

  sleep(0.5);

  // Update user preferences
  const preferencesPayload = {
    emailFrequency: 'weekly',
    contentTypes: ['articles', 'news'],
    topics: ['technology', 'ai'],
    timezone: 'UTC',
  };

  const preferencesResponse = http.put(
    `${BASE_URL}/api/v1/users/preferences`,
    JSON.stringify(preferencesPayload),
    { headers }
  );

  const preferencesSuccess = check(preferencesResponse, {
    'preferences update status is 200': r => r.status === 200,
    'preferences update response time < 800ms': r => r.timings.duration < 800,
  });

  apiCalls.add(1);
  apiErrors.add(!preferencesSuccess);
  apiResponseTime.add(preferencesResponse.timings.duration);
  serviceMetrics.add(1, { service: 'user' });

  sleep(0.5);

  // Get subscription info
  const subscriptionResponse = http.get(
    `${BASE_URL}/api/v1/users/subscription`,
    { headers }
  );

  check(subscriptionResponse, {
    'subscription info status is 200': r => r.status === 200,
    'subscription info response time < 300ms': r => r.timings.duration < 300,
  });

  apiCalls.add(1);
  serviceMetrics.add(1, { service: 'user' });
}

function testNewsletterOperations() {
  // Test newsletter-related API operations
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  // Get newsletters list
  const newslettersResponse = http.get(
    `${BASE_URL}/api/v1/newsletters?limit=25`,
    { headers }
  );

  const newslettersSuccess = check(newslettersResponse, {
    'newsletters list status is 200': r => r.status === 200,
    'newsletters list response time < 1s': r => r.timings.duration < 1000,
  });

  apiCalls.add(1);
  apiErrors.add(!newslettersSuccess);
  apiResponseTime.add(newslettersResponse.timings.duration);
  serviceMetrics.add(1, { service: 'newsletter' });

  sleep(1);

  // Get newsletter templates
  const templatesResponse = http.get(
    `${BASE_URL}/api/v1/newsletters/templates`,
    { headers }
  );

  check(templatesResponse, {
    'templates list status is 200': r => r.status === 200,
    'templates list response time < 500ms': r => r.timings.duration < 500,
  });

  apiCalls.add(1);
  serviceMetrics.add(1, { service: 'newsletter' });

  sleep(1);

  // Generate newsletter (async operation)
  const generatePayload = {
    sections: ['news', 'research'],
    template: 'modern',
    personalization: true,
  };

  const generateResponse = http.post(
    `${BASE_URL}/api/v1/newsletters/generate`,
    JSON.stringify(generatePayload),
    { headers, timeout: '30s' }
  );

  const generateSuccess = check(generateResponse, {
    'newsletter generation status is 202': r => r.status === 202,
    'newsletter generation response time < 5s': r => r.timings.duration < 5000,
  });

  apiCalls.add(1);
  apiErrors.add(!generateSuccess);
  apiResponseTime.add(generateResponse.timings.duration);
  serviceMetrics.add(1, { service: 'newsletter' });
}

function testContentOperations() {
  // Test content-related API operations (public endpoints)

  // Get trending content
  const trendingResponse = http.get(
    `${BASE_URL}/api/v1/content/trending?limit=20`
  );

  const trendingSuccess = check(trendingResponse, {
    'trending content status is 200': r => r.status === 200,
    'trending content response time < 1s': r => r.timings.duration < 1000,
  });

  apiCalls.add(1);
  apiErrors.add(!trendingSuccess);
  apiResponseTime.add(trendingResponse.timings.duration);
  serviceMetrics.add(1, { service: 'content' });

  sleep(0.5);

  // Search content
  const searchTerms = [
    'AI',
    'blockchain',
    'javascript',
    'startup',
    'technology',
  ];
  const searchTerm =
    searchTerms[Math.floor(Math.random() * searchTerms.length)];

  const searchResponse = http.get(
    `${BASE_URL}/api/v1/content/search?q=${searchTerm}&limit=15`
  );

  check(searchResponse, {
    'content search status is 200': r => r.status === 200,
    'content search response time < 1.5s': r => r.timings.duration < 1500,
  });

  apiCalls.add(1);
  serviceMetrics.add(1, { service: 'content' });

  sleep(0.5);

  // Get content categories
  const categoriesResponse = http.get(`${BASE_URL}/api/v1/content/categories`);

  check(categoriesResponse, {
    'categories status is 200': r => r.status === 200,
    'categories response time < 300ms': r => r.timings.duration < 300,
  });

  apiCalls.add(1);
  serviceMetrics.add(1, { service: 'content' });
}

function testCRMOperations() {
  // Test CRM-related API operations
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  // Get contacts list
  const contactsResponse = http.get(`${BASE_URL}/api/v1/contacts?limit=50`, {
    headers,
  });

  const contactsSuccess = check(contactsResponse, {
    'contacts list status is 200': r => r.status === 200,
    'contacts list response time < 1s': r => r.timings.duration < 1000,
  });

  apiCalls.add(1);
  apiErrors.add(!contactsSuccess);
  apiResponseTime.add(contactsResponse.timings.duration);
  serviceMetrics.add(1, { service: 'crm' });

  sleep(1);

  // Get segments
  const segmentsResponse = http.get(`${BASE_URL}/api/v1/contacts/segments`, {
    headers,
  });

  check(segmentsResponse, {
    'segments list status is 200': r => r.status === 200,
    'segments list response time < 800ms': r => r.timings.duration < 800,
  });

  apiCalls.add(1);
  serviceMetrics.add(1, { service: 'crm' });

  sleep(0.5);

  // Create a test contact
  const contactPayload = {
    email: `load-test-${Math.random()}@example.com`,
    firstName: 'Load',
    lastName: 'Test',
    company: 'Test Company',
    leadScore: Math.floor(Math.random() * 100),
  };

  const createContactResponse = http.post(
    `${BASE_URL}/api/v1/contacts`,
    JSON.stringify(contactPayload),
    { headers }
  );

  const createSuccess = check(createContactResponse, {
    'contact creation status is 201': r => r.status === 201,
    'contact creation response time < 600ms': r => r.timings.duration < 600,
  });

  apiCalls.add(1);
  apiErrors.add(!createSuccess);
  apiResponseTime.add(createContactResponse.timings.duration);
  serviceMetrics.add(1, { service: 'crm' });

  sleep(0.5);

  // Search contacts
  const searchResponse = http.get(
    `${BASE_URL}/api/v1/contacts/search?q=test&limit=20`,
    { headers }
  );

  check(searchResponse, {
    'contact search status is 200': r => r.status === 200,
    'contact search response time < 1s': r => r.timings.duration < 1000,
  });

  apiCalls.add(1);
  serviceMetrics.add(1, { service: 'crm' });
}

function testAnalyticsOperations() {
  // Test analytics-related API operations
  const headers = {
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  // Get analytics dashboard
  const dashboardResponse = http.get(`${BASE_URL}/api/v1/analytics/dashboard`, {
    headers,
  });

  const dashboardSuccess = check(dashboardResponse, {
    'analytics dashboard status is 200': r => r.status === 200,
    'analytics dashboard response time < 3s': r => r.timings.duration < 3000,
  });

  apiCalls.add(1);
  apiErrors.add(!dashboardSuccess);
  apiResponseTime.add(dashboardResponse.timings.duration);
  serviceMetrics.add(1, { service: 'analytics' });

  sleep(2);

  // Get engagement metrics
  const engagementResponse = http.get(
    `${BASE_URL}/api/v1/analytics/engagement?period=30d&granularity=daily`,
    { headers }
  );

  check(engagementResponse, {
    'engagement metrics status is 200': r => r.status === 200,
    'engagement metrics response time < 2s': r => r.timings.duration < 2000,
  });

  apiCalls.add(1);
  serviceMetrics.add(1, { service: 'analytics' });

  sleep(1);

  // Get subscriber analytics
  const subscribersResponse = http.get(
    `${BASE_URL}/api/v1/analytics/subscribers?period=90d`,
    { headers }
  );

  check(subscribersResponse, {
    'subscriber analytics status is 200': r => r.status === 200,
    'subscriber analytics response time < 1.5s': r => r.timings.duration < 1500,
  });

  apiCalls.add(1);
  serviceMetrics.add(1, { service: 'analytics' });
}

export function handleSummary(data) {
  const totalCalls = data.metrics.api_calls
    ? data.metrics.api_calls.values.count
    : 0;
  const errorRate = data.metrics.api_errors
    ? data.metrics.api_errors.values.rate * 100
    : 0;
  const avgResponseTime = data.metrics.api_response_time
    ? data.metrics.api_response_time.values.avg
    : 0;
  const p95ResponseTime = data.metrics.api_response_time
    ? data.metrics.api_response_time.values['p(95)']
    : 0;

  return {
    'api-load-test-results.json': JSON.stringify(data, null, 2),
    stdout: `
    ========================================
    API Load Test Summary
    ========================================
    Total API Calls: ${totalCalls}
    Error Rate: ${errorRate.toFixed(2)}%
    Average Response Time: ${avgResponseTime.toFixed(2)}ms
    95th Percentile Response Time: ${p95ResponseTime.toFixed(2)}ms

    Overall Performance:
    - Total HTTP Requests: ${data.metrics.http_reqs.values.count}
    - HTTP Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
    - Average HTTP Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
    - 95th Percentile HTTP Response: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
    ========================================
    `,
  };
}
