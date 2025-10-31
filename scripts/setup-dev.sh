#!/bin/bash

# DatatechtonCRM Development Environment Setup Script
# This script sets up a complete development environment for macOS/Linux

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."

    local missing_deps=()

    # Check Node.js
    if command_exists node; then
        local node_version=$(node --version | sed 's/v//')
        local required_version="18.0.0"
        if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]; then
            log_warning "Node.js version $node_version found, but $required_version or higher is required"
            missing_deps+=("node")
        else
            log_success "Node.js $node_version ✓"
        fi
    else
        log_error "Node.js not found"
        missing_deps+=("node")
    fi

    # Check npm
    if command_exists npm; then
        local npm_version=$(npm --version)
        log_success "npm $npm_version ✓"
    else
        log_error "npm not found"
        missing_deps+=("npm")
    fi

    # Check Docker
    if command_exists docker; then
        local docker_version=$(docker --version | cut -d' ' -f3 | sed 's/,//')
        log_success "Docker $docker_version ✓"
    else
        log_error "Docker not found"
        missing_deps+=("docker")
    fi

    # Check Docker Compose
    if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
        if command_exists docker-compose; then
            local compose_version=$(docker-compose --version | cut -d' ' -f3 | sed 's/,//')
            log_success "Docker Compose $compose_version ✓"
        else
            local compose_version=$(docker compose version --short)
            log_success "Docker Compose $compose_version ✓"
        fi
    else
        log_error "Docker Compose not found"
        missing_deps+=("docker-compose")
    fi

    # Check Git
    if command_exists git; then
        local git_version=$(git --version | cut -d' ' -f3)
        log_success "Git $git_version ✓"
    else
        log_error "Git not found"
        missing_deps+=("git")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install the missing dependencies and run this script again."

        # Provide installation instructions based on OS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            log_info "On macOS, you can install missing dependencies using Homebrew:"
            log_info "  brew install node docker git"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            log_info "On Ubuntu/Debian, you can install missing dependencies using:"
            log_info "  sudo apt update && sudo apt install nodejs npm docker.io docker-compose git"
        fi

        exit 1
    fi

    log_success "All system requirements met!"
}

# Setup environment files
setup_environment() {
    log_info "Setting up environment files..."

    # Root environment
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            log_success "Created .env from .env.example"
        else
            log_warning ".env.example not found, creating basic .env"
            cat > .env << EOF
NODE_ENV=development
DATABASE_URL=postgresql://datatechtoncrm:password@localhost:5432/datatechtoncrm
REDIS_URL=redis://localhost:6379
JWT_SECRET=$(openssl rand -base64 32)
API_BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# Email configuration (MailHog for development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=

# Optional external service keys
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
EOF
        fi
    else
        log_info ".env already exists, skipping"
    fi

    # Frontend environment
    if [ ! -f frontend/.env.local ]; then
        if [ -f frontend/.env.local.example ]; then
            cp frontend/.env.local.example frontend/.env.local
            log_success "Created frontend/.env.local"
        else
            log_warning "frontend/.env.local.example not found, creating basic frontend/.env.local"
            mkdir -p frontend
            cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:8000/graphql
NEXT_PUBLIC_WS_URL=ws://localhost:8000/graphql
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)
EOF
        fi
    else
        log_info "frontend/.env.local already exists, skipping"
    fi

    # Service environments
    for service_dir in services/*/; do
        if [ -d "$service_dir" ]; then
            service_name=$(basename "$service_dir")
            env_file="${service_dir}.env"
            example_file="${service_dir}.env.example"

            if [ ! -f "$env_file" ]; then
                if [ -f "$example_file" ]; then
                    cp "$example_file" "$env_file"
                    log_success "Created $env_file"
                else
                    log_info "Creating basic environment for $service_name"
                    cat > "$env_file" << EOF
NODE_ENV=development
PORT=0
DATABASE_URL=postgresql://datatechtoncrm:password@localhost:5432/datatechtoncrm
REDIS_URL=redis://localhost:6379
JWT_SECRET=$(openssl rand -base64 32)
EOF
                fi
            fi
        fi
    done
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."

    # Install root dependencies
    log_info "Installing root dependencies..."
    npm install

    # Install service dependencies
    log_info "Installing service dependencies..."
    if [ -f package.json ] && grep -q "install:services" package.json; then
        npm run install:services
    else
        for service_dir in services/*/; do
            if [ -d "$service_dir" ] && [ -f "${service_dir}package.json" ]; then
                service_name=$(basename "$service_dir")
                log_info "Installing dependencies for $service_name..."
                (cd "$service_dir" && npm install)
            fi
        done
    fi

    # Install frontend dependencies
    if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
        log_info "Installing frontend dependencies..."
        (cd frontend && npm install)
    fi

    log_success "Dependencies installed successfully!"
}

# Setup Docker infrastructure
setup_infrastructure() {
    log_info "Setting up Docker infrastructure..."

    # Check if docker-compose.yml exists
    if [ ! -f docker-compose.yml ]; then
        log_error "docker-compose.yml not found!"
        exit 1
    fi

    # Start infrastructure services
    log_info "Starting infrastructure services (PostgreSQL, Redis, etc.)..."

    # Use docker compose or docker-compose based on availability
    if command_exists docker-compose; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi

    # Pull images first
    $COMPOSE_CMD pull postgres redis elasticsearch rabbitmq mailhog

    # Start infrastructure services
    $COMPOSE_CMD up -d postgres redis elasticsearch rabbitmq mailhog

    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if $COMPOSE_CMD exec -T postgres pg_isready -U datatechtoncrm >/dev/null 2>&1; then
            log_success "PostgreSQL is ready!"
            break
        fi

        if [ $attempt -eq $max_attempts ]; then
            log_error "PostgreSQL failed to start after $max_attempts attempts"
            exit 1
        fi

        log_info "Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    attempt=1

    while [ $attempt -le $max_attempts ]; do
        if $COMPOSE_CMD exec -T redis redis-cli ping >/dev/null 2>&1; then
            log_success "Redis is ready!"
            break
        fi

        if [ $attempt -eq $max_attempts ]; then
            log_error "Redis failed to start after $max_attempts attempts"
            exit 1
        fi

        log_info "Waiting for Redis... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    log_success "Infrastructure services started successfully!"
}

# Setup database
setup_database() {
    log_info "Setting up database..."

    # Run migrations
    if [ -f package.json ] && grep -q "db:migrate" package.json; then
        log_info "Running database migrations..."
        npm run db:migrate
        log_success "Database migrations completed!"
    else
        log_warning "No db:migrate script found, skipping migrations"
    fi

    # Seed database
    if [ -f package.json ] && grep -q "db:seed" package.json; then
        log_info "Seeding database with development data..."
        npm run db:seed
        log_success "Database seeded successfully!"
    else
        log_warning "No db:seed script found, skipping seeding"
    fi
}

# Build services
build_services() {
    log_info "Building services..."

    if [ -f package.json ] && grep -q "\"build\":" package.json; then
        npm run build
        log_success "Services built successfully!"
    else
        log_info "Building individual services..."
        for service_dir in services/*/; do
            if [ -d "$service_dir" ] && [ -f "${service_dir}package.json" ]; then
                service_name=$(basename "$service_dir")
                if grep -q "\"build\":" "${service_dir}package.json"; then
                    log_info "Building $service_name..."
                    (cd "$service_dir" && npm run build)
                fi
            fi
        done

        # Build frontend
        if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
            if grep -q "\"build\":" "frontend/package.json"; then
                log_info "Building frontend..."
                (cd frontend && npm run build)
            fi
        fi
    fi
}

# Run tests
run_tests() {
    log_info "Running tests to verify setup..."

    if [ -f package.json ] && grep -q "test" package.json; then
        # Run a quick test to verify everything is working
        if npm run test -- --passWithNoTests --silent; then
            log_success "Tests passed! Setup verification complete."
        else
            log_warning "Some tests failed, but setup may still be functional"
        fi
    else
        log_info "No test script found, skipping test verification"
    fi
}

# Display success message and next steps
show_success_message() {
    echo
    log_success "🎉 Development environment setup complete!"
    echo
    log_info "Next steps:"
    echo "  1. Start the development environment:"
    echo "     ${GREEN}npm run dev${NC}"
    echo
    echo "  2. Access the applications:"
    echo "     • Frontend: ${BLUE}http://localhost:3000${NC}"
    echo "     • API: ${BLUE}http://localhost:8000${NC}"
    echo "     • API Docs: ${BLUE}http://localhost:8000/docs${NC}"
    echo "     • GraphQL Playground: ${BLUE}http://localhost:8000/graphql${NC}"
    echo
    echo "  3. Development tools:"
    echo "     • Grafana: ${BLUE}http://localhost:3001${NC} (admin/admin)"
    echo "     • MailHog: ${BLUE}http://localhost:8025${NC}"
    echo "     • Prometheus: ${BLUE}http://localhost:9090${NC}"
    echo
    echo "  4. Useful commands:"
    echo "     • ${GREEN}npm run dev${NC} - Start all services"
    echo "     • ${GREEN}npm run test${NC} - Run tests"
    echo "     • ${GREEN}npm run lint${NC} - Lint code"
    echo "     • ${GREEN}npm run db:reset${NC} - Reset database"
    echo
    log_info "For more information, see docs/development/setup-guide.md"
    echo
}

# Main setup function
main() {
    echo
    log_info "🚀 Starting DatatechtonCRM development environment setup..."
    echo

    # Check if we're in the right directory
    if [ ! -f package.json ]; then
        log_error "package.json not found. Please run this script from the project root directory."
        exit 1
    fi

    # Run setup steps
    check_requirements
    setup_environment
    install_dependencies
    setup_infrastructure
    setup_database
    build_services
    run_tests
    show_success_message
}

# Handle script interruption
cleanup() {
    log_warning "Setup interrupted. You may need to clean up Docker containers:"
    log_info "docker-compose down"
    exit 1
}

trap cleanup INT TERM

# Parse command line arguments
SKIP_TESTS=false
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help|-h)
            echo "DatatechtonCRM Development Environment Setup"
            echo
            echo "Usage: $0 [options]"
            echo
            echo "Options:"
            echo "  --skip-tests    Skip running tests after setup"
            echo "  --skip-build    Skip building services"
            echo "  --help, -h      Show this help message"
            echo
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Modify main function based on flags
if [ "$SKIP_BUILD" = true ]; then
    build_services() {
        log_info "Skipping build step (--skip-build flag)"
    }
fi

if [ "$SKIP_TESTS" = true ]; then
    run_tests() {
        log_info "Skipping tests (--skip-tests flag)"
    }
fi

# Run main setup
main
