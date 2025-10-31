# Developer Quick Reference

## Essential Commands

### 🚀 Getting Started

```bash
# New developer onboarding
npm run dev:onboard

# Quick setup (experienced developers)
./scripts/setup-dev.sh  # macOS/Linux
.\scripts\setup-dev.ps1  # Windows

# Start development environment
npm run dev
```

### 🔧 Daily Development

```bash
# System diagnostics
npm run dev:diagnostics

# Start development servers
npm run dev

# Run quality checks
npm run dev:quality --fix

# Run tests
npm test
```

### 🐛 Debugging & Troubleshooting

```bash
# Complete system diagnostics
npm run dev:diagnostics

# Performance monitoring
npm run dev:performance

# Analyze logs
npm run dev:logs:analyze

# Network connectivity check
npm run dev:network

# Database debugging
node scripts/debug-tools.js database
```

### 🏗️ Code Generation

```bash
# Generate new service
npm run dev:generate:service my-service

# Generate API endpoints
npm run dev:generate:api user-service profile
```

### 🔍 Quality Assurance

```bash
# Run all quality checks
npm run dev:quality

# Auto-fix issues
npm run dev:quality -- --fix

# Run specific checks
npm run lint
npm run format
npm run type-check
npm test
```

### 🗄️ Database Management

```bash
# Reset database
npm run db:reset

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed

# Create backup
node scripts/dev-utilities.js db backup
```

### 🔐 Security & Environment

```bash
# Generate secure secrets
npm run dev:secrets

# Validate environment
npm run dev:validate

# Security scan
npm run security:scan
```

### 📊 Performance Testing

```bash
# Quick performance test
npm run test:performance:quick

# Comprehensive performance test
npm run test:performance:comprehensive

# Load testing
npm run test:performance:load

# Database performance
npm run test:performance:database
```

## Service Management

### Docker Services

```bash
# Start all services
npm run dev

# Stop all services
npm run dev:stop

# Reset environment
npm run dev:reset

# View logs
npm run dev:logs

# Service-specific logs
npm run logs:user
npm run logs:newsletter
npm run logs:crm
```

### Individual Services

```bash
# Start specific service
node scripts/dev-utilities.js service start postgres

# Stop specific service
node scripts/dev-utilities.js service stop postgres

# Restart service
node scripts/dev-utilities.js service restart postgres

# View service logs
node scripts/dev-utilities.js service logs user-service

# Check service status
node scripts/dev-utilities.js service status
```

## Development URLs

| Service     | URL                           | Description           |
| ----------- | ----------------------------- | --------------------- |
| Frontend    | http://localhost:3000         | Next.js application   |
| API Gateway | http://localhost:8000         | Main API endpoint     |
| API Docs    | http://localhost:8000/docs    | Swagger documentation |
| GraphQL     | http://localhost:8000/graphql | GraphQL playground    |
| Grafana     | http://localhost:3001         | Monitoring dashboard  |
| MailHog     | http://localhost:8025         | Email testing         |
| Prometheus  | http://localhost:9090         | Metrics collection    |

## File Structure

```
├── docs/                    # Documentation
│   ├── api/                # API documentation
│   └── development/        # Development guides
├── frontend/               # Next.js frontend
├── services/               # Microservices
│   ├── user-service/       # User management
│   ├── newsletter-service/ # Newsletter functionality
│   ├── crm-service/       # CRM features
│   ├── analytics-service/ # Analytics
│   └── shared/            # Shared utilities
├── scripts/               # Development tools
│   ├── code-generators/   # Code generation
│   ├── quality-tools/     # Quality assurance
│   ├── debug-tools.js     # Debugging utilities
│   ├── dev-utilities.js   # Development shortcuts
│   └── dev-onboarding.js  # Interactive setup
├── tests/                 # Test suites
│   ├── e2e/              # End-to-end tests
│   ├── integration/      # Integration tests
│   └── performance/      # Performance tests
└── infrastructure/        # Infrastructure configs
```

## Environment Variables

### Required Variables

```bash
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secure-secret
```

### Optional Variables

```bash
SMTP_HOST=localhost
SMTP_PORT=1025
AWS_ACCESS_KEY_ID=your-key
STRIPE_SECRET_KEY=sk_test_your-key
OPENAI_API_KEY=your-key
```

## Common Issues & Solutions

### Port Conflicts

```bash
# Check port usage
npm run dev:diagnostics

# Kill processes using ports
./scripts/dev-utils.sh clean
```

### Database Issues

```bash
# Test database connection
node scripts/debug-tools.js database

# Reset database
npm run db:reset

# Check database logs
npm run logs:postgres
```

### Service Startup Problems

```bash
# Check service status
node scripts/dev-utilities.js service status

# View service logs
node scripts/dev-utilities.js service logs problematic-service

# Restart services
npm run dev:reset
```

### Performance Issues

```bash
# Monitor performance
npm run dev:performance

# Analyze logs for errors
npm run dev:logs:analyze

# Check system resources
npm run dev:diagnostics
```

### Code Quality Issues

```bash
# Run quality checks with auto-fix
npm run dev:quality -- --fix

# Fix specific issues
npm run lint:fix
npm run format
```

## Testing Strategies

### Test Types

| Type        | Command                    | Purpose                        |
| ----------- | -------------------------- | ------------------------------ |
| Unit        | `npm run test:unit`        | Individual component testing   |
| Integration | `npm run test:integration` | Service interaction testing    |
| E2E         | `npm run test:e2e`         | Complete user journey testing  |
| Performance | `npm run test:performance` | Load and performance testing   |
| Security    | `npm run test:security`    | Security vulnerability testing |

### Test Execution

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Debug tests
npm run test:debug
```

## Git Workflow

### Branch Management

```bash
# Create feature branch
git checkout -b feature/my-feature

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push branch
git push origin feature/my-feature
```

### Pre-commit Checks

```bash
# Run before committing
npm run dev:quality -- --fix
npm test
```

## IDE Setup

### VS Code Extensions

- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Docker
- GitLens
- Thunder Client

### Debug Configuration

Launch configurations are provided for debugging services in
`.vscode/launch.json`.

## Performance Optimization

### Development Performance

- Use hot reloading for faster development
- Enable incremental builds
- Use parallel processing
- Implement intelligent caching

### Production Performance

- Optimize bundle sizes
- Use CDN for static assets
- Implement proper caching strategies
- Monitor performance metrics

## Security Best Practices

### Development Security

- Never commit secrets
- Use environment variables
- Validate all inputs
- Implement proper authentication
- Regular security audits

### Secret Management

```bash
# Generate secure secrets
npm run dev:secrets

# Validate environment security
npm run dev:validate

# Run security scan
npm run security:scan
```

## Deployment

### Staging Deployment

```bash
npm run deploy:staging
```

### Production Deployment

```bash
npm run deploy:prod
```

## Monitoring & Observability

### Development Monitoring

- Grafana dashboard: http://localhost:3001
- Prometheus metrics: http://localhost:9090
- Application logs via Docker Compose

### Production Monitoring

- Comprehensive metrics collection
- Alerting for critical issues
- Performance monitoring
- Error tracking

## Getting Help

### Documentation

1. **Setup Guide**: `docs/development/setup-guide.md`
2. **Developer Experience**: `docs/development/developer-experience.md`
3. **API Documentation**: `docs/api/`
4. **Architecture**: `docs/architecture.md`

### Tools

1. **Debug Tools**: `npm run dev:diagnostics`
2. **Interactive Onboarding**: `npm run dev:onboard`
3. **Quality Checks**: `npm run dev:quality`

### Support Channels

1. **GitHub Issues**: Create detailed issue reports
2. **Team Channels**: Ask questions in team communication
3. **Documentation**: Check relevant documentation first
4. **Pair Programming**: Collaborate with team members

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
- Use appropriate caching
- Profile performance regularly
- Implement proper error handling

### Collaboration

- Use feature branches
- Write clear PR descriptions
- Review code thoroughly
- Share knowledge with team
- Maintain documentation

---

For more detailed information, see the
[Developer Experience Guide](developer-experience.md).
