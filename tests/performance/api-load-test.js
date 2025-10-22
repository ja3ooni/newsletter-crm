import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate must be below 10%
    errors: ['rate<0.1'],             // Custom error rate
    response_time: ['p(95)<500'],     // Custom response time metric
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export default function () {
  const scenarios = [
    healthCheck,
    userOperations,
    newsletterOperations,
    contentOperations,
    crmOperations,
    analyticsOperations,
  ];

  // Randomly select a scenario
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  scenario();

  sleep(1);
}

function healthCheck() {
  const response = http.get(`${BASE_URL}/health`);
  
  const success = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function userOperations() {
  // User registration
  const registerPayload = {
    email: `test${Math.random()}@example.com`,
    password: 'testpassword123',
    firstName: 'Test',
    lastName: 'User',
  };

  const registerResponse = http.post(
    `${BASE_URL}/api/v1/users/register`,
    JSON.stringify(registerPayload),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const registerSuccess = check(registerResponse, {
    'user registration status is 201': (r) => r.status === 201,
    'user registration response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!registerSuccess);
  responseTime.add(registerResponse.timings.duration);

  if (registerResponse.status === 201) {
    // User login
    const loginPayload = {
      email: registerPayload.email,
      password: registerPayload.password,
    };

    const loginResponse = http.post(
      `${BASE_URL}/api/v1/users/login`,
      JSON.stringify(loginPayload),
      { headers: { 'Content-Type': 'application/json' } }
    );

    const loginSuccess = check(loginResponse, {
      'user login status is 200': (r) => r.status === 200,
      'user login response time < 500ms': (r) => r.timings.duration < 500,
      'login returns token': (r) => JSON.parse(r.body).token !== undefined,
    });

    errorRate.add(!loginSuccess);
    responseTime.add(loginResponse.timings.duration);

    if (loginResponse.status === 200) {
      const token = JSON.parse(loginResponse.body).token;
      
      // Get user profile
      const profileResponse = http.get(
        `${BASE_URL}/api/v1/users/profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const profileSuccess = check(profileResponse, {
        'get profile status is 200': (r) => r.status === 200,
        'get profile response time < 300ms': (r) => r.timings.duration < 300,
      });

      errorRate.add(!profileSuccess);
      responseTime.add(profileResponse.timings.duration);
    }
  }
}

function newsletterOperations() {
  // Get newsletters list
  const newslettersResponse = http.get(`${BASE_URL}/api/v1/newsletters`);
  
  const success = check(newslettersResponse, {
    'newsletters list status is 200': (r) => r.status === 200,
    'newsletters list response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  responseTime.add(newslettersResponse.timings.duration);

  // Get newsletter by ID (if any exist)
  if (newslettersResponse.status === 200) {
    const newsletters = JSON.parse(newslettersResponse.body);
    if (newsletters.length > 0) {
      const newsletterId = newsletters[0].id;
      const newsletterResponse = http.get(`${BASE_URL}/api/v1/newsletters/${newsletterId}`);
      
      const detailSuccess = check(newsletterResponse, {
        'newsletter detail status is 200': (r) => r.status === 200,
        'newsletter detail response time < 300ms': (r) => r.timings.duration < 300,
      });

      errorRate.add(!detailSuccess);
      responseTime.add(newsletterResponse.timings.duration);
    }
  }
}

function contentOperations() {
  // Search content
  const searchQuery = ['AI', 'technology', 'startup', 'development'][Math.floor(Math.random() * 4)];
  const searchResponse = http.get(`${BASE_URL}/api/v1/content/search?q=${searchQuery}&limit=10`);
  
  const success = check(searchResponse, {
    'content search status is 200': (r) => r.status === 200,
    'content search response time < 800ms': (r) => r.timings.duration < 800,
  });

  errorRate.add(!success);
  responseTime.add(searchResponse.timings.duration);

  // Get trending content
  const trendingResponse = http.get(`${BASE_URL}/api/v1/content/trending`);
  
  const trendingSuccess = check(trendingResponse, {
    'trending content status is 200': (r) => r.status === 200,
    'trending content response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!trendingSuccess);
  responseTime.add(trendingResponse.timings.duration);
}

function crmOperations() {
  // Get contacts list
  const contactsResponse = http.get(`${BASE_URL}/api/v1/contacts?limit=20`);
  
  const success = check(contactsResponse, {
    'contacts list status is 200': (r) => r.status === 200,
    'contacts list response time < 600ms': (r) => r.timings.duration < 600,
  });

  errorRate.add(!success);
  responseTime.add(contactsResponse.timings.duration);

  // Get segments
  const segmentsResponse = http.get(`${BASE_URL}/api/v1/contacts/segments`);
  
  const segmentsSuccess = check(segmentsResponse, {
    'segments list status is 200': (r) => r.status === 200,
    'segments list response time < 400ms': (r) => r.timings.duration < 400,
  });

  errorRate.add(!segmentsSuccess);
  responseTime.add(segmentsResponse.timings.duration);
}

function analyticsOperations() {
  // Get dashboard metrics
  const metricsResponse = http.get(`${BASE_URL}/api/v1/analytics/dashboard`);
  
  const success = check(metricsResponse, {
    'analytics dashboard status is 200': (r) => r.status === 200,
    'analytics dashboard response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!success);
  responseTime.add(metricsResponse.timings.duration);

  // Get engagement metrics
  const engagementResponse = http.get(`${BASE_URL}/api/v1/analytics/engagement?period=7d`);
  
  const engagementSuccess = check(engagementResponse, {
    'engagement metrics status is 200': (r) => r.status === 200,
    'engagement metrics response time < 800ms': (r) => r.timings.duration < 800,
  });

  errorRate.add(!engagementSuccess);
  responseTime.add(engagementResponse.timings.duration);
}

export function handleSummary(data) {
  return {
    'performance-results.json': JSON.stringify(data, null, 2),
    stdout: `
    ========================================
    Load Test Summary
    ========================================
    Total Requests: ${data.metrics.http_reqs.values.count}
    Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%
    Average Response Time: ${data.metrics.http_req_duration.values.avg}ms
    95th Percentile: ${data.metrics.http_req_duration.values['p(95)']}ms
    99th Percentile: ${data.metrics.http_req_duration.values['p(99)']}ms
    ========================================
    `,
  };
}