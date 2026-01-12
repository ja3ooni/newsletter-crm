#!/bin/bash

# Blue-Green Deployment Script for DatatechtonCRM Production
# This script automates the blue-green deployment process with health checks and rollback capabilities

set -euo pipefail

# Configuration
NAMESPACE="datatechtoncrm-production"
SERVICES=("user-service" "newsletter-service" "crm-service" "analytics-service" "content-service")
HEALTH_CHECK_TIMEOUT=300
ROLLBACK_TIMEOUT=600
KUBECTL_TIMEOUT=60

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Function to check if kubectl is available and configured
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi

    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl is not configured or cluster is not accessible"
        exit 1
    fi

    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Function to get current active environment
get_active_environment() {
    local active_env
    active_env=$(kubectl get configmap blue-green-config -n "$NAMESPACE" -o jsonpath='{.data.active-environment}' 2>/dev/null || echo "blue")
    echo "$active_env"
}

# Function to get inactive environment
get_inactive_environment() {
    local active_env="$1"
    if [ "$active_env" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Function to update service selector to point to new environment
update_service_selector() {
    local service_name="$1"
    local target_env="$2"

    log_info "Updating service $service_name to point to $target_env environment"

    kubectl patch service "$service_name" -n "$NAMESPACE" \
        -p "{\"spec\":{\"selector\":{\"version\":\"$target_env\"}}}" \
        --timeout="${KUBECTL_TIMEOUT}s"

    if [ $? -eq 0 ]; then
        log_success "Service $service_name updated to $target_env environment"
    else
        log_error "Failed to update service $service_name"
        return 1
    fi
}

# Function to scale deployment
scale_deployment() {
    local deployment_name="$1"
    local replicas="$2"

    log_info "Scaling deployment $deployment_name to $replicas replicas"

    kubectl scale deployment "$deployment_name" -n "$NAMESPACE" --replicas="$replicas" --timeout="${KUBECTL_TIMEOUT}s"

    if [ $? -eq 0 ]; then
        log_success "Deployment $deployment_name scaled to $replicas replicas"
    else
        log_error "Failed to scale deployment $deployment_name"
        return 1
    fi
}

# Function to wait for deployment to be ready
wait_for_deployment() {
    local deployment_name="$1"
    local timeout="$2"

    log_info "Waiting for deployment $deployment_name to be ready (timeout: ${timeout}s)"

    if kubectl wait --for=condition=available deployment/"$deployment_name" -n "$NAMESPACE" --timeout="${timeout}s"; then
        log_success "Deployment $deployment_name is ready"
        return 0
    else
        log_error "Deployment $deployment_name failed to become ready within ${timeout}s"
        return 1
    fi
}

# Function to perform health check
health_check() {
    local service_name="$1"
    local environment="$2"
    local max_attempts=10
    local attempt=1

    log_info "Performing health check for $service_name-$environment"

    while [ $attempt -le $max_attempts ]; do
        log_info "Health check attempt $attempt/$max_attempts for $service_name-$environment"

        # Get pod IP for direct health check
        local pod_ip
        pod_ip=$(kubectl get pods -n "$NAMESPACE" -l "app=$service_name,version=$environment" -o jsonpath='{.items[0].status.podIP}' 2>/dev/null)

        if [ -n "$pod_ip" ]; then
            # Perform health check using kubectl exec
            if kubectl exec -n "$NAMESPACE" deployment/"$service_name-$environment" -- wget --quiet --tries=1 --timeout=5 --spider "http://localhost:3001/health" 2>/dev/null; then
                log_success "Health check passed for $service_name-$environment"
                return 0
            fi
        fi

        log_warning "Health check failed for $service_name-$environment (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done

    log_error "Health check failed for $service_name-$environment after $max_attempts attempts"
    return 1
}

# Function to perform comprehensive health checks
comprehensive_health_check() {
    local environment="$1"
    local failed_services=()

    log_info "Performing comprehensive health checks for $environment environment"

    for service in "${SERVICES[@]}"; do
        if ! health_check "$service" "$environment"; then
            failed_services+=("$service")
        fi
    done

    if [ ${#failed_services[@]} -eq 0 ]; then
        log_success "All services passed health checks in $environment environment"
        return 0
    else
        log_error "Health checks failed for services: ${failed_services[*]}"
        return 1
    fi
}

# Function to update HPA target
update_hpa_target() {
    local service_name="$1"
    local target_env="$2"

    log_info "Updating HPA for $service_name to target $target_env environment"

    kubectl patch hpa "$service_name-hpa" -n "$NAMESPACE" \
        -p "{\"spec\":{\"scaleTargetRef\":{\"name\":\"$service_name-$target_env\"}}}" \
        --timeout="${KUBECTL_TIMEOUT}s"

    if [ $? -eq 0 ]; then
        log_success "HPA updated for $service_name to target $target_env environment"
    else
        log_error "Failed to update HPA for $service_name"
        return 1
    fi
}

# Function to update active environment in ConfigMap
update_active_environment() {
    local new_env="$1"

    log_info "Updating active environment to $new_env"

    kubectl patch configmap blue-green-config -n "$NAMESPACE" \
        -p "{\"data\":{\"active-environment\":\"$new_env\"}}" \
        --timeout="${KUBECTL_TIMEOUT}s"

    if [ $? -eq 0 ]; then
        log_success "Active environment updated to $new_env"
    else
        log_error "Failed to update active environment"
        return 1
    fi
}

# Function to deploy new version
deploy_new_version() {
    local new_image_tag="$1"
    local active_env
    local inactive_env

    active_env=$(get_active_environment)
    inactive_env=$(get_inactive_environment "$active_env")

    log_info "Starting blue-green deployment"
    log_info "Current active environment: $active_env"
    log_info "Deploying to inactive environment: $inactive_env"
    log_info "New image tag: $new_image_tag"

    # Step 1: Update inactive environment with new image
    log_info "Step 1: Updating inactive environment deployments"
    for service in "${SERVICES[@]}"; do
        log_info "Updating $service-$inactive_env with new image"
        kubectl set image deployment/"$service-$inactive_env" \
            "$service=datatechtoncrm/$service:$new_image_tag" \
            -n "$NAMESPACE" --timeout="${KUBECTL_TIMEOUT}s"

        if [ $? -ne 0 ]; then
            log_error "Failed to update image for $service-$inactive_env"
            return 1
        fi
    done

    # Step 2: Scale up inactive environment
    log_info "Step 2: Scaling up inactive environment"
    for service in "${SERVICES[@]}"; do
        # Get current replica count from active environment
        local current_replicas
        current_replicas=$(kubectl get deployment "$service-$active_env" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')

        scale_deployment "$service-$inactive_env" "$current_replicas"
        if [ $? -ne 0 ]; then
            log_error "Failed to scale $service-$inactive_env"
            return 1
        fi
    done

    # Step 3: Wait for inactive environment to be ready
    log_info "Step 3: Waiting for inactive environment to be ready"
    for service in "${SERVICES[@]}"; do
        wait_for_deployment "$service-$inactive_env" "$HEALTH_CHECK_TIMEOUT"
        if [ $? -ne 0 ]; then
            log_error "Deployment $service-$inactive_env failed to become ready"
            return 1
        fi
    done

    # Step 4: Perform health checks on inactive environment
    log_info "Step 4: Performing health checks on inactive environment"
    if ! comprehensive_health_check "$inactive_env"; then
        log_error "Health checks failed for inactive environment"
        return 1
    fi

    # Step 5: Switch traffic to inactive environment
    log_info "Step 5: Switching traffic to inactive environment"
    for service in "${SERVICES[@]}"; do
        update_service_selector "$service" "$inactive_env"
        if [ $? -ne 0 ]; then
            log_error "Failed to switch traffic for $service"
            return 1
        fi

        # Update HPA target
        update_hpa_target "$service" "$inactive_env"
        if [ $? -ne 0 ]; then
            log_error "Failed to update HPA for $service"
            return 1
        fi
    done

    # Step 6: Wait and verify traffic switch
    log_info "Step 6: Verifying traffic switch (waiting 30 seconds)"
    sleep 30

    if ! comprehensive_health_check "$inactive_env"; then
        log_error "Health checks failed after traffic switch"
        log_warning "Initiating rollback..."
        rollback_deployment "$active_env"
        return 1
    fi

    # Step 7: Update active environment marker
    update_active_environment "$inactive_env"

    # Step 8: Scale down old environment
    log_info "Step 8: Scaling down old environment"
    for service in "${SERVICES[@]}"; do
        scale_deployment "$service-$active_env" 0
    done

    log_success "Blue-green deployment completed successfully!"
    log_success "New active environment: $inactive_env"
    log_success "Old environment ($active_env) scaled down"

    return 0
}

# Function to rollback deployment
rollback_deployment() {
    local rollback_env="$1"

    log_warning "Starting rollback to $rollback_env environment"

    # Switch traffic back
    for service in "${SERVICES[@]}"; do
        log_info "Rolling back traffic for $service to $rollback_env"
        update_service_selector "$service" "$rollback_env"
        update_hpa_target "$service" "$rollback_env"
    done

    # Update active environment marker
    update_active_environment "$rollback_env"

    log_success "Rollback completed to $rollback_env environment"
}

# Function to show current status
show_status() {
    local active_env
    active_env=$(get_active_environment)

    echo "=== Blue-Green Deployment Status ==="
    echo "Active Environment: $active_env"
    echo "Namespace: $NAMESPACE"
    echo ""

    echo "=== Service Status ==="
    for service in "${SERVICES[@]}"; do
        echo "Service: $service"

        # Blue environment
        local blue_replicas
        blue_replicas=$(kubectl get deployment "$service-blue" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        local blue_ready
        blue_ready=$(kubectl get deployment "$service-blue" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        echo "  Blue:  $blue_ready/$blue_replicas ready"

        # Green environment
        local green_replicas
        green_replicas=$(kubectl get deployment "$service-green" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        local green_ready
        green_ready=$(kubectl get deployment "$service-green" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        echo "  Green: $green_ready/$green_replicas ready"

        # Service selector
        local service_version
        service_version=$(kubectl get service "$service" -n "$NAMESPACE" -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "unknown")
        echo "  Traffic: -> $service_version"
        echo ""
    done
}

# Function to show help
show_help() {
    cat << EOF
Blue-Green Deployment Script for DatatechtonCRM Production

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    deploy <image-tag>    Deploy new version using blue-green strategy
    rollback <env>        Rollback to specified environment (blue|green)
    status               Show current deployment status
    health-check <env>   Perform health check on specified environment
    help                 Show this help message

Examples:
    $0 deploy v1.2.3
    $0 rollback blue
    $0 status
    $0 health-check green

Environment Variables:
    NAMESPACE            Kubernetes namespace (default: datatechtoncrm-production)
    HEALTH_CHECK_TIMEOUT Health check timeout in seconds (default: 300)
    ROLLBACK_TIMEOUT     Rollback timeout in seconds (default: 600)

EOF
}

# Main function
main() {
    local command="${1:-help}"

    case "$command" in
        "deploy")
            if [ $# -lt 2 ]; then
                log_error "Image tag is required for deploy command"
                show_help
                exit 1
            fi
            check_prerequisites
            deploy_new_version "$2"
            ;;
        "rollback")
            if [ $# -lt 2 ]; then
                log_error "Environment is required for rollback command"
                show_help
                exit 1
            fi
            check_prerequisites
            rollback_deployment "$2"
            ;;
        "status")
            check_prerequisites
            show_status
            ;;
        "health-check")
            if [ $# -lt 2 ]; then
                log_error "Environment is required for health-check command"
                show_help
                exit 1
            fi
            check_prerequisites
            comprehensive_health_check "$2"
            ;;
        "help"|"-h"|"--help")
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
