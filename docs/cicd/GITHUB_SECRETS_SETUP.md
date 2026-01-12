# GitHub Secrets Setup Guide

This document lists all the secrets that need to be configured in your GitHub repository for the CI/CD workflows to work properly.

## Required Secrets

### Security Scanning Secrets

1. **SNYK_TOKEN**
   - **Purpose**: Snyk security vulnerability scanning
   - **How to get**: Sign up at https://snyk.io and get your API token from Account Settings
   - **Required for**: Security scans and dependency vulnerability checks

2. **SEMGREP_APP_TOKEN**
   - **Purpose**: Semgrep static analysis security scanning
   - **How to get**: Sign up at https://semgrep.dev and get your app token
   - **Required for**: Static application security testing (SAST)

### AWS Deployment Secrets (Optional - only if deploying to AWS)

3. **AWS_ACCESS_KEY_ID**
   - **Purpose**: AWS authentication for EKS deployment
   - **How to get**: Create IAM user with EKS permissions in AWS Console
   - **Required for**: Staging and production deployments

4. **AWS_SECRET_ACCESS_KEY**
   - **Purpose**: AWS authentication for EKS deployment
   - **How to get**: Pair with AWS_ACCESS_KEY_ID from IAM user
   - **Required for**: Staging and production deployments

5. **AWS_REGION**
   - **Purpose**: AWS region for EKS clusters
   - **Example value**: `us-east-1` or your preferred region
   - **Required for**: Staging and production deployments

6. **EKS_CLUSTER_NAME_STAGING**
   - **Purpose**: Name of your staging EKS cluster
   - **Example value**: `datatechtoncrm-staging`
   - **Required for**: Staging deployments

7. **EKS_CLUSTER_NAME_PROD**
   - **Purpose**: Name of your production EKS cluster
   - **Example value**: `datatechtoncrm-production`
   - **Required for**: Production deployments

### Notification Secrets (Optional)

8. **SLACK_WEBHOOK**
   - **Purpose**: Slack notifications for deployment status
   - **How to get**: Create a Slack webhook in your workspace
   - **Required for**: Deployment notifications

## Automatic Secrets (Provided by GitHub)

These secrets are automatically available and don't need to be configured:

- **GITHUB_TOKEN**: Automatically provided by GitHub Actions for repository access

## How to Add Secrets

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add the secret name and value
6. Click **Add secret**

## Workflow Behavior Without Secrets

The workflows are designed to handle missing secrets gracefully:

- **Missing SNYK_TOKEN**: Snyk scans will be skipped with a warning
- **Missing SEMGREP_APP_TOKEN**: Semgrep scans will be skipped with a warning
- **Missing AWS secrets**: Deployment jobs will be skipped
- **Missing SLACK_WEBHOOK**: Notifications will be skipped

## Testing Without All Secrets

You can test the basic CI/CD pipeline with just the core functionality:

1. **Minimum setup**: No additional secrets needed for basic linting, testing, and Docker builds
2. **With security scanning**: Add SNYK_TOKEN and SEMGREP_APP_TOKEN
3. **Full deployment**: Add all AWS secrets for complete pipeline

## Security Best Practices

1. **Rotate secrets regularly**: Update tokens and keys periodically
2. **Use least privilege**: AWS IAM users should have minimal required permissions
3. **Monitor usage**: Check secret usage in workflow logs
4. **Environment separation**: Use different secrets for staging and production

## Troubleshooting

### Common Issues

1. **Invalid SNYK_TOKEN**: Check token format and permissions
2. **AWS authentication failed**: Verify IAM user permissions and region
3. **EKS cluster not found**: Ensure cluster names match exactly
4. **Slack webhook failed**: Test webhook URL in Slack settings

### Testing Secrets

You can test individual secrets by running specific workflow jobs:

```bash
# Test security scanning
gh workflow run security-scan.yml

# Test full CI/CD (requires all secrets)
gh workflow run ci-cd.yml
```

## Next Steps

1. Add the minimum required secrets (SNYK_TOKEN, SEMGREP_APP_TOKEN)
2. Test the workflows with basic functionality
3. Gradually add deployment secrets as needed
4. Monitor workflow runs and adjust as necessary