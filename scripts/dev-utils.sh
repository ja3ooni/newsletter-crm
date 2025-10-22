#!/bin/bash

# AiLert Development Utilities
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        return 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        return 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        return 1
    fi

    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18 or higher is required. Current: $(node -v)"
        return 1
    fi

    log_success "All prerequisites are met"
}

# Install dependencies for all services
install_dependencies() {
    log_info "Installing dependencies for all services..."

    # Root dependencies
    npm install

    # Service dependencies
    for service in services/*/; do
        if [ -f "$service/package.json" ]; then
            log_info "Installing dependencies for $(basename "$service")..."
            cd "$service"
            npm install
            cd ../..
        fi
    done

    # Frontend dependencies
    if [ -f "frontend/package.json" ]; then
        log_info "Installing frontend dependencies..."
        cd frontend
        npm install
        cd ..
    fi

    log_success "All dependencies installed"
}

# Update dependencies for all services
update_dependencies() {
    log_info "Updating dependencies for all services..."

    # Root dependencies
    npm update

    # Service dependencies
    for service in services/*/; do
        if [ -f "$service/package.json" ]; then
            log_info "Updating dependencies for $(basename "$service")..."
            cd "$service"
            npm update
            cd ../..
        fi
    done

    # Frontend dependencies
    if [ -f "frontend/package.json" ]; then
        log_info "Updating frontend dependencies..."
        cd frontend
        npm update
        cd ..
    fi

    log_success "All dependencies updated"
}

# Clean all node_modules and reinstall
clean_install() {
    log_info "Cleaning all node_modules and reinstalling..."

    # Remove all node_modules
    find . -name 'node_modules' -type d -prune -exec rm -rf '{}' +

    # Remove package-lock.json files
    find . -name 'package-lock.json' -delete

    # Reinstall
    install_dependencies

    log_success "Clean install completed"
}

# Generate service boilerplate
generate_service() {
    local service_name=$1

    if [ -z "$service_name" ]; then
        log_error "Service name is required"
        echo "Usage: $0 generate-service <service-name>"
        return 1
    fi

    local service_dir="services/$service_name"

    if [ -d "$service_dir" ]; then
        log_error "Service $service_name already exists"
        return 1
    fi

    log_info "Generating service: $service_name"

    # Create service directory structure
    mkdir -p "$service_dir/src"/{controllers,services,models,middleware,utils,types}
    mkdir -p "$service_dir/tests"/{unit,integration}
    mkdir -p "$service_dir/docs"

    # Create package.json
    cat > "$service_dir/package.json" << EOF
{
  "name": "@ailert/$service_name",
  "version": "1.0.0",
  "description": "AiLert $service_name Service",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "dev:debug": "ts-node-dev --inspect=0.0.0.0:9229 --respawn --transpile-only src/index.ts",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write src/**/*.ts",
    "format:check": "prettier --check src/**/*.ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.3.1",
    "joi": "^17.11.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/morgan": "^1.9.9",
    "@types/node": "^20.9.0",
    "@types/jest": "^29.5.8",
    "typescript": "^5.3.2",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.3",
    "@types/supertest": "^2.0.16"
  }
}
EOF

    # Create TypeScript config
    cat > "$service_dir/tsconfig.json" << EOF
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF

    # Create basic index.ts
    cat > "$service_dir/src/index.ts" << EOF
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: '$service_name',
    timestamp: new Date().toISOString(),
  });
});

// Ready check endpoint
app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    service: '$service_name',
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(\`$service_name service running on port \${PORT}\`);
});

export default app;
EOF

    # Create Dockerfile
    cp "services/user-service/Dockerfile" "$service_dir/Dockerfile"

    # Create basic test
    cat > "$service_dir/tests/unit/health.test.ts" << EOF
import request from 'supertest';
import app from '../../src/index';

describe('Health Endpoints', () => {
  it('should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe('$service_name');
  });

  it('should return ready status', async () => {
    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });
});
EOF

    # Create Jest config
    cat > "$service_dir/jest.config.js" << EOF
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
EOF

    # Create README
    cat > "$service_dir/README.md" << EOF
# $service_name Service

## Description
AiLert $service_name Service

## Development

### Prerequisites
- Node.js 18+
- Docker

### Setup
\`\`\`bash
npm install
\`\`\`

### Running
\`\`\`bash
# Development
npm run dev

# Production
npm run build
npm start
\`\`\`

### Testing
\`\`\`bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
\`\`\`

### Docker
\`\`\`bash
# Build image
docker build -t ailert/$service_name .

# Run container
docker run -p 3000:3000 ailert/$service_name
\`\`\`

## API Endpoints

### Health Check
- \`GET /health\` - Service health status
- \`GET /ready\` - Service readiness status

## Environment Variables
- \`PORT\` - Server port (default: 3000)
- \`NODE_ENV\` - Environment (development/production)
EOF

    log_success "Service $service_name generated successfully"
    log_info "Next steps:"
    echo "  1. cd $service_dir"
    echo "  2. npm install"
    echo "  3. npm run dev"
}

# Run security audit
security_audit() {
    log_info "Running security audit..."

    # Root audit
    npm audit --audit-level=moderate

    # Service audits
    for service in services/*/; do
        if [ -f "$service/package.json" ]; then
            log_info "Auditing $(basename "$service")..."
            cd "$service"
            npm audit --audit-level=moderate
            cd ../..
        fi
    done

    # Frontend audit
    if [ -f "frontend/package.json" ]; then
        log_info "Auditing frontend..."
        cd frontend
        npm audit --audit-level=moderate
        cd ..
    fi

    log_success "Security audit completed"
}

# Fix security vulnerabilities
security_fix() {
    log_info "Fixing security vulnerabilities..."

    # Root fix
    npm audit fix

    # Service fixes
    for service in services/*/; do
        if [ -f "$service/package.json" ]; then
            log_info "Fixing $(basename "$service")..."
            cd "$service"
            npm audit fix
            cd ../..
        fi
    done

    # Frontend fix
    if [ -f "frontend/package.json" ]; then
        log_info "Fixing frontend..."
        cd frontend
        npm audit fix
        cd ..
    fi

    log_success "Security fixes applied"
}

# Backup development data
backup_data() {
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"

    log_info "Creating backup in $backup_dir..."

    mkdir -p "$backup_dir"

    # Backup databases
    docker-compose exec -T postgres pg_dumpall -U ailert > "$backup_dir/postgres_backup.sql"

    # Backup Redis data
    docker-compose exec -T redis redis-cli --rdb - > "$backup_dir/redis_backup.rdb"

    # Backup Elasticsearch data
    docker-compose exec -T elasticsearch curl -X GET "localhost:9200/_snapshot" > "$backup_dir/elasticsearch_snapshot.json"

    log_success "Backup created in $backup_dir"
}

# Restore development data
restore_data() {
    local backup_dir=$1

    if [ -z "$backup_dir" ]; then
        log_error "Backup directory is required"
        echo "Usage: $0 restore-data <backup-directory>"
        return 1
    fi

    if [ ! -d "$backup_dir" ]; then
        log_error "Backup directory does not exist: $backup_dir"
        return 1
    fi

    log_info "Restoring data from $backup_dir..."

    # Restore PostgreSQL
    if [ -f "$backup_dir/postgres_backup.sql" ]; then
        docker-compose exec -T postgres psql -U ailert -d ailert < "$backup_dir/postgres_backup.sql"
    fi

    # Restore Redis
    if [ -f "$backup_dir/redis_backup.rdb" ]; then
        docker-compose stop redis
        docker cp "$backup_dir/redis_backup.rdb" $(docker-compose ps -q redis):/data/dump.rdb
        docker-compose start redis
    fi

    log_success "Data restored from $backup_dir"
}

# Main command handler
case "$1" in
    "check-prerequisites")
        check_prerequisites
        ;;
    "install")
        install_dependencies
        ;;
    "update")
        update_dependencies
        ;;
    "clean-install")
        clean_install
        ;;
    "generate-service")
        generate_service "$2"
        ;;
    "security-audit")
        security_audit
        ;;
    "security-fix")
        security_fix
        ;;
    "backup")
        backup_data
        ;;
    "restore")
        restore_data "$2"
        ;;
    *)
        echo "AiLert Development Utilities"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  check-prerequisites           Check if all prerequisites are installed"
        echo "  install                      Install dependencies for all services"
        echo "  update                       Update dependencies for all services"
        echo "  clean-install                Clean all node_modules and reinstall"
        echo "  generate-service <name>      Generate boilerplate for new service"
        echo "  security-audit               Run security audit for all services"
        echo "  security-fix                 Fix security vulnerabilities"
        echo "  backup                       Backup development data"
        echo "  restore <backup-dir>         Restore data from backup"
        echo ""
        echo "Examples:"
        echo "  $0 generate-service billing-service"
        echo "  $0 backup"
        echo "  $0 restore backups/20231201_120000"
        ;;
esac
