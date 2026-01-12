#!/bin/bash

# DatatechtonCRM Development Debugging Utilities
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

# Enable debug mode for specific service
enable_debug() {
    local service=$1
    local port=${2:-9229}

    if [ -z "$service" ]; then
        log_error "Service name is required"
        echo "Usage: $0 enable-debug <service-name> [debug-port]"
        echo "Available services: user-service, newsletter-service, content-service, crm-service, analytics-service"
        exit 1
    fi

    log_info "Enabling debug mode for $service on port $port..."

    # Stop the service
    docker-compose stop "$service"

    # Start with debug mode
    docker-compose run --rm -p "$port:$port" "$service" \
        node --inspect=0.0.0.0:$port --inspect-brk dist/index.js

    log_success "Debug mode enabled for $service. Connect your debugger to localhost:$port"
}

# Attach debugger to running service
attach_debugger() {
    local service=$1
    local port=${2:-9229}

    if [ -z "$service" ]; then
        log_error "Service name is required"
        echo "Usage: $0 attach <service-name> [debug-port]"
        exit 1
    fi

    log_info "Attaching debugger to $service..."

    # Check if service is running
    if ! docker-compose ps | grep -q "$service.*Up"; then
        log_error "$service is not running"
        exit 1
    fi

    # Get container ID
    local container_id=$(docker-compose ps -q "$service")

    # Enable debug mode in running container
    docker exec "$container_id" kill -USR1 1

    log_success "Debugger attached to $service. Connect to localhost:$port"
}

# Show service logs with filtering
show_logs() {
    local service=$1
    local filter=${2:-""}
    local lines=${3:-100}

    if [ -z "$service" ]; then
        log_info "Available services:"
        docker-compose config --services
        echo
        read -p "Enter service name: " service
    fi

    log_info "Showing logs for $service (last $lines lines)..."

    if [ -n "$filter" ]; then
        docker-compose logs --tail="$lines" "$service" | grep -i "$filter"
    else
        docker-compose logs --tail="$lines" -f "$service"
    fi
}

# Monitor service performance
monitor_performance() {
    local service=$1
    local interval=${2:-5}

    if [ -z "$service" ]; then
        log_error "Service name is required"
        echo "Usage: $0 monitor <service-name> [interval-seconds]"
        exit 1
    fi

    log_info "Monitoring performance for $service (interval: ${interval}s)..."

    while true; do
        clear
        echo -e "${CYAN}=== Performance Monitor for $service ===${NC}"
        echo "$(date)"
        echo

        # Get container stats
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" | grep "$service"

        # Get service-specific metrics if available
        case $service in
            "user-service")
                curl -s http://localhost:3001/metrics 2>/dev/null | grep -E "(http_requests_total|response_time)" || echo "Metrics not available"
                ;;
            "newsletter-service")
                curl -s http://localhost:3002/metrics 2>/dev/null | grep -E "(newsletters_sent|queue_size)" || echo "Metrics not available"
                ;;
            *)
                echo "Service-specific metrics not configured"
                ;;
        esac

        sleep "$interval"
    done
}

# Test service endpoints
test_endpoints() {
    local service=$1

    if [ -z "$service" ]; then
        log_info "Testing all service endpoints..."
        services=("user-service:3001" "newsletter-service:3002" "content-service:3003" "crm-service:3004" "analytics-service:3005")
    else
        case $service in
            "user-service") services=("user-service:3001") ;;
            "newsletter-service") services=("newsletter-service:3002") ;;
            "content-service") services=("content-service:3003") ;;
            "crm-service") services=("crm-service:3004") ;;
            "analytics-service") services=("analytics-service:3005") ;;
            *) log_error "Unknown service: $service"; exit 1 ;;
        esac
    fi

    for service_info in "${services[@]}"; do
        IFS=':' read -r svc_name port <<< "$service_info"

        echo -e "\n${CYAN}Testing $svc_name endpoints:${NC}"

        # Health check
        if curl -f -s "http://localhost:$port/health" > /dev/null; then
            echo -e "  ${GREEN}✓${NC} Health check: OK"
        else
            echo -e "  ${RED}✗${NC} Health check: FAILED"
        fi

        # Ready check
        if curl -f -s "http://localhost:$port/ready" > /dev/null; then
            echo -e "  ${GREEN}✓${NC} Ready check: OK"
        else
            echo -e "  ${RED}✗${NC} Ready check: FAILED"
        fi

        # Metrics endpoint
        if curl -f -s "http://localhost:$port/metrics" > /dev/null; then
            echo -e "  ${GREEN}✓${NC} Metrics: Available"
        else
            echo -e "  ${YELLOW}!${NC} Metrics: Not available"
        fi

        # API documentation
        if curl -f -s "http://localhost:$port/docs" > /dev/null; then
            echo -e "  ${GREEN}✓${NC} API Docs: Available"
        else
            echo -e "  ${YELLOW}!${NC} API Docs: Not available"
        fi
    done
}

# Profile service memory usage
profile_memory() {
    local service=$1
    local duration=${2:-60}

    if [ -z "$service" ]; then
        log_error "Service name is required"
        echo "Usage: $0 profile-memory <service-name> [duration-seconds]"
        exit 1
    fi

    log_info "Profiling memory usage for $service for ${duration} seconds..."

    # Create output directory
    mkdir -p "profiles/$(date +%Y%m%d)"
    local output_file="profiles/$(date +%Y%m%d)/${service}-memory-$(date +%H%M%S).log"

    # Monitor memory usage
    for i in $(seq 1 "$duration"); do
        echo "$(date +%H:%M:%S) $(docker stats --no-stream --format '{{.MemUsage}}' | grep "$service")" >> "$output_file"
        sleep 1
    done

    log_success "Memory profile saved to $output_file"
}

# Generate heap dump
generate_heap_dump() {
    local service=$1

    if [ -z "$service" ]; then
        log_error "Service name is required"
        echo "Usage: $0 heap-dump <service-name>"
        exit 1
    fi

    log_info "Generating heap dump for $service..."

    # Get container ID
    local container_id=$(docker-compose ps -q "$service")

    if [ -z "$container_id" ]; then
        log_error "$service is not running"
        exit 1
    fi

    # Create dumps directory
    mkdir -p "dumps/$(date +%Y%m%d)"
    local dump_file="dumps/$(date +%Y%m%d)/${service}-heap-$(date +%H%M%S).heapsnapshot"

    # Generate heap dump
    docker exec "$container_id" node -e "
        const v8 = require('v8');
        const fs = require('fs');
        const heapSnapshot = v8.getHeapSnapshot();
        const fileName = '/tmp/heap.heapsnapshot';
        const fileStream = fs.createWriteStream(fileName);
        heapSnapshot.pipe(fileStream);
        console.log('Heap dump generated at', fileName);
    "

    # Copy dump from container
    docker cp "$container_id:/tmp/heap.heapsnapshot" "$dump_file"

    log_success "Heap dump saved to $dump_file"
    log_info "You can analyze this dump in Chrome DevTools > Memory tab"
}

# Stress test specific service
stress_test() {
    local service=$1
    local concurrent=${2:-10}
    local duration=${3:-30}

    if [ -z "$service" ]; then
        log_error "Service name is required"
        echo "Usage: $0 stress-test <service-name> [concurrent-requests] [duration-seconds]"
        exit 1
    fi

    # Get service port
    local port
    case $service in
        "user-service") port=3001 ;;
        "newsletter-service") port=3002 ;;
        "content-service") port=3003 ;;
        "crm-service") port=3004 ;;
        "analytics-service") port=3005 ;;
        *) log_error "Unknown service: $service"; exit 1 ;;
    esac

    log_info "Running stress test on $service (port $port) with $concurrent concurrent requests for ${duration}s..."

    # Check if service is healthy first
    if ! curl -f -s "http://localhost:$port/health" > /dev/null; then
        log_error "$service is not healthy. Cannot run stress test."
        exit 1
    fi

    # Run stress test using Apache Bench if available
    if command -v ab &> /dev/null; then
        ab -n $((concurrent * duration)) -c "$concurrent" "http://localhost:$port/health"
    else
        log_warning "Apache Bench (ab) not found. Using curl-based stress test..."

        # Simple curl-based stress test
        for i in $(seq 1 "$concurrent"); do
            (
                for j in $(seq 1 "$duration"); do
                    curl -s "http://localhost:$port/health" > /dev/null
                    sleep 1
                done
            ) &
        done

        wait
        log_success "Stress test completed"
    fi
}

# Interactive debugging session
debug_session() {
    local service=$1

    if [ -z "$service" ]; then
        log_info "Available services for debugging:"
        docker-compose config --services | grep -E "(user|newsletter|content|crm|analytics)-service"
        echo
        read -p "Enter service name: " service
    fi

    log_info "Starting interactive debugging session for $service..."

    # Get container ID
    local container_id=$(docker-compose ps -q "$service")

    if [ -z "$container_id" ]; then
        log_error "$service is not running"
        exit 1
    fi

    # Start interactive shell in container
    docker exec -it "$container_id" /bin/sh
}

# Main command handler
case "$1" in
    "enable-debug")
        enable_debug "$2" "$3"
        ;;
    "attach")
        attach_debugger "$2" "$3"
        ;;
    "logs")
        show_logs "$2" "$3" "$4"
        ;;
    "monitor")
        monitor_performance "$2" "$3"
        ;;
    "test-endpoints")
        test_endpoints "$2"
        ;;
    "profile-memory")
        profile_memory "$2" "$3"
        ;;
    "heap-dump")
        generate_heap_dump "$2"
        ;;
    "stress-test")
        stress_test "$2" "$3" "$4"
        ;;
    "debug-session")
        debug_session "$2"
        ;;
    *)
        echo "DatatechtonCRM Development Debugging Utilities"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  enable-debug <service> [port]     Enable debug mode for service"
        echo "  attach <service> [port]           Attach debugger to running service"
        echo "  logs <service> [filter] [lines]   Show filtered logs for service"
        echo "  monitor <service> [interval]      Monitor service performance"
        echo "  test-endpoints [service]          Test service API endpoints"
        echo "  profile-memory <service> [duration] Profile memory usage"
        echo "  heap-dump <service>               Generate heap dump"
        echo "  stress-test <service> [concurrent] [duration] Run stress test"
        echo "  debug-session <service>           Start interactive debugging session"
        echo ""
        echo "Examples:"
        echo "  $0 enable-debug user-service 9229"
        echo "  $0 logs newsletter-service error 50"
        echo "  $0 monitor crm-service 10"
        echo "  $0 stress-test user-service 20 60"
        ;;
esac
