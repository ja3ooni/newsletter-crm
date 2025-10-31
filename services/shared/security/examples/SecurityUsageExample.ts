import express from 'express';

import { logger } from '../../utils/logger';
import { createEncryptionService } from '../EncryptionService';
import {
  KeyRotationService,
  defaultRotationConfig,
} from '../KeyRotationService';
import { createSecretManager } from '../SecretManager';
import {
  SecureServiceCommunication,
  defaultSecureCommunicationConfig,
} from '../SecureServiceCommunication';
import { applyAdvancedSecurity } from '../SecurityMiddleware';

/**
 * Comprehensive example showing how to use all security components together
 * in a production-ready Express.js application
 */

// 1. Initialize Secret Management
const secretManager = createSecretManager({
  provider: process.env.SECRET_PROVIDER === 'aws' ? 'aws' : 'local',
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
  },
  local: {
    encryptionKey:
      process.env.ENCRYPTION_KEY || 'default-key-for-development-only',
  },
});

// 2. Initialize Encryption Service
const encryptionService = createEncryptionService({
  provider: process.env.ENCRYPTION_PROVIDER === 'aws-kms' ? 'aws-kms' : 'local',
  keyId: process.env.KMS_KEY_ID,
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
  },
});

// 3. Initialize Key Rotation Service
const keyRotationService = new KeyRotationService(
  {
    ...defaultRotationConfig,
    enabled: process.env.KEY_ROTATION_ENABLED === 'true',
    secrets: [
      {
        name: 'database-password',
        type: 'database',
        rotationStrategy: 'gradual',
        maxAge: 90, // 90 days
      },
      {
        name: 'jwt-secret',
        type: 'jwt_secret',
        rotationStrategy: 'blue_green',
        maxAge: 30, // 30 days
      },
      {
        name: 'api-encryption-key',
        type: 'encryption_key',
        rotationStrategy: 'gradual',
        maxAge: 180, // 6 months
      },
    ],
    notifications: {
      webhook: process.env.ROTATION_WEBHOOK_URL,
    },
  },
  secretManager,
  encryptionService
);

// 4. Initialize Secure Service Communication
const secureServiceComm = new SecureServiceCommunication(
  {
    ...defaultSecureCommunicationConfig,
    encryption: {
      enabled: process.env.SERVICE_ENCRYPTION_ENABLED === 'true',
      algorithm: 'aes-256-gcm',
    },
    authentication: {
      enabled: true,
      method: 'jwt',
    },
  },
  {
    serviceId: process.env.SERVICE_ID || 'example-service',
    privateKey: process.env.SERVICE_PRIVATE_KEY || 'default-private-key',
    publicKey: process.env.SERVICE_PUBLIC_KEY || 'default-public-key',
    algorithm: 'RS256',
    expiresIn: '1h',
  }
);

// 5. Create Express Application with Security Middleware
const app = express();

// Apply comprehensive security middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply all security middleware
app.use(applyAdvancedSecurity());

// 6. Example API Routes with Security Features

/**
 * Store sensitive user data with field-level encryption
 */
app.post('/api/users', async (req, res) => {
  try {
    const userData = req.body;

    // Encrypt sensitive fields
    const encryptedUser = await encryptionService.encryptFields(userData, {
      fields: ['email', 'phone', 'ssn', 'creditCard'],
      preserveNull: true,
    });

    // Store in database (simulated)
    const userId = Math.random().toString(36).substr(2, 9);

    // In a real application, you would save to your database here
    logger.info('Storing encrypted user data', {
      userId,
      fieldsEncrypted: Object.keys(encryptedUser),
    });

    res.status(201).json({
      success: true,
      userId,
      message: 'User created successfully with encrypted sensitive data',
    });
  } catch (error) {
    logger.error('Error creating user', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create user',
    });
  }
});

/**
 * Retrieve user data with automatic decryption
 */
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Simulate retrieving encrypted data from database
    const encryptedUserData = {
      id: userId,
      name: 'John Doe',
      email:
        '{"ciphertext":"encrypted-email","algorithm":"AES-256-GCM","iv":"...","authTag":"..."}',
      phone:
        '{"ciphertext":"encrypted-phone","algorithm":"AES-256-GCM","iv":"...","authTag":"..."}',
      createdAt: new Date().toISOString(),
    };

    // Decrypt sensitive fields
    const decryptedUser = await encryptionService.decryptFields(
      encryptedUserData,
      {
        fields: ['email', 'phone', 'ssn', 'creditCard'],
      }
    );

    res.json({
      success: true,
      user: decryptedUser,
    });
  } catch (error) {
    logger.error('Error retrieving user', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve user',
    });
  }
});

/**
 * Secure inter-service communication example
 */
app.post('/api/services/notify', async (req, res) => {
  try {
    const { targetService, message } = req.body;

    // Make secure request to another service
    const response = await secureServiceComm.request({
      method: 'POST',
      url: `https://${targetService}.example.com/api/notifications`,
      data: { message, timestamp: new Date().toISOString() },
      encrypted: true,
    });

    res.json({
      success: true,
      response: response.data,
      encrypted: response.encrypted,
    });
  } catch (error) {
    logger.error('Error in service communication', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Service Communication Error',
      message: 'Failed to communicate with target service',
    });
  }
});

/**
 * Secret management endpoints (admin only)
 */
app.post('/api/admin/secrets', async (req, res) => {
  try {
    const { name, value, metadata } = req.body;

    await secretManager.storeSecret(name, value, metadata);

    res.json({
      success: true,
      message: 'Secret stored successfully',
    });
  } catch (error) {
    logger.error('Error storing secret', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Secret Management Error',
      message: 'Failed to store secret',
    });
  }
});

app.post('/api/admin/secrets/:name/rotate', async (req, res) => {
  try {
    const { name } = req.params;

    const result = await keyRotationService.rotateSecret(name);

    if (result.success) {
      res.json({
        success: true,
        message: 'Secret rotated successfully',
        oldVersion: result.oldVersion,
        newVersion: result.newVersion,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Rotation Failed',
        message: result.error,
      });
    }
  } catch (error) {
    logger.error('Error rotating secret', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Secret Rotation Error',
      message: 'Failed to rotate secret',
    });
  }
});

/**
 * Health check endpoint with security validation
 */
app.get('/api/health', async (req, res) => {
  try {
    // Test encryption service
    const testData = 'health-check-test';
    const encrypted = await encryptionService.encrypt(testData);
    const decrypted = await encryptionService.decrypt(encrypted);
    const encryptionHealthy = decrypted === testData;

    // Test secret manager
    let secretManagerHealthy = false;

    try {
      await secretManager.storeSecret('health-check', 'test-value');
      const retrieved = await secretManager.getSecret('health-check');

      secretManagerHealthy = retrieved.value === 'test-value';
      await secretManager.deleteSecret('health-check');
    } catch (error) {
      logger.warn('Secret manager health check failed', {
        error: error.message,
        stack: error.stack,
      });
    }

    const isHealthy = encryptionHealthy && secretManagerHealthy;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        encryption: encryptionHealthy ? 'healthy' : 'unhealthy',
        secretManager: secretManagerHealthy ? 'healthy' : 'unhealthy',
        keyRotation: keyRotationService ? 'healthy' : 'unhealthy',
      },
    });
  } catch (error) {
    logger.error('Health check error', {
      error: error.message,
      stack: error.stack,
    });
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// 7. Error handling middleware
app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Something went wrong',
      requestId: req.headers['x-request-id'] || 'unknown',
    });
  }
);

// 8. Start the application
const PORT = process.env.PORT || 3000;

async function startApplication() {
  try {
    // Start key rotation service
    if (process.env.KEY_ROTATION_ENABLED === 'true') {
      keyRotationService.start();
      logger.info('Key rotation service started');
    }

    // Start the server
    app.listen(PORT, () => {
      logger.info('Secure application started', {
        port: PORT,
        securityFeatures: [
          'Field-level encryption',
          'Secret management',
          'Key rotation',
          'Secure service communication',
          'Comprehensive security middleware',
        ],
      });
    });
  } catch (error) {
    logger.error('Failed to start application', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  keyRotationService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  keyRotationService.stop();
  process.exit(0);
});

// Export for testing
export {
  app,
  encryptionService,
  keyRotationService,
  secretManager,
  secureServiceComm,
  startApplication,
};

// Start the application if this file is run directly
if (require.main === module) {
  startApplication();
}
