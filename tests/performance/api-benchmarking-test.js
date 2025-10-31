import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for API benchmarking
const apiResponseTime = new Trend('api_response_time');
const apiThroughput = new Rate('api_throughput');
const apiErrors = new Rate('api_errors');
const endpointMetrics = new Counter('endpoint_calls');
const slowQueries = new Counter('slow_queries');

// Endpoint-specific metrics
const userServiceMetrics = new Trend('user_service_response_time');
const newsletterServiceMetrics = new Trend('newsletter_service_response_time');
const crmServiceMetrics = new Trend('crm_service_response_time');
const analyticsServiceMetrics = new Trend('analytics_service_response_time');
const contentServiceMetrics = new Trend('content_service_response_time');

export const options = {
  scenarios: {
    // API response time benchmarking
    api_benchmark: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
    },
    // Endpoint-specific performance testing
    endpoint_performance: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 50,
      startTime: '2m',
    },
    // API stress testing
    api_stress: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      startTime: '5m',
    },
  },
  thresholds: {
    api_response_time: ['p(95)<1000'], // 95% of API calls under 1s
    api_errors: ['rate<0.02'], // Less than 2% API error rate
    user_service_response_time: ['p(95)<500'], // User service under 500ms
    newsletter_service_response_time: ['p(95)<2000'], // Newsletter service under 2s
    crm_service_response_time: ['p(95)<800'], // CRM service under 800ms
    analytics_service_response_time: ['p(95)<3000'], // Analytics under 3s
    content_service_response_time: ['p(95)<1500'], // Content service under 1.5s
    http_req_duration: ['p(95)<2000'], // Overall response time
    http_req_failed: ['rate<0.05'], // Overall error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

// API endpoint definitions for benchmarking
const apiEndpoints = {
  userService: [
    {
      method: 'GET',
      path: '/api/v1/users/profile',
      auth: true,
      expectedTime: 200,
    },
    {
      method: 'POST',
      path: '/api/v1/users/login',
      auth: false,
      expectedTime: 300,
    },
    {
      method: 'PUT',
      path: '/api/v1/users/preferences',
      auth: true,
      expectedTime: 250,
    },
    {
      method: 'GET',
      path: '/api/v1/users/subscription',
      auth: true,
      expectedTime: 150,
    },
  ],
  newsletterService: [
    {
      method: 'GET',
      path: '/api/v1/newsletters',
      auth: true,
      expectedTime: 500,
    },
    {
      method: 'POST',
      path: '/api/v1/newsletters/generate',
      auth: true,
      expectedTime: 1500,
    },
    {
      method: 'GET',
      path: '/api/v1/newsletters/templates',
      auth: true,
      expectedTime: 300,
    },
    {
      method: 'POST',
      path: '/api/v1/newsletters/send-bulk',
      auth: true,
      expectedTime: 1000,
    },
  ],
  crmService: [
    { method: 'GET', path: '/api/v1/contacts', auth: true, expectedTime: 400 },
    { method: 'POST', path: '/api/v1/contacts', auth: true, expectedTime: 300 },
    {
      method: 'GET',
      path: '/api/v1/contacts/segments',
      auth: true,
      expectedTime: 600,
    },
    {
      method: 'GET',
      path: '/api/v1/contacts/search',
      auth: true,
      expectedTime: 800,
    },
  ],
  analyticsService: [
    {
      method: 'GET',
      path: '/api/v1/analytics/dashboard',
      auth: true,
      expectedTime: 2000,
    },
    {
      method: 'GET',
      path: '/api/v1/analytics/engagement',
      auth: true,
      expectedTime: 1500,
    },
    {
      method: 'GET',
      path: '/api/v1/analytics/subscribers',
      auth: true,
      expectedTime: 1200,
    },
    {
      method: 'GET',
      path: '/api/v1/analytics/revenue',
      auth: true,
      expectedTime: 1800,
    },
  ],
  contentService: [
    {
      method: 'GET',
      path: '/api/v1/content/trending',
      auth: false,
      expectedTime: 800,
    },
    {
      method: 'GET',
      path: '/api/v1/content/search',
      auth: false,
      expectedTime: 1000,
    },
    {
      method: 'GET',
      path: '/api/v1/content/categories',
      auth: false,
      expectedTime: 200,
    },
    {
      method: 'POST',
      path: '/api/v1/content/aggregate',
      auth: true,
      expectedTime: 2000,
    },
  ],
};

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME;

  switch (scenario) {
    case 'api_benchmark':
      benchmarkAllEndpoints();
      break;
    case 'endpoint_performance':
      testSpecificEndpoints();
      break;
    case 'api_stress':
      stressTestAPIs();
      break;
    default:
      benchmarkAllEndpoints();
  }

  sleep(1);
}

function benchmarkAllEndpoints() {
  // Test all services in a realistic usage pattern
  const services = Object.keys(apiEndpoints);
  const service = services[Math.floor(Math.random() * services.length)];

  benchmarkService(service);
}

function benchmarkService(serviceName) {
  const endpoints = apiEndpoints[serviceName];
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const startTime = Date.now();
  const response = makeAPICall(endpoint);
  const responseTime = Date.now() - startTime;

  // Record service-specific metrics
  switch (serviceName) {
    case 'userService':
      userServiceMetrics.add(responseTime);
      break;
    case 'newsletterService':
      newsletterServiceMetrics.add(responseTime);
      break;
    case 'crmService':
      crmServiceMetrics.add(responseTime);
      break;
    case 'analyticsService':
      analyticsServiceMetrics.add(responseTime);
      break;
    case 'contentService':
      contentServiceMetrics.add(responseTime);
      break;
  }

  apiResponseTime.add(responseTime);
  endpointMetrics.add(1);

  // Check if response time exceeds expected threshold
  if (responseTime > endpoint.expectedTime) {
    slowQueries.add(1);
  }

  const success = check(response, {
    [`${serviceName} ${endpoint.method} ${endpoint.path} status ok`]: r =>
      r.status >= 200 && r.status < 400,
    [`${serviceName} response time acceptable`]: () =>
      responseTime <= endpoint.expectedTime * 2, // Allow 2x expected time
  });

  apiThroughput.add(success);
  apiErrors.add(!success);
}

function makeAPICall(endpoint) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (endpoint.auth) {
    headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  }

  let url = `${BASE_URL}${endpoint.path}`;
  let body = null;

  // Add query parameters or body data based on endpoint
  if (endpoint.method === 'GET') {
    url = addQueryParameters(url, endpoint.path);
  } else if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
    body = generateRequestBody(endpoint.path);
  }

  const requestOptions = {
    headers,
    timeout: '30s',
  };

  switch (endpoint.method) {
    case 'GET':
      return http.get(url, requestOptions);
    case 'POST':
      return http.post(url, body, requestOptions);
    case 'PUT':
      return http.put(url, body, requestOptions);
    case 'DELETE':
      return http.del(url, requestOptions);
    default:
      return http.get(url, requestOptions);
  }
}

function addQueryParameters(url, path) {
  // Add realistic query parameters based on the endpoint
  const params = new URLSearchParams();

  if (path.includes('/contacts')) {
    params.append('limit', '25');
    params.append('sort', 'updated_at');
    if (Math.random() > 0.5) {
      params.append('lifecycle', 'lead');
    }
  } else if (path.includes('/newsletters')) {
    params.append('limit', '20');
    params.append('status', 'sent');
  } else if (path.includes('/analytics')) {
    params.append('period', '30d');
    if (path.includes('engagement')) {
      params.append('granularity', 'daily');
    }
  } else if (path.includes('/content/search')) {
    const searchTerms = ['AI', 'blockchain', 'javascript', 'startup'];

    params.append(
      'q',
      searchTerms[Math.floor(Math.random() * searchTerms.length)]
    );
    params.append('limit', '20');
  } else if (path.includes('/content/trending')) {
    params.append('limit', '15');
    params.append('category', 'tech');
  }

  const queryString = params.toString();

  return queryString ? `${url}?${queryString}` : url;
}

function generateRequestBody(path) {
  // Generate realistic request bodies based on the endpoint
  if (path.includes('/users/login')) {
    return JSON.stringify({
      email: 'benchmark@test.com',
      password: 'benchmarktest123',
    });
  } else if (path.includes('/users/preferences')) {
    return JSON.stringify({
      emailFrequency: 'weekly',
      contentTypes: ['articles', 'tutorials'],
      topics: ['ai', 'technology'],
    });
  } else if (path.includes('/contacts') && !path.includes('search')) {
    return JSON.stringify({
      email: `benchmark-${Math.random()}@example.com`,
      firstName: 'Benchmark',
      lastName: 'Test',
      company: 'Test Company',
      leadScore: Math.floor(Math.random() * 100),
    });
  } else if (path.includes('/newsletters/generate')) {
    return JSON.stringify({
      sections: ['news', 'research'],
      template: 'modern',
      personalization: true,
      contentFilters: {
        minScore: 0.7,
        maxAge: 24,
      },
    });
  } else if (path.includes('/newsletters/send-bulk')) {
    return JSON.stringify({
      newsletterId: 'benchmark-newsletter',
      recipients: Array.from({ length: 10 }, (_, i) => ({
        email: `recipient-${i}@example.com`,
        firstName: `User${i}`,
      })),
      sendOptions: {
        enableTracking: true,
        batchSize: 10,
      },
    });
  } else if (path.includes('/content/aggregate')) {
    return JSON.stringify({
      sources: ['techcrunch', 'github', 'arxiv'],
      categories: ['ai', 'technology'],
      maxItems: 100,
    });
  }

  return JSON.stringify({});
}

function testSpecificEndpoints() {
  // Focus on testing specific high-impact endpoints
  const criticalEndpoints = [
    { service: 'userService', endpoint: apiEndpoints.userService[0] },
    {
      service: 'newsletterService',
      endpoint: apiEndpoints.newsletterService[0],
    },
    { service: 'crmService', endpoint: apiEndpoints.crmService[0] },
    { service: 'analyticsService', endpoint: apiEndpoints.analyticsService[0] },
    { service: 'contentService', endpoint: apiEndpoints.contentService[0] },
  ];

  const selected =
    criticalEndpoints[Math.floor(Math.random() * criticalEndpoints.length)];

  benchmarkService(selected.service);
}

function stressTestAPIs() {
  // Stress test with rapid API calls
  const rapidCalls = [
    () => benchmarkService('userService'),
    () => benchmarkService('contentService'),
    () => benchmarkService('crmService'),
  ];

  // Make multiple rapid calls
  for (let i = 0; i < 3; i++) {
    const call = rapidCalls[Math.floor(Math.random() * rapidCalls.length)];

    call();
    sleep(0.1); // Very short delay for stress testing
  }
}

export function handleSummary(data) {
  // Calculate benchmark results
  const totalCalls = data.metrics.endpoint_calls
    ? data.metrics.endpoint_calls.values.count
    : 0;
  const slowQueryCount = data.metrics.slow_queries
    ? data.metrics.slow_queries.values.count
    : 0;
  const avgResponseTime = data.metrics.api_response_time
    ? data.metrics.api_response_time.values.avg
    : 0;
  const p95ResponseTime = data.metrics.api_response_time
    ? data.metrics.api_response_time.values['p(95)']
    : 0;
  const errorRate = data.metrics.api_errors
    ? data.metrics.api_errors.values.rate * 100
    : 0;

  // Service-specific performance
  const servicePerformance = {
    userService: data.metrics.user_service_response_time
      ? {
          avg: data.metrics.user_service_response_time.values.avg.toFixed(2),
          p95: data.metrics.user_service_response_time.values['p(95)'].toFixed(
            2
          ),
        }
      : null,
    newsletterService: data.metrics.newsletter_service_response_time
      ? {
          avg: data.metrics.newsletter_service_response_time.values.avg.toFixed(
            2
          ),
          p95: data.metrics.newsletter_service_response_time.values[
            'p(95)'
          ].toFixed(2),
        }
      : null,
    crmService: data.metrics.crm_service_response_time
      ? {
          avg: data.metrics.crm_service_response_time.values.avg.toFixed(2),
          p95: data.metrics.crm_service_response_time.values['p(95)'].toFixed(
            2
          ),
        }
      : null,
    analyticsService: data.metrics.analytics_service_response_time
      ? {
          avg: data.metrics.analytics_service_response_time.values.avg.toFixed(
            2
          ),
          p95: data.metrics.analytics_service_response_time.values[
            'p(95)'
          ].toFixed(2),
        }
      : null,
    contentService: data.metrics.content_service_response_time
      ? {
          avg: data.metrics.content_service_response_time.values.avg.toFixed(2),
          p95: data.metrics.content_service_response_time.values[
            'p(95)'
          ].toFixed(2),
        }
      : null,
  };

  // Performance grades
  const getPerformanceGrade = (p95Time, threshold) => {
    if (p95Time <= threshold) return 'A';
    if (p95Time <= threshold * 1.5) return 'B';
    if (p95Time <= threshold * 2) return 'C';

    return 'D';
  };

  const benchmarkReport = {
    summary: {
      totalAPICalls: totalCalls,
      slowQueries: slowQueryCount,
      slowQueryPercentage:
        totalCalls > 0 ? ((slowQueryCount / totalCalls) * 100).toFixed(2) : 0,
      avgResponseTime: avgResponseTime.toFixed(2),
      p95ResponseTime: p95ResponseTime.toFixed(2),
      errorRate: errorRate.toFixed(2),
    },
    serviceGrades: {
      userService: servicePerformance.userService
        ? getPerformanceGrade(
            parseFloat(servicePerformance.userService.p95),
            500
          )
        : 'N/A',
      newsletterService: servicePerformance.newsletterService
        ? getPerformanceGrade(
            parseFloat(servicePerformance.newsletterService.p95),
            2000
          )
        : 'N/A',
      crmService: servicePerformance.crmService
        ? getPerformanceGrade(
            parseFloat(servicePerformance.crmService.p95),
            800
          )
        : 'N/A',
      analyticsService: servicePerformance.analyticsService
        ? getPerformanceGrade(
            parseFloat(servicePerformance.analyticsService.p95),
            3000
          )
        : 'N/A',
      contentService: servicePerformance.contentService
        ? getPerformanceGrade(
            parseFloat(servicePerformance.contentService.p95),
            1500
          )
        : 'N/A',
    },
    recommendations: [],
  };

  // Generate recommendations
  if (errorRate > 2) {
    benchmarkReport.recommendations.push(
      'High API error rate - investigate service stability'
    );
  }
  if (slowQueryCount > totalCalls * 0.1) {
    benchmarkReport.recommendations.push(
      'High number of slow queries - optimize database and caching'
    );
  }
  if (p95ResponseTime > 1000) {
    benchmarkReport.recommendations.push(
      'API response times degrading - consider performance optimization'
    );
  }

  return {
    'api-benchmark-results.json': JSON.stringify(data, null, 2),
    'api-benchmark-report.json': JSON.stringify(benchmarkReport, null, 2),
    stdout: `
    ========================================
    API Benchmarking Test Summary
    ========================================

    OVERALL PERFORMANCE:
    - Total API Calls: ${totalCalls}
    - Average Response Time: ${avgResponseTime.toFixed(2)}ms
    - 95th Percentile: ${p95ResponseTime.toFixed(2)}ms
    - Error Rate: ${errorRate.toFixed(2)}%
    - Slow Queries: ${slowQueryCount} (${totalCalls > 0 ? ((slowQueryCount / totalCalls) * 100).toFixed(2) : 0}%)

    SERVICE PERFORMANCE GRADES:
    - User Service: ${benchmarkReport.serviceGrades.userService} ${servicePerformance.userService ? `(${servicePerformance.userService.p95}ms)` : ''}
    - Newsletter Service: ${benchmarkReport.serviceGrades.newsletterService} ${servicePerformance.newsletterService ? `(${servicePerformance.newsletterService.p95}ms)` : ''}
    - CRM Service: ${benchmarkReport.serviceGrades.crmService} ${servicePerformance.crmService ? `(${servicePerformance.crmService.p95}ms)` : ''}
    - Analytics Service: ${benchmarkReport.serviceGrades.analyticsService} ${servicePerformance.analyticsService ? `(${servicePerformance.analyticsService.p95}ms)` : ''}
    - Content Service: ${benchmarkReport.serviceGrades.contentService} ${servicePerformance.contentService ? `(${servicePerformance.contentService.p95}ms)` : ''}

    RECOMMENDATIONS:
    ${benchmarkReport.recommendations.length > 0 ? benchmarkReport.recommendations.map(r => `- ${r}`).join('\n    ') : '- All services performing within acceptable limits'}

    ========================================
    `,
  };
}
