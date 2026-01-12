# Production Deployment Guide

This guide provides comprehensive instructions for deploying and managing the
DatatechtonCRM platform in production using Kubernetes with advanced features including
blue-green deployments, auto-scaling, disaster recovery, and comprehensive
monitoring.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Production Deployment](#production-deployment)
4. [Blue-Green Deployment](#blue-green-deployment)
5. [Monitoring and Alerting](#monitoring-and-alerting)
6. [Disaster Recovery](#disaster-recovery)
7. [Capacity Planning](#capacity-planning)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance Procedures](#maintenance-procedures)

## Prerequisites

### Required Tools

- `kubectl` (v1.28+)
- `helm` (v3.12+)
- `docker` (v24.0+)
- `aws-cli` (v2.0+) or equivalent cloud CLI
- `jq` for JSON processing
- `bc` for calculations

### Infrastructure Requirements

- Kubernetes cluster (v1.28+)
- Minimum 3 worker nodes
- Node specifications:
  - CPU: 8 cores per node
  - Memory: 32GB per node
  - Storage: 100GB SSD per node
- Load balancer (AWS ALB, GCP Load Balancer, etc.)
- DNS management
- SSL certificates

### Access Requirements

- Cluster admin access
- Container registry access
- Cloud provider permissions for:
  - Load balancers
  - Storage provisioning
  - DNS management
  - Backup storage (S3, GCS, etc.)

## Infrastructure Setup

### 1. Cluster Preparation

```bash
# Verify cluster access
kubectl cluster-info

# Create production namespace with resource quotas
kubectl apply -f k8s/production/namespace-production.yaml

# Verify namespace creation
kubectl get namespace datatechtoncrm-production
kubectl describe namespace datatechtoncrm-production
```

### 2. Storage Classes

```bash
# Create high-performance storage class for databases
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
EOF
```

### 3. Secrets Management

```bash
# Create secrets for production
kubectl create secret generic datatechtoncrm-secrets \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -base64 32)" \
  --from-literal=REDIS_PASSWORD="$(openssl rand -base64 32)" \
  --from-literal=RABBITMQ_PASSWORD="$(openssl rand -base64 32)" \
  --from-literal=JWT_SECRET="$(openssl rand -base64 64)" \
  --from-literal=ADMIN_TOKEN="$(openssl rand -base64 32)" \
  --from-literal=GRAFANA_PASSWORD="$(openssl rand -base64 16)" \
  --from-literal=SMTP_USERNAME="your-smtp-username" \
  --from-literal=SMTP_PASSWORD="your-smtp-password" \
  --from-literal=SLACK_BOT_TOKEN="your-slack-token" \
  --from-literal=PAGERDUTY_TOKEN="your-pagerduty-token" \
  --from-literal=BACKUP_WEBHOOK_URL="your-backup-webhook" \
  --from-literal=UPTIME_WEBHOOK_URL="your-uptime-webhook" \
  --from-literal=LOG_ALERT_WEBHOOK_URL="your-log-alert-webhook" \
  --from-literal=LOG_ANALYSIS_WEBHOOK_URL="your-log-analysis-webhook" \
  --from-literal=CAPACITY_WEBHOOK_URL="your-capacity-webhook" \
  --from-literal=PERFORMANCE_WEBHOOK_URL="your-performance-webhook" \
  -n datatechtoncrm-production

# Create Elasticsearch secrets
kubectl create secret generic elasticsearch-secrets \
  --from-literal=username="elastic" \
  --from-literal=password="$(openssl rand -base64 32)" \
  -n datatechtoncrm-production

# Create AlertManager secrets
kubectl create secret generic alertmanager-secrets \
  --from-literal=smtp_password="your-smtp-password" \
  --from-literal=slack_webhook="your-slack-webhook-url" \
  --from-literal=pagerduty_key="your-pagerduty-integration-key" \
  -n datatechtoncrm-production
```

### 4. Service Accounts and RBAC

```bash
# Create service accounts with proper RBAC
kubectl apply -f k8s/rbac.yaml
```

## Production Deployment

### 1. Database Deployment

```bash
# Deploy PostgreSQL with high availability
kubectl apply -f k8s/postgres.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n datatechtoncrm-production --timeout=300s

# Deploy Redis cluster
kubectl apply -f k8s/redis.yaml

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l app=redis -n datatechtoncrm-production --timeout=300s
```

### 2. Message Queue Deployment

```bash
# Deploy RabbitMQ cluster
kubectl apply -f k8s/rabbitmq.yaml

# Wait for RabbitMQ to be ready
kubectl wait --for=condition=ready pod -l app=rabbitmq -n datatechtoncrm-production --timeout=300s
```

### 3. Monitoring Infrastructure

```bash
# Deploy monitoring stack
kubectl apply -f k8s/production/monitoring-production.yaml

# Wait for Prometheus to be ready
kubectl wait --for=condition=available deployment/prometheus-production -n datatechtoncrm-production --timeout=600s

# Deploy log aggregation
kubectl apply -f k8s/production/log-aggregation.yaml

# Wait for Elasticsearch cluster to be ready
kubectl wait --for=condition=ready pod -l app=elasticsearch -n datatechtoncrm-production --timeout=900s
```

### 4. Application Services Deployment

```bash
# Deploy blue-green infrastructure
kubectl apply -f k8s/production/blue-green-deployment.yaml

# Deploy auto-scaling configuration
kubectl apply -f k8s/production/auto-scaling.yaml

# Deploy health checks
kubectl apply -f k8s/production/health-checks.yaml

# Deploy capacity planning
kubectl apply -f k8s/production/capacity-planning.yaml

# Deploy incident response automation
kubectl apply -f k8s/production/incident-response.yaml
```

### 5. Ingress and Load Balancer

```bash
# Deploy ingress controller (if not already present)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer

# Deploy application ingress
kubectl apply -f k8s/ingress.yaml
```

## Blue-Green Deployment

### Using the Deployment Script

```bash
# Make the script executable (Linux/Mac)
chmod +x scripts/blue-green-deployment.sh

# Check current deployment status
./scripts/blue-green-deployment.sh status

# Deploy new version
./scripts/blue-green-deployment.sh deploy v1.2.3

# Rollback if needed
./scripts/blue-green-deployment.sh rollback blue

# Perform health check
./scripts/blue-green-deployment.sh health-check green
```

### Manual Blue-Green Deployment

```bash
# 1. Check current active environment
ACTIVE_ENV=$(kubectl get configmap blue-green-config -n datatechtoncrm-production -o jsonpath='{.data.active-environment}')
echo "Current active environment: $ACTIVE_ENV"

# 2. Determine inactive environment
if [ "$ACTIVE_ENV" = "blue" ]; then
  INACTIVE_ENV="green"
else
  INACTIVE_ENV="blue"
fi

# 3. Update inactive environment with new image
kubectl set image deployment/user-service-$INACTIVE_ENV \
  user-service=datatechtoncrm/user-service:v1.2.3 \
  -n datatechtoncrm-production

# 4. Scale up inactive environment
kubectl scale deployment user-service-$INACTIVE_ENV --replicas=3 -n datatechtoncrm-production

# 5. Wait for deployment to be ready
kubectl rollout status deployment/user-service-$INACTIVE_ENV -n datatechtoncrm-production

# 6. Switch traffic to inactive environment
kubectl patch service user-service -n datatechtoncrm-production \
  -p '{"spec":{"selector":{"version":"'$INACTIVE_ENV'"}}}'

# 7. Update active environment marker
kubectl patch configmap blue-green-config -n datatechtoncrm-production \
  -p '{"data":{"active-environment":"'$INACTIVE_ENV'"}}'

# 8. Scale down old environment
kubectl scale deployment user-service-$ACTIVE_ENV --replicas=0 -n datatechtoncrm-production
```

## Monitoring and Alerting

### Accessing Monitoring Dashboards

```bash
# Port forward to Grafana
kubectl port-forward service/grafana-service 3000:3000 -n datatechtoncrm-production

# Access Grafana at http://localhost:3000
# Default credentials: admin / (check secret for password)

# Port forward to Prometheus
kubectl port-forward service/prometheus-service 9090:9090 -n datatechtoncrm-production

# Access Prometheus at http://localhost:9090

# Port forward to AlertManager
kubectl port-forward service/alertmanager 9093:9093 -n datatechtoncrm-production

# Access AlertManager at http://localhost:9093
```

### Key Metrics to Monitor

1. **Application Metrics**
   - Response time (p50, p95, p99)
   - Error rate
   - Throughput (requests per second)
   - Active users

2. **Infrastructure Metrics**
   - CPU utilization
   - Memory usage
   - Disk I/O
   - Network traffic

3. **Business Metrics**
   - Newsletter generation rate
   - Email delivery success rate
   - User registration rate
   - Subscription conversions

### Alert Configuration

Alerts are automatically configured through the monitoring stack. Key alerts
include:

- **Critical Alerts**: Service down, high error rate, database issues
- **Warning Alerts**: High resource usage, performance degradation
- **Business Alerts**: Newsletter failures, high unsubscribe rate

## Disaster Recovery

### Backup Procedures

Automated backups are configured through CronJobs:

```bash
# Check backup job status
kubectl get cronjobs -n datatechtoncrm-production

# Manual backup trigger
kubectl create job --from=cronjob/postgres-backup postgres-backup-manual -n datatechtoncrm-production

# Verify backup completion
kubectl logs job/postgres-backup-manual -n datatechtoncrm-production
```

### Recovery Procedures

#### Database Recovery

```bash
# 1. Stop application services
kubectl scale deployment user-service-blue --replicas=0 -n datatechtoncrm-production
kubectl scale deployment newsletter-service-blue --replicas=0 -n datatechtoncrm-production

# 2. Restore PostgreSQL from backup
kubectl exec -it statefulset/postgres -n datatechtoncrm-production -- bash
# Inside the pod:
# pg_restore -h localhost -U datatechtoncrm -d datatechtoncrm_production /path/to/backup.dump

# 3. Restart application services
kubectl scale deployment user-service-blue --replicas=3 -n datatechtoncrm-production
kubectl scale deployment newsletter-service-blue --replicas=3 -n datatechtoncrm-production
```

#### Full Cluster Recovery

```bash
# 1. Restore Kubernetes state
aws s3 cp s3://datatechtoncrm-production-backups/kubernetes/k8s-state-latest.tar.gz .
tar -xzf k8s-state-latest.tar.gz

# 2. Apply configurations
kubectl apply -f k8s-backup/

# 3. Restore data volumes
# Follow cloud provider specific procedures for volume restoration

# 4. Verify services
kubectl get pods -n datatechtoncrm-production
./scripts/blue-green-deployment.sh status
```

## Capacity Planning

### Monitoring Resource Usage

```bash
# Check current resource usage
kubectl top nodes
kubectl top pods -n datatechtoncrm-production

# Check HPA status
kubectl get hpa -n datatechtoncrm-production

# View capacity planning metrics
kubectl logs deployment/capacity-planner -n datatechtoncrm-production
```

### Scaling Recommendations

The capacity planning system provides automatic recommendations:

1. **Horizontal Scaling**: Based on CPU/memory thresholds
2. **Vertical Scaling**: For database and cache layers
3. **Cluster Scaling**: Node addition recommendations

### Manual Scaling

```bash
# Scale specific service
kubectl scale deployment user-service-blue --replicas=5 -n datatechtoncrm-production

# Update HPA limits
kubectl patch hpa user-service-hpa -n datatechtoncrm-production \
  -p '{"spec":{"maxReplicas":15}}'

# Add cluster nodes (cloud provider specific)
# AWS EKS example:
aws eks update-nodegroup-config \
  --cluster-name datatechtoncrm-production \
  --nodegroup-name workers \
  --scaling-config minSize=3,maxSize=10,desiredSize=5
```

## Troubleshooting

### Common Issues

#### Service Not Starting

```bash
# Check pod status
kubectl get pods -n datatechtoncrm-production -l app=user-service

# Check pod logs
kubectl logs deployment/user-service-blue -n datatechtoncrm-production --tail=100

# Check events
kubectl get events -n datatechtoncrm-production --sort-by='.lastTimestamp'

# Check resource constraints
kubectl describe pod <pod-name> -n datatechtoncrm-production
```

#### High Error Rate

```bash
# Check application logs for errors
kubectl logs deployment/user-service-blue -n datatechtoncrm-production | grep ERROR

# Check database connectivity
kubectl exec deployment/user-service-blue -n datatechtoncrm-production -- nc -zv postgres-service 5432

# Check recent deployments
kubectl rollout history deployment/user-service-blue -n datatechtoncrm-production

# Rollback if needed
kubectl rollout undo deployment/user-service-blue -n datatechtoncrm-production
```

#### Database Issues

```bash
# Check PostgreSQL status
kubectl exec statefulset/postgres -n datatechtoncrm-production -- pg_isready

# Check database connections
kubectl exec statefulset/postgres -n datatechtoncrm-production -- \
  psql -U datatechtoncrm -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
kubectl exec statefulset/postgres -n datatechtoncrm-production -- \
  psql -U datatechtoncrm -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

### Performance Issues

```bash
# Check resource usage
kubectl top pods -n datatechtoncrm-production --sort-by=cpu
kubectl top pods -n datatechtoncrm-production --sort-by=memory

# Check HPA status
kubectl describe hpa -n datatechtoncrm-production

# Check node resources
kubectl describe nodes
```

## Maintenance Procedures

### Regular Maintenance Tasks

#### Weekly Tasks

```bash
# 1. Check backup integrity
kubectl logs cronjob/backup-verification -n datatechtoncrm-production

# 2. Review capacity metrics
kubectl logs deployment/capacity-planner -n datatechtoncrm-production

# 3. Check certificate expiration
kubectl get certificates -n datatechtoncrm-production

# 4. Review security alerts
kubectl logs deployment/incident-responder -n datatechtoncrm-production
```

#### Monthly Tasks

```bash
# 1. Update container images
# Use blue-green deployment for zero-downtime updates

# 2. Review and rotate secrets
kubectl create secret generic datatechtoncrm-secrets-new \
  --from-literal=JWT_SECRET="$(openssl rand -base64 64)" \
  -n datatechtoncrm-production

# 3. Database maintenance
kubectl exec statefulset/postgres -n datatechtoncrm-production -- \
  psql -U datatechtoncrm -c "VACUUM ANALYZE;"

# 4. Clean up old resources
kubectl delete pods --field-selector=status.phase=Succeeded -n datatechtoncrm-production
```

#### Quarterly Tasks

```bash
# 1. Disaster recovery testing
# Perform full backup and restore test in staging environment

# 2. Security audit
# Review RBAC permissions, network policies, and secrets

# 3. Performance benchmarking
kubectl logs cronjob/performance-benchmark -n datatechtoncrm-production

# 4. Capacity planning review
# Analyze growth trends and plan infrastructure scaling
```

### Emergency Procedures

#### Complete Service Outage

```bash
# 1. Check cluster status
kubectl get nodes
kubectl get pods --all-namespaces

# 2. Check ingress controller
kubectl get pods -n ingress-nginx

# 3. Restart critical services
kubectl rollout restart deployment/user-service-blue -n datatechtoncrm-production
kubectl rollout restart deployment/newsletter-service-blue -n datatechtoncrm-production

# 4. Check external dependencies
# Verify database, Redis, and external API connectivity
```

#### Data Corruption

```bash
# 1. Immediately stop write operations
kubectl scale deployment --all --replicas=0 -n datatechtoncrm-production

# 2. Assess damage
kubectl exec statefulset/postgres -n datatechtoncrm-production -- \
  psql -U datatechtoncrm -c "SELECT pg_database_size('datatechtoncrm_production');"

# 3. Restore from backup
# Follow disaster recovery procedures

# 4. Verify data integrity
# Run application-specific data validation
```

## Security Considerations

### Network Security

- All inter-service communication uses TLS
- Network policies restrict pod-to-pod communication
- Ingress controller terminates SSL/TLS

### Secret Management

- Secrets are encrypted at rest
- Regular secret rotation procedures
- Least privilege access principles

### Container Security

- Images scanned for vulnerabilities
- Non-root containers
- Read-only root filesystems where possible
- Security contexts with dropped capabilities

### Monitoring and Auditing

- All API calls are logged
- Security events trigger alerts
- Regular security scans and assessments

## Performance Optimization

### Database Optimization

```bash
# Monitor slow queries
kubectl exec statefulset/postgres -n datatechtoncrm-production -- \
  psql -U datatechtoncrm -c "SELECT * FROM pg_stat_statements WHERE mean_time > 1000 ORDER BY mean_time DESC LIMIT 10;"

# Connection pooling optimization
# Configure PgBouncer for connection pooling

# Index optimization
# Regular ANALYZE and index maintenance
```

### Caching Strategy

- Redis for session storage and caching
- CDN for static assets
- Application-level caching for frequently accessed data

### Auto-scaling Configuration

- CPU-based scaling for compute-intensive services
- Memory-based scaling for data-intensive services
- Custom metrics for business logic scaling

This production deployment guide provides comprehensive instructions for
deploying, monitoring, and maintaining the DatatechtonCRM platform in a production
Kubernetes environment with enterprise-grade reliability, security, and
performance.
