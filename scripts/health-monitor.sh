#!/bin/bash

# DatatechtonCRM Health Monitoring Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SERVICES=(
    "user-service:3001"
    "newsletter-service:3002"
    "content-service:3003"
    "crm-service:3004"
    "analytics-service:3005"
    "frontend:3000"
)

INFRASTRUCTURE=(
    "postgres:5432"
    "redis:6379"
    "elasticsearch:9200"
    "rabbitmq:5672"
    "api-gateway:8000"
)

MONITORING_INTERVAL=${MONITORING_INTERVAL:-30}
LOG_FILE="logs/health-monitor.log"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" >> "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$LOG_FILE"
}

# Create logs directory
mkdir -p logs

# Check if service is healthy
check_service_health() {
    local service_info=$1
    IFS=':' read -r service_name port <<< "$service_info"

    local health_url="http://localhost:$port/health"

    if curl -f -s --max-time 5 "$health_url" > /dev/null 2>&1; then
        log_success "$service_name is healthy"
        return 0
    else
        log_error "$service_name is unhealthy or unreachable"
        return 1
    fi
}

# Check if infrastructure service is running
check_infrastructure_health() {
    local service_info=$1
    IFS=':' read -r service_name port <<< "$service_info"

    if nc -z localhost "$port" 2>/dev/null; then
        log_success "$service_name is running"
        return 0
    else
        log_error "$service_name is not running or unreachable"
        return 1
    fi
}

# Check Docker container status
check_container_status() {
    local container_name=$1

    if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        local status=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null)
        if [ "$status" = "running" ]; then
            log_success "Container $container_name is running"
            return 0
        else
            log_error "Container $container_name is not running (status: $status)"
            return 1
        fi
    else
        log_error "Container $container_name not found"
        return 1
    fi
}

# Get service metrics
get_service_metrics() {
    local service_info=$1
    IFS=':' read -r service_name port <<< "$service_info"

    local metrics_url="http://localhost:$port/metrics"

    if curl -f -s --max-time 5 "$metrics_url" > /dev/null 2>&1; then
        log_info "$service_name metrics are available"
        # You can add specific metric collection here
    else
        log_warning "$service_name metrics are not available"
    fi
}

# Check system resources
check_system_resources() {
    log_info "Checking system resources..."

    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    log_info "CPU Usage: ${cpu_usage}%"

    # Memory usage
    local memory_info=$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2 }')
    log_info "Memory Usage: $memory_info"

    # Disk usage
    local disk_usage=$(df -h / | awk 'NR==2{print $5}')
    log_info "Disk Usage: $disk_usage"

    # Docker stats
    if command -v docker &> /dev/null; then
        log_info "Docker container stats:"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | head -10
    fi
}

# Send alert (placeholder for integration with alerting systems)
send_alert() {
    local message=$1
    local severity=${2:-"warning"}

    log_warning "ALERT [$severity]: $message"

    # Add integrations here:
    # - Slack webhook
    # - Email notification
    # - PagerDuty
    # - Discord webhook

    # Example Slack webhook (uncomment and configure)
    # if [ -n "$SLACK_WEBHOOK_URL" ]; then
    #     curl -X POST -H 'Content-type: application/json' \
    #         --data "{\"text\":\"DatatechtonCRM Alert [$severity]: $message\"}" \
    #         "$SLACK_WEBHOOK_URL"
    # fi
}

# Comprehensive health check
run_health_check() {
    log_info "Starting comprehensive health check..."

    local failed_services=()
    local failed_infrastructure=()

    # Check application services
    log_info "Checking application services..."
    for service in "${SERVICES[@]}"; do
        if ! check_service_health "$service"; then
            failed_services+=("$service")
        fi
        get_service_metrics "$service"
    done

    # Check infrastructure services
    log_info "Checking infrastructure services..."
    for service in "${INFRASTRUCTURE[@]}"; do
        if ! check_infrastructure_health "$service"; then
            failed_infrastructure+=("$service")
        fi
    done

    # Check Docker containers
    log_info "Checking Docker containers..."
    local containers=(
        "datatechtoncrm-user-service"
        "datatechtoncrm-newsletter-service"
        "datatechtoncrm-content-service"
        "datatechtoncrm-crm-service"
        "datatechtoncrm-analytics-service"
        "datatechtoncrm-frontend"
        "datatechtoncrm-postgres"
        "datatechtoncrm-redis"
        "datatechtoncrm-elasticsearch"
        "datatechtoncrm-rabbitmq"
        "datatechtoncrm-api-gateway"
    )

    for container in "${containers[@]}"; do
        check_container_status "$container" || true
    done

    # Check system resources
    check_system_resources

    # Report results
    if [ ${#failed_services[@]} -eq 0 ] && [ ${#failed_infrastructure[@]} -eq 0 ]; then
        log_success "All services are healthy"
    else
        if [ ${#failed_services[@]} -gt 0 ]; then
            local failed_list=$(IFS=', '; echo "${failed_services[*]}")
            send_alert "Failed application services: $failed_list" "critical"
        fi

        if [ ${#failed_infrastructure[@]} -gt 0 ]; then
            local failed_list=$(IFS=', '; echo "${failed_infrastructure[*]}")
            send_alert "Failed infrastructure services: $failed_list" "critical"
        fi
    fi

    log_info "Health check completed"
}

# Continuous monitoring
continuous_monitoring() {
    log_info "Starting continuous monitoring (interval: ${MONITORING_INTERVAL}s)"
    log_info "Press Ctrl+C to stop monitoring"

    while true; do
        run_health_check
        echo ""
        sleep "$MONITORING_INTERVAL"
    done
}

# Service recovery attempt
attempt_service_recovery() {
    local service=$1

    log_info "Attempting to recover service: $service"

    # Try to restart the service
    if docker-compose restart "$service"; then
        log_success "Service $service restarted successfully"

        # Wait a bit and check if it's healthy
        sleep 10
        if check_service_health "$service:$(get_service_port "$service")"; then
            log_success "Service $service is now healthy after restart"
            return 0
        else
            log_error "Service $service is still unhealthy after restart"
            return 1
        fi
    else
        log_error "Failed to restart service $service"
        return 1
    fi
}

# Get service port (helper function)
get_service_port() {
    local service=$1
    case $service in
        "user-service") echo "3001" ;;
        "newsletter-service") echo "3002" ;;
        "content-service") echo "3003" ;;
        "crm-service") echo "3004" ;;
        "analytics-service") echo "3005" ;;
        "frontend") echo "3000" ;;
        *) echo "3000" ;;
    esac
}

# Generate health report
generate_health_report() {
    local report_file="reports/health-report-$(date +%Y%m%d_%H%M%S).html"

    mkdir -p reports

    log_info "Generating health report: $report_file"

    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>DatatechtonCRM Health Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .service { margin: 10px 0; padding: 10px; border-left: 4px solid #ccc; }
        .healthy { border-left-color: #4CAF50; }
        .unhealthy { border-left-color: #f44336; }
        .warning { border-left-color: #ff9800; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>DatatechtonCRM Health Report</h1>
        <p class="timestamp">Generated: $(date)</p>
    </div>

    <h2>Application Services</h2>
EOF

    # Add service status to report
    for service in "${SERVICES[@]}"; do
        IFS=':' read -r service_name port <<< "$service"
        if check_service_health "$service" &>/dev/null; then
            echo "    <div class=\"service healthy\">✅ $service_name - Healthy</div>" >> "$report_file"
        else
            echo "    <div class=\"service unhealthy\">❌ $service_name - Unhealthy</div>" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF

    <h2>Infrastructure Services</h2>
EOF

    # Add infrastructure status to report
    for service in "${INFRASTRUCTURE[@]}"; do
        IFS=':' read -r service_name port <<< "$service"
        if check_infrastructure_health "$service" &>/dev/null; then
            echo "    <div class=\"service healthy\">✅ $service_name - Running</div>" >> "$report_file"
        else
            echo "    <div class=\"service unhealthy\">❌ $service_name - Not Running</div>" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF

    <h2>System Resources</h2>
    <div class="service">
        <p>CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')%</p>
        <p>Memory Usage: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2 }')</p>
        <p>Disk Usage: $(df -h / | awk 'NR==2{print $5}')</p>
    </div>

</body>
</html>
EOF

    log_success "Health report generated: $report_file"
}

# Main command handler
case "$1" in
    "check")
        run_health_check
        ;;
    "monitor")
        continuous_monitoring
        ;;
    "recover")
        attempt_service_recovery "$2"
        ;;
    "report")
        generate_health_report
        ;;
    *)
        echo "DatatechtonCRM Health Monitoring"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  check                    Run single health check"
        echo "  monitor                  Start continuous monitoring"
        echo "  recover <service>        Attempt to recover a service"
        echo "  report                   Generate HTML health report"
        echo ""
        echo "Environment Variables:"
        echo "  MONITORING_INTERVAL      Monitoring interval in seconds (default: 30)"
        echo "  SLACK_WEBHOOK_URL        Slack webhook for alerts"
        echo ""
        echo "Examples:"
        echo "  $0 check"
        echo "  $0 monitor"
        echo "  $0 recover user-service"
        echo "  MONITORING_INTERVAL=60 $0 monitor"
        ;;
esac
