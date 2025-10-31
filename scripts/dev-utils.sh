#!/bin/bash

# Development Utilities Script
# Collection of useful development commands and shortcuts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

# Show help
show_help() {
    echo -e "${CYAN}Development Utilities${NC}"
    echo
    echo "Usage: ./scripts/dev-utils.sh <command> [options]"
    echo
    echo "Available commands:"
    echo "  ${GREEN}status${NC}          Show development environment status"
    echo "  ${GREEN}logs${NC} [service]  Show logs for all services or specific service"
    echo "  ${GREEN}restart${NC} [service] Restart all services or specific service"
    echo "  ${GREEN}clean${NC}           Clean all build artifacts and caches"
    echo "  ${GREEN}reset${NC}           Reset development environment"
    echo "  ${GREEN}test${NC} [pattern]  Run tests with optional pattern"
    echo "  ${GREEN}lint${NC}            Run linting and formatting"
    echo "  ${GREEN}build${NC}           Build all services"
    echo "  ${GREEN}db-reset${NC}        Reset database with fresh data"
    echo "  ${GREEN}generate${NC}        Interactive code generation"
    echo "  ${GREEN}debug${NC} <service> Start service in debug mode"
    echo "  ${GREEN}profile${NC}         Run performance profiling"
    echo "  ${GREEN}docs${NC}            Generate and serve documentation"
    echo
    echo "Examples:"
    echo "  ./scripts/dev-utils.sh status"
    echo "  ./scripts/dev-utils.sh logs user-service"
    echo "  ./scripts/dev-utils.sh test newsletter"
    echo "  ./scripts/dev-utils.sh debug user-service"
}

# Check development environment status
check_status() {
    log_info "Checking development environment status..."
    echo

    # Check Docker services
    echo -e "${CYAN}Docker Services:${NC}"
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose ps
    elif docker compose version >/dev/null 2>&1; then
        docker compose ps
    else
        log_error "Docker Compose not found"
    fi
    echo

    # Check Node.js processes
    echo -e "${CYAN}Node.js Processes:${NC}"
    if pgrep -f "node.*src/index" >/dev/null; then
        ps aux | grep "node.*src/index" | grep -v grep
    else
        echo "No Node.js development processes running"
    fi
    echo

    # Check ports
    echo -e "${CYAN}Port Usage:${NC}"
    local ports=(3000 3001 8000 8001 8002 8003 8004 5432 6379 9200 5672 1025 8025)
    for port in "${ports[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            local process=$(lsof -i :$port | tail -n 1 | awk '{print $1}')
            echo "Port $port: $process"
        fi
    done
    echo

    # Check disk space
    echo -e "${CYAN}Disk Usage:${NC}"
    df -h . | tail -n 1
    echo

    # Check memory usage
    echo -e "${CYAN}Memory Usage:${NC}"
    free -h 2>/dev/null || vm_stat | head -n 5
}

# Show logs
show_logs() {
    local service=$1

    if [ -z "$service" ]; then
        log_info "Showing logs for all services..."
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose logs -f --tail=100
        else
            docker compose logs -f --tail=100
        fi
    else
        log_info "Showing logs for $service..."
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose logs -f --tail=100 "$service"
        else
            docker compose logs -f --tail=100 "$service"
        fi
    fi
}

# Restart services
restart_services() {
    local service=$1

    if [ -z "$service" ]; then
        log_info "Restarting all services..."
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose restart
        else
            docker compose restart
        fi

        # Restart Node.js processes
        if pgrep -f "node.*src/index" >/dev/null; then
            log_info "Restarting Node.js processes..."
            pkill -f "node.*src/index"
            sleep 2
            npm run dev &
        fi
    else
        log_info "Restarting $service..."
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose restart "$service"
        else
            docker compose restart "$service"
        fi
    fi

    log_success "Services restarted"
}

# Clean build artifacts and caches
clean_environment() {
    log_info "Cleaning development environment..."

    # Clean Node.js artifacts
    log_info "Cleaning Node.js artifacts..."
    find . -name "node_modules" -type d -prune -exec rm -rf {} \; 2>/dev/null || true
    find . -name "dist" -type d -prune -exec rm -rf {} \; 2>/dev/null || true
    find . -name ".next" -type d -prune -exec rm -rf {} \; 2>/dev/null || true
    find . -name "coverage" -type d -prune -exec rm -rf {} \; 2>/dev/null || true

    # Clean TypeScript cache
    find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

    # Clean Jest cache
    npx jest --clearCache 2>/dev/null || true

    # Clean Docker artifacts
    log_info "Cleaning Docker artifacts..."
    docker system prune -f >/dev/null 2>&1 || true

    # Clean logs
    log_info "Cleaning logs..."
    find . -name "*.log" -delete 2>/dev/null || true

    log_success "Environment cleaned"
}

# Reset development environment
reset_environment() {
    log_warning "This will reset your entire development environment!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Resetting development environment..."

        # Stop all services
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose down -v
        else
            docker compose down -v
        fi

        # Kill Node.js processes
        pkill -f "node.*src/index" 2>/dev/null || true

        # Clean environment
        clean_environment

        # Reinstall dependencies
        log_info "Reinstalling dependencies..."
        npm install

        # Restart infrastructure
        log_info "Starting infrastructure..."
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose up -d postgres redis elasticsearch rabbitmq mailhog
        else
            docker compose up -d postgres redis elasticsearch rabbitmq mailhog
        fi

        # Wait for services
        sleep 10

        # Reset database
        reset_database

        log_success "Environment reset complete"
    else
        log_info "Reset cancelled"
    fi
}

# Run tests
run_tests() {
    local pattern=$1

    if [ -z "$pattern" ]; then
        log_info "Running all tests..."
        npm test -- --silent
    else
        log_info "Running tests matching pattern: $pattern"
        npm test -- --silent --testNamePattern="$pattern"
    fi
}

# Run linting and formatting
run_lint() {
    log_info "Running code quality checks..."
    node scripts/quality-tools/code-quality-check.js --fix
}

# Build all services
build_services() {
    log_info "Building all services..."

    # Build root project
    if [ -f "package.json" ] && grep -q "\"build\":" package.json; then
        npm run build
    fi

    # Build services
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

    log_success "All services built successfully"
}

# Reset database
reset_database() {
    log_info "Resetting database..."

    if [ -f "package.json" ] && grep -q "db:reset" package.json; then
        npm run db:reset
    else
        log_warning "No db:reset script found"

        # Manual database reset
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose exec -T postgres psql -U datatechtoncrm -d datatechtoncrm -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
        else
            docker compose exec -T postgres psql -U datatechtoncrm -d datatechtoncrm -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
        fi

        # Run migrations if available
        if [ -f "package.json" ] && grep -q "db:migrate" package.json; then
            npm run db:migrate
        fi

        # Seed database if available
        if [ -f "package.json" ] && grep -q "db:seed" package.json; then
            npm run db:seed
        fi
    fi

    log_success "Database reset complete"
}

# Interactive code generation
interactive_generate() {
    echo -e "${CYAN}Code Generation Menu${NC}"
    echo
    echo "1. Generate new service"
    echo "2. Generate API endpoints"
    echo "3. Generate React component"
    echo "4. Generate database migration"
    echo "5. Exit"
    echo

    read -p "Select option (1-5): " choice

    case $choice in
        1)
            read -p "Service name: " service_name
            node scripts/code-generators/generate-service.js "$service_name"
            ;;
        2)
            read -p "Service name: " service_name
            read -p "Resource name: " resource_name
            node scripts/code-generators/generate-api.js "$service_name" "$resource_name"
            ;;
        3)
            read -p "Component name: " component_name
            echo "Generating React component: $component_name"
            # Add React component generator here
            ;;
        4)
            read -p "Migration name: " migration_name
            echo "Generating migration: $migration_name"
            # Add migration generator here
            ;;
        5)
            log_info "Exiting..."
            ;;
        *)
            log_error "Invalid option"
            ;;
    esac
}

# Debug service
debug_service() {
    local service=$1

    if [ -z "$service" ]; then
        log_error "Service name required"
        echo "Available services:"
        ls -1 services/ | grep -v "shared"
        return 1
    fi

    local service_dir="services/$service"

    if [ ! -d "$service_dir" ]; then
        log_error "Service not found: $service"
        return 1
    fi

    log_info "Starting $service in debug mode..."
    log_info "Debug port: 9229"
    log_info "Attach your debugger to localhost:9229"

    cd "$service_dir"
    npm run dev:debug
}

# Performance profiling
run_profiling() {
    log_info "Running performance profiling..."

    # Check if performance tests exist
    if [ -d "tests/performance" ]; then
        log_info "Running performance tests..."
        npm run test:performance
    else
        log_warning "No performance tests found"
    fi

    # Profile memory usage
    log_info "Profiling memory usage..."
    node --inspect --max-old-space-size=4096 -e "
        const used = process.memoryUsage();
        console.log('Memory Usage:');
        for (let key in used) {
            console.log(\`\${key}: \${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB\`);
        }
    "
}

# Generate and serve documentation
serve_docs() {
    log_info "Generating documentation..."

    # Generate API docs if available
    if [ -f "package.json" ] && grep -q "docs:generate" package.json; then
        npm run docs:generate
    fi

    # Generate TypeDoc if available
    if command -v typedoc >/dev/null 2>&1; then
        typedoc --out docs/api src
    fi

    # Serve documentation
    if [ -d "docs" ]; then
        log_info "Serving documentation at http://localhost:8080"
        if command -v python3 >/dev/null 2>&1; then
            cd docs && python3 -m http.server 8080
        elif command -v python >/dev/null 2>&1; then
            cd docs && python -m SimpleHTTPServer 8080
        elif command -v npx >/dev/null 2>&1; then
            npx serve docs -p 8080
        else
            log_error "No web server available to serve documentation"
        fi
    else
        log_error "No documentation directory found"
    fi
}

# Main command dispatcher
main() {
    local command=$1
    shift

    case $command in
        "status")
            check_status
            ;;
        "logs")
            show_logs "$@"
            ;;
        "restart")
            restart_services "$@"
            ;;
        "clean")
            clean_environment
            ;;
        "reset")
            reset_environment
            ;;
        "test")
            run_tests "$@"
            ;;
        "lint")
            run_lint
            ;;
        "build")
            build_services
            ;;
        "db-reset")
            reset_database
            ;;
        "generate")
            interactive_generate
            ;;
        "debug")
            debug_service "$@"
            ;;
        "profile")
            run_profiling
            ;;
        "docs")
            serve_docs
            ;;
        "help"|"--help"|"-h"|"")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
