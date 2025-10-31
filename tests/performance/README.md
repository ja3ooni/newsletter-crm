# Performance Testing Suite

Comprehensive performance testing suite for the DatatechtonCRM platform using k6
load testing framework.

## Overview

This performance testing suite provides comprehensive load testing, stress
testing, capacity planning, and benchmarking capabilities for the DatatechtonCRM
platform. It includes tests for all major services and components.

## Test Types

### 1. Load Testing (`api-load-test.js`)

- **Purpose**: Test normal expected load
- **Duration**: 5-16 minutes
- **Max Users**: 100 concurrent
- **Scenarios**: Health checks, user operations, newsletter operations, content
  operations, CRM operations, analytics operations

### 2. Stress Testing (`stress-test.js`)

- **Purpose**: Test system behavior under stress conditions
- **Duration**: 18 minutes
- **Max Users**: 500 concurrent
- **Focus**: Breaking point identification, resource exhaustion testing

### 3. Spike Testing (`spike-test.js`)

- **Purpose**: Test system behavior under sudden load spikes
- **Duration**: 10 minutes
- **Max Users**: 1000 concurrent (spikes)
- **Focus**: System recovery, auto-scaling behavior

### 4. Database Performance Testing (`database-performance-test.js`)

- **Purpose**: Test database performance under various load conditions
- **Duration**: 15 minutes
- **Max Users**: 50 concurrent
- **Scenarios**: Read operations, write operations, complex queries

### 5. Email Performance Testing (`email-performance-test.js`)

- **Purpose**: Test email sending and newsletter generation performance
- **Duration**: 12 minutes
- **Max Users**: 20 concurrent
- **Scenarios**: Bulk email sending, newsletter generation, template rendering

### 6. Capacity Planning Testing (`capacity-planning-test.js`)

- **Purpose**: Determine system capacity and scaling requirements
- **Duration**: 25 minutes
- **Max Users**: 500 concurrent
- **Focus**: Resource utilization, bottleneck identification, scaling
  recommendations

### 7. API Benchmarking (`api-benchmarking-test.js`)

- **Purpose**: Benchmark API response times and throughput
- **Duration**: 15 minutes
- **Max Users**: 50 concurrent
- **Focus**: Service-specific performance grading, SLA validation

## Quick Start

### Prerequisites

1. **Install k6**: Download from
   [k6.io](https://k6.io/docs/getting-started/installation/)
2. **Start the platform**: Ensure all services are running
3. **Set environment variables** (optional):
   ```bash
   export BASE_URL=http://localhost:8000
   export AUTH_TOKEN=your-test-token
   ```

### Running Tests

#### Using the Test Runner (Recommended)

```bash
# Quick performance check (2-5 minutes)
npm run test:performance:quick

# Standard performance testing (15-30 minutes)
npm run test:performance

# Comprehensive testing (60-90 minutes)
npm run test:performance:comprehensive

# Capacity planning (25-30 minutes)
npm run test:performance:capacity

# API benchmarking (15-20 minutes)
npm run test:performance:benchmark
```

#### Running Individual Tests

```bash
# Load testing
npm run test:performance:load

# Stress testing
npm run test:performance:stress

# Spike testing
npm run test:performance:spike

# Database performance
npm run test:performance:database

# Email performance
npm run test:performance:email
```

#### Direct k6 Execution

```bash
# Basic load test
k6 run tests/performance/api-load-test.js

# With custom parameters
k6 run --vus 50 --duration 10m tests/performance/api-load-test.js

# With environment variables
k6 run -e BASE_URL=http://staging.example.com tests/performance/api-load-test.js
```

## Configuration

### Environment Variables

| Variable     | Default                 | Description                        |
| ------------ | ----------------------- | ---------------------------------- |
| `BASE_URL`   | `http://localhost:8000` | Base URL for the platform          |
| `AUTH_TOKEN` | `test-token`            | Authentication token for API calls |
| `OUTPUT_DIR` | `./performance-results` | Directory for test results         |
| `K6_BINARY`  | `k6`                    | Path to k6 binary                  |

### Test Runner Options

```bash
node tests/performance/run-performance-tests.js [suite] [options]

Options:
  --base-url <url>     - Base URL for testing
  --auth-token <token> - Authentication token
  --output-dir <dir>   - Output directory
  --k6-binary <path>   - Path to k6 binary
  --help              - Show help message
```

## Performance Thresholds

### API Response Times

- **User Service**: p(95) < 500ms
- **Newsletter Service**: p(95) < 2000ms
- **CRM Service**: p(95) < 800ms
- **Analytics Service**: p(95) < 3000ms
- **Content Service**: p(95) < 1500ms

### System Metrics

- **Error Rate**: < 5%
- **Database Query Time**: p(95) < 1000ms
- **Email Send Time**: p(95) < 5000ms
- **System Throughput**: > 95% success rate

## Test Results

### Output Files

Test results are saved in the configured output directory:

- `*-results.json` - Raw k6 test results
- `*-report.json` - Processed test reports
- `performance-summary.json` - Overall test summary
- `performance-report.html` - HTML report for viewing

### Interpreting Results

#### Response Time Metrics

- **Average**: Mean response time across all requests
- **p(95)**: 95% of requests completed within this time
- **p(99)**: 99% of requests completed within this time
- **Max**: Maximum response time observed

#### Performance Grades

- **A**: Excellent performance, within target thresholds
- **B**: Good performance, slightly above target
- **C**: Acceptable performance, needs monitoring
- **D**: Poor performance, requires optimization

#### Capacity Planning Metrics

- **Recommended Max Users**: Safe concurrent user limit
- **Safety Margin**: Buffer for traffic spikes
- **Scaling Recommendations**: Infrastructure improvements needed

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Tests

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Start services
        run: docker-compose up -d

      - name: Wait for services
        run: sleep 60

      - name: Run performance tests
        run: npm run test:performance:quick
        env:
          BASE_URL: http://localhost:8000

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results/
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any

    environment {
        BASE_URL = 'http://localhost:8000'
        OUTPUT_DIR = './performance-results'
    }

    stages {
        stage('Setup') {
            steps {
                sh 'docker-compose up -d'
                sh 'sleep 60'  // Wait for services
            }
        }

        stage('Performance Tests') {
            parallel {
                stage('Quick Tests') {
                    steps {
                        sh 'npm run test:performance:quick'
                    }
                }
                stage('Benchmark Tests') {
                    steps {
                        sh 'npm run test:performance:benchmark'
                    }
                }
            }
        }

        stage('Results') {
            steps {
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'performance-results',
                    reportFiles: 'performance-report.html',
                    reportName: 'Performance Report'
                ])
            }
        }
    }

    post {
        always {
            sh 'docker-compose down'
            archiveArtifacts artifacts: 'performance-results/**/*', fingerprint: true
        }
    }
}
```

## Troubleshooting

### Common Issues

#### k6 Not Found

```bash
# Install k6 on macOS
brew install k6

# Install k6 on Ubuntu/Debian
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

#### Connection Refused

- Ensure all services are running: `docker-compose ps`
- Check service health: `curl http://localhost:8000/health`
- Verify BASE_URL is correct

#### High Error Rates

- Check service logs: `docker-compose logs`
- Verify authentication token is valid
- Ensure database is properly initialized

#### Slow Performance

- Check system resources: CPU, memory, disk I/O
- Review database performance and indexes
- Monitor network latency

### Performance Optimization Tips

1. **Database Optimization**
   - Add appropriate indexes
   - Optimize slow queries
   - Implement connection pooling
   - Use read replicas for analytics

2. **Caching Strategy**
   - Implement Redis caching
   - Use CDN for static assets
   - Cache frequently accessed data
   - Implement cache invalidation

3. **Application Optimization**
   - Optimize API endpoints
   - Implement pagination
   - Use async processing for heavy operations
   - Optimize database queries

4. **Infrastructure Scaling**
   - Horizontal scaling with load balancers
   - Auto-scaling based on metrics
   - Database sharding for large datasets
   - Microservices optimization

## Contributing

### Adding New Tests

1. Create test file in `tests/performance/`
2. Follow k6 testing patterns
3. Add appropriate metrics and thresholds
4. Update test runner configuration
5. Add documentation

### Test File Structure

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const customMetric = new Trend('custom_metric');

export const options = {
  // Test configuration
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    // Performance thresholds
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  // Test logic
  const response = http.get('http://example.com/api');

  check(response, {
    'status is 200': r => r.status === 200,
  });

  sleep(1);
}

export function handleSummary(data) {
  // Custom result processing
  return {
    'results.json': JSON.stringify(data, null, 2),
  };
}
```

## Support

For questions or issues with performance testing:

1. Check the troubleshooting section above
2. Review k6 documentation: [k6.io/docs](https://k6.io/docs/)
3. Open an issue in the project repository
4. Contact the development team

## License

This performance testing suite is part of the DatatechtonCRM platform and
follows the same license terms.
