import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Normal load
    { duration: '10s', target: 500 },  // Sudden spike to 500 users
    { duration: '1m', target: 500 },   // Maintain spike
    { duration: '10s', target: 10 },   // Drop back to normal
    { duration: '30s', target: 10 },   // Maintain normal load
    { duration: '10s', target: 1000 }, // Even bigger spike
    { duration: '30s', target: 1000 }, // Maintain bigger spike
    { duration: '10s', target: 0 },    // Drop to zero
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests must complete below 5s (very relaxed for spikes)
    http_req_failed: ['rate<0.5'],     // Error rate must be below 50% (very relaxed for spikes)
    errors: ['rate<0.5'],              // Custom error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export default function () {
  // Spike test focuses on sudden load increases
  const scenarios = [
    quickHealthCheck,
    fastUserAuth,
    rapidContentAccess,
    burstAnalytics,
  ];

  // Quick scenario selection for spike testing
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  scenario();

  // Very short sleep to maximize request rate during spikes
  sleep(Math.random() * 0.1);
}

function quickHealthCheck() {
  const response = http.get(`${BASE_URL}/health`);
  
  const success = check(response, {
    'spike health check status is 200': (r) => r.status === 200,
    'spike health check response time < 5000ms': (r) => r.timings.duration < 5000,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function fastUserAuth() {
  // Quick authentication test
  const loginPayload = {
    email: 'spike@test.com',
    password: 'spiketest123',
  };

  const response = http.post(
    `${BASE_URL}/api/v1/users/login`,
    JSON.stringify(loginPayload),
    { 
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s',
    }
  );

  const success = check(response, {
    'spike login completed': (r) => r.status >= 200 && r.status < 500,
    'spike login response time < 10000ms': (r) => r.timings.duration < 10000,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function rapidContentAccess() {
  // Quick content access
  const response = http.get(`${BASE_URL}/api/v1/content/trending?limit=5`, {
    timeout: '10s',
  });
  
  const success = check(response, {
    'spike content access completed': (r) => r.status >= 200 && r.status < 500,
    'spike content access response time < 10000ms': (r) => r.timings.duration < 10000,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function burstAnalytics() {
  // Quick analytics request
  const response = http.get(`${BASE_URL}/api/v1/analytics/dashboard`, {
    timeout: '15s',
  });
  
  const success = check(response, {
    'spike analytics completed': (r) => r.status >= 200 && r.status < 500,
    'spike analytics response time < 15000ms': (r) => r.timings.duration < 15000,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

export function handleSummary(data) {
  return {
    'spike-test-results.json': JSON.stringify(data, null, 2),
    stdout: `
    ========================================
    Spike Test Summary
    ========================================
    Total Requests: ${data.metrics.http_reqs.values.count}
    Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%
    Average Response Time: ${data.metrics.http_req_duration.values.avg}ms
    95th Percentile: ${data.metrics.http_req_duration.values['p(95)']}ms
    99th Percentile: ${data.metrics.http_req_duration.values['p(99)']}ms
    Max Response Time: ${data.metrics.http_req_duration.values.max}ms
    
    Spike Test Analysis:
    - System recovery after 500 user spike
    - System recovery after 1000 user spike
    - Peak concurrent users: 1000
    - Error rate during spikes: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
    ========================================
    `,
  };
}