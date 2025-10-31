# Integration Tests for Developer Tools

This directory contains comprehensive integration tests for the developer tools
ecosystem, validating real-world functionality across different platforms and
scenarios.

## Test Categories

### 1. Debug Tools Integration Tests (`debug-tools.integration.test.ts`)

- **System Diagnostics**: Tests complete system diagnostic functionality
- **Performance Monitoring**: Validates performance monitoring capabilities
- **Log Analysis**: Tests log file analysis and processing
- **Database Debugging**: Validates database connection and debugging features
- **Network Debugging**: Tests network connectivity and endpoint validation
- **Cross-Platform Compatibility**: Ensures tools work across Windows, macOS,
  and Linux
- **Error Handling**: Validates graceful error handling and recovery
- **CLI Interface**: Tests command-line interface functionality

### 2. Dev Utilities Integration Tests (`dev-utilities.integration.test.ts`)

- **Secret Generation**: Tests secure secret generation functionality
- **Environment Validation**: Validates environment variable checking
- **Database Utilities**: Tests database backup, restore, and management
  operations
- **Service Management**: Validates Docker service management capabilities
- **Code Quality Tools**: Tests ESLint, Prettier, and TypeScript integration
- **Development Server Management**: Tests dev server start/stop/build
  operations
- **Cross-Platform Compatibility**: Ensures utilities work across all platforms
- **Performance**: Validates operation completion times

### 3. Dev Onboarding Integration Tests (`dev-onboarding.integration.test.ts`)

- **Prerequisites Checking**: Tests system prerequisite validation
- **Environment Setup**: Validates .env file creation and configuration
- **Dependencies Installation**: Tests npm/yarn dependency installation
- **Database Setup**: Validates database initialization and seeding
- **Services Management**: Tests development service startup
- **Testing**: Validates test execution and verification
- **Documentation Display**: Tests help and documentation features
- **User Information Collection**: Tests interactive user setup
- **Completion Summary**: Validates onboarding completion reporting

### 4. Performance Regression Tests (`performance-regression.test.ts`)

- **Performance Thresholds**: Ensures tools complete within acceptable time
  limits
- **Memory Usage**: Validates memory consumption and leak detection
- **Concurrent Operations**: Tests parallel execution capabilities
- **Scalability**: Validates performance under load
- **Resource Management**: Tests proper cleanup and resource management

## Running Integration Tests

### Prerequisites

- Node.js 18+ installed
- TypeScript and ts-jest configured
- All developer tools built and available

### Commands

```bash
# Run all integration tests
node run-integration-tests.js

# Run with verbose output
node run-integration-tests.js --verbose

# Run with coverage reporting
node run-integration-tests.js --coverage

# Run specific test file
npx jest __tests__/integration/debug-tools.integration.test.ts --config=__tests__/integration/jest.integration.config.js
```

### Test Configuration

The integration tests use a specialized Jest configuration
(`jest.integration.config.js`) with:

- Extended timeouts for real system operations
- Coverage reporting focused on core functionality
- Cross-platform compatibility settings
- Proper cleanup and resource management

## Test Environment

### Environment Variables

- `NODE_ENV=test`: Ensures test environment configuration
- `LOG_LEVEL=error`: Reduces log noise during testing

### Mock Strategy

- **Minimal Mocking**: Tests use real system operations where possible
- **Interactive Prompts**: Mocked to avoid blocking test execution
- **External Dependencies**: Gracefully handle missing tools (Docker, Git, etc.)
- **File System**: Uses temporary directories for safe testing

### Cross-Platform Testing

Tests are designed to work across:

- **Windows**: Uses PowerShell and Windows-specific commands
- **macOS**: Uses Unix commands with macOS-specific variations
- **Linux**: Uses standard Unix/Linux commands

Platform-specific behavior is handled through the `PlatformService` abstraction
layer.

## Performance Expectations

### Timing Thresholds

- System Diagnostics: < 30 seconds
- Environment Validation: < 5 seconds
- Prerequisite Checking: < 15 seconds
- Secret Generation: < 1 second
- Quality Checks: < 60 seconds

### Coverage Targets

- Statements: > 60%
- Branches: > 60%
- Functions: > 60%
- Lines: > 60%

## Troubleshooting

### Common Issues

1. **Open Handles**: Ensure readline interfaces are properly closed
2. **Async Operations**: Wait for all promises to resolve before test completion
3. **Platform Differences**: Use PlatformService for cross-platform operations
4. **Missing Dependencies**: Tests should gracefully handle missing external
   tools
5. **Timing Issues**: Allow sufficient tolerance for system operations

### Debug Mode

Enable verbose logging by setting:

```bash
LOG_LEVEL=debug node run-integration-tests.js
```

### Test Isolation

Each test:

- Uses isolated temporary directories
- Cleans up resources after completion
- Mocks interactive prompts
- Handles missing external dependencies gracefully

## Contributing

When adding new integration tests:

1. **Follow Naming Convention**: Use descriptive test names
2. **Handle Cross-Platform**: Ensure tests work on all supported platforms
3. **Clean Up Resources**: Always clean up temporary files and processes
4. **Mock Interactions**: Mock user inputs and external service calls
5. **Test Error Cases**: Include negative test cases and error handling
6. **Performance Aware**: Consider test execution time and resource usage

### Test Structure

```typescript
describe('Feature Integration', () => {
  let service: ServiceClass;

  beforeAll(() => {
    // One-time setup
  });

  afterAll(() => {
    // One-time cleanup
  });

  beforeEach(() => {
    service = new ServiceClass();
  });

  afterEach(() => {
    // Per-test cleanup
  });

  describe('Functionality Group', () => {
    it('should handle normal case', async () => {
      // Test implementation
    });

    it('should handle error case', async () => {
      // Error handling test
    });
  });
});
```

## Continuous Integration

Integration tests are designed to run in CI/CD environments with:

- Headless operation (no interactive prompts)
- Timeout handling for long-running operations
- Proper exit codes for success/failure
- Coverage reporting integration
- Cross-platform matrix testing
