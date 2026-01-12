# DatatechtonCRM Rebranding Plan

## Overview

This document outlines the systematic approach to rebrand from "DatatechtonCRM" to
"DatatechtonCRM" across the entire codebase.

## Phase 1: Core Configuration Files

### Package.json Files

- [ ] `package.json` - Update name, description, author, repository
- [ ] `frontend/package.json` - Update name from "datatechtoncrm-frontend" to
      "datatechtoncrm-frontend"
- [ ] `services/*/package.json` - Update all service package names
- [ ] `services/shared/package.json` - Update shared library name

### Docker & Infrastructure

- [ ] `docker-compose.yml` - Update service names and container names
- [ ] `docker-compose.prod.yml` - Update production configuration
- [ ] `Dockerfile` files - Update labels and metadata
- [ ] `k8s/*.yaml` - Update Kubernetes deployment names and labels
- [ ] `infrastructure/grafana/dashboards/datatechtoncrm-overview.json` - Rename and
      update content

### Environment & Configuration

- [ ] `.env.example` files - Update database names and service references
- [ ] Database migration scripts - Update database names from "datatechtoncrm" to
      "datatechtoncrm"
- [ ] `infrastructure/postgres/init.sql` - Update database creation scripts

## Phase 2: Source Code Updates

### Frontend Updates

- [ ] `frontend/src/app/layout.tsx` - Update page titles and metadata
- [ ] `frontend/src/components/**/*.tsx` - Update component names and references
- [ ] `frontend/next.config.js` - Update configuration
- [ ] `frontend/public/manifest.json` - Update PWA manifest
- [ ] `frontend/src/types/*.ts` - Update type definitions

### Backend Service Updates

- [ ] `services/user-service/src/**/*.ts` - Update service references
- [ ] `services/newsletter-service/src/**/*.ts` - Update service references
- [ ] `services/crm-service/src/**/*.ts` - Update service references
- [ ] `services/analytics-service/src/**/*.ts` - Update service references
- [ ] `services/marketing-automation-service/src/**/*.ts` - Update service
      references
- [ ] `services/billing-service/src/**/*.ts` - Update service references
- [ ] `services/monitoring-service/src/**/*.ts` - Update service references
- [ ] `services/deliverability-service/src/**/*.ts` - Update service references

### Database Schema Updates

- [ ] Update database names in connection strings
- [ ] Update table prefixes if using "datatechtoncrm\_" prefix
- [ ] Update migration scripts with new naming
- [ ] Update seed data with new branding

## Phase 3: Documentation & Metadata

### Documentation Files

- [ ] `README.md` - Update project name, description, and branding
- [ ] `services/*/README.md` - Update service documentation
- [ ] API documentation - Update OpenAPI specs and descriptions
- [ ] `CHANGELOG.md` - Add rebranding entry

### Test Files

- [ ] `tests/**/*.test.ts` - Update test descriptions and mock data
- [ ] `services/*/tests/**/*.test.ts` - Update service-specific tests
- [ ] Test configuration files - Update test database names

### CI/CD Pipeline

- [ ] `.github/workflows/*.yml` - Update workflow names and descriptions
- [ ] Update deployment scripts and configurations
- [ ] Update monitoring and alerting configurations

## Phase 4: External References

### Repository & Git

- [ ] Update repository name on GitHub (if desired)
- [ ] Update repository description and topics
- [ ] Update README badges and links
- [ ] Consider updating git remote URL

### Domain & Branding

- [ ] Register datatechtoncrm.com domain (if available)
- [ ] Update any hardcoded URLs or domain references
- [ ] Update email templates and branding
- [ ] Update logo and favicon files

## Implementation Strategy

### Automated Approach

```bash
# 1. Global find and replace for common patterns
find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" | \
  xargs sed -i 's/DatatechtonCRM/DatatechtonCRM/g'

find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" | \
  xargs sed -i 's/datatechtoncrm/datatechtoncrm/g'

# 2. Update package names
find . -name "package.json" -exec sed -i 's/"datatechtoncrm-/"datatechtoncrm-/g' {} \;

# 3. Update database references
find . -type f -name "*.ts" -o -name "*.js" -o -name "*.sql" | \
  xargs sed -i 's/datatechtoncrm_db/datatechtoncrm_db/g'
```

### Manual Review Required

- Database connection strings and environment variables
- Docker service names and networking
- Kubernetes deployments and services
- External API configurations
- Monitoring dashboard configurations
- SSL certificates and domain configurations

## Verification Checklist

### Functional Testing

- [ ] All services start successfully with new names
- [ ] Database connections work with new database names
- [ ] Inter-service communication works with updated service names
- [ ] Frontend loads and displays new branding correctly
- [ ] API endpoints respond correctly
- [ ] Authentication and authorization still work

### Integration Testing

- [ ] Docker Compose stack starts successfully
- [ ] Kubernetes deployments work correctly
- [ ] CI/CD pipeline runs without errors
- [ ] Monitoring and logging capture new service names
- [ ] External integrations still function

### Documentation Verification

- [ ] All documentation reflects new branding
- [ ] API documentation is updated
- [ ] README files are accurate
- [ ] Installation instructions work with new names

## Rollback Plan

### Git Strategy

- Create a feature branch for rebranding: `feature/rebrand-to-datatechtoncrm`
- Commit changes in logical groups (config, frontend, backend, docs)
- Test thoroughly before merging to main
- Tag the commit before rebranding for easy rollback

### Database Backup

- Backup all databases before running migration scripts
- Test database migrations on development environment first
- Have rollback scripts ready for database changes

### Service Deployment

- Deploy services one at a time to identify issues early
- Keep old service names as aliases during transition period
- Monitor logs and metrics during deployment

## Timeline Estimate

- **Phase 1 (Config Files)**: 2-3 hours
- **Phase 2 (Source Code)**: 4-6 hours
- **Phase 3 (Documentation)**: 2-3 hours
- **Phase 4 (External References)**: 1-2 hours
- **Testing & Verification**: 3-4 hours
- **Total Estimated Time**: 12-18 hours

## Risk Assessment

### High Risk

- Database connection failures
- Service discovery issues in microservices
- External API integration breaks
- SSL certificate and domain issues

### Medium Risk

- Frontend routing and navigation issues
- Monitoring dashboard configuration
- CI/CD pipeline failures
- Docker networking problems

### Low Risk

- Documentation updates
- Test file updates
- Comment and string updates
- Cosmetic branding changes

## Success Criteria

- [ ] All services run successfully with new branding
- [ ] No broken functionality after rebranding
- [ ] All tests pass with updated names
- [ ] Documentation accurately reflects new branding
- [ ] External integrations continue to work
- [ ] Monitoring and logging capture new service names
- [ ] Performance remains unchanged
- [ ] Security configurations remain intact
