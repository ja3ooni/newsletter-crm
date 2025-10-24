# AiLert Security Components

This directory contains comprehensive security components for the AiLert
platform, implementing enterprise-grade security features including secret
management, encryption, key rotation, secure service communication, and security
middleware.

## Components Overview

### 1. SecretManager

Manages secrets across multiple providers (AWS Secrets Manager, HashiCorp Vault,
Local).

**Features:**

- Multi-provider support (AWS, HashiCorp Vault, Local)
- Encrypted storage for local provider
- Metadata support
- Automatic encryption/decryption
- Secret rotation capabilities

**Usage:**

```typescript
import { createSecretManager } from './SecretManager';

const secretManager = createSecretManager({
  provider: 'aws', // or 'hashicorp' or 'local'
  aws: {
    region: 'us-east-1',
  },
});

// Store a secret
await secretManager.storeSecret('database-password', 'secure-password', {
  description: 'Main database password',
  environment: 'production',
});

// Retrieve a secret
const secret = await secretManager.getSecret('database-password');
console.log(secret.value); // 'secure-password'

// Rotate a secret
await secretManager.rotateSecret('database-password');
```

### 2. EncryptionService

Provides field-level and data encryption with multiple provider support.

**Features:**

- Multiple encryption providers (AWS KMS, Local AES-256-GCM, HashiCorp Vault)
- Field-level encryption for objects
- Data encryption key generation
- Secure key management

**Usage:**

```typescript
import { createEncryptionService } from './EncryptionService';

const encryptionService = createEncryptionService({
  provider: 'local', // or 'aws-kms' or 'vault'
});

// Encrypt sensitive data
const encrypted = await encryptionService.encrypt('sensitive-data');

// Decrypt data
const decrypted = await encryptionService.decrypt(encrypted);

// Field-level encryption
const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  ssn: '123-45-6789',
};

const encryptedUser = await encryptionService.encryptFields(userData, {
  fields: ['email', 'ssn'],
});

const decryptedUser = await encryptionService.decryptFields(encryptedUser, {
  fields: ['email', 'ssn'],
});
```

### 3. KeyRotationService

Automated key and secret rotation with configurable strategies.

**Features:**

- Scheduled automatic rotation
- Multiple rotation strategies (immediate, gradual, blue-green)
- Custom rotation handlers
- Notification support
- Age-based rotation triggers

**Usage:**

```typescript
import { KeyRotationService } from './KeyRotationService';

const rotationService = new KeyRotationService({
  enabled: true,
  schedule: '0 2 * * 0', // Weekly at 2 AM on Sunday
  secrets: [
    {
      name: 'database-password',
      type: 'database',
      rotationStrategy: 'gradual',
      maxAge: 90, // 90 days
    },
  ],
  notifications: {
    webhook: 'https://alerts.example.com/webhook',
  },
});

// Start the rotation service
rotationService.start();

// Manual rotation
const result = await rotationService.rotateSecret('database-password');
```

### 4. SecureServiceCommunication

Secure communication between microservices with encryption and authentication.

**Features:**

- JWT and HMAC authentication
- Request/response encryption
- Circuit breaker pattern
- Retry mechanisms
- Request signing and verification

**Usage:**

```typescript
import { SecureServiceCommunication } from './SecureServiceCommunication';

const secureComm = new SecureServiceCommunication(
  {
    encryption: { enabled: true, algorithm: 'aes-256-gcm' },
    authentication: { enabled: true, method: 'jwt' },
    circuitBreaker: { enabled: true, threshold: 5, timeout: 60000 },
  },
  {
    serviceId: 'user-service',
    privateKey: 'your-private-key',
    publicKey: 'your-public-key',
    algorithm: 'RS256',
    expiresIn: '1h',
  }
);

// Make secure request
const response = await secureComm.request({
  method: 'POST',
  url: 'https://api.example.com/users',
  data: { name: 'John Doe' },
  encrypted: true,
});
```

### 5. SecurityMiddleware

Comprehensive Express.js security middleware stack.

**Features:**

- Rate limiting and slow down
- CORS protection
- Helmet security headers
- SQL injection protection
- XSS protection
- DDoS protection
- Request sanitization
- Content Security Policy

**Usage:**

```typescript
import express from 'express';
import { applyAdvancedSecurity } from './SecurityMiddleware';

const app = express();

// Apply all security middleware
app.use(applyAdvancedSecurity());

// Or apply individual middleware
const security = SecurityMiddleware.getInstance();
app.use(security.rateLimitMiddleware());
app.use(security.sqlInjectionProtection());
app.use(security.xssProtection());
```

## Configuration

### Environment Variables

```bash
# Secret Management
SECRET_PROVIDER=aws|hashicorp|local
AWS_REGION=us-east-1
ENCRYPTION_KEY=your-32-byte-hex-key

# Encryption
ENCRYPTION_PROVIDER=aws-kms|vault|local
KMS_KEY_ID=alias/your-kms-key
MASTER_ENCRYPTION_KEY=your-master-key

# Key Rotation
KEY_ROTATION_ENABLED=true
KEY_ROTATION_SCHEDULE="0 2 * * 0"
ROTATION_WEBHOOK_URL=https://alerts.example.com/webhook

# Service Communication
SERVICE_ENCRYPTION_ENABLED=true
SERVICE_AUTH_METHOD=jwt|hmac|mutual-tls
SERVICE_TIMEOUT=30000
CIRCUIT_BREAKER_ENABLED=true

# Security Middleware
ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
```

### AWS Configuration

For AWS providers, ensure your environment has proper AWS credentials:

```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
```

Or use IAM roles for EC2/ECS/Lambda environments.

### HashiCorp Vault Configuration

```bash
VAULT_ENDPOINT=https://vault.example.com
VAULT_TOKEN=your-vault-token
VAULT_NAMESPACE=your-namespace
VAULT_TRANSIT_PATH=transit
```

## Security Best Practices

### 1. Secret Management

- Use AWS Secrets Manager or HashiCorp Vault in production
- Rotate secrets regularly (30-90 days)
- Use metadata to track secret usage
- Implement proper access controls

### 2. Encryption

- Use AWS KMS or HashiCorp Vault for key management in production
- Encrypt sensitive fields at the application level
- Use different keys for different data types
- Implement proper key rotation

### 3. Service Communication

- Always use HTTPS in production
- Implement mutual TLS for high-security environments
- Use short-lived tokens (1 hour or less)
- Implement circuit breakers for resilience

### 4. Middleware Security

- Apply rate limiting based on your traffic patterns
- Customize CORS settings for your domains
- Implement proper CSP headers
- Monitor and log security events

## Testing

Run the comprehensive test suite:

```bash
cd services/shared/security
npm test
```

The test suite includes:

- Unit tests for all components
- Integration tests
- Performance tests
- Security validation tests
- Error handling tests

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Secret Management:**
   - Secret rotation success/failure rates
   - Secret access patterns
   - Failed secret retrievals

2. **Encryption:**
   - Encryption/decryption performance
   - Key usage patterns
   - Encryption failures

3. **Service Communication:**
   - Request success/failure rates
   - Circuit breaker activations
   - Authentication failures

4. **Security Middleware:**
   - Rate limit violations
   - SQL injection attempts
   - XSS attempts
   - DDoS attacks

### Logging

All components use structured logging with the following format:

```json
{
  "timestamp": "2023-12-07T10:30:00Z",
  "level": "info",
  "service": "SecretManager",
  "message": "Secret retrieved successfully",
  "metadata": {
    "secretName": "database-password",
    "provider": "aws"
  }
}
```

## Troubleshooting

### Common Issues

1. **AWS Credentials Not Found**
   - Ensure AWS credentials are properly configured
   - Check IAM permissions for Secrets Manager and KMS

2. **Vault Connection Failed**
   - Verify Vault endpoint and token
   - Check network connectivity
   - Ensure proper Vault policies

3. **Encryption Failures**
   - Verify encryption keys are properly formatted
   - Check key permissions and access
   - Ensure proper algorithm configuration

4. **Service Communication Timeouts**
   - Check network connectivity
   - Verify service endpoints
   - Review circuit breaker configuration

### Debug Mode

Enable debug logging:

```bash
NODE_ENV=development
LOG_LEVEL=debug
```

## Contributing

When contributing to security components:

1. Follow security best practices
2. Add comprehensive tests
3. Update documentation
4. Review security implications
5. Test with multiple providers
6. Validate error handling

## License

This security module is part of the AiLert platform and follows the same
licensing terms.
