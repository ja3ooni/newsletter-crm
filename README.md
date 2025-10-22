# Newsletter CRM - Professional Newsletter Platform

[![CI/CD Pipeline](https://github.com/ja3ooni/newsletter-crm/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/ja3ooni/newsletter-crm/actions/workflows/ci-cd.yml)
[![Security Scan](https://github.com/ja3ooni/newsletter-crm/actions/workflows/security-scan.yml/badge.svg)](https://github.com/ja3ooni/newsletter-crm/actions/workflows/security-scan.yml)
[![Performance Test](https://github.com/ja3ooni/newsletter-crm/actions/workflows/performance-test.yml/badge.svg)](https://github.com/ja3ooni/newsletter-crm/actions/workflows/performance-test.yml)

A comprehensive, enterprise-grade newsletter and CRM platform built with modern microservices architecture. This platform combines powerful newsletter creation tools with advanced customer relationship management, marketing automation, and analytics capabilities.

## 🚀 Features

### 📧 Newsletter Management
- **Drag & Drop Builder**: Intuitive visual newsletter editor with real-time preview
- **Template Library**: Pre-built responsive templates for various industries
- **Content Blocks**: Reusable components for consistent branding
- **A/B Testing**: Built-in split testing for subject lines and content
- **Scheduling**: Advanced scheduling with timezone support
- **Personalization**: Dynamic content based on subscriber data

### 👥 CRM System
- **Contact Management**: Comprehensive contact profiles with custom fields
- **Segmentation**: Advanced audience segmentation with dynamic rules
- **Lead Scoring**: Automated lead scoring based on engagement
- **Import/Export**: Bulk operations with CSV support and field mapping
- **Contact Timeline**: Complete interaction history and engagement tracking
- **Opportunity Management**: Sales pipeline with customizable stages

### 🤖 Marketing Automation
- **Drip Campaigns**: Automated email sequences with triggers
- **Workflow Builder**: Visual workflow designer for complex automations
- **Event Tracking**: Real-time user behavior tracking
- **Webhook Integration**: Connect with external systems and APIs
- **Behavioral Triggers**: Actions based on user interactions

### 📊 Analytics & Reporting
- **Real-time Analytics**: Live dashboard with key metrics
- **Engagement Tracking**: Open rates, click rates, and conversion tracking
- **Performance Reports**: Detailed campaign performance analysis
- **Custom Dashboards**: Configurable widgets and metrics
- **Export Capabilities**: Data export in multiple formats

## 🏗️ Architecture

### Microservices Design
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Load Balancer │
│   (Next.js)     │◄──►│   (Kong)        │◄──►│   (Nginx)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
        │ User Service │ │ CRM Service │ │Newsletter  │
        │              │ │             │ │Service     │
        └──────────────┘ └─────────────┘ └────────────┘
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
        │   Database   │ │   Redis     │ │ RabbitMQ   │
        │ (PostgreSQL) │ │   Cache     │ │  Queue     │
        └──────────────┘ └─────────────┘ └────────────┘
```

### Technology Stack

#### Frontend
- **Framework**: Next.js 14 with App Router
- **UI Library**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom components
- **State Management**: Zustand for global state
- **Forms**: React Hook Form with Zod validation
- **Testing**: Jest + React Testing Library + Accessibility testing

#### Backend Services
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with middleware
- **Database**: PostgreSQL with migrations
- **Cache**: Redis for session and data caching
- **Queue**: RabbitMQ for async processing
- **API Gateway**: Kong for routing and security

#### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Kubernetes with Helm charts
- **Monitoring**: Prometheus + Grafana
- **Logging**: Centralized logging with ELK stack
- **CI/CD**: GitHub Actions with automated testing

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Docker and Docker Compose
- PostgreSQL 14+
- Redis 6+
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ja3ooni/newsletter-crm.git
   cd newsletter-crm
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Install frontend dependencies
   cd frontend && npm install && cd ..

   # Install service dependencies
   cd services/user-service && npm install && cd ../..
   cd services/crm-service && npm install && cd ../..
   cd services/newsletter-service && npm install && cd ../..
   cd services/marketing-automation-service && npm install && cd ../..
   ```

3. **Environment Setup**
   ```bash
   # Copy environment files
   cp .env.example .env
   cp frontend/.env.local.example frontend/.env.local

   # Configure your environment variables
   # Edit .env and frontend/.env.local with your settings
   ```

4. **Database Setup**
   ```bash
   # Start PostgreSQL and Redis
   docker-compose up -d postgres redis

   # Run database migrations
   npm run db:migrate

   # Seed initial data (optional)
   npm run db:seed
   ```

5. **Start Development Servers**
   ```bash
   # Start all services in development mode
   npm run dev

   # Or start services individually:
   npm run dev:frontend     # Frontend on http://localhost:3000
   npm run dev:user         # User service on http://localhost:3001
   npm run dev:crm          # CRM service on http://localhost:3002
   npm run dev:newsletter   # Newsletter service on http://localhost:3003
   npm run dev:marketing    # Marketing service on http://localhost:3004
   ```

### Docker Development

```bash
# Start entire stack with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📁 Project Structure

```
newsletter-crm/
├── frontend/                    # Next.js frontend application
│   ├── src/
│   │   ├── app/                # App router pages
│   │   ├── components/         # Reusable UI components
│   │   ├── lib/               # Utilities and API clients
│   │   ├── store/             # Zustand state management
│   │   └── types/             # TypeScript type definitions
│   ├── public/                # Static assets
│   └── package.json
├── services/                   # Backend microservices
│   ├── user-service/          # User authentication & management
│   ├── crm-service/           # Contact & lead management
│   ├── newsletter-service/    # Newsletter creation & sending
│   └── marketing-automation-service/  # Automation workflows
├── infrastructure/            # Infrastructure configuration
│   ├── kong/                 # API Gateway configuration
│   ├── postgres/             # Database schemas & migrations
│   ├── prometheus/           # Monitoring configuration
│   └── utils/                # Shared infrastructure utilities
├── k8s/                      # Kubernetes manifests
├── scripts/                  # Development and deployment scripts
├── tests/                    # Integration and performance tests
├── .github/workflows/        # CI/CD pipelines
└── docker-compose.yml        # Local development environment
```

## 🔧 Configuration

### Environment Variables

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Newsletter CRM
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

#### Backend Services (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/newsletter_crm
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

# Email Service
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password

# External APIs
SENDGRID_API_KEY=your-sendgrid-key
STRIPE_SECRET_KEY=your-stripe-key
```

### API Configuration

#### Kong Gateway (infrastructure/kong/kong.yml)
```yaml
_format_version: "3.0"
services:
  - name: user-service
    url: http://user-service:3001
    routes:
      - name: user-routes
        paths: ["/api/users", "/api/auth"]
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific service tests
npm run test:user-service
npm run test:crm-service
npm run test:newsletter-service

# Run frontend tests
npm run test:frontend

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance
```

### Test Types

- **Unit Tests**: Individual component and function testing
- **Integration Tests**: Service-to-service communication testing
- **E2E Tests**: Full user workflow testing
- **Performance Tests**: Load and stress testing
- **Accessibility Tests**: WCAG compliance testing

## 🚀 Deployment

### Production Deployment

#### Using Docker Compose
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

#### Using Kubernetes
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n newsletter-crm
```

#### Using Helm (Recommended)
```bash
# Install with Helm
helm install newsletter-crm ./helm-chart

# Upgrade deployment
helm upgrade newsletter-crm ./helm-chart
```

### Environment-Specific Configurations

#### Staging
```bash
# Deploy to staging
npm run deploy:staging
```

#### Production
```bash
# Deploy to production
npm run deploy:production
```

## 📊 Monitoring & Observability

### Metrics & Monitoring
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization dashboards
- **Health Checks**: Service health monitoring
- **Performance Metrics**: Response times and throughput

### Logging
- **Centralized Logging**: ELK stack (Elasticsearch, Logstash, Kibana)
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: Debug, Info, Warn, Error with appropriate filtering

### Alerting
- **Slack Integration**: Real-time alerts to development team
- **Email Notifications**: Critical system alerts
- **PagerDuty**: On-call incident management

## 🔒 Security

### Authentication & Authorization
- **JWT Tokens**: Secure API authentication
- **Role-Based Access**: Granular permission system
- **OAuth Integration**: Social login support
- **Session Management**: Secure session handling

### Data Protection
- **Encryption**: Data encryption at rest and in transit
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content Security Policy headers

### Security Scanning
- **Dependency Scanning**: Automated vulnerability detection
- **Code Analysis**: Static security analysis
- **Container Scanning**: Docker image vulnerability scanning
- **Penetration Testing**: Regular security assessments

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Standards
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting with custom rules
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks for quality checks
- **Conventional Commits**: Standardized commit messages

## 📚 Documentation

- [API Documentation](docs/api.md) - Complete API reference
- [Development Guide](DEVELOPMENT.md) - Detailed development setup
- [Infrastructure Guide](INFRASTRUCTURE.md) - Infrastructure and deployment
- [Architecture Decision Records](docs/adr/) - Technical decisions and rationale
- [User Guide](docs/user-guide.md) - End-user documentation

## 🆘 Support & Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database status
docker-compose ps postgres

# View database logs
docker-compose logs postgres

# Reset database
npm run db:reset
```

#### Service Communication Issues
```bash
# Check service health
npm run health-check

# View service logs
docker-compose logs [service-name]

# Restart services
docker-compose restart
```

### Getting Help
- **GitHub Issues**: Report bugs and request features
- **Discussions**: Community support and questions
- **Documentation**: Comprehensive guides and API docs
- **Email Support**: [support@newsletter-crm.com](mailto:support@newsletter-crm.com)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Next.js Team**: For the amazing React framework
- **Vercel**: For hosting and deployment platform
- **Kong**: For the powerful API gateway
- **PostgreSQL**: For the robust database system
- **Open Source Community**: For the countless libraries and tools

## 📈 Roadmap

### Q1 2024
- [ ] Advanced analytics dashboard
- [ ] Mobile app development
- [ ] Advanced segmentation features
- [ ] Multi-language support

### Q2 2024
- [ ] AI-powered content suggestions
- [ ] Advanced A/B testing
- [ ] Social media integration
- [ ] Advanced reporting features

### Q3 2024
- [ ] Machine learning recommendations
- [ ] Advanced automation workflows
- [ ] Enterprise SSO integration
- [ ] Advanced security features

---

**Built with ❤️ by the Newsletter CRM Team**

For more information, visit our [website](https://newsletter-crm.com) or follow us on [Twitter](https://twitter.com/newsletter-crm).
