# Development Environment Setup Guide

## Overview

This guide will help you set up a complete development environment for the
DatatechtonCRM platform. The setup includes all necessary services, databases,
and development tools.

## Prerequisites

### Required Software

- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher) or **Yarn** (v1.22.0 or higher)
- **Docker** (v20.0.0 or higher)
- **Docker Compose** (v2.0.0 or higher)
- **Git** (v2.30.0 or higher)

### Optional but Recommended

- **Visual Studio Code** with recommended extensions
- **Postman** or **Insomnia** for API testing
- **pgAdmin** or **DBeaver** for database management
- **Redis Desktop Manager** for Redis inspection

## Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/datatechtoncrm/platform.git
cd platform
```

### 2. Run Setup Script

We provide automated setup scripts for different operating systems:

#### Windows (PowerShell)

```powershell
.\scripts\setup-dev.ps1
```

#### macOS/Linux (Bash)

```bash
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh
```

### 3. Start Development Environment

```bash
npm run dev
```

This will start all services in development mode with hot reloading enabled.

## Manual Setup

If you prefer to set up the environment manually or need to troubleshoot issues:

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install service dependencies
npm run install:all
```

### 2. Environment Configuration

Copy the example environment files and configure them:

```bash
# Root environment
cp .env.example .env

# Frontend environment
cp frontend/.env.local.example frontend/.env.local

# Service environments
cp services/user-service/.env.example services/user-service/.env
cp services/newsletter-service/.env.example services/newsletter-service/.env
# ... repeat for other services
```

### 3. Configure Environment Variables

Edit the `.env` files with your local configuration:

```bash
# .env
NODE_ENV=development
DATABASE_URL=postgresql://datatechtoncrm:password@localhost:5432/datatechtoncrm
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret-key
API_BASE_URL=http://localhost:8000

# Email configuration (for development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=

# External service keys (optional for development)
OPENAI_API_KEY=your-openai-key
STRIPE_SECRET_KEY=sk_test_your-stripe-key
```

### 4. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, and other infrastructure
docker-compose up -d postgres redis elasticsearch rabbitmq mailhog
```

### 5. Database Setup

```bash
# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed
```

### 6. Start Development Servers

```bash
# Start all services in development mode
npm run dev

# Or start services individually
npm run dev:user-service
npm run dev:newsletter-service
npm run dev:frontend
```

## Development Scripts

### Available Scripts

| Script               | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start all services in development mode   |
| `npm run build`      | Build all services for production        |
| `npm run test`       | Run all tests                            |
| `npm run test:watch` | Run tests in watch mode                  |
| `npm run lint`       | Lint all code                            |
| `npm run format`     | Format all code                          |
| `npm run type-check` | Type check TypeScript code               |
| `npm run db:migrate` | Run database migrations                  |
| `npm run db:seed`    | Seed development data                    |
| `npm run db:reset`   | Reset database and reseed                |
| `npm run clean`      | Clean all build artifacts and containers |

### Service-Specific Scripts

Each service has its own set of scripts:

```bash
# User Service
cd services/user-service
npm run dev          # Start in development mode
npm run build        # Build for production
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode

# Newsletter Service
cd services/newsletter-service
npm run dev          # Start in development mode
npm run build        # Build for production
npm run test         # Run tests

# Frontend
cd frontend
npm run dev          # Start Next.js development server
npm run build        # Build for production
npm run test         # Run tests
```

## IDE Configuration

### Visual Studio Code

Install the recommended extensions by opening the command palette
(`Ctrl+Shift+P`) and running:

```
Extensions: Show Recommended Extensions
```

#### Recommended Extensions

- **TypeScript and JavaScript Language Features**
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Docker** - Docker support
- **GitLens** - Enhanced Git capabilities
- **Thunder Client** - API testing
- **PostgreSQL** - Database support
- **Auto Rename Tag** - HTML/JSX tag renaming
- **Bracket Pair Colorizer** - Bracket highlighting
- **Path Intellisense** - File path autocompletion

#### Workspace Settings

The repository includes VS Code workspace settings in `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  }
}
```

### Debug Configuration

Launch configurations for debugging are included in `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug User Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/services/user-service/src/index.ts",
      "outFiles": ["${workspaceFolder}/services/user-service/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["-r", "ts-node/register"]
    },
    {
      "name": "Debug Newsletter Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/services/newsletter-service/src/server.ts",
      "outFiles": [
        "${workspaceFolder}/services/newsletter-service/dist/**/*.js"
      ],
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["-r", "ts-node/register"]
    }
  ]
}
```

## Database Management

### PostgreSQL Setup

The development environment uses PostgreSQL as the primary database:

```bash
# Connect to database
psql -h localhost -U datatechtoncrm -d datatechtoncrm

# View tables
\dt

# View specific table
\d users

# Run SQL query
SELECT * FROM users LIMIT 5;
```

### Database Migrations

We use a custom migration system:

```bash
# Create new migration
npm run migration:create add_new_column_to_users

# Run pending migrations
npm run db:migrate

# Rollback last migration
npm run db:rollback

# Reset database (drops all tables and recreates)
npm run db:reset
```

### Sample Data

The seed script creates sample data for development:

- **Users**: Admin user and test users
- **Contacts**: Sample CRM contacts
- **Segments**: Example contact segments
- **Templates**: Newsletter templates
- **Newsletters**: Sample newsletters with analytics data

```bash
# Reseed database with fresh sample data
npm run db:seed:fresh
```

## Testing Setup

### Test Environment

Tests run in a separate test environment with its own database:

```bash
# Copy test environment file
cp .env.test.example .env.test

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Database

The test environment uses a separate PostgreSQL database:

```bash
# Create test database
createdb datatechtoncrm_test

# Run test migrations
NODE_ENV=test npm run db:migrate
```

### Running Specific Tests

```bash
# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e

# Run tests for specific service
cd services/user-service && npm test

# Run specific test file
npm test -- --testPathPattern=user.test.ts
```

## API Development

### API Documentation

The API documentation is automatically generated and served during development:

- **Swagger UI**: http://localhost:8000/docs
- **GraphQL Playground**: http://localhost:8000/graphql
- **API Explorer**: http://localhost:8000/api-explorer

### Testing APIs

#### Using curl

```bash
# Login to get JWT token
curl -X POST http://localhost:8000/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'

# Use token for authenticated requests
curl -X GET http://localhost:8000/v1/newsletters \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Using Postman

Import the Postman collection from `docs/api/postman-collection.json`:

1. Open Postman
2. Click "Import"
3. Select the collection file
4. Configure environment variables

### GraphQL Development

Access GraphQL Playground at http://localhost:8000/graphql:

```graphql
# Example query
query GetMyProfile {
  me {
    id
    email
    firstName
    lastName
    preferences {
      frequency
      topics
    }
  }
}

# Example mutation
mutation CreateNewsletter($input: CreateNewsletterInput!) {
  createNewsletter(input: $input) {
    id
    title
    status
    createdAt
  }
}
```

## Debugging

### Application Debugging

#### Node.js Services

Use VS Code's built-in debugger or attach to running processes:

```bash
# Start service with debugging enabled
node --inspect=0.0.0.0:9229 dist/index.js

# Or use npm script with debugging
npm run dev:debug
```

#### Frontend Debugging

Next.js applications can be debugged in the browser:

1. Open Chrome DevTools
2. Go to Sources tab
3. Set breakpoints in TypeScript files
4. Refresh the page

### Database Debugging

#### Query Logging

Enable query logging in development:

```bash
# In .env file
DATABASE_LOG_QUERIES=true
```

#### Performance Analysis

```sql
-- Enable query timing
\timing on

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM contacts WHERE email = 'user@example.com';

-- View slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Log Analysis

#### Application Logs

```bash
# View logs from all services
docker-compose logs -f

# View logs from specific service
docker-compose logs -f user-service

# View logs with timestamps
docker-compose logs -f -t newsletter-service
```

#### Structured Logging

All services use structured logging with Winston:

```javascript
// Example log output
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Newsletter created",
  "service": "newsletter-service",
  "userId": "user-uuid",
  "newsletterId": "newsletter-uuid",
  "requestId": "req_123456"
}
```

## Performance Monitoring

### Development Metrics

Access development metrics at:

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **Jaeger**: http://localhost:16686

### Performance Testing

```bash
# Run performance tests
npm run test:performance

# Load test specific endpoint
k6 run tests/performance/api-load-test.js

# Database performance test
npm run test:performance:database
```

## Troubleshooting

### Common Issues

#### Port Conflicts

If you encounter port conflicts:

```bash
# Check what's using a port
lsof -i :8000

# Kill process using port
kill -9 PID

# Or use different ports in .env
API_PORT=8001
FRONTEND_PORT=3001
```

#### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check database logs
docker-compose logs postgres
```

#### Node.js Memory Issues

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or set in package.json scripts
"dev": "NODE_OPTIONS='--max-old-space-size=4096' tsx watch src/index.ts"
```

#### TypeScript Compilation Issues

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Rebuild TypeScript projects
npm run build

# Check for type errors
npm run type-check
```

### Getting Help

#### Documentation

- **API Documentation**: http://localhost:8000/docs
- **Development Guide**: `docs/development/`
- **Architecture Overview**: `docs/architecture.md`

#### Support Channels

- **GitHub Issues**: https://github.com/datatechtoncrm/platform/issues
- **Discord Community**: https://discord.gg/datatechtoncrm
- **Email Support**: dev-support@datatechtoncrm.com

#### Debugging Checklist

1. ✅ All required services are running
2. ✅ Environment variables are configured
3. ✅ Database migrations are up to date
4. ✅ No port conflicts
5. ✅ Dependencies are installed
6. ✅ TypeScript compilation is successful
7. ✅ Tests are passing

## Development Tools

### Interactive Onboarding

For new developers, we provide an interactive onboarding tool:

```bash
node scripts/dev-onboarding.js
```

This tool will guide you through the entire setup process interactively.

### Debug Tools

Comprehensive debugging utilities for troubleshooting:

```bash
# System diagnostics
node scripts/debug-tools.js diagnostics

# Performance monitoring
node scripts/debug-tools.js performance --duration 60

# Log analysis
node scripts/debug-tools.js logs

# Database debugging
node scripts/debug-tools.js database

# Network connectivity testing
node scripts/debug-tools.js network
```

### Development Utilities

Collection of helpful development shortcuts:

```bash
# Generate secure secrets
node scripts/dev-utilities.js secrets

# Validate environment configuration
node scripts/dev-utilities.js validate-env

# Database utilities
node scripts/dev-utilities.js db reset
node scripts/dev-utilities.js db seed
node scripts/dev-utilities.js db backup

# Service management
node scripts/dev-utilities.js service start postgres
node scripts/dev-utilities.js service logs
node scripts/dev-utilities.js service status

# Code quality checks
node scripts/dev-utilities.js quality --fix
```

### Code Generation

Generate consistent code with our generators:

```bash
# Generate new service
node scripts/code-generators/generate-service.js my-service

# Generate API endpoints
node scripts/code-generators/generate-api.js user-service profile
```

### Quality Tools

Automated code quality checking:

```bash
# Run all quality checks
node scripts/quality-tools/code-quality-check.js

# Run with auto-fix
node scripts/quality-tools/code-quality-check.js --fix

# Skip specific checks
node scripts/quality-tools/code-quality-check.js --skip-tests --skip-security
```

## Development Workflow

### Daily Development

1. **Start your day**:

   ```bash
   # Check system status
   node scripts/debug-tools.js diagnostics

   # Start services
   npm run dev
   ```

2. **Before committing**:

   ```bash
   # Run quality checks
   node scripts/quality-tools/code-quality-check.js --fix

   # Run tests
   npm test
   ```

3. **Debugging issues**:

   ```bash
   # Check logs
   node scripts/debug-tools.js logs

   # Monitor performance
   node scripts/debug-tools.js performance

   # Check database
   node scripts/debug-tools.js database
   ```

### Code Quality Standards

- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier with consistent configuration
- **Type Checking**: Strict TypeScript configuration
- **Testing**: Jest with comprehensive coverage
- **Security**: Automated security scanning

### Performance Monitoring

- **Memory Usage**: Automatic leak detection
- **Response Times**: API performance tracking
- **Database Performance**: Query optimization monitoring
- **Resource Usage**: System resource monitoring

## Next Steps

After setting up your development environment:

1. **Run the Interactive Onboarding**: `node scripts/dev-onboarding.js`
2. **Explore the Codebase**: Start with `docs/architecture.md`
3. **Run the Tests**: Ensure everything is working with `npm test`
4. **Use Debug Tools**: Familiarize yourself with
   `node scripts/debug-tools.js diagnostics`
5. **Make Your First Change**: Try modifying a simple component
6. **Read the Contributing Guide**: `CONTRIBUTING.md`
7. **Join the Community**: Connect with other developers

Happy coding! 🚀
