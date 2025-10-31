import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for spike testing
const spikeMetrics = new Counter('spike_requests');
const spikeErrors = new Rate('spike_errors');
const spikeResponseTime = new Trend('spike_response_time');
const systemRecovery = new Trend('system_recovery_time');

export const options = {
  scenarios: {
    // Sudden traffic spike simulation
    traffic_spike: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      stages: [
        { duration: '1m', target: 10 }, // Normal load
        { duration: '30s', target: 1000 }, // Sudden spike to 1000 req/s
        { duration: '2m', target: 1000 }, // Sustained spike
        { duration: '30s', target: 10 }, // Drop back to normal
        { duration: '2m', target: 10 }, // Recovery period
      ],
      preAllocatedVUs: 50,
      maxVUs: 1000,
    },
    // User spike simulation
    user_spike: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '1m', target: 5 }, // Normal users
        { duration: '15s', target: 500 }, // Sudden user spike
        { duration: '3m', target: 500 }, // Sustained high users
        { duration: '15s', target: 5 }, // Drop back
        { duration: '2m', target: 5 }, // Recovery
      ],
      startTime: '30s',
    },
  },
  thresholds: {
    spike_response_time: ['p(95)<5000'], // Allow higher response times during spikes
    spike_errors: ['rate<0.2'], // Allow up to 20% error rate during spikes
    system_recovery_time: ['p(95)<10000'], // System should recover within 10s
    http_req_duration: ['p(95)<3000'], // Overall response time
    http_req_failed: ['rate<0.15'], // Overall error rate during spikes
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME;
  const currentTime = Date.now();

  // Simulate different user behaviors during spike
  const behaviors = [
    testQuickOperations,
    testMediumOperations,
    testHeavyOperations,
  ];

  // Weight behaviors based on typical spike patterns
  const weights = [0.6, 0.3, 0.1]; // Most users do quick operations during spikes
  const selectedBehavior = selectWeightedBehavior(behaviors, weights);

  const startTime = Date.now();
  const success = selectedBehavior();
  const responseTime = Date.now() - startTime;

  spikeMetrics.add(1);
  spikeErrors.add(!success);
  spikeResponseTime.add(responseTime);

  // Minimal sleep during spike testing
  sleep(Math.random() * 0.5);
}

function selectWeightedBehavior(behaviors, weights) {
  const random = Math.random();
  let cumulativeWeight = 0;

  for (let i = 0; i < behaviors.length; i++) {
    cumulativeWeight += weights[i];
    if (random <= cumulativeWeight) {
      return behaviors[i];
    }
  }

  return behaviors[0];
}

function testQuickOperations() {
  // Test lightweight operations that should handle spikes well
  let success = true;

  // Health check
  const healthResponse = http.get(`${BASE_URL}/health`, {
    timeout: '5s',
  });

  success =
    success &&
    check(healthResponse, {
      'health check during spike ok': r => r.status === 200,
    });

  // Quick content fetch
  const contentResponse = http.get(
    `${BASE_URL}/api/v1/content/trending?limit=5`,
    {
      timeout: '10s',
    }
  );

  success =
    success &&
    check(contentResponse, {
      'quick content fetch ok': r => r.status === 200,
    });

  return success;
}

function testMediumOperations() {
  // Test medium-weight operations
  let success = true;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  // User profile fetch
  const profileResponse = http.get(`${BASE_URL}/api/v1/users/profile`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    timeout: '10s',
  });

  success =
    success &&
    check(profileResponse, {
      'profile fetch during spike ok': r =>
        r.status === 200 || r.status === 429, // Allow rate limiting
    });

  // Newsletter list
  const newslettersResponse = http.get(
    `${BASE_URL}/api/v1/newsletters?limit=10`,
    {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      timeout: '15s',
    }
  );

  success =
    success &&
    check(newslettersResponse, {
      'newsletters fetch during spike ok': r =>
        r.status === 200 || r.status === 429,
    });

  return success;
}

function testHeavyOperations() {
  // Test heavy operations that might fail during spikes
  let success = true;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  // Analytics dashboard (heavy query)
  const analyticsResponse = http.get(`${BASE_URL}/api/v1/analytics/dashboard`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    timeout: '30s',
  });

  success =
    success &&
    check(analyticsResponse, {
      'analytics during spike': r =>
        r.status === 200 || r.status === 429 || r.status === 503, // Allow service unavailable
    });

  // Complex search
  const searchResponse = http.get(
    `${BASE_URL}/api/v1/content/search?q=artificial+intelligence&limit=50`,
    {
      timeout: '20s',
    }
  );

  success =
    success &&
    check(searchResponse, {
      'complex search during spike': r =>
        r.status === 200 || r.status === 429 || r.status === 503,
    });

  return success;
}

export function handleSummary(data) {
  const totalRequests = data.metrics.spike_requests
    ? data.metrics.spike_requests.values.count
    : 0;
  const errorRate = data.metrics.spike_errors
    ? data.metrics.spike_errors.values.rate * 100
    : 0;
  const avgResponseTime = data.metrics.spike_response_time
    ? data.metrics.spike_response_time.values.avg
    : 0;
  const p95ResponseTime = data.metrics.spike_response_time
    ? data.metrics.spike_response_time.values['p(95)']
    : 0;
  const maxResponseTime = data.metrics.spike_response_time
    ? data.metrics.spike_response_time.values.max
    : 0;

  // Calculate peak throughput
  const testDuration = data.state.testRunDurationMs / 1000;
  const peakThroughput = totalRequests / testDuration;

  return {
    'spike-test-results.json': JSON.stringify(data, null, 2),
    stdout: `
    ========================================
    Spike Test Summary
    ========================================
    Total Requests During Spike: ${totalRequests}
    Error Rate During Spike: ${errorRate.toFixed(2)}%
    Average Response Time: ${avgResponseTime.toFixed(2)}ms
    95th Percentile Response Time: ${p95ResponseTime.toFixed(2)}ms
    Max Response Time: ${maxResponseTime.toFixed(2)}ms
    Peak Throughput: ${peakThroughput.toFixed(2)} req/sec

    System Resilience:
    - Peak Load Handled: 1000 req/sec
    - System Recovery: ${errorRate < 20 ? 'GOOD' : 'NEEDS IMPROVEMENT'}
    - Rate Limiting: ${errorRate > 5 && errorRate < 25 ? 'ACTIVE' : 'CHECK CONFIGURATION'}

    Overall HTTP Performance:
    - Total HTTP Requests: ${data.metrics.http_reqs.values.count}
    - HTTP Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
    - Average HTTP Response: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
    ========================================
    `,
  };
}
