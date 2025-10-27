# AiLert Platform Technology Stack

## Overview

The AiLert platform is built using a modern, cloud-native technology stack
designed for scalability, maintainability, and developer productivity. The
platform combines Node.js/TypeScript microservices with a Python-based AI
component and a Next.js frontend.

## Core Technologies

### Runtime & Languages

- **Node.js**: 18.0.0+ (Primary runtime for microservices)
- **TypeScript**: 5.3.2+ (Type-safe JavaScript development)
- **Python**: 3.8+ (AI content aggregation service)
- **JavaScript**: ES2022 (Frontend and build tools)

### Frontend Technologies

#### Framework & Core Libraries

- **Next.js**: 14.0.4 (React framework with SSR/SSG)
- **React**: 18.2.0 (UI library)
- **React DOM**: 18.2.0 (DOM rendering)

#### State Management & Data Fetching

- **Zustand**: 4.4.7 (Lightweight state management)
- **TanStack React Query**: 5.17.9 (Server state management)
- **React Hook Form**: 7.48.2 (Form handling)

#### UI Components & Styling

- **Tailwind CSS**: 3.4.0 (Utility-first CSS framework)
- **Headless UI**: 1.7.17 (Unstyled accessible components)
- **Radix UI**: Multiple packages (Primitive components)
  - Alert Dialog: 1.1.15
  - Dialog: 1.1.15
  - Dropdown Menu: 2.1.16
  - Label: 2.1.7
  - Progress: 1.1.7
- **Heroicons**: 2.0.18 (Icon library)
- **Lucide React**: 0.303.0 (Icon library)
- **Framer Motion**: 10.16.16 (Animation library)

#### Data Visualization & Charts

- **Recharts**: 3.3.0 (Chart library for React)

#### Drag & Drop

- **React DnD**: 16.0.1 (Drag and drop for React)
- **React DnD HTML5 Backend**: 16.0.1 (HTML5 backend)

#### Utilities & Helpers

- **Axios**: 1.6.2 (HTTP client)
- **Date-fns**: 3.0.6 (Date utility library)
- **js-cookie**: 3.0.5 (Cookie handling)
- **React Hot Toast**: 2.4.1 (Toast notifications)
- **Zod**: 3.22.4 (Schema validation)
- **clsx**: 2.0.0 (Conditional className utility)
- **Class Variance Authority**: 0.7.0 (CSS class variants)

### Backend Technologies

#### Web Framework & Middleware

- **Express.js**: 4.18.2 (Web application framework)
- **CORS**: 2.8.5 (Cross-origin resource sharing)
- **Helmet**: 7.1.0 (Security middleware)
- **Compression**: 1.7.4 (Response compression)

#### Authentication & Security

- **JSON Web Tokens**: 9.0.2 (JWT authentication)
- **bcryptjs**: 2.4.3 (Password hashing)
- **Passport.js**: 0.7.0 (Authentication middleware)
  - **passport-jwt**: 4.0.1 (JWT strategy)
  - **passport-google-oauth20**: 2.0.0 (Google OAuth)
  - **passport-github2**: 0.1.12 (GitHub OAuth)
- **Express Rate Limit**: 7.1.5 (Rate limiting)
- **Express Validator**: 7.0.1 (Input validation)

#### Database & Caching

- **PostgreSQL**: 15+ (Primary database)
- **pg**: 8.11.3 (PostgreSQL client for Node.js)
- **Redis**: 7+ (Caching and session storage)
- **redis**: 4.6.10 (Redis client for Node.js)
- **ioredis**: 5.3.2 (Advanced Redis client)

#### Message Queue & Communication

- **RabbitMQ**: 3.12+ (Message broker)
- **AMQP**: Protocol for message queuing

#### Logging & Monitoring

- **Winston**: 3.11.0 (Logging library)
- **Winston Elasticsearch**: 0.17.4 (Elasticsearch transport)
- **Prometheus Client**: 15.1.0 (Metrics collection)
- **OpenTracing**: 0.14.7 (Distributed tracing)

#### Utilities

- **dotenv**: 16.3.1 (Environment variable loading)
- **UUID**: 9.0.1 (UUID generation)
- **Zod**: 3.22.4 (Schema validation)
- **node-cron**: 3.0.3 (Task scheduling)
- **nodemailer**: 6.9.7 (Email sending)

### Python AI Service Technologies

#### Core Framework

- **Flask**: 3.1.2 (Web framework)
- **Flask-CORS**: 6.0.1 (CORS support)
- **Flask-Limiter**: 4.0.0 (Rate limiting)
- **uvicorn**: 0.37.0 (ASGI server)

#### AI & Machine Learning

- **OpenAI**: 2.3.0 (OpenAI API client)
- **LiteLLM**: 1.78.0 (LLM abstraction layer)
- **scikit-learn**: 1.7.2 (Machine learning library)
- **numpy**: 2.3.3 (Numerical computing)
- **pandas**: 2.3.3 (Data manipulation)
- **tiktoken**: 0.12.0 (Token counting)
- **tokenizers**: 0.22.1 (Text tokenization)

#### Web Scraping & Content Processing

- **BeautifulSoup4**: 4.14.2 (HTML/XML parsing)
- **feedparser**: 6.0.12 (RSS/Atom feed parsing)
- **aiohttp**: 3.13.0 (Async HTTP client)
- **requests**: 2.32.5 (HTTP library)
- **bleach**: 6.2.0 (HTML sanitization)
- **markdown**: 3.9 (Markdown processing)

#### Cloud & Storage

- **boto3**: 1.40.52 (AWS SDK)
- **botocore**: 1.40.52 (AWS core library)

#### Data Processing & Utilities

- **schedule**: 1.2.2 (Task scheduling)
- **python-dateutil**: 2.9.0.post0 (Date utilities)
- **pytz**: 2025.2 (Timezone handling)
- **pyyaml**: 6.0.3 (YAML processing)
- **python-slugify**: 8.0.4 (String slugification)
- **regex**: 2025.9.18 (Regular expressions)

#### External Integrations

- **kaggle**: 1.7.4.5 (Kaggle API)
- **sendgrid**: 6.12.5 (Email service)
- **substack-api**: 1.1.1 (Substack integration)

### Infrastructure Technologies

#### Containerization & Orchestration

- **Docker**: Latest (Containerization)
- **Docker Compose**: 3.8 (Multi-container orchestration)
- **Kubernetes**: Latest (Production orchestration)

#### API Gateway & Load Balancing

- **Kong**: 3.4-alpine (API Gateway)
- **Kong Declarative Config**: YAML-based configuration

#### Databases & Storage

- **PostgreSQL**: 15-alpine (Primary database)
- **Redis**: 7-alpine (Caching and sessions)
- **Elasticsearch**: 8.11.0 (Search and analytics)

#### Message Broker

- **RabbitMQ**: 3.12-management-alpine (Message queuing)

#### Monitoring & Observability

- **Prometheus**: 2.47.0 (Metrics collection)
- **Grafana**: 10.2.0 (Visualization and dashboards)
- **Loki**: Latest (Log aggregation)
- **Jaeger**: Latest (Distributed tracing)
- **AlertManager**: Latest (Alert management)

### Development Tools

#### TypeScript Configuration

- **Target**: ES2022
- **Module**: CommonJS
- **Module Resolution**: Node
- **Strict Mode**: Enabled
- **Source Maps**: Enabled
- **Declaration Maps**: Enabled
- **Path Mapping**: Configured for monorepo

#### Code Quality & Formatting

- **ESLint**: 8.54.0+ (Linting)
  - **@typescript-eslint/eslint-plugin**: 6.21.0
  - **@typescript-eslint/parser**: 6.21.0
  - **eslint-config-prettier**: 9.1.2
  - **eslint-plugin-prettier**: 5.5.4
  - **eslint-plugin-security**: 1.7.1
- **Prettier**: 3.1.0+ (Code formatting)
  - **prettier-plugin-tailwindcss**: 0.5.9

#### Testing Framework

- **Jest**: 29.7.0 (Testing framework)
- **ts-jest**: 29.1.1 (TypeScript support for Jest)
- **Supertest**: 6.3.3 (HTTP testing)
- **@testing-library/react**: 14.1.2 (React testing utilities)
- **@testing-library/jest-dom**: 6.1.6 (DOM testing utilities)
- **@testing-library/user-event**: 14.5.1 (User interaction testing)
- **jest-axe**: 8.0.0 (Accessibility testing)
- **jest-environment-jsdom**: 29.7.0 (DOM environment)
- **nock**: 13.4.0 (HTTP mocking)

#### Build Tools & Development

- **tsx**: 4.6.0 (TypeScript execution)
- **ts-node-dev**: 2.0.0 (Development server)
- **PostCSS**: 8.4.32 (CSS processing)
- **Autoprefixer**: 10.4.16 (CSS vendor prefixes)
- **TypeDoc**: 0.25.4 (Documentation generation)

#### Git Hooks & CI/CD

- **Husky**: 8.0.3 (Git hooks)
- **lint-staged**: 15.1.0 (Staged file linting)
- **GitHub Actions**: CI/CD pipeline

### Cloud & External Services

#### AWS Services

- **AWS S3**: Object storage
- **AWS CloudFront**: CDN
- **AWS KMS**: Key management
- **AWS Secrets Manager**: Secret management

#### Third-party Integrations

- **Zapier**: Workflow automation
- **Segment**: Customer data platform
- **Google Analytics**: Web analytics
- **Facebook Pixel**: Social media analytics
- **SendGrid**: Email delivery service

## Development Setup Requirements

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Python**: 3.8 or higher
- **Docker**: Latest version
- **Docker Compose**: 3.8 or higher

### Development Environment Setup

#### 1. Prerequisites Installation

```bash
# Install Node.js 18+
# Install Python 3.8+
# Install Docker and Docker Compose
# Install Git
```

#### 2. Project Setup

```bash
# Clone repository
git clone https://github.com/your-username/ailert-platform.git
cd ailert-platform

# Install all dependencies
npm run install:all

# Set up environment variables
cp .env.example .env
# Configure environment variables
```

#### 3. Database Setup

```bash
# Start infrastructure services
npm run dev

# Run database migrations
npm run db:migrate

# Seed database with initial data
npm run db:seed
```

#### 4. Development Commands

```bash
# Start all services in development mode
npm run dev

# Run tests
npm run test

# Run linting
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

### Environment Variables

#### Required Environment Variables

- `NODE_ENV`: Development environment
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: JWT signing secret
- `RABBITMQ_URL`: RabbitMQ connection string
- `ELASTICSEARCH_URL`: Elasticsearch connection string

#### Optional Environment Variables

- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region
- `SENDGRID_API_KEY`: SendGrid API key
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GITHUB_CLIENT_ID`: GitHub OAuth client ID

## Technical Constraints

### Performance Constraints

- **Memory Usage**: Services should not exceed 512MB in development
- **Response Time**: API responses should be under 200ms for 95th percentile
- **Database Connections**: Maximum 20 connections per service
- **Cache TTL**: Default cache expiration of 5 minutes

### Security Constraints

- **HTTPS Only**: All production traffic must use HTTPS
- **JWT Expiration**: Access tokens expire in 15 minutes
- **Rate Limiting**: API endpoints limited to prevent abuse
- **Input Validation**: All user inputs must be validated and sanitized
- **CORS**: Strict CORS policy for cross-origin requests

### Scalability Constraints

- **Stateless Services**: All services must be stateless for horizontal scaling
- **Database Per Service**: Each service owns its data
- **Async Communication**: Use message queues for service communication
- **Connection Pooling**: Database connections must be pooled

### Development Constraints

- **TypeScript Strict Mode**: All TypeScript code must pass strict checks
- **Test Coverage**: Minimum 80% test coverage required
- **Code Quality**: ESLint and Prettier must pass without errors
- **Documentation**: All public APIs must be documented

## Tool Usage Patterns

### Package Management

- **Workspaces**: npm workspaces for monorepo management
- **Dependency Management**: Centralized dependency management in root
  package.json
- **Version Pinning**: Exact versions for production dependencies

### Testing Strategy

- **Unit Tests**: Jest for individual component/function testing
- **Integration Tests**: Supertest for API endpoint testing
- **E2E Tests**: Custom E2E tests for user workflows
- **Performance Tests**: k6 for load testing

### Code Organization

- **Monorepo Structure**: Services organized in separate directories
- **Shared Libraries**: Common utilities in services/shared
- **Type Definitions**: Centralized type definitions
- **Path Mapping**: TypeScript path mapping for clean imports

### Build & Deployment

- **Multi-stage Builds**: Docker multi-stage builds for optimization
- **Development Hot Reload**: File watching for development
- **Production Optimization**: Minification and bundling for production
- **Health Checks**: Container health checks for all services

### Monitoring & Debugging

- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Metrics Collection**: Prometheus metrics for all services
- **Distributed Tracing**: Jaeger for request tracing
- **Error Tracking**: Centralized error logging and alerting

## Configuration Management

### TypeScript Configuration

- **Project References**: TypeScript project references for monorepo
- **Strict Type Checking**: All strict TypeScript options enabled
- **Path Mapping**: Configured for clean imports across services
- **Declaration Generation**: Type declarations generated for shared libraries

### ESLint Configuration

- **Shared Configuration**: Common ESLint rules across all services
- **TypeScript Integration**: TypeScript-specific linting rules
- **Security Rules**: Security-focused linting rules
- **Import Organization**: Automatic import sorting and organization

### Jest Configuration

- **Service-specific**: Each service has its own Jest configuration
- **TypeScript Support**: ts-jest for TypeScript test execution
- **Coverage Reports**: Code coverage reporting enabled
- **Test Environment**: Appropriate test environments for different test types

### Docker Configuration

- **Multi-stage Builds**: Separate build and runtime stages
- **Layer Optimization**: Optimized Docker layers for caching
- **Security**: Non-root user execution
- **Health Checks**: Container health monitoring

This technology stack provides a robust foundation for building a scalable,
maintainable, and secure newsletter CRM platform with modern development
practices and comprehensive tooling support.
