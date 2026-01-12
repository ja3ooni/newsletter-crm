# Newsletter CRM Documentation

Welcome to the Newsletter CRM documentation. This directory contains comprehensive guides, references, and planning documents for the platform.

## Documentation Structure

### Core Documentation
- [api.md](api.md) - Complete API reference and endpoints
- [user-guide.md](user-guide.md) - End-user documentation and tutorials
- [production-deployment-guide.md](production-deployment-guide.md) - Production deployment instructions

### Development (`development/`)
Essential guides for developers working on the platform:
- [DEVELOPMENT.md](development/DEVELOPMENT.md) - Detailed development environment setup
- [CONTRIBUTING.md](development/CONTRIBUTING.md) - Contribution guidelines and workflow
- [DEVELOPER_TOOLS_REVIEW.md](development/DEVELOPER_TOOLS_REVIEW.md) - Available developer tools overview
- [DEVELOPER_TOOLS_ACTION_PLAN.md](development/DEVELOPER_TOOLS_ACTION_PLAN.md) - Developer tooling improvements roadmap
- [quick-reference.md](development/quick-reference.md) - Quick reference for common tasks
- [setup-guide.md](development/setup-guide.md) - Initial project setup
- [developer-experience.md](development/developer-experience.md) - DX improvements and best practices

### Deployment & Infrastructure (`deployment/`)
Infrastructure and deployment architecture documentation:
- [INFRASTRUCTURE.md](deployment/INFRASTRUCTURE.md) - Complete infrastructure guide including Docker, Kubernetes, monitoring, and scaling

### CI/CD (`cicd/`)
Continuous Integration and Deployment documentation:
- [CI_CD_ISSUES_SUMMARY.md](cicd/CI_CD_ISSUES_SUMMARY.md) - Known CI/CD issues and their resolutions
- [GITHUB_ACTIONS_FIXES.md](cicd/GITHUB_ACTIONS_FIXES.md) - GitHub Actions troubleshooting guide
- [GITHUB_SECRETS_SETUP.md](cicd/GITHUB_SECRETS_SETUP.md) - Setting up GitHub secrets for CI/CD
- [DOCKER_NPM_FIXES.md](cicd/DOCKER_NPM_FIXES.md) - Docker and NPM configuration fixes

### Accessibility (`accessibility/`)
WCAG compliance and accessibility audit documentation:
- [ACCESSIBILITY_AUDIT.md](accessibility/ACCESSIBILITY_AUDIT.md) - General accessibility audit
- [ACCESSIBILITY_AUDIT_BillingPage.md](accessibility/ACCESSIBILITY_AUDIT_BillingPage.md) - Billing page accessibility review
- [ACCESSIBILITY_AUDIT_PromoCodeManager.md](accessibility/ACCESSIBILITY_AUDIT_PromoCodeManager.md) - Promo code manager accessibility
- [ACCESSIBILITY_AUDIT_SubscriptionOverview.md](accessibility/ACCESSIBILITY_AUDIT_SubscriptionOverview.md) - Subscription overview accessibility
- [ACCESSIBILITY_AUDIT_UsageTracking.md](accessibility/ACCESSIBILITY_AUDIT_UsageTracking.md) - Usage tracking accessibility
- [ACCESSIBILITY_IMPLEMENTATION_SUMMARY.md](accessibility/ACCESSIBILITY_IMPLEMENTATION_SUMMARY.md) - Implementation summary and status

### Security (`security/`)
Security best practices and recommendations:
- [SECURITY_RECOMMENDATIONS.md](security/SECURITY_RECOMMENDATIONS.md) - Security best practices, vulnerability management, and compliance

### Planning & Roadmap (`planning/`)
Strategic planning and feature roadmaps:
- [IMMEDIATE_ACTION_PLAN.md](planning/IMMEDIATE_ACTION_PLAN.md) - Short-term priorities and action items
- [OPTIMIZATION_AND_FEATURES.md](planning/OPTIMIZATION_AND_FEATURES.md) - Performance optimization plans
- [REBRANDING_PLAN.md](planning/REBRANDING_PLAN.md) - Brand refresh and rebranding roadmap

### Issue Tracking (`issues/`)
Documented issues and their resolution plans:
- [01-critical-debug-tools-fix.md](issues/01-critical-debug-tools-fix.md) - Critical debug tools fixes
- [02-cross-platform-compatibility.md](issues/02-cross-platform-compatibility.md) - Cross-platform compatibility improvements
- [03-error-handling-improvements.md](issues/03-error-handling-improvements.md) - Enhanced error handling

### API Documentation (`api/`)
Detailed API documentation and integration guides:
- [integration-guide.md](api/integration-guide.md) - API integration guide
- [sdk-documentation.md](api/sdk-documentation.md) - SDK documentation

## Quick Navigation

### Getting Started
1. Start with [setup-guide.md](development/setup-guide.md) for initial setup
2. Review [DEVELOPMENT.md](development/DEVELOPMENT.md) for development workflow
3. Check [CONTRIBUTING.md](development/CONTRIBUTING.md) before making changes

### For Developers
- Common tasks: [quick-reference.md](development/quick-reference.md)
- API reference: [api.md](api.md)
- Troubleshooting: See individual section READMEs

### For DevOps
- Infrastructure: [INFRASTRUCTURE.md](deployment/INFRASTRUCTURE.md)
- CI/CD setup: [cicd/](cicd/)
- Production deployment: [production-deployment-guide.md](production-deployment-guide.md)

### For Product/Design
- User documentation: [user-guide.md](user-guide.md)
- Accessibility: [accessibility/](accessibility/)
- Planning docs: [planning/](planning/)

## Contributing to Documentation

When adding new documentation:
1. Place files in the appropriate subdirectory
2. Update this README.md with the new document
3. Update the main [README.md](../README.md) if it's a major addition
4. Use clear, descriptive filenames
5. Include a brief description of the document's purpose

## Documentation Standards

- Use Markdown format (.md)
- Include a clear title and introduction
- Use proper heading hierarchy (H1 > H2 > H3)
- Add code examples where applicable
- Keep documents focused and concise
- Update dates when making significant changes
