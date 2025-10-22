#!/bin/bash

# AiLert Development Environment Setup Script
set -e

echo "🚀 Setting up AiLert development environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Development Environment Variables
NODE_ENV=development
DEBUG=true

# Database
POSTGRES_PASSWORD=ailert_dev_password
POSTGRES_DB=ailert
POSTGRES_USER=ailert

# Redis
REDIS_PASSWORD=ailert_redis_password

# RabbitMQ
RABBITMQ_PASSWORD=ailert_rabbitmq_password

# JWT
JWT_SECRET=dev_jwt_secret_change_in_production

# SMTP (for development - use Mailhog or similar)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=

# AWS (optional for development)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# API URLs
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Monitoring
GRAFANA_PASSWORD=admin
EOF
    echo "✅ Created .env file with development defaults"
else
    echo "✅ .env file already exists"
fi

# Create service directories if they don't exist
echo "📁 Creating service directories..."
mkdir -p services/{user-service,newsletter-service,content-service,crm-service,analytics-service}
mkdir -p frontend
mkdir -p infrastructure/{kong,prometheus,grafana}

# Install dependencies for existing services
echo "📦 Installing dependencies..."
for service in services/*/; do
    if [ -f "$service/package.json" ]; then
        echo "Installing dependencies for $(basename "$service")..."
        cd "$service"
        npm install
        cd ../..
    fi
done

# Install frontend dependencies if package.json exists
if [ -f "frontend/package.json" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Pull required Docker images
echo "🐳 Pulling Docker images..."
docker-compose pull

# Start infrastructure services
echo "🏗️ Starting infrastructure services..."
docker-compose up -d postgres redis elasticsearch rabbitmq

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
docker-compose ps

# Create databases
echo "🗄️ Setting up databases..."
docker-compose exec -T postgres psql -U ailert -d ailert -c "SELECT version();" || echo "Database setup will be handled by init scripts"

# Setup Git hooks (if .git exists)
if [ -d ".git" ]; then
    echo "🪝 Setting up Git hooks..."
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Run linting and tests before commit
npm run lint:check
npm run test:unit -- --silent
EOF
    chmod +x .git/hooks/pre-commit
    echo "✅ Git hooks configured"
fi

# Create development scripts
echo "📜 Creating development scripts..."
mkdir -p scripts

cat > scripts/dev-start.sh << 'EOF'
#!/bin/bash
# Start all development services
echo "🚀 Starting AiLert development environment..."
docker-compose up -d
echo "✅ Services started!"
echo ""
echo "🌐 Available services:"
echo "  - Frontend: http://localhost:3000"
echo "  - API Gateway: http://localhost:8000"
echo "  - User Service: http://localhost:3001"
echo "  - Newsletter Service: http://localhost:3002"
echo "  - Content Service: http://localhost:3003"
echo "  - CRM Service: http://localhost:3004"
echo "  - Analytics Service: http://localhost:3005"
echo "  - Grafana: http://localhost:3001 (admin/admin)"
echo "  - RabbitMQ Management: http://localhost:15672 (ailert/ailert_rabbitmq_password)"
echo ""
echo "📊 To view logs: docker-compose logs -f [service-name]"
echo "🛑 To stop: docker-compose down"
EOF

cat > scripts/dev-stop.sh << 'EOF'
#!/bin/bash
# Stop all development services
echo "🛑 Stopping AiLert development environment..."
docker-compose down
echo "✅ Services stopped!"
EOF

cat > scripts/dev-reset.sh << 'EOF'
#!/bin/bash
# Reset development environment (removes all data)
echo "🔄 Resetting AiLert development environment..."
echo "⚠️  This will remove all data. Are you sure? (y/N)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    docker-compose down -v
    docker-compose up -d
    echo "✅ Environment reset complete!"
else
    echo "❌ Reset cancelled"
fi
EOF

cat > scripts/dev-logs.sh << 'EOF'
#!/bin/bash
# View logs for all services or specific service
if [ -z "$1" ]; then
    echo "📋 Showing logs for all services..."
    docker-compose logs -f
else
    echo "📋 Showing logs for $1..."
    docker-compose logs -f "$1"
fi
EOF

chmod +x scripts/dev-*.sh

echo "✅ Development scripts created in scripts/ directory"

# Create VS Code configuration
if command -v code &> /dev/null; then
    echo "🔧 Creating VS Code configuration..."
    mkdir -p .vscode
    
    cat > .vscode/settings.json << 'EOF'
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": [
    "services/user-service",
    "services/newsletter-service",
    "services/content-service",
    "services/crm-service",
    "services/analytics-service",
    "frontend"
  ],
  "docker.defaultRegistryPath": "ghcr.io/your-username/ailert"
}
EOF

    cat > .vscode/launch.json << 'EOF'
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
      "program": "${workspaceFolder}/services/newsletter-service/src/index.ts",
      "outFiles": ["${workspaceFolder}/services/newsletter-service/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["-r", "ts-node/register"]
    }
  ]
}
EOF

    cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-docker",
    "ms-kubernetes-tools.vscode-kubernetes-tools",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ]
}
EOF

    echo "✅ VS Code configuration created"
fi

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Review and update .env file with your configuration"
echo "  2. Run './scripts/dev-start.sh' to start all services"
echo "  3. Visit http://localhost:3000 to see the frontend"
echo "  4. Check service health at http://localhost:8000/health"
echo ""
echo "🔧 Useful commands:"
echo "  - Start services: ./scripts/dev-start.sh"
echo "  - Stop services: ./scripts/dev-stop.sh"
echo "  - View logs: ./scripts/dev-logs.sh [service-name]"
echo "  - Reset environment: ./scripts/dev-reset.sh"
echo ""
echo "📚 Documentation:"
echo "  - API docs will be available at http://localhost:8000/docs"
echo "  - Monitoring at http://localhost:3001 (Grafana)"
echo "  - Message queue at http://localhost:15672 (RabbitMQ)"
echo ""