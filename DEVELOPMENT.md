# AiLert Development Guide

## Overview

This document provides comprehensive guidance for developing the AiLert Professional Newsletter Platform. The platform uses a modern microservices architecture with Docker containerization, Kubernetes deployment, and comprehensive CI/CD pipelines.

## Architecture

### Microservices
- **User Service** (Port 3001) - Authentication, user management
- **Newsletter Service** (Port 3002) - Newsletter creation, management, sending
- **Content Service** (Port 3003) - Content management, AI integration
- **CRM Service** (Port 3004) - Contact management, segmentation
- **Analytics Service** (Port 3005) - Analytics, reporting, insights
- **Frontend** (Port 3000) - Next.js web application

### Infrastructure
- **PostgreSQL** - Primary database
- **Redis** - Caching and session storage
- **Elasticsearch** - Search and analytics
- **RabbitMQ** - Message queue
- **Kong** - API Gateway
- **Prometheus/Grafana** - Monitoring

## Prerequisites

### Required Software
- **Node.js** 18+
- **Docker** 20.10+
- **Docker Compose** 2.0+
- **Git** 2.30+

### Optional Tools
- **kubectl** - Kubernetes CLI
- **k6** - Performance testing
- **Trivy** - Security scanning

### Development Tools
- **VS Code** (recommended)
- **Docker Desktop**
- **Postman** or **Insomnia** for API testing

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url>
cd ailert-platform
chmod +x scripts/*.sh
./scripts/setup-dev.sh
```

### 2. Start Development Environment
```bash
# Using Make
make dev-start

# Using Docker Compose
docker-compose up -d

# Using npm scripts
npm run dev
```

### 3. Verify Installation
```bash
# Check service health
make health

# View logs
make dev-logs

# Run tests
make test
```

## Development Workflow

### Environment Management

#### Development Environment
```bash
# Start all services
make dev-start

# Stop all services
make dev-stop

# Reset environment (removes all data)
make dev-reset

# View logs for all services
make dev-logs

# View logs for specific service
make dev-logs-user-service
```

#### Environment Variables
- **Development**: `.env` (created by setup script)
- **Testing**: `.env.test`
- **Production**: Environment-specific secrets

### Service Development

#### Creating a New Service
```bash
# Generate service boilerplate
./scripts/dev-utils.sh generate-service billing-service

# Or using PowerShell on Windows
.\scripts\dev-utils.ps1 generate-service billing-service
```

#### Service Structure
```
services/service-name/
├── src/
│   ├── controllers/     # HTTP request handlers
│   ├── services/        # Business logic
│   ├── models/          # Data models
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript types
│   └── index.ts         # Entry point
├── tests/
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── docs/                # Service documentation
├── Dockerfile           # Multi-stage Docker build
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── jest.config.js       # Test configuration
```

#### Development Commands
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start with debugging
npm run dev:debug

# Build for production
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

### Database Management

#### Migrations
```bash
# Run migrations for all services
make db-migrate

# Run migrations for specific service
docker-compose exec user-service npm run db:migrate
```

#### Seeding
```bash
# Seed all databases
make db-seed

# Reset and reseed
make db-reset
```

#### Database Access
```bash
# Connect to PostgreSQL
make psql

# Connect to Redis
make redis-cli

# Access pgAdmin (development)
# http://localhost:5050 (admin@ailert.dev / admin)
```

### Testing

#### Test Types
- **Unit Tests** - Individual function/component testing
- **Integration Tests** - Service interaction testing
- **End-to-End Tests** - Full workflow testing
- **Performance Tests** - Load and stress testing

#### Running Tests
```bash
# All tests
npm test

# Specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e

# Performance tests
npm run test:performance

# Security tests
npm run test:security

# With coverage
npm run test:coverage

# Watch mode (development)
npm run test:watch
```

#### Test Environment
```bash
# Start test infrastructure
docker-compose -f docker-compose.test.yml up -d

# Run tests against test environment
START_TEST_INFRASTRUCTURE=true npm test

# Clean up test environment
docker-compose -f docker-compose.test.yml down -v
```

### Code Quality

#### Linting and Formatting
```bash
# Lint all code
make lint

# Fix linting issues
npm run lint:fix

# Format all code
make format

# Type check all services
make type-check
```

#### Pre-commit Hooks
Git hooks are automatically configured to run:
- ESLint
- Prettier
- TypeScript compilation
- Unit tests

#### Code Standards
- **TypeScript** for all services
- **ESLint** with TypeScript rules
- **Prettier** for code formatting
- **Conventional Commits** for commit messages
- **JSDoc** for function documentation

### Debugging

#### VS Code Debugging
1. Open VS Code in project root
2. Go to Run and Debug (Ctrl+Shift+D)
3. Select service to debug
4. Set breakpoints and start debugging

#### Container Debugging
```bash
# Enable debug mode for service
./scripts/dev-debug.sh enable-debug user-service 9229

# Attach to running container
./scripts/dev-debug.sh attach user-service

# Interactive shell in container
make shell-user-service
```

#### Log Analysis
```bash
# View service logs
./scripts/dev-debug.sh logs user-service

# Filter logs
./scripts/dev-debug.sh logs user-service error 100

# Monitor performance
./scripts/dev-debug.sh monitor user-service 5
```

### Performance Monitoring

#### Health Monitoring
```bash
# Single health check
./scripts/health-monitor.sh check

# Continuous monitoring
./scripts/health-monitor.sh monitor

# Generate health report
./scripts/health-monitor.sh report
```

#### Metrics and Monitoring
- **Prometheus** - http://localhost:9090
- **Grafana** - http://localhost:3001 (admin/admin)
- **Service Metrics** - http://localhost:PORT/metrics

#### Performance Testing
```bash
# API load testing
npm run test:performance

# Stress testing
./scripts/dev-debug.sh stress-test user-service 50 120

# Memory profiling
./scripts/dev-debug.sh profile-memory user-service 60
```

## Deployment

### Local Deployment
```bash
# Build all services
make build

# Deploy to local Kubernetes
make deploy-staging
```

### Production Deployment
Deployment is handled by GitHub Actions CI/CD pipeline:

1. **Code Push** → Triggers CI/CD
2. **Security Scan** → Vulnerability assessment
3. **Tests** → Unit, integration, e2e tests
4. **Build** → Docker images
5. **Deploy Staging** → Staging environment
6. **Deploy Production** → Production environment

### Kubernetes
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n ailert

# View service logs
kubectl logs -f deployment/user-service -n ailert

# Port forward for local access
kubectl port-forward service/user-service 3001:3001 -n ailert
```

## Security

### Security Scanning
```bash
# Run security audit
make security-scan

# Fix vulnerabilities
npm audit fix

# Docker image scanning
trivy image ailert/user-service:latest
```

### Security Best Practices
- Never commit secrets to version control
- Use environment variables for configuration
- Implement proper authentication and authorization
- Validate all user inputs
- Use HTTPS in production
- Regular dependency updates
- Security headers in HTTP responses

## Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check Docker status
docker ps

# Check service logs
docker-compose logs service-name

# Restart specific service
docker-compose restart service-name
```

#### Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready -U ailert

# Reset database
make db-reset

# Check connection string
echo $DATABASE_URL
```

#### Port Conflicts
```bash
# Check port usage
netstat -tulpn | grep :3001

# Kill process using port
sudo kill -9 $(lsof -t -i:3001)
```

#### Memory Issues
```bash
# Check Docker memory usage
docker stats

# Clean up Docker resources
make clean

# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory
```

### Debug Commands
```bash
# System health check
./scripts/health-monitor.sh check

# Service endpoint testing
./scripts/dev-debug.sh test-endpoints

# Container resource usage
docker stats --no-stream

# Service recovery
./scripts/health-monitor.sh recover user-service
```

## Development Tools

### VS Code Extensions
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Docker
- Kubernetes
- GitLens
- Thunder Client (API testing)

### Useful Commands
```bash
# Generate API documentation
npm run docs:generate

# Serve documentation
npm run docs:serve

# Backup development data
./scripts/dev-utils.sh backup

# Restore development data
./scripts/dev-utils.sh restore backups/20231201_120000

# Clean node_modules
./scripts/dev-utils.sh clean-install
```

### Browser Extensions
- **React Developer Tools** (for frontend debugging)
- **Redux DevTools** (if using Redux)
- **JSON Viewer** (for API responses)

## Contributing

### Development Process
1. Create feature branch from `develop`
2. Implement changes with tests
3. Run quality checks locally
4. Submit pull request
5. Code review and approval
6. Merge to `develop`
7. Deploy to staging for testing
8. Merge to `main` for production

### Commit Guidelines
```bash
# Conventional commit format
feat(user-service): add password reset functionality
fix(newsletter): resolve email template rendering issue
docs(readme): update installation instructions
test(crm): add integration tests for contact import
```

### Code Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] Security considerations addressed
- [ ] Performance impact assessed
- [ ] Breaking changes documented

## Resources

### Documentation
- [API Documentation](http://localhost:8000/docs)
- [Architecture Decision Records](./docs/adr/)
- [Deployment Guide](./docs/deployment.md)
- [Security Guide](./docs/security.md)

### External Resources
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Support
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: Project Wiki
- **Chat**: Team Slack/Discord

---

For additional help, run `make help` to see all available commands or check the individual service README files.
