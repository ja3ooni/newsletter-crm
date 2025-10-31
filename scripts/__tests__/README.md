# Developer Tools Testing Infrastructure

This directory contains the comprehensive testing infrastructure for the
developer tools, including unit tests, integration tests, performance tests, and
automated quality gates.

## Overview

The testing infrastructure provides:

- **Unit Tests**: Fast, isolated tests for individual components
- **Integration Tests**: End-to-end testing of tool functionality
- **Performance Tests**: Regression testing and performance monitoring
- **Cross-Platform Tests**: Validation across Windows, macOS, and Linux
- **Security Scanning**: Automated vulnerability detection
- **Quality Gates**: Automated quality validation and reporting

## Directory Structure

```
__tests__/
├── README.md                    # This file
├── setup/                       # Global test setup and teardown
│   ├── global-setup.ts         # Jest global setup
│   └── global-teardown.ts      # Jest global teardown
├── fixtures/                    # Test data and mock configurations
│   ├── init.sql                # Database initialization
│   ├── mockserver.properties   # Mock server configuration
│   └── mock-expectations.json  # API mock responses
├── integration/                 # Integration test suites
│   ├── debug-tools.integration.test.ts
│   ├── dev-utilities.integration.test.ts
│   ├── dev-onboarding.integration.test.ts
│   ├── performance-regression.test.ts
│   ├── jest.integration.config.js
│   └── reports/                # Integration test reports
├── performance-results/         # Performance test outputs
│   ├── report.json             # Performance analysis report
│   ├── trends.json             # Historical performance data
│   └── *.json                  # Individual tool performance data
└── reports/                     # Test result reports
    ├── summary.json            # Test execution summary
    ├── summary.md              # Markdown test report
    └── *.json                  # Platform-specific results
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run unit tests with coverage
npm run test:coverage

# Run unit tests in watch mode
npm run test:watch

# Run specific test file
npm test -- debug-tools.test.ts
```

### Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run integration tests with full services
npm run test:integration:full

# Run integration tests in watch mode
npm run test:integration:watch
```

### Performance Tests

```bash
# Run performance regression tests
npm run test:performance

# Analyze performance results
npm run performance:analyze
```

### Cross-Platform Tests

```bash
# Run platform-specific tests
npm run test:platform

# Test on specific platform (in CI)
npm run test:ci
```

### Full Test Suite

```bash
# Run complete test suite with all checks
npm run ci:full
```

## Test Configuration

### Jest Configuration

The main Jest configuration is in `jest.config.js` with the following key
features:

- TypeScript support via `ts-jest`
- Coverage collection and thresholds
- Custom reporters for CI/CD integration
- Global setup and teardown
- Platform-specific test result processing

### Integration Test Configuration

Integration tests use a separate configuration
(`__tests__/integration/jest.integration.config.js`) with:

- Longer timeouts for complex operations
- Service dependency management
- Mock server integration
- Database and Redis connections

## Test Services

### Docker Compose Services

The testing infrastructure uses Docker Compose (`docker-compose.test.yml`) to
provide:

- **Redis**: Caching and session storage testing
- **PostgreSQL**: Database operations testing
- **MongoDB**: Document storage testing
- **Elasticsearch**: Search functionality testing
- **MockServer**: API endpoint mocking

### Starting Test Services

```bash
# Start all test services
docker-compose -f docker-compose.test.yml up -d

# Check service health
docker-compose -f docker-compose.test.yml ps

# Stop test services
docker-compose -f docker-compose.test.yml down
```

## Quality Gates

The automated testing infrastructure includes quality gates that must pass:

### Coverage Gates

- **Statements**: ≥70%
- **Branches**: ≥65%
- **Functions**: ≥70%
- **Lines**: ≥70%

### Performance Gates

- **Execution Time**: ≤30 seconds per tool
- **Memory Usage**: ≤100MB per tool
- **No Performance Regressions**: 0 tools with regressions

### Security Gates

- **High Severity**: 0 vulnerabilities
- **Medium Severity**: ≤5 vulnerabilities
- **Total Vulnerabilities**: ≤10

### Code Quality Gates

- **ESLint Errors**: 0
- **ESLint Warnings**: ≤10
- **TypeScript Errors**: 0

## CI/CD Integration

### GitHub Actions Workflow

The testing infrastructure integrates with GitHub Actions
(`.github/workflows/developer-tools-ci.yml`) providing:

- Cross-platform testing matrix
- Automated quality gates
- Test result aggregation
- Performance regression detection
- Security vulnerability scanning
- Coverage reporting

### Workflow Stages

1. **Code Quality**: ESLint, TypeScript compilation
2. **Cross-Platform Tests**: Windows, macOS, Linux testing
3. **Coverage Analysis**: Test coverage validation
4. **Performance Tests**: Regression detection
5. **Security Scan**: Vulnerability assessment
6. **Integration Tests**: Full service testing
7. **Quality Gates**: Final validation
8. **Deployment**: Staging deployment (on main branch)

## Test Reports

### Generated Reports

The testing infrastructure generates comprehensive reports:

- **HTML Reports**: Visual test results and coverage
- **JSON Reports**: Machine-readable test data
- **Markdown Reports**: Human-readable summaries
- **JUnit XML**: CI/CD integration format
- **Performance Reports**: Trend analysis and regression detection
- **Security Reports**: Vulnerability assessments

### Report Locations

- `test-results/`: Test execution results
- `coverage/`: Code coverage reports
- `__tests__/reports/`: Integration test reports
- `__tests__/performance-results/`: Performance analysis
- `quality-report/`: Final quality assessment

## Writing Tests

### Unit Test Example

```typescript
import { PlatformService } from '../shared/PlatformService';

describe('PlatformService', () => {
  let platformService: PlatformService;

  beforeEach(() => {
    platformService = new PlatformService();
  });

  it('should detect operating system correctly', () => {
    const os = platformService.getOperatingSystem();
    expect(['windows', 'macos', 'linux', 'unknown']).toContain(os);
  });

  it('should execute cross-platform commands', async () => {
    const result = await platformService.executeCommand({
      windows: 'echo "test"',
      linux: 'echo "test"',
      macos: 'echo "test"',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('test');
  });
});
```

### Integration Test Example

```typescript
import { DebugTools } from '../debug-tools';

describe('Debug Tools Integration', () => {
  let debugTools: DebugTools;

  beforeAll(async () => {
    // Setup test environment
    await setupTestServices();
  });

  afterAll(async () => {
    // Cleanup test environment
    await cleanupTestServices();
  });

  it('should perform system diagnostics', async () => {
    const diagnostics = await debugTools.runDiagnostics();

    expect(diagnostics.system).toBeDefined();
    expect(diagnostics.services).toBeInstanceOf(Array);
    expect(diagnostics.performance).toBeDefined();
  }, 30000); // 30 second timeout
});
```

### Performance Test Example

```typescript
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  it('should complete diagnostics within time limit', async () => {
    const startTime = performance.now();

    await debugTools.runDiagnostics();

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(30000); // 30 seconds
  });
});
```

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase timeout in test configuration
2. **Service Connection Failures**: Check Docker services are running
3. **Coverage Threshold Failures**: Add more tests or adjust thresholds
4. **Platform-Specific Failures**: Check platform-specific command mappings

### Debug Mode

Enable debug mode for detailed test output:

```bash
# Enable debug logging
DEBUG=* npm test

# Run with verbose output
npm test -- --verbose

# Run specific test with debugging
npm test -- --testNamePattern="specific test" --verbose
```

### Performance Debugging

Analyze performance issues:

```bash
# Generate performance report
npm run performance:analyze

# Check memory usage
npm test -- --logHeapUsage

# Profile specific test
npm test -- --detectOpenHandles --forceExit
```

## Contributing

When adding new tests:

1. Follow existing test patterns and naming conventions
2. Add appropriate setup and teardown
3. Include both positive and negative test cases
4. Update documentation for new test categories
5. Ensure tests are cross-platform compatible
6. Add performance considerations for long-running tests

## Maintenance

Regular maintenance tasks:

1. **Update Dependencies**: Keep test dependencies current
2. **Review Thresholds**: Adjust quality gates as codebase evolves
3. **Clean Test Data**: Remove obsolete test fixtures
4. **Monitor Performance**: Track test execution trends
5. **Update Documentation**: Keep test documentation current

For more information, see the main [Developer Tools README](../README.md).
