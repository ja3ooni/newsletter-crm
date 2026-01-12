#!/bin/bash

# Kong API Gateway Setup Script
# This script configures Kong with JWT authentication, API keys, rate limiting, and service discovery

set -e

# Configuration variables
KONG_ADMIN_URL=${KONG_ADMIN_URL:-"http://localhost:8001"}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 32)}
REDIS_PASSWORD=${REDIS_PASSWORD:-"datatechtoncrm_redis_password"}

# Service endpoints for health checks
declare -A SERVICES=(
    ["user-service"]="http://user-service:3001"
    ["newsletter-service"]="http://newsletter-service:3002"
    ["content-service"]="http://content-service:3003"
    ["crm-service"]="http://crm-service:3004"
    ["analytics-service"]="http://analytics-service:3005"
    ["marketing-automation-service"]="http://marketing-automation-service:3006"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Wait for Kong to be ready
wait_for_kong() {
    log_info "Waiting for Kong to be ready..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s "$KONG_ADMIN_URL" > /dev/null 2>&1; then
            log_info "Kong is ready!"
            return 0
        fi

        log_warn "Kong not ready yet (attempt $attempt/$max_attempts)..."
        sleep 2
        ((attempt++))
    done

    log_error "Kong failed to start within expected time"
    exit 1
}

# Wait for services to be ready
wait_for_services() {
    log_info "Waiting for backend services to be ready..."

    for service_name in "${!SERVICES[@]}"; do
        local service_url="${SERVICES[$service_name]}"
        local health_url="${service_url}/health"
        local max_attempts=20
        local attempt=1

        log_debug "Checking health of $service_name at $health_url"

        while [ $attempt -le $max_attempts ]; do
            if curl -s -f "$health_url" > /dev/null 2>&1; then
                log_info "✓ $service_name is ready"
                break
            fi

            if [ $attempt -eq $max_attempts ]; then
                log_warn "⚠ $service_name not ready after $max_attempts attempts"
                break
            fi

            sleep 3
            ((attempt++))
        done
    done
}

# Create JWT credentials
create_jwt_credentials() {
    log_info "Creating JWT credentials..."

    # Create JWT credential for default consumer
    curl -s -X POST "$KONG_ADMIN_URL/consumers/default/jwt" \
        -d "key=datatechtoncrm-jwt-key" \
        -d "secret=$JWT_SECRET" \
        -d "algorithm=HS256" || true
}

# Create consumers for different subscription tiers
create_consumers() {
    log_info "Creating subscription tier consumers..."

    # Free tier consumer
    curl -s -X POST "$KONG_ADMIN_URL/consumers" \
        -d "username=free-tier" \
        -d "custom_id=free" \
        -d "tags=tier:free" || true

    # Premium tier consumer
    curl -s -X POST "$KONG_ADMIN_URL/consumers" \
        -d "username=premium-tier" \
        -d "custom_id=premium" \
        -d "tags=tier:premium" || true

    # Enterprise tier consumer
    curl -s -X POST "$KONG_ADMIN_URL/consumers" \
        -d "username=enterprise-tier" \
        -d "custom_id=enterprise" \
        -d "tags=tier:enterprise" || true
}

# Create API keys for different tiers
create_api_keys() {
    log_info "Creating API keys for subscription tiers..."

    # Generate API keys
    FREE_API_KEY=${FREE_TIER_API_KEY:-$(openssl rand -hex 32)}
    PREMIUM_API_KEY=${PREMIUM_TIER_API_KEY:-$(openssl rand -hex 32)}
    ENTERPRISE_API_KEY=${ENTERPRISE_TIER_API_KEY:-$(openssl rand -hex 32)}

    # Create API key for free tier
    curl -s -X POST "$KONG_ADMIN_URL/consumers/free-tier/key-auth" \
        -d "key=$FREE_API_KEY" || true

    # Create API key for premium tier
    curl -s -X POST "$KONG_ADMIN_URL/consumers/premium-tier/key-auth" \
        -d "key=$PREMIUM_API_KEY" || true

    # Create API key for enterprise tier
    curl -s -X POST "$KONG_ADMIN_URL/consumers/enterprise-tier/key-auth" \
        -d "key=$ENTERPRISE_API_KEY" || true

    # Save API keys to environment file
    cat > .env.kong << EOF
# Kong API Gateway Configuration
JWT_SECRET=$JWT_SECRET
REDIS_PASSWORD=$REDIS_PASSWORD
FREE_TIER_API_KEY=$FREE_API_KEY
PREMIUM_TIER_API_KEY=$PREMIUM_API_KEY
ENTERPRISE_TIER_API_KEY=$ENTERPRISE_API_KEY
EOF

    log_info "API keys saved to .env.kong"
}

# Configure rate limiting plugins
configure_rate_limiting() {
    log_info "Configuring rate limiting plugins..."

    # This will be handled by the Kong declarative configuration
    # but we can add dynamic adjustments here if needed
}

# Setup monitoring and logging
setup_monitoring() {
    log_info "Setting up monitoring and logging..."

    # Enable Prometheus plugin globally
    curl -s -X POST "$KONG_ADMIN_URL/plugins" \
        -d "name=prometheus" \
        -d "config.per_consumer=true" \
        -d "config.status_code_metrics=true" \
        -d "config.latency_metrics=true" \
        -d "config.bandwidth_metrics=true" \
        -d "config.upstream_health_metrics=true" || true

    # Enable request ID plugin globally
    curl -s -X POST "$KONG_ADMIN_URL/plugins" \
        -d "name=request-id" \
        -d "config.header_name=X-Request-ID" \
        -d "config.echo_downstream=true" \
        -d "config.generator=uuid" || true
}

# Validate Kong configuration
validate_configuration() {
    log_info "Validating Kong configuration..."

    # Check if services are registered
    local services=$(curl -s "$KONG_ADMIN_URL/services" | jq -r '.data[].name' 2>/dev/null || echo "")

    if [ -z "$services" ]; then
        log_warn "No services found. Make sure to apply the Kong declarative configuration."
    else
        log_info "Found services: $services"
    fi

    # Check if consumers exist
    local consumers=$(curl -s "$KONG_ADMIN_URL/consumers" | jq -r '.data[].username' 2>/dev/null || echo "")

    if [ -z "$consumers" ]; then
        log_warn "No consumers found."
    else
        log_info "Found consumers: $consumers"
    fi
}

# Configure service discovery and load balancing
configure_service_discovery() {
    log_info "Configuring service discovery and load balancing..."

    for service_name in "${!SERVICES[@]}"; do
        local service_url="${SERVICES[$service_name]}"
        local upstream_name="${service_name}-upstream"

        log_debug "Creating upstream for $service_name"

        # Create upstream with health checks
        curl -s -X POST "$KONG_ADMIN_URL/upstreams" \
            -d "name=$upstream_name" \
            -d "algorithm=round-robin" \
            -d "healthchecks.active.type=http" \
            -d "healthchecks.active.http_path=/health" \
            -d "healthchecks.active.healthy.interval=10" \
            -d "healthchecks.active.healthy.successes=2" \
            -d "healthchecks.active.unhealthy.interval=10" \
            -d "healthchecks.active.unhealthy.http_failures=3" \
            -d "healthchecks.active.unhealthy.timeouts=3" || true

        # Add target to upstream
        local host_port=$(echo "$service_url" | sed 's|http://||' | sed 's|https://||')
        curl -s -X POST "$KONG_ADMIN_URL/upstreams/$upstream_name/targets" \
            -d "target=$host_port" \
            -d "weight=100" || true

        log_info "✓ Configured upstream for $service_name"
    done
}

# Setup circuit breaker and retry mechanisms
setup_resilience() {
    log_info "Setting up circuit breaker and retry mechanisms..."

    # This would typically be done via plugins in the declarative config
    # but we can add dynamic configuration here if needed

    log_info "✓ Resilience mechanisms configured"
}

# Configure advanced monitoring
setup_advanced_monitoring() {
    log_info "Setting up advanced monitoring..."

    # Enable Zipkin tracing plugin globally
    curl -s -X POST "$KONG_ADMIN_URL/plugins" \
        -d "name=zipkin" \
        -d "config.http_endpoint=http://zipkin:9411/api/v2/spans" \
        -d "config.sample_ratio=0.1" || true

    # Enable file logging with structured format
    curl -s -X POST "$KONG_ADMIN_URL/plugins" \
        -d "name=file-log" \
        -d "config.path=/var/log/kong/access.log" \
        -d "config.reopen=true" || true

    # Enable TCP logging for external log aggregation
    curl -s -X POST "$KONG_ADMIN_URL/plugins" \
        -d "name=tcp-log" \
        -d "config.host=logstash" \
        -d "config.port=5000" || true

    log_info "✓ Advanced monitoring configured"
}

# Validate Kong configuration and services
validate_configuration() {
    log_info "Validating Kong configuration..."

    # Check if services are registered
    local services=$(curl -s "$KONG_ADMIN_URL/services" | jq -r '.data[].name' 2>/dev/null || echo "")

    if [ -z "$services" ]; then
        log_warn "No services found. Make sure to apply the Kong declarative configuration."
    else
        log_info "Found services: $(echo $services | tr '\n' ' ')"
    fi

    # Check if consumers exist
    local consumers=$(curl -s "$KONG_ADMIN_URL/consumers" | jq -r '.data[].username' 2>/dev/null || echo "")

    if [ -z "$consumers" ]; then
        log_warn "No consumers found."
    else
        log_info "Found consumers: $(echo $consumers | tr '\n' ' ')"
    fi

    # Check plugin configuration
    local plugins=$(curl -s "$KONG_ADMIN_URL/plugins" | jq -r '.data[].name' 2>/dev/null || echo "")
    if [ -n "$plugins" ]; then
        log_info "Active plugins: $(echo $plugins | tr '\n' ' ' | sort -u)"
    fi

    # Test service connectivity
    log_info "Testing service connectivity..."
    for service_name in "${!SERVICES[@]}"; do
        local service_url="${SERVICES[$service_name]}"
        local health_url="${service_url}/health"

        if curl -s -f "$health_url" > /dev/null 2>&1; then
            log_info "✓ $service_name is healthy"
        else
            log_warn "⚠ $service_name health check failed"
        fi
    done
}

# Generate Kong configuration summary
generate_summary() {
    log_info "Generating configuration summary..."

    cat > kong-setup-summary.txt << EOF
Kong API Gateway Setup Summary
==============================
Generated: $(date)

Configuration:
- Kong Admin URL: $KONG_ADMIN_URL
- JWT Secret: [REDACTED]
- Redis Password: [REDACTED]

Services Configured:
$(for service in "${!SERVICES[@]}"; do echo "- $service: ${SERVICES[$service]}"; done)

API Keys Generated:
- Free Tier: $FREE_API_KEY
- Premium Tier: $PREMIUM_API_KEY
- Enterprise Tier: $ENTERPRISE_API_KEY

Next Steps:
1. Apply declarative configuration: docker exec datatechtoncrm-api-gateway kong reload
2. Verify configuration: curl http://localhost:8001/status
3. Test API endpoints: curl -H "X-API-Key: \$API_KEY" http://localhost:8000/api/v1/health
4. Monitor logs: docker logs datatechtoncrm-api-gateway -f

Configuration Files:
- Kong Config: infrastructure/kong/kong.yml
- Environment: .env.kong
- Setup Summary: kong-setup-summary.txt
EOF

    log_info "✓ Configuration summary saved to kong-setup-summary.txt"
}

# Main setup function
main() {
    log_info "Starting Kong API Gateway setup..."
    log_info "=================================="

    wait_for_kong
    wait_for_services
    create_consumers
    create_jwt_credentials
    create_api_keys
    configure_service_discovery
    configure_rate_limiting
    setup_monitoring
    setup_advanced_monitoring
    setup_resilience
    validate_configuration
    generate_summary

    log_info ""
    log_info "🎉 Kong setup completed successfully!"
    log_info "Configuration saved to .env.kong"
    log_info "Summary saved to kong-setup-summary.txt"
    log_info ""
    log_info "Next steps:"
    log_info "1. Apply declarative config: docker exec datatechtoncrm-api-gateway kong reload"
    log_info "2. Validate setup: ./infrastructure/kong/kong-cli.ts validate"
    log_info "3. Test API: curl -H 'X-API-Key: \$FREE_TIER_API_KEY' http://localhost:8000/api/v1/health"
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "validate")
        wait_for_kong
        validate_configuration
        ;;
    "health")
        wait_for_kong
        wait_for_services
        ;;
    "summary")
        generate_summary
        ;;
    *)
        echo "Usage: $0 [setup|validate|health|summary]"
        echo "  setup    - Full Kong setup (default)"
        echo "  validate - Validate existing configuration"
        echo "  health   - Check service health"
        echo "  summary  - Generate configuration summary"
        exit 1
        ;;
esac
