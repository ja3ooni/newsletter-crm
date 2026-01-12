# DatatechtonCRM Platform Infrastructure

This document provides a comprehensive overview of the DatatechtonCRM platform's modern development infrastructure, including containerization, orchestration, CI/CD, and development environment setup.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Docker Containerization](#docker-containerization)
- [Kubernetes Deployment](#kubernetes-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Development Environment](#development-environment)
- [Monitoring and Observability](#monitoring-and-observability)
- [Security](#security)
- [Getting Started](#getting-started)
- [Troubleshooting](#troubleshooting)

## Overview

The DatatechtonCRM platform uses a modern microservices architecture with the following key infrastructure components:

- **Containerization**: Docker with multi-stage builds for all services
- **Orchestration**: Kubernetes for production deployment
- **CI/CD**: GitHub Actions with automated testing, security scanning, and deployment
- **Development Environment**: Docker Compose with hot reloading and debugging capabilities
- **Monitoring**: Prometheus, Grafana, and distributed tracing with Jaeger
- **Security**: Comprehensive security scanning, secrets management, and secure defaults

## Architecture

### Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  API Gateway    │    │   Load Balancer │
│   (Next.js)     │◄──►│    (Kong)       │◄──►│   (Kubernetes)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
        │ User Service │ │Newsletter   │ │Content     │
        │              │ │Service      │ │Service     │
        └──────────────┘ └─────────────┘ └────────────┘
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
        │ CRM Service  │ │Analytics    │ │Message     │
        │              │ │Service      │ │Queue       │
        └──────────────┘ └─────────────┘ └────────────┘
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
        │ PostgreSQL   │ │    Redis    │ │Elasticsearch│
        │              │ │             │ │            │
        └──────────────┘ └─────────────┘ └────────────┘
```

### Infrastructure Components

- **Frontend**: Next.js application with SSR/SSG capabilities
- **API Gateway**: Kong for request routing, rate limiting, and authentication
- **Microservices**: Node.js/TypeScript services with dedicated responsibilities
- **Databases**: PostgreSQL for transactional data, Redis for caching
- **Search**: Elasticsearch for full-text search and analytics
- **Message Queue**: RabbitMQ for asynchronous processing
- **Monitoring**: Prometheus + Grafana + Jaeger for observability

## Docker Containerization

### Multi-Stage Builds

All services use optimized multi-stage Dockerfiles with the following stages:

1. **Base**: Common dependencies and security updates
2. **Dependencies**: Production dependencies only
3. **Dev Dependencies**: All dependencies for development
4. **Development**: Hot reloading and debugging capabilities
5. **Builder**: Application build process
6. **Production**: Minimal runtime image

### Security Features

- Non-root user execution
- Read-only root filesystem
- Minimal attack surface with Alpine Linux
- Security updates and vulnerability scanning
- Secrets management via environment variables

### Example Dockerfile Structure

```dockerfile
# Multi-stage build for optimal size and security
FROM node:18-alpine AS base
RUN apk update && apk upgrade && \
    apk add --no-cache curl dumb-init ca-certificates tzdata

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund

FROM base AS development
COPY --from=dev-deps /app/node_modules ./node_modules
USER nodejs
HEALTHCHECK --interval=30s --timeout=10s CMD curl -f http://localhost:3001/health
CMD ["dumb-init", "npm", "run", "dev"]

FROM base AS production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
USER nodejs
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

## Kubernetes Deployment

### Deployment Features

- **Rolling Updates**: Zero-downtime deployments
- **Health Checks**: Liveness, readiness, and startup probes
- **Resource Management**: CPU and memory limits/requests
- **Security Context**: Non-root execution, read-only filesystem
- **Auto-scaling**: Horizontal Pod Autoscaler (HPA)
- **Service Mesh**: Ready for Istio/Linkerd integration

### Resource Configuration

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
    ephemeral-storage: "1Gi"
  limits:
    memory: "1Gi"
    cpu: "1000m"
    ephemeral-storage: "2Gi"
```

### Security Configuration

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  fsGroup: 1001
  seccompProfile:
    type: RuntimeDefault
```

### Health Checks

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: http
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: http
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

## CI/CD Pipeline

### Pipeline Stages

1. **Security Scanning**
   - Trivy vulnerability scanning
   - Semgrep static analysis
   - npm audit for dependencies
   - OWASP Dependency Check
   - CodeQL analysis
   - Hadolint for Dockerfile linting

2. **Code Quality**
   - ESLint for code linting
   - Prettier for code formatting
   - TypeScript type checking
   - Unit tests with coverage

3. **Build and Test**
   - Docker image building
   - Integration tests
   - End-to-end tests
   - Performance tests

4. **Deployment**
   - Staging deployment with smoke tests
   - Production deployment with blue-green strategy
   - Automatic rollback on failure

### Security Scanning Tools

- **Trivy**: Container and filesystem vulnerability scanning
- **Semgrep**: Static analysis for security issues
- **Snyk**: Dependency vulnerability scanning
- **OWASP Dependency Check**: Known vulnerability detection
- **Hadolint**: Dockerfile best practices
- **Checkov**: Infrastructure as Code scanning

### Deployment Strategy

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

## Development Environment

### Quick Start

```bash
# Clone and setup
git clone <repository>
cd datatechtoncrm-platform

# Start development environment
./scripts/setup-dev.sh
./scripts/dev-start.sh

# Or on Windows
.\scripts\setup-dev.ps1
.\scripts\dev-utils.ps1 start
```

### Available Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js application |
| API Gateway | 8000 | Kong gateway |
| User Service | 3001 | User management |
| Newsletter Service | 3002 | Newsletter operations |
| Content Service | 3003 | Content management |
| CRM Service | 3004 | Customer relationship |
| Analytics Service | 3005 | Analytics and reporting |
| Grafana | 3001 | Monitoring dashboard |
| Prometheus | 9090 | Metrics collection |
| RabbitMQ Management | 15672 | Message queue UI |
| MailHog | 8025 | Email testing |
| pgAdmin | 5050 | Database management |
| Redis Commander | 8081 | Redis management |
| Kibana | 5601 | Elasticsearch UI |
| Jaeger | 16686 | Distributed tracing |

### Development Tools

- **Hot Reloading**: Automatic code reloading for all services
- **Debugging**: VS Code debug configurations for all services
- **Database Tools**: pgAdmin, Redis Commander, Kibana
- **Email Testing**: MailHog for email development
- **Monitoring**: Grafana dashboards for development metrics
- **Tracing**: Jaeger for distributed tracing

### VS Code Integration

The project includes comprehensive VS Code configuration:

- **Debug Configurations**: Launch and attach debuggers for all services
- **Tasks**: Common development tasks (build, test, lint, format)
- **Extensions**: Recommended extensions for optimal development
- **Settings**: Consistent formatting and linting rules

## Monitoring and Observability

### Metrics Collection

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Node Exporter**: System metrics
- **cAdvisor**: Container metrics
- **Custom Metrics**: Application-specific metrics

### Distributed Tracing

- **Jaeger**: Distributed tracing for microservices
- **OpenTelemetry**: Standardized observability framework
- **Zipkin**: Alternative tracing solution

### Logging

- **Structured Logging**: JSON format for all services
- **Log Aggregation**: Centralized logging with ELK stack
- **Log Levels**: Configurable log levels per service

### Alerting

```yaml
# Example alert rule
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: High error rate detected
```

## Security

### Container Security

- **Non-root execution**: All containers run as non-root users
- **Read-only filesystem**: Containers use read-only root filesystem
- **Minimal base images**: Alpine Linux for reduced attack surface
- **Security scanning**: Automated vulnerability scanning
- **Secrets management**: Kubernetes secrets for sensitive data

### Network Security

- **Network policies**: Kubernetes network segmentation
- **TLS encryption**: End-to-end encryption
- **API Gateway**: Centralized security policies
- **Rate limiting**: Protection against abuse

### Code Security

- **Static analysis**: Automated security code review
- **Dependency scanning**: Known vulnerability detection
- **Secrets detection**: Prevention of secret leakage
- **Security headers**: Proper HTTP security headers

## Getting Started

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+
- kubectl (for Kubernetes deployment)
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd datatechtoncrm-platform
   ```

2. **Run setup script**
   ```bash
   # Linux/macOS
   ./scripts/setup-dev.sh

   # Windows
   .\scripts\setup-dev.ps1
   ```

3. **Start services**
   ```bash
   # Linux/macOS
   ./scripts/dev-start.sh

   # Windows
   .\scripts\dev-utils.ps1 start
   ```

4. **Verify installation**
   ```bash
   # Linux/macOS
   ./scripts/validate-infrastructure.sh

   # Windows
   .\scripts\validate-infrastructure.ps1
   ```

### Production Deployment

1. **Build production images**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
   ```

2. **Deploy to Kubernetes**
   ```bash
   kubectl apply -f k8s/
   ```

3. **Verify deployment**
   ```bash
   kubectl get pods -n datatechtoncrm
   kubectl get services -n datatechtoncrm
   ```

## Troubleshooting

### Common Issues

#### Docker Issues

**Problem**: Docker daemon not running
```bash
# Solution: Start Docker service
sudo systemctl start docker  # Linux
# Or start Docker Desktop on Windows/macOS
```

**Problem**: Port conflicts
```bash
# Solution: Check and stop conflicting services
netstat -tulpn | grep :3000
sudo kill -9 <PID>
```

#### Service Issues

**Problem**: Service not starting
```bash
# Check logs
docker-compose logs <service-name>

# Restart service
docker-compose restart <service-name>
```

**Problem**: Database connection issues
```bash
# Check database status
docker-compose ps postgres
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

#### Development Issues

**Problem**: Hot reloading not working
```bash
# Restart development environment
docker-compose down
docker-compose up -d
```

**Problem**: VS Code debugger not connecting
```bash
# Check debug port availability
netstat -an | grep :9229

# Restart service in debug mode
./scripts/dev-debug.sh enable-debug user-service 9229
```

### Useful Commands

```bash
# View all service logs
docker-compose logs -f

# Check service health
curl http://localhost:3001/health

# Monitor resource usage
docker stats

# Clean up resources
docker system prune -f
docker volume prune -f

# Reset development environment
docker-compose down -v
docker-compose up -d
```

### Performance Optimization

#### Development Environment

- Use Docker BuildKit for faster builds
- Enable Docker layer caching
- Use .dockerignore to exclude unnecessary files
- Optimize volume mounts for better performance

#### Production Environment

- Use multi-stage builds for smaller images
- Implement proper resource limits
- Use horizontal pod autoscaling
- Optimize database queries and indexing

### Support

For additional support:

1. Check the [troubleshooting section](#troubleshooting)
2. Review service logs: `docker-compose logs <service>`
3. Run validation script: `./scripts/validate-infrastructure.sh`
4. Check GitHub Issues for known problems
5. Contact the development team

---

## Quick Reference

### Essential Commands

```bash
# Start development environment
./scripts/dev-start.sh

# Stop development environment
./scripts/dev-stop.sh

# View logs
./scripts/dev-logs.sh [service-name]

# Run tests
npm test

# Build production images
npm run build:prod

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

### Service URLs (Development)

- Frontend: http://localhost:3000
- API Gateway: http://localhost:8000
- Grafana: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090
- RabbitMQ: http://localhost:15672 (datatechtoncrm/datatechtoncrm_rabbitmq_password)
- MailHog: http://localhost:8025
- pgAdmin: http://localhost:5050 (admin@datatechtoncrm.dev/admin)
- Redis Commander: http://localhost:8081
- Kibana: http://localhost:5601
- Jaeger: http://localhost:16686

This infrastructure provides a robust, scalable, and secure foundation for the DatatechtonCRM platform with modern development practices and comprehensive tooling.
