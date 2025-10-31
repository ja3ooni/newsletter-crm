# Development Scripts

This directory contains comprehensive development tools and utilities to enhance
the developer experience for the AiLert platform.

## Overview

Our development tooling is designed to provide:

- **Automated Setup**: Interactive onboarding for new developers
- **Debugging Tools**: Comprehensive system diagnostics and troubleshooting
- **Code Generation**: Consistent service and API generation
- **Quality Assurance**: Automated code quality checking
- **Development Utilities**: Helpful shortcuts and tools

## Scripts Overview

### 🚀 Onboarding & Setup

#### `dev-onboarding.js`

Interactive onboarding tool for new developers.

```bash
node scripts/dev-onboarding.js
```

**Features:**

- Prerequisites checking
- Environment setup
- Dependencies installation
- Database configuration
- Service startup
- Test execution
- Documentation overview

#### `setup-dev.sh` / `setup-dev.ps1`

Automated development environment setup scripts.

```bash
# macOS/Linux
./scripts/setup-dev.sh

# Windows
.\scripts\setup-dev.ps1
```

**Features:**

- System requirements validation
- Environment file creation
- Dependencies installation
- Infrastructure setup
- Database initialization

### 🔧 Development Utilities

#### `dev-utilities.js`

Collection of helpful development tools and shortcuts.

```bash
# Generate secure secrets
node scripts/dev-utilities.js secrets

# Validate environment
node scripts/dev-utilities.js validate-env

# Database utilities
node scripts/dev-utilities.js db reset
node scripts/dev-utilities.js db seed
node scripts/dev-utilities.js db backup

# Service management
node scripts/dev-utilities.js service start postgres
node scripts/dev-utilities.js service logs user-service
node scripts/dev-utilities.js service status

# Code quality
node scripts/dev-utilities.js quality --fix
```

#### `dev-utils.sh` / `dev-utils.ps1`

Cross-platform development utilities with common shortcuts.

```bash
# Check system status
./scripts/dev-utils.sh status

# Show service logs
./scripts/dev-utils.sh logs user-service

# Clean environment
./scripts/dev-utils.sh clean

# Reset development environment
./scripts/dev-utils.sh reset

# Run tests with pattern
./scripts/dev-utils.sh test newsletter

# Debug service
./scripts/dev-utils.sh debug user-service
```

### 🐛 Debugging Tools

#### `debug-tools.js`

Comprehensive debugging utilities for troubleshooting.

```bash
# System diagnostics
node scripts/debug-tools.js diagnostics

# Performance monitoring
node scripts/debug-tools.js performance --duration 60

# Log analysis
node scripts/debug-tools.js logs --log-path ./logs

# Database debugging
node scripts/debug-tools.js database

# Network connectivity
node scripts/debug-tools.js network

# Complete monitoring dashboard
node scripts/debug-tools.js monitor
```

**Capabilities:**

- System resource monitoring
- Memory leak detection
- Performance analysis
- Log aggregation and analysis
- Database health checks
- Network connectivity testing

### 🏗️ Code Generation

#### `code-generators/generate-service.js`

Generate complete microservice boilerplate.

```bash
node scripts/code-generators/generate-service.js billing-service
```

**Options:**

- `--no-auth` - Skip authentication setup
- `--no-database` - Skip database integration
- `--no-redis` - Skip Redis integration
- `--with-graphql` - Include GraphQL setup
- `--with-websocket` - Include WebSocket support

**Generates:**

- Express.js setup with TypeScript
- Health check endpoints
- Error handling middleware
- Logging configuration
- Docker configuration
- Test setup
- Documentation

#### `code-generators/generate-api.js`

Generate consistent API endpoints and controllers.

```bash
node scripts/code-generators/generate-api.js user-service profile
```

**Options:**

- `--with-auth` - Include authentication middleware
- `--no-validation` - Skip request validation
- `--no-tests` - Skip test generation

**Generates:**

- RESTful controllers
- Service layer
- Data models with validation
- Route definitions
- Comprehensive tests
- API documentation

### 🔍 Quality Tools

#### `quality-tools/code-quality-check.js`

Comprehensive code quality checking with detailed reporting.

```bash
# Run all quality checks
node scripts/quality-tools/code-quality-check.js

# Auto-fix issues where possible
node scripts/quality-tools/code-quality-check.js --fix

# Skip specific checks
node scripts/quality-tools/code-quality-check.js --skip-tests --skip-security

# Verbose output
node scripts/quality-tools/code-quality-check.js --verbose
```

**Includes:**

- **ESLint**: Code linting with TypeScript support
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **Tests**: Automated test execution
- **Security**: Vulnerability scanning

## Usage Patterns

### New Developer Workflow

1. **Initial Setup**

   ```bash
   # Interactive onboarding
   node scripts/dev-onboarding.js
   ```

2. **Daily Development**

   ```bash
   # Check system status
   node scripts/debug-tools.js diagnostics

   # Start development
   npm run dev
   ```

3. **Before Committing**

   ```bash
   # Quality checks
   node scripts/quality-tools/code-quality-check.js --fix

   # Run tests
   npm test
   ```

### Debugging Workflow

1. **Issue Investigation**

   ```bash
   # System diagnostics
   node scripts/debug-tools.js diagnostics

   # Check logs
   node scripts/debug-tools.js logs
   ```

2. **Performance Issues**

   ```bash
   # Monitor performance
   node scripts/debug-tools.js performance --duration 120

   # Database performance
   node scripts/debug-tools.js database
   ```

3. **Service Issues**

   ```bash
   # Check service status
   node scripts/dev-utilities.js service status

   # View service logs
   node scripts/dev-utilities.js service logs problematic-service
   ```

### Feature Development Workflow

1. **Service Generation**

   ```bash
   # Generate new service
   node scripts/code-generators/generate-service.js my-feature-service
   ```

2. **API Development**

   ```bash
   # Generate API endpoints
   node scripts/code-generators/generate-api.js my-service resource
   ```

3. **Quality Assurance**
   ```bash
   # Run quality checks
   node scripts/quality-tools/code-quality-check.js
   ```

## Configuration

### Environment Variables

Scripts respect the following environment variables:

- `NODE_ENV` - Environment mode (development/production)
- `DEBUG` - Enable debug output
- `DATABASE_URL` - Database connection string
- `REDIS_URL` - Redis connection string
- `LOG_LEVEL` - Logging level

### Script Options

Most scripts support common options:

- `--verbose` - Detailed output
- `--help` - Show help information
- `--fix` - Auto-fix issues where possible
- `--skip-*` - Skip specific operations

## Troubleshooting

### Common Issues

1. **Permission Errors**

   ```bash
   # Make scripts executable
   chmod +x scripts/*.sh
   ```

2. **Node.js Version Issues**

   ```bash
   # Check Node.js version
   node --version

   # Should be 18.0.0 or higher
   ```

3. **Docker Issues**

   ```bash
   # Check Docker status
   docker --version
   docker-compose --version
   ```

4. **Port Conflicts**
   ```bash
   # Check port usage
   node scripts/debug-tools.js diagnostics
   ```

### Getting Help

1. **Script Help**: Run any script with `--help` flag
2. **Documentation**: Check `docs/development/` directory
3. **Debug Tools**: Use `node scripts/debug-tools.js diagnostics`
4. **Team Support**: Reach out in team channels

## Contributing

### Adding New Scripts

1. **Follow Naming Convention**: Use kebab-case for script names
2. **Include Help Text**: Provide `--help` option
3. **Error Handling**: Implement proper error handling
4. **Documentation**: Update this README
5. **Testing**: Test on multiple platforms

### Script Standards

- Use consistent color coding for output
- Implement proper logging levels
- Support common CLI options
- Include progress indicators
- Provide meaningful error messages

### Code Style

- Follow existing patterns
- Use TypeScript where applicable
- Include JSDoc comments
- Implement proper error handling
- Use consistent formatting

## Platform Support

### Supported Platforms

- **macOS**: Full support with Bash scripts
- **Linux**: Full support with Bash scripts
- **Windows**: Full support with PowerShell scripts

### Cross-Platform Considerations

- Use Node.js for complex logic
- Provide both Bash and PowerShell versions
- Test on all supported platforms
- Handle platform-specific differences

## Performance

### Script Performance

- Scripts are optimized for development use
- Parallel execution where possible
- Intelligent caching of results
- Minimal resource usage

### Monitoring

- Built-in performance monitoring
- Resource usage tracking
- Execution time measurement
- Memory usage analysis

## Security

### Security Considerations

- Never log sensitive information
- Use secure secret generation
- Validate all inputs
- Follow security best practices

### Secret Management

- Generate secure random secrets
- Never commit secrets to version control
- Use environment variables
- Rotate secrets regularly

## Future Enhancements

### Planned Features

- **GUI Interface**: Web-based development dashboard
- **Remote Debugging**: Remote service debugging capabilities
- **Advanced Analytics**: Enhanced performance analytics
- **Integration Testing**: Automated integration test generation
- **Deployment Tools**: Enhanced deployment automation

### Feedback

We welcome feedback and suggestions for improving the development experience.
Please:

1. Create issues for bugs or feature requests
2. Submit pull requests for improvements
3. Share feedback in team channels
4. Contribute to documentation

---

For more information, see the
[Developer Experience Guide](../docs/development/developer-experience.md).
