import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

// Custom metrics for capacity planning
const systemThroughput = new Rate('system_throughput');
const resourceUtilization = new Trend('resource_utilization');
const concurrentUsers = new Gauge('concurrent_users');
const systemErrors = new Rate('system_errors');
const capacityMetrics = new Counter('capacity_metrics');
const bottleneckDetection = new Trend('bottleneck_detection');

export const options = {
  scenarios: {
    // Gradual capacity testing
    capacity_ramp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 25 }, // Baseline load
        { duration: '3m', target: 50 }, // Light load
        { duration: '3m', target: 100 }, // Moderate load
        { duration: '3m', target: 200 }, // Heavy load
        { duration: '3m', target: 300 }, // Stress load
        { duration: '3m', target: 500 }, // Breaking point
        { duration: '2m', target: 0 }, // Recovery
      ],
    },
    // Sustained load testing
    sustained_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15m',
      startTime: '5m',
    },
    // Peak hour simulation
    peak_hour_simulation: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      stages: [
        { duration: '2m', target: 50 }, // Morning ramp-up
        { duration: '5m', target: 100 }, // Peak morning
        { duration: '2m', target: 30 }, // Midday lull
        { duration: '3m', target: 150 }, // Afternoon peak
        { duration: '3m', target: 200 }, // Evening peak
        { duration: '2m', target: 20 }, // Night wind-down
      ],
      preAllocatedVUs: 50,
      maxVUs: 300,
      startTime: '10m',
    },
  },
  thresholds: {
    system_throughput: ['rate>0.95'], // 95% successful operations
    system_errors: ['rate<0.05'], // Less than 5% error rate
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // Response time thresholds
    http_req_failed: ['rate<0.1'], // API error rate
    resource_utilization: ['p(95)<80'], // Resource utilization under 80%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

// Capacity planning data collection
let capacityData = {
  userLevels: [],
  throughputData: [],
  responseTimeData: [],
  errorRateData: [],
  resourceData: [],
};

export default function () {
  const currentVUs = __VU;
  concurrentUsers.add(currentVUs);

  // Simulate realistic user behavior patterns
  const userBehaviors = [
    simulateContentConsumer,
    simulateNewsletterManager,
    simulateCRMUser,
    simulateAnalyticsUser,
    simulateAPIUser,
  ];

  // Weight behaviors based on typical usage patterns
  const behaviorWeights = [0.4, 0.25, 0.2, 0.1, 0.05];
  const selectedBehavior = selectWeightedBehavior(
    userBehaviors,
    behaviorWeights
  );

  const startTime = Date.now();
  const success = selectedBehavior();
  const duration = Date.now() - startTime;

  // Collect capacity planning metrics
  systemThroughput.add(success);
  systemErrors.add(!success);
  capacityMetrics.add(1);

  // Simulate realistic user think time
  sleep(Math.random() * 2 + 1); // 1-3 seconds think time
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

  return behaviors[0]; // Fallback
}

function simulateContentConsumer() {
  // Simulate typical content consumer behavior
  let success = true;

  // Browse trending content
  const trendingResponse = http.get(
    `${BASE_URL}/api/v1/content/trending?limit=20`
  );
  success =
    success &&
    check(trendingResponse, {
      'trending content loaded': r => r.status === 200,
    });

  sleep(2); // Read content

  // Search for specific topics
  const searchTerms = [
    'AI',
    'blockchain',
    'startup',
    'technology',
    'programming',
  ];
  const searchTerm =
    searchTerms[Math.floor(Math.random() * searchTerms.length)];

  const searchResponse = http.get(
    `${BASE_URL}/api/v1/content/search?q=${searchTerm}&limit=15`
  );
  success =
    success &&
    check(searchResponse, {
      'content search successful': r => r.status === 200,
    });

  sleep(1); // Review search results

  // Get content categories
  const categoriesResponse = http.get(`${BASE_URL}/api/v1/content/categories`);
  success =
    success &&
    check(categoriesResponse, {
      'categories loaded': r => r.status === 200,
    });

  return success;
}

function simulateNewsletterManager() {
  // Simulate newsletter management workflow
  let success = true;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  // Check newsletter list
  const newslettersResponse = http.get(
    `${BASE_URL}/api/v1/newsletters?limit=25`,
    {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    }
  );
  success =
    success &&
    check(newslettersResponse, {
      'newsletters list loaded': r => r.status === 200,
    });

  sleep(1); // Review newsletters

  // Check templates
  const templatesResponse = http.get(
    `${BASE_URL}/api/v1/newsletters/templates`,
    {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    }
  );
  success =
    success &&
    check(templatesResponse, {
      'templates loaded': r => r.status === 200,
    });

  sleep(2); // Select template

  // Generate newsletter (simulate)
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
  success =
    success &&
    check(generateResponse, {
      'newsletter generation started': r => r.status === 202,
    });

  sleep(3); // Wait for generation

  // Check analytics
  const analyticsResponse = http.get(
    `${BASE_URL}/api/v1/newsletters/analytics?period=7d`,
    {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    }
  );
  success =
    success &&
    check(analyticsResponse, {
      'newsletter analytics loaded': r => r.status === 200,
    });

  return success;
}

function simulateCRMUser() {
  // Simulate CRM user workflow
  let success = true;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  // Browse contacts
  const contactsResponse = http.get(
    `${BASE_URL}/api/v1/contacts?limit=50&sort=updated_at`,
    {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    }
  );
  success =
    success &&
    check(contactsResponse, {
      'contacts list loaded': r => r.status === 200,
    });

  sleep(2); // Review contacts

  // Check segments
  const segmentsResponse = http.get(`${BASE_URL}/api/v1/contacts/segments`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });
  success =
    success &&
    check(segmentsResponse, {
      'segments loaded': r => r.status === 200,
    });

  sleep(1); // Review segments

  // Create new contact (simulate)
  const contactData = {
    email: `capacity-test-${Math.random()}@example.com`,
    firstName: 'Capacity',
    lastName: 'Test',
    company: 'Test Company',
    leadScore: Math.floor(Math.random() * 100),
  };

  const createContactResponse = http.post(
    `${BASE_URL}/api/v1/contacts`,
    JSON.stringify(contactData),
    { headers }
  );
  success =
    success &&
    check(createContactResponse, {
      'contact created': r => r.status === 201,
    });

  sleep(1); // Process creation

  // Search contacts
  const searchResponse = http.get(
    `${BASE_URL}/api/v1/contacts/search?q=test&limit=20`,
    {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    }
  );
  success =
    success &&
    check(searchResponse, {
      'contact search successful': r => r.status === 200,
    });

  return success;
}

function simulateAnalyticsUser() {
  // Simulate analytics user workflow
  let success = true;

  const headers = { Authorization: `Bearer ${AUTH_TOKEN}` };

  // Load dashboard
  const dashboardResponse = http.get(`${BASE_URL}/api/v1/analytics/dashboard`, {
    headers,
  });
  success =
    success &&
    check(dashboardResponse, {
      'analytics dashboard loaded': r => r.status === 200,
    });

  sleep(3); // Review dashboard

  // Get engagement metrics
  const engagementResponse = http.get(
    `${BASE_URL}/api/v1/analytics/engagement?period=30d&granularity=daily`,
    { headers }
  );
  success =
    success &&
    check(engagementResponse, {
      'engagement metrics loaded': r => r.status === 200,
    });

  sleep(2); // Analyze engagement

  // Get subscriber analytics
  const subscribersResponse = http.get(
    `${BASE_URL}/api/v1/analytics/subscribers?period=90d&breakdown=weekly`,
    { headers }
  );
  success =
    success &&
    check(subscribersResponse, {
      'subscriber analytics loaded': r => r.status === 200,
    });

  sleep(2); // Review subscriber data

  // Get revenue metrics
  const revenueResponse = http.get(
    `${BASE_URL}/api/v1/analytics/revenue?period=30d`,
    { headers }
  );
  success =
    success &&
    check(revenueResponse, {
      'revenue metrics loaded': r => r.status === 200,
    });

  return success;
}

function simulateAPIUser() {
  // Simulate API-only user (integrations, webhooks, etc.)
  let success = true;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  // Batch operations
  const batchRequests = [
    ['GET', `${BASE_URL}/api/v1/contacts?limit=100`],
    ['GET', `${BASE_URL}/api/v1/newsletters?status=sent&limit=50`],
    ['GET', `${BASE_URL}/api/v1/analytics/summary`],
  ];

  const responses = http.batch(
    batchRequests.map(([method, url]) => [method, url, null, { headers }])
  );

  responses.forEach((response, index) => {
    success =
      success &&
      check(response, {
        [`batch request ${index} successful`]: r => r.status === 200,
      });
  });

  sleep(0.5); // API users typically have shorter delays

  // Webhook simulation
  const webhookData = {
    event: 'contact.updated',
    data: {
      contactId: `test-${Math.random()}`,
      changes: ['leadScore', 'lifecycle'],
    },
    timestamp: new Date().toISOString(),
  };

  const webhookResponse = http.post(
    `${BASE_URL}/api/v1/webhooks/test`,
    JSON.stringify(webhookData),
    { headers }
  );
  success =
    success &&
    check(webhookResponse, {
      'webhook processed': r => r.status >= 200 && r.status < 300,
    });

  return success;
}

// Capacity planning analysis functions
export function setup() {
  console.log('Starting capacity planning test...');
  return { startTime: Date.now() };
}

export function teardown(data) {
  console.log('Capacity planning test completed.');

  // Generate capacity planning report
  const testDuration = (Date.now() - data.startTime) / 1000;
  console.log(`Test duration: ${testDuration} seconds`);
}

export function handleSummary(data) {
  // Calculate capacity metrics
  const totalRequests = data.metrics.http_reqs.values.count;
  const totalErrors = data.metrics.http_req_failed.values.count;
  const avgResponseTime = data.metrics.http_req_duration.values.avg;
  const p95ResponseTime = data.metrics.http_req_duration.values['p(95)'];
  const p99ResponseTime = data.metrics.http_req_duration.values['p(99)'];
  const maxResponseTime = data.metrics.http_req_duration.values.max;

  const throughput = totalRequests / (data.state.testRunDurationMs / 1000);
  const errorRate = (totalErrors / totalRequests) * 100;

  // Capacity recommendations
  let recommendations = [];

  if (errorRate > 5) {
    recommendations.push(
      'High error rate detected - consider scaling infrastructure'
    );
  }

  if (p95ResponseTime > 2000) {
    recommendations.push(
      'Response times degrading - optimize database queries and add caching'
    );
  }

  if (throughput < 50) {
    recommendations.push(
      'Low throughput - investigate bottlenecks in application layer'
    );
  }

  // Calculate recommended capacity
  const safeCapacityMultiplier = 0.7; // 70% of breaking point for safety margin
  const recommendedMaxUsers = Math.floor(500 * safeCapacityMultiplier); // Based on test stages

  const capacityReport = {
    summary: {
      totalRequests,
      totalErrors,
      errorRate: errorRate.toFixed(2),
      throughput: throughput.toFixed(2),
      avgResponseTime: avgResponseTime.toFixed(2),
      p95ResponseTime: p95ResponseTime.toFixed(2),
      p99ResponseTime: p99ResponseTime.toFixed(2),
      maxResponseTime: maxResponseTime.toFixed(2),
    },
    capacity: {
      testedMaxUsers: 500,
      recommendedMaxUsers,
      safetyMargin: '30%',
      scalingRecommendations: recommendations,
    },
    performance: {
      acceptableResponseTime: p95ResponseTime < 2000,
      acceptableErrorRate: errorRate < 5,
      acceptableThroughput: throughput > 50,
    },
    infrastructure: {
      databaseOptimization: p95ResponseTime > 1000 ? 'Required' : 'Optional',
      cachingStrategy: p95ResponseTime > 500 ? 'Critical' : 'Recommended',
      loadBalancing: throughput > 100 ? 'Required' : 'Optional',
      autoScaling: 'Recommended for production',
    },
  };

  return {
    'capacity-planning-results.json': JSON.stringify(data, null, 2),
    'capacity-report.json': JSON.stringify(capacityReport, null, 2),
    stdout: `
    ========================================
    Capacity Planning Test Summary
    ========================================

    PERFORMANCE METRICS:
    - Total Requests: ${totalRequests}
    - Throughput: ${throughput.toFixed(2)} req/sec
    - Error Rate: ${errorRate.toFixed(2)}%
    - Avg Response Time: ${avgResponseTime.toFixed(2)}ms
    - 95th Percentile: ${p95ResponseTime.toFixed(2)}ms
    - 99th Percentile: ${p99ResponseTime.toFixed(2)}ms
    - Max Response Time: ${maxResponseTime.toFixed(2)}ms

    CAPACITY RECOMMENDATIONS:
    - Tested Max Users: 500 concurrent
    - Recommended Max Users: ${recommendedMaxUsers} concurrent
    - Safety Margin: 30%

    INFRASTRUCTURE RECOMMENDATIONS:
    ${recommendations.length > 0 ? recommendations.map(r => `- ${r}`).join('\n    ') : '- System performing within acceptable limits'}

    SCALING DECISIONS:
    - Database Optimization: ${p95ResponseTime > 1000 ? 'Required' : 'Optional'}
    - Caching Strategy: ${p95ResponseTime > 500 ? 'Critical' : 'Recommended'}
    - Load Balancing: ${throughput > 100 ? 'Required' : 'Optional'}
    - Auto Scaling: Recommended for production

    ========================================
    `,
  };
}
