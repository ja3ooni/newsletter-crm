#!/bin/bash

# AiLert Infrastructure Validation Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((FAILED_CHECKS++))
}

check_command() {
    local cmd=$1
    local name=$2
    ((TOTAL_CHECKS++))

    if command -v "$cmd" &> /dev/null; then
        log_success "$name is installed"
        return 0
    else
        log_error "$name is not installed"
        return 1
    fi
}

check_docker_service() {
    local service=$1
    local port=$2
    ((TOTAL_CHECKS++))

    if docker-compose ps | grep -q "$service.*Up"; then
        log_success "$service is running"

        # Check if port is accessible
        if nc -z localhost "$port" 2>/dev/null; then
            log_success "$service is accessible on port $port"
        else
            log_warning "$service is running but port $port is not accessible"
        fi
        return 0
    else
        log_error "$service is not running"
        return 1
    fi
}

check_endpoint() {
    local url=$1
    local name=$2
    ((TOTAL_CHECKS++))

    if curl -f -s "$url" > /dev/null 2>&1; then
        log_success "$name endpoint is accessible"
        return 0
    else
        log_error "$name endpoint is not accessible ($url)"
        return 1
    fi
}

check_file_exists() {
    local file=$1
    local name=$2
    ((TOTAL_CHECKS++))

    if [ -f "$file" ]; then
        log_success "$name exists"
        return 0
    else
        log_error "$name does not exist ($file)"
        return 1
    fi
}

check_directory_exists() {
    local dir=$1
    local name=$2
    ((TOTAL_CHECKS++))

    if [ -d "$dir" ]; then
        log_success "$name directory exists"
        return 0
    else
        log_error "$name directory does not exist ($dir)"
        return 1
    fi
}

echo -e "${CYAN}=== AiLert Infrastructure Validation ===${NC}"
echo "$(date)"
echo

# Check prerequisites
log_info "Checking prerequisites..."
check_command "docker" "Docker"
check_command "docker-compose" "Docker Compose"
check_command "node" "Node.js"
check_command "npm" "npm"
check_command "curl" "curl"
check_command "nc" "netcat"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    ((TOTAL_CHECKS++))
    if [ "$NODE_VERSION" -ge 18 ]; then
        log_success "Node.js version is 18 or higher ($(node -v))"
    else
        log_error "Node.js version must be 18 or higher (current: $(node -v))"
    fi
fi

echo

# Check project structure
log_info "Checking project structure..."
check_directory_exists "services" "Services"
check_directory_exists "frontend" "Frontend"
check_directory_exists "k8s" "Kubernetes manifests"
check_directory_exists "infrastructure" "Infrastructure"
check_directory_exists "scripts" "Scripts"
check_directory_exists ".vscode" "VS Code configuration"

# Check configuration files
log_info "Checking configuration files..."
check_file_exists "docker-compose.yml" "Docker Compose configuration"
check_file_exists "docker-compose.prod.yml" "Production Docker Compose configuration"
check_file_exists "docker-compose.override.yml" "Development Docker Compose override"
check_file_exists ".env.example" "Environment example file"
check_file_exists "package.json" "Root package.json"
check_file_exists ".github/workflows/ci-cd.yml" "CI/CD workflow"
check_file_exists ".hadolint.yaml" "Hadolint configuration"

# Check service directories and files
log_info "Checking service structure..."
services=("user-service" "newsletter-service" "content-service" "crm-service" "analytics-service")
for service in "${services[@]}"; do
    check_directory_exists "services/$service" "$service directory"
    check_file_exists "services/$service/Dockerfile" "$service Dockerfile"
    check_file_exists "k8s/$service.yaml" "$service Kubernetes manifest"
done

echo

# Check if Docker is running
log_info "Checking Docker daemon..."
((TOTAL_CHECKS++))
if docker info > /dev/null 2>&1; then
    log_success "Docker daemon is running"
else
    log_error "Docker daemon is not running"
    echo -e "${YELLOW}Please start Docker and run this script again${NC}"
    exit 1
fi

echo

# Check Docker Compose services
log_info "Checking Docker Compose services..."
if [ -f "docker-compose.yml" ]; then
    # Check if services are defined
    services_in_compose=$(docker-compose config --services 2>/dev/null || echo "")
    if [ -n "$services_in_compose" ]; then
        log_success "Docker Compose configuration is valid"

        # Check if any services are running
        running_services=$(docker-compose ps --services --filter "status=running" 2>/dev/null || echo "")
        if [ -n "$running_services" ]; then
            log_info "Running services: $running_services"

            # Check specific services
            check_docker_service "postgres" "5432"
            check_docker_service "redis" "6379"
            check_docker_service "elasticsearch" "9200"
            check_docker_service "rabbitmq" "5672"

            # Check application services if running
            for service in "${services[@]}"; do
                if echo "$running_services" | grep -q "$service"; then
                    case $service in
                        "user-service") check_docker_service "$service" "3001" ;;
                        "newsletter-service") check_docker_service "$service" "3002" ;;
                        "content-service") check_docker_service "$service" "3003" ;;
                        "crm-service") check_docker_service "$service" "3004" ;;
                        "analytics-service") check_docker_service "$service" "3005" ;;
                    esac
                fi
            done
        else
            log_warning "No services are currently running"
            log_info "Run 'docker-compose up -d' to start services"
        fi
    else
        log_error "Docker Compose configuration is invalid"
    fi
fi

echo

# Check service endpoints (if services are running)
log_info "Checking service endpoints..."
running_services=$(docker-compose ps --services --filter "status=running" 2>/dev/null || echo "")

if echo "$running_services" | grep -q "user-service"; then
    check_endpoint "http://localhost:3001/health" "User Service health"
fi

if echo "$running_services" | grep -q "newsletter-service"; then
    check_endpoint "http://localhost:3002/health" "Newsletter Service health"
fi

if echo "$running_services" | grep -q "content-service"; then
    check_endpoint "http://localhost:3003/health" "Content Service health"
fi

if echo "$running_services" | grep -q "crm-service"; then
    check_endpoint "http://localhost:3004/health" "CRM Service health"
fi

if echo "$running_services" | grep -q "analytics-service"; then
    check_endpoint "http://localhost:3005/health" "Analytics Service health"
fi

if echo "$running_services" | grep -q "frontend"; then
    check_endpoint "http://localhost:3000" "Frontend"
fi

if echo "$running_services" | grep -q "api-gateway"; then
    check_endpoint "http://localhost:8000/health" "API Gateway health"
fi

echo

# Check monitoring services
log_info "Checking monitoring services..."
if echo "$running_services" | grep -q "prometheus"; then
    check_endpoint "http://localhost:9090/-/healthy" "Prometheus"
fi

if echo "$running_services" | grep -q "grafana"; then
    check_endpoint "http://localhost:3001/api/health" "Grafana"
fi

echo

# Check development tools
log_info "Checking development tools..."
if echo "$running_services" | grep -q "mailhog"; then
    check_endpoint "http://localhost:8025" "MailHog"
fi

if echo "$running_services" | grep -q "pgadmin"; then
    check_endpoint "http://localhost:5050" "pgAdmin"
fi

if echo "$running_services" | grep -q "redis-commander"; then
    check_endpoint "http://localhost:8081" "Redis Commander"
fi

if echo "$running_services" | grep -q "kibana"; then
    check_endpoint "http://localhost:5601/api/status" "Kibana"
fi

echo

# Check Kubernetes manifests
log_info "Checking Kubernetes manifests..."
if command -v kubectl &> /dev/null; then
    for service in "${services[@]}"; do
        if [ -f "k8s/$service.yaml" ]; then
            ((TOTAL_CHECKS++))
            if kubectl apply --dry-run=client -f "k8s/$service.yaml" > /dev/null 2>&1; then
                log_success "$service Kubernetes manifest is valid"
            else
                log_error "$service Kubernetes manifest is invalid"
            fi
        fi
    done
else
    log_warning "kubectl not found, skipping Kubernetes manifest validation"
fi

echo

# Check security configurations
log_info "Checking security configurations..."

# Check for secrets in git
((TOTAL_CHECKS++))
if git check-ignore .env > /dev/null 2>&1 || [ ! -f .env ]; then
    log_success ".env file is properly ignored by git"
else
    log_error ".env file is tracked by git (security risk)"
fi

# Check Dockerfile security
for service in "${services[@]}"; do
    dockerfile="services/$service/Dockerfile"
    if [ -f "$dockerfile" ]; then
        ((TOTAL_CHECKS++))
        if grep -q "USER.*nodejs" "$dockerfile"; then
            log_success "$service Dockerfile uses non-root user"
        else
            log_warning "$service Dockerfile may be running as root"
        fi
    fi
done

echo

# Summary
echo -e "${CYAN}=== Validation Summary ===${NC}"
echo "Total checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Infrastructure is ready.${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILED_CHECKS checks failed. Please address the issues above.${NC}"
    exit 1
fi
