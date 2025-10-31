# Developer Experience Guide

## Overview

This guide covers the comprehensive developer experience tools and workflows
available in the AiLert platform. Our goal is to provide an exceptional
development experience that enables developers to be productive from day one.

## Quick Start

### New Developer Onboarding

For new team members, start with our interactive onboarding:

```bash
node scripts/dev-onboarding.js
```

This interactive tool will:

- Check system prerequisites
- Set up environment configuration
- Install dependencies
- Configure database
- Start services
- Run initial tests
- Provide documentation overview

### Existing Developer Quick Setup

For experienced developers familiar with the project:

```bash
# Quick setup
./scripts/setup-dev.sh

# Or on Windows
.\scripts\setup-dev.ps1
```

## Development Tools

### 1. Debug Tools (`scripts/debug-tools.js`)

Comprehensive debugging utilities for troubleshooting development issues.

#### System Diagnostics

```bash
node scripts/debug-tools.js diagnostics
```

Provides complete system overview including:

- System information (OS, memory, CPU)
- Node.js environment details
- Dependency versions and availability
- Service status
- Port usage
- Disk space

#### Performance Monitoring

```bash
node scripts/debug-tools.js performance --duration 60
```

Features:

- Real-time memory usage tracking
- CPU usage monitoring
- Memory leak detection
- Performance trend analysis
- Automatic alerts for issues

#### Log Analysis

```bash
node scripts/debug-tools.js logs --log-path ./logs
```

Capabilities:

- Error pattern detection
- Log aggregation and analysis
- Common error identification
- Time-based log filtering
- Performance issue detection

#### Database Debugging

```bash
node scripts/debug-tools.js database
```

Includes:

- Connection testing
- Query performance analysis
- Lock detection
- Long-running query identification
- Database health checks

#### Network Diagnostics

```bash
node scripts/debug-tools.js network
```

Tests:

- Service endpoint availability
- Response time measurement
- Health check validation
- Network connectivity issues

### 2. Development Utilities (`scripts/dev-utilities.js`)

Collection of helpful development shortcuts and tools.

#### Secret Generation

```bash
node scripts/dev-utilities.js secrets
```

Generates secure secrets for:

- JWT tokens
- Encryption keys
- API keys
- Session secrets
- Webhook secrets

#### Environment Validation

```bash
node scripts/dev-utilities.js validate-env
```

Validates:

- Required environment variables
- Configuration format
- Security best practices
- Service connectivity

#### Database Management

```bash
# Reset database
node scripts/dev-utilities.js db reset

# Create backup
node scripts/dev-utilities.js db backup

# Seed with sample data
node scripts/dev-utilities.js db seed

# Run migrations
node scripts/dev-utilities.js db migrate
```

#### Service Management

```bash
# Start specific service
node scripts/dev-utilities.js service start postgres

# View service logs
node scripts/dev-utilities.js service logs user-service

# Check service status
node scripts/dev-utilities.js service status

# Restart services
node scripts/dev-utilities.js service restart
```

#### Code Quality

```bash
# Run quality checks
node scripts/dev-utilities.js quality

# Run with auto-fix
node scripts/dev-utilities.js quality --fix
```

### 3. Code Generators

#### Service Generator (`scripts/code-generators/generate-service.js`)

```bash
node scripts/code-generators/generate-service.js billing-service
```

Generates complete microservice with:

- Express.js setup with TypeScript
- Health check endpoints
- Error handling middleware
- Logging configuration
- Docker configuration
- Test setup
- Documentation

Options:

- `--no-auth` - Skip authentication setup
- `--no-database` - Skip database integration
- `--with-graphql` - Include GraphQL setup
- `--with-websocket` - Include WebSocket support

#### API Generator (`scripts/code-generators/generate-api.js`)

```bash
node scripts/code-generators/generate-api.js user-service profile
```

Generates consistent API endpoints:

- RESTful controllers
- Service layer
- Data models with validation
- Route definitions
- Comprehensive tests
- API documentation

### 4. Quality Tools (`scripts/quality-tools/code-quality-check.js`)

Automated code quality checking with comprehensive reporting.

```bash
# Run all checks
node scripts/quality-tools/code-quality-check.js

# Auto-fix issues
node scripts/quality-tools/code-quality-check.js --fix

# Skip specific checks
node scripts/quality-tools/code-quality-check.js --skip-tests --skip-security
```

Includes:

- **ESLint**: Code linting with TypeScript support
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **Tests**: Automated test execution
- **Security**: Vulnerability scanning

### 5. Development Utilities (`scripts/dev-utils.sh` / `scripts/dev-utils.ps1`)

Cross-platform development shortcuts:

```bash
# Check development environment status
./scripts/dev-utils.sh status

# Show service logs
./scripts/dev-utils.sh logs user-service

# Clean build artifacts
./scripts/dev-utils.sh clean

# Reset development environment
./scripts/dev-utils.sh reset

# Run tests with pattern
./scripts/dev-utils.sh test newsletter

# Start service in debug mode
./scripts/dev-utils.sh debug user-service
```

## Development Workflow

### Daily Development Workflow

1. **Morning Setup**

   ```bash
   # Check system status
   node scripts/debug-tools.js diagnostics

   # Validate environment
   node scripts/dev-utilities.js validate-env

   # Start services
   npm run dev
   ```

2. **During Development**

   ```bash
   # Monitor performance
   node scripts/debug-tools.js performance --duration 30

   # Check logs for issues
   node scripts/debug-tools.js logs

   # Run quality checks
   node scripts/dev-utilities.js quality --fix
   ```

3. **Before Committing**

   ```bash
   # Run comprehensive quality check
   node scripts/quality-tools/code-quality-check.js --fix

   # Run tests
   npm test

   # Check for security issues
   npm audit
   ```

### Feature Development Workflow

1. **Planning Phase**
   - Review requirements and design documents
   - Check existing code patterns
   - Plan service architecture

2. **Implementation Phase**

   ```bash
   # Generate service if needed
   node scripts/code-generators/generate-service.js my-feature-service

   # Generate API endpoints
   node scripts/code-generators/generate-api.js my-service resource

   # Implement business logic
   # Write tests
   ```

3. **Testing Phase**

   ```bash
   # Run unit tests
   npm run test:unit

   # Run integration tests
   npm run test:integration

   # Performance testing
   node scripts/debug-tools.js performance --duration 120
   ```

4. **Quality Assurance**

   ```bash
   # Comprehensive quality check
   node scripts/quality-tools/code-quality-check.js

   # Security scan
   npm audit

   # Manual testing
   ```

### Debugging Workflow

1. **Issue Identification**

   ```bash
   # System diagnostics
   node scripts/debug-tools.js diagnostics

   # Check service status
   node scripts/dev-utilities.js service status
   ```

2. **Log Analysis**

   ```bash
   # Analyze application logs
   node scripts/debug-tools.js logs

   # Check specific service logs
   node scripts/dev-utilities.js service logs problematic-service
   ```

3. **Performance Investigation**

   ```bash
   # Monitor performance
   node scripts/debug-tools.js performance --duration 300

   # Database performance
   node scripts/debug-tools.js database
   ```

4. **Network Issues**

   ```bash
   # Test connectivity
   node scripts/debug-tools.js network

   # Check port usage
   ./scripts/dev-utils.sh status
   ```

## IDE Integration

### Visual Studio Code

Recommended extensions are automatically suggested when opening the project:

- **TypeScript and JavaScript Language Features**
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Docker** - Container support
- **GitLens** - Enhanced Git capabilities
- **Thunder Client** - API testing

### Debug Configuration

Launch configurations are provided for debugging services:

```json
{
  "name": "Debug User Service",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/services/user-service/src/index.ts",
  "env": { "NODE_ENV": "development" },
  "runtimeArgs": ["-r", "ts-node/register"]
}
```

### Tasks and Shortcuts

Custom VS Code tasks for common operations:

- Build all services
- Run tests
- Start development servers
- Run quality checks

## Performance Optimization

### Development Performance

- **Hot Reloading**: Automatic code reloading during development
- **Incremental Builds**: Only rebuild changed components
- **Parallel Processing**: Run multiple services simultaneously
- **Caching**: Intelligent caching of dependencies and builds

### Monitoring and Profiling

- **Memory Usage**: Automatic memory leak detection
- **CPU Profiling**: Performance bottleneck identification
- **Database Performance**: Query optimization suggestions
- **Network Latency**: Response time monitoring

## Testing Strategy

### Test Types

1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Service interaction testing
3. **End-to-End Tests**: Complete user journey testing
4. **Performance Tests**: Load and stress testing
5. **Security Tests**: Vulnerability and penetration testing

### Test Execution

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Utilities

- **Mock Data Generation**: Consistent test data
- **Database Seeding**: Test database setup
- **Service Mocking**: External service simulation
- **Performance Benchmarking**: Automated performance testing

## Documentation

### API Documentation

- **OpenAPI/Swagger**: Interactive API documentation
- **GraphQL Schema**: Schema documentation with examples
- **Postman Collections**: Ready-to-use API collections
- **SDK Documentation**: Client library documentation

### Code Documentation

- **TypeDoc**: Automated TypeScript documentation
- **JSDoc**: JavaScript documentation
- **README Files**: Service-specific documentation
- **Architecture Diagrams**: System design documentation

## Troubleshooting

### Common Issues

1. **Port Conflicts**

   ```bash
   # Check port usage
   node scripts/debug-tools.js diagnostics

   # Kill processes using ports
   ./scripts/dev-utils.sh clean
   ```

2. **Database Connection Issues**

   ```bash
   # Test database connectivity
   node scripts/debug-tools.js database

   # Reset database
   node scripts/dev-utilities.js db reset
   ```

3. **Service Startup Problems**

   ```bash
   # Check service status
   node scripts/dev-utilities.js service status

   # View service logs
   node scripts/dev-utilities.js service logs
   ```

4. **Performance Issues**

   ```bash
   # Monitor performance
   node scripts/debug-tools.js performance

   # Analyze logs
   node scripts/debug-tools.js logs
   ```

### Getting Help

1. **Documentation**: Check relevant documentation first
2. **Debug Tools**: Use built-in debugging utilities
3. **Team Channels**: Ask questions in team communication channels
4. **Issue Tracking**: Create detailed issue reports
5. **Pair Programming**: Collaborate with team members

## Best Practices

### Code Quality

- Follow TypeScript strict mode
- Use consistent naming conventions
- Write comprehensive tests
- Document complex logic
- Use meaningful commit messages

### Performance

- Monitor memory usage
- Optimize database queries
- Use appropriate caching strategies
- Profile performance regularly
- Implement proper error handling

### Security

- Never commit secrets
- Use environment variables
- Validate all inputs
- Implement proper authentication
- Regular security audits

### Collaboration

- Use feature branches
- Write clear pull request descriptions
- Review code thoroughly
- Share knowledge with team
- Maintain documentation

## Conclusion

The AiLert platform provides a comprehensive developer experience with powerful
tools, automated workflows, and extensive documentation. By following these
guidelines and utilizing the available tools, developers can be productive and
deliver high-quality code efficiently.

For questions or suggestions about the developer experience, please reach out to
the development team or create an issue in the project repository.
