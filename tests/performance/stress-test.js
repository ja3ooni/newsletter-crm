import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 300 },   // Ramp up to 300 users (stress level)
    { duration: '5m', target: 500 },   // Ramp up to 500 users (breaking point)
    { duration: '2m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s (relaxed for stress)
    http_req_failed: ['rate<0.3'],     // Error rate must be below 30% (relaxed for stress)
    errors: ['rate<0.3'],              // Custom error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export default function () {
  // Stress test focuses on high-load scenarios
  const scenarios = [
    heavyContentSearch,
    bulkUserOperations,
    intensiveAnalytics,
    concurrentNewsletterGeneration,
    massContactOperations,
  ];

  // Randomly select a scenario with weighted distribution
  const weights = [0.3, 0.2, 0.2, 0.15, 0.15];
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (let i = 0; i < scenarios.length; i++) {
    cumulativeWeight += weights[i];
    if (random <= cumulativeWeight) {
      scenarios[i]();
      break;
    }
  }

  // Reduced sleep time to increase load
  sleep(Math.random() * 0.5);
}

function heavyContentSearch() {
  // Perform multiple concurrent searches
  const searches = [
    'artificial intelligence machine learning',
    'blockchain cryptocurrency bitcoin',
    'cloud computing aws azure',
    'javascript typescript react',
    'python django flask',
  ];

  const searchQuery = searches[Math.floor(Math.random() * searches.length)];
  
  // Multiple search requests to stress the system
  const requests = [
    ['GET', `${BASE_URL}/api/v1/content/search?q=${searchQuery}&limit=50`],
    ['GET', `${BASE_URL}/api/v1/content/search?q=${searchQuery}&sort=date&limit=30`],
    ['GET', `${BASE_URL}/api/v1/content/trending?category=tech&limit=20`],
    ['GET', `${BASE_URL}/api/v1/content/categories`],
  ];

  const responses = http.batch(requests);
  
  responses.forEach((response, index) => {
    const success = check(response, {
      [`search request ${index} status is 200`]: (r) => r.status === 200,
      [`search request ${index} response time < 3000ms`]: (r) => r.timings.duration < 3000,
    });

    errorRate.add(!success);
    responseTime.add(response.timings.duration);
  });
}

function bulkUserOperations() {
  // Simulate bulk user operations
  const operations = [];
  
  for (let i = 0; i < 5; i++) {
    const email = `stresstest${Math.random()}@example.com`;
    operations.push([
      'POST',
      `${BASE_URL}/api/v1/users/register`,
      JSON.stringify({
        email: email,
        password: 'stresstest123',
        firstName: `User${i}`,
        lastName: 'StressTest',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    ]);
  }

  const responses = http.batch(operations);
  
  responses.forEach((response, index) => {
    const success = check(response, {
      [`bulk user operation ${index} completed`]: (r) => r.status === 201 || r.status === 409, // 409 for duplicate email
      [`bulk user operation ${index} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    });

    errorRate.add(!success);
    responseTime.add(response.timings.duration);
  });
}

function intensiveAnalytics() {
  // Request multiple analytics endpoints simultaneously
  const analyticsRequests = [
    ['GET', `${BASE_URL}/api/v1/analytics/dashboard`],
    ['GET', `${BASE_URL}/api/v1/analytics/engagement?period=30d`],
    ['GET', `${BASE_URL}/api/v1/analytics/subscribers?period=7d`],
    ['GET', `${BASE_URL}/api/v1/analytics/content-performance?limit=100`],
    ['GET', `${BASE_URL}/api/v1/analytics/revenue?period=30d`],
  ];

  const responses = http.batch(analyticsRequests);
  
  responses.forEach((response, index) => {
    const success = check(response, {
      [`analytics request ${index} status is 200`]: (r) => r.status === 200,
      [`analytics request ${index} response time < 5000ms`]: (r) => r.timings.duration < 5000,
    });

    errorRate.add(!success);
    responseTime.add(response.timings.duration);
  });
}

function concurrentNewsletterGeneration() {
  // Simulate concurrent newsletter operations
  const newsletterRequests = [
    ['GET', `${BASE_URL}/api/v1/newsletters?limit=50`],
    ['GET', `${BASE_URL}/api/v1/newsletters/templates`],
    ['POST', `${BASE_URL}/api/v1/newsletters/generate`, JSON.stringify({
      sections: ['tech', 'ai', 'startup'],
      personalization: true,
      template: 'default',
    }), { headers: { 'Content-Type': 'application/json' } }],
  ];

  const responses = http.batch(newsletterRequests);
  
  responses.forEach((response, index) => {
    const success = check(response, {
      [`newsletter request ${index} completed`]: (r) => r.status >= 200 && r.status < 400,
      [`newsletter request ${index} response time < 10000ms`]: (r) => r.timings.duration < 10000,
    });

    errorRate.add(!success);
    responseTime.add(response.timings.duration);
  });
}

function massContactOperations() {
  // Simulate mass contact operations
  const contactRequests = [
    ['GET', `${BASE_URL}/api/v1/contacts?limit=100&sort=created_at`],
    ['GET', `${BASE_URL}/api/v1/contacts/segments`],
    ['GET', `${BASE_URL}/api/v1/contacts/search?q=test&limit=50`],
    ['POST', `${BASE_URL}/api/v1/contacts/bulk-import`, JSON.stringify({
      contacts: Array.from({ length: 10 }, (_, i) => ({
        email: `bulk${Math.random()}@example.com`,
        firstName: `Bulk${i}`,
        lastName: 'Contact',
      })),
    }), { headers: { 'Content-Type': 'application/json' } }],
  ];

  const responses = http.batch(contactRequests);
  
  responses.forEach((response, index) => {
    const success = check(response, {
      [`contact request ${index} completed`]: (r) => r.status >= 200 && r.status < 400,
      [`contact request ${index} response time < 3000ms`]: (r) => r.timings.duration < 3000,
    });

    errorRate.add(!success);
    responseTime.add(response.timings.duration);
  });
}

export function handleSummary(data) {
  return {
    'stress-test-results.json': JSON.stringify(data, null, 2),
    stdout: `
    ========================================
    Stress Test Summary
    ========================================
    Total Requests: ${data.metrics.http_reqs.values.count}
    Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%
    Average Response Time: ${data.metrics.http_req_duration.values.avg}ms
    95th Percentile: ${data.metrics.http_req_duration.values['p(95)']}ms
    99th Percentile: ${data.metrics.http_req_duration.values['p(99)']}ms
    Max Response Time: ${data.metrics.http_req_duration.values.max}ms
    
    Breaking Point Analysis:
    - System handled ${data.metrics.http_reqs.values.count} total requests
    - Error rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
    - Peak concurrent users: 500
    ========================================
    `,
  };
}