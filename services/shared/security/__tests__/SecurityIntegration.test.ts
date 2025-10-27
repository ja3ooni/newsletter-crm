import {
  EncryptionService,
  createEncryptionService,
} from '../EncryptionService';
import { KeyRotationService } from '../KeyRotationService';
import { SecretManager, createSecretManager } from '../SecretManager';
import { SecureServiceCommunication } from '../SecureServiceCommunication';
import { SecurityMiddleware } from '../SecurityMiddleware';

describe('Security Integration Tests', () => {
  let secretManager: SecretManager;
  let encryptionService: EncryptionService;
  let keyRotationService: KeyRotationService;

  beforeEach(() => {
    // Set up test environment
    process.env.MASTER_ENCRYPTION_KEY = 'a'.repeat(64);

    secretManager = createSecretManager({
      provider: 'local',
      local: {
        encryptionKey: 'test-encryption-key-32-bytes-long',
      },
    });

    encryptionService = createEncryptionService({
      provider: 'local',
    });

    const rotationConfig = {
      enabled: true,
      schedule: '0 2 * * 0',
      secrets: [
        {
          name: 'integration-test-secret',
          type: 'database' as const,
          rotationStrategy: 'immediate' as const,
          maxAge: 1, // 1 day for testing
        },
      ],
    };

    keyRotationService = new KeyRotationService(
      rotationConfig,
      secretManager,
      encryptionService
    );
  });

  afterEach(() => {
    delete process.env.MASTER_ENCRYPTION_KEY;
    jest.clearAllMocks();
  });

  describe('End-to-End Secret Management', () => {
    it('should store, encrypt, rotate, and retrieve secrets', async () => {
      const secretName = 'e2e-test-secret';
      const originalValue = 'original-secret-value';
      const sensitiveData = 'sensitive-user-data';

      // 1. Store a secret
      await secretManager.storeSecret(secretName, originalValue, {
        description: 'End-to-end test secret',
        environment: 'test',
      });

      // 2. Retrieve and verify the secret
      const retrievedSecret = await secretManager.getSecret(secretName);

      expect(retrievedSecret.value).toBe(originalValue);
      expect(retrievedSecret.metadata?.description).toBe(
        'End-to-end test secret'
      );

      // 3. Encrypt sensitive data using the encryption service
      const encrypted = await encryptionService.encrypt(sensitiveData);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.algorithm).toBe('AES-256-GCM');

      // 4. Decrypt the data
      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(sensitiveData);

      // 5. Test field-level encryption
      const userData = {
        id: 123,
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        ssn: '123-45-6789',
      };

      const encryptedUser = await encryptionService.encryptFields(userData, {
        fields: ['email', 'password', 'ssn'],
      });

      expect(encryptedUser.id).toBe(123); // Not encrypted
      expect(encryptedUser.name).toBe('John Doe'); // Not encrypted
      expect(encryptedUser.email).not.toBe('john@example.com'); // Encrypted
      expect(encryptedUser.password).not.toBe('secret123'); // Encrypted
      expect(encryptedUser.ssn).not.toBe('123-45-6789'); // Encrypted

      const decryptedUser = await encryptionService.decryptFields(
        encryptedUser,
        {
          fields: ['email', 'password', 'ssn'],
        }
      );

      expect(decryptedUser).toEqual(userData);

      // 6. Simulate key rotation (force rotation by setting old date)
      const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

      // Mock the secret to appear old
      jest
        .spyOn(secretManager, 'getSecret')
        .mockResolvedValueOnce({
          name: secretName,
          value: originalValue,
          createdAt: oldDate,
          version: 'v1',
        })
        .mockResolvedValueOnce({
          name: secretName,
          value: 'rotated-secret-value',
          createdAt: new Date(),
          version: 'v2',
        });

      const rotationResult = await keyRotationService.rotateSecret(secretName);

      expect(rotationResult.success).toBe(true);
      expect(rotationResult.oldVersion).toBe('v1');
      expect(rotationResult.newVersion).toBe('v2');
    });

    it('should handle encryption with different providers', async () => {
      const testData = 'multi-provider-test-data';

      // Test local encryption
      const localEncrypted = await encryptionService.encrypt(testData);
      const localDecrypted = await encryptionService.decrypt(localEncrypted);

      expect(localDecrypted).toBe(testData);

      // Test with different encryption service instance
      const anotherEncryptionService = createEncryptionService({
        provider: 'local',
      });

      const anotherEncrypted = await anotherEncryptionService.encrypt(testData);
      const anotherDecrypted =
        await anotherEncryptionService.decrypt(anotherEncrypted);

      expect(anotherDecrypted).toBe(testData);

      // Verify that different instances produce different ciphertexts
      expect(localEncrypted.ciphertext).not.toBe(anotherEncrypted.ciphertext);
    });
  });

  describe('Secure Service Communication Integration', () => {
    it('should establish secure communication between services', async () => {
      const config = {
        encryption: {
          enabled: true,
          algorithm: 'aes-256-gcm' as const,
        },
        authentication: {
          enabled: true,
          method: 'jwt' as const,
        },
        timeout: 30000,
        retries: 3,
        circuitBreaker: {
          enabled: true,
          threshold: 5,
          timeout: 60000,
        },
      };

      const authConfig = {
        serviceId: 'test-service-1',
        privateKey: 'test-private-key',
        publicKey: 'test-public-key',
        algorithm: 'RS256' as const,
        expiresIn: '1h',
      };

      const secureComm = new SecureServiceCommunication(config, authConfig);

      // Test JWT token generation and verification
      const token = await (secureComm as any).generateJWT();

      expect(typeof token).toBe('string');

      // Test HMAC signature generation and verification
      const headers = { 'content-type': 'application/json' };
      const signature = await (secureComm as any).generateHMACSignature(
        headers
      );

      expect(typeof signature).toBe('string');

      const isValidSignature = SecureServiceCommunication.verifyHMACSignature(
        signature,
        headers,
        authConfig.serviceId,
        authConfig.privateKey
      );

      expect(isValidSignature).toBe(true);
    });
  });

  describe('Security Middleware Integration', () => {
    it('should apply comprehensive security protection', () => {
      const securityMiddleware = SecurityMiddleware.getInstance({
        rateLimit: {
          windowMs: 15 * 60 * 1000,
          max: 100,
        },
        cors: {
          origin: ['http://localhost:3000'],
          credentials: true,
        },
      });

      // Test that all middleware components are available
      const basicMiddlewares = securityMiddleware.applySecurityMiddleware();

      expect(Array.isArray(basicMiddlewares)).toBe(true);
      expect(basicMiddlewares.length).toBeGreaterThan(0);

      // Test individual middleware components
      const helmetMiddleware = securityMiddleware.helmetMiddleware();
      const corsMiddleware = securityMiddleware.corsMiddleware();
      const rateLimitMiddleware = securityMiddleware.rateLimitMiddleware();
      const sanitizationMiddleware =
        securityMiddleware.requestSanitizationMiddleware();
      const securityHeadersMiddleware =
        securityMiddleware.securityHeadersMiddleware();
      const sqlInjectionMiddleware =
        securityMiddleware.sqlInjectionProtection();
      const xssMiddleware = securityMiddleware.xssProtection();
      const ddosMiddleware = securityMiddleware.ddosProtection();

      expect(typeof helmetMiddleware).toBe('function');
      expect(typeof corsMiddleware).toBe('function');
      expect(typeof rateLimitMiddleware).toBe('function');
      expect(typeof sanitizationMiddleware).toBe('function');
      expect(typeof securityHeadersMiddleware).toBe('function');
      expect(typeof sqlInjectionMiddleware).toBe('function');
      expect(typeof xssMiddleware).toBe('function');
      expect(typeof ddosMiddleware).toBe('function');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle cascading failures gracefully', async () => {
      // Test encryption service failure
      const faultyEncryptionService = createEncryptionService({
        provider: 'local',
      });

      // Corrupt the master key
      (faultyEncryptionService as any).masterKey = Buffer.from('invalid');

      await expect(faultyEncryptionService.encrypt('test')).rejects.toThrow();

      // Test secret manager with faulty encryption
      const faultySecretManager = createSecretManager({
        provider: 'local',
        local: {
          encryptionKey: 'invalid-key',
        },
      });

      await expect(faultySecretManager.encrypt('test')).rejects.toThrow();

      // Test key rotation service with faulty dependencies
      const faultyRotationService = new KeyRotationService(
        {
          enabled: true,
          schedule: '0 2 * * 0',
          secrets: [
            {
              name: 'faulty-secret',
              type: 'database',
              rotationStrategy: 'immediate',
              maxAge: 30,
            },
          ],
        },
        faultySecretManager,
        faultyEncryptionService
      );

      const result = await faultyRotationService.rotateSecret('faulty-secret');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should maintain security even with partial failures', async () => {
      // Test that encryption still works even if secret manager fails
      const workingEncryption = createEncryptionService({
        provider: 'local',
      });

      const testData = 'critical-data';
      const encrypted = await workingEncryption.encrypt(testData);
      const decrypted = await workingEncryption.decrypt(encrypted);

      expect(decrypted).toBe(testData);

      // Test that individual middleware components work independently
      const securityMiddleware = SecurityMiddleware.getInstance();

      const mockReq = {
        ip: '127.0.0.1',
        headers: {},
        query: { safe: 'value' },
        body: { data: 'clean' },
        path: '/test',
        method: 'GET',
        get: jest.fn(),
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        removeHeader: jest.fn(),
        end: jest.fn(),
      };

      const mockNext = jest.fn();

      // Each middleware should work independently
      const sanitizationMiddleware =
        securityMiddleware.requestSanitizationMiddleware();

      sanitizationMiddleware(mockReq as any, mockRes as any, mockNext);
      expect(mockNext).toHaveBeenCalled();

      jest.clearAllMocks();

      const securityHeadersMiddleware =
        securityMiddleware.securityHeadersMiddleware();

      securityHeadersMiddleware(mockReq as any, mockRes as any, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume encryption operations', async () => {
      const startTime = Date.now();
      const operations = [];

      // Perform 100 encryption operations concurrently
      for (let i = 0; i < 100; i++) {
        operations.push(encryptionService.encrypt(`test-data-${i}`));
      }

      const results = await Promise.all(operations);
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all encryptions are unique
      const ciphertexts = results.map(r => r.ciphertext);
      const uniqueCiphertexts = new Set(ciphertexts);

      expect(uniqueCiphertexts.size).toBe(100);

      // Test decryption of all results
      const decryptOperations = results.map(encrypted =>
        encryptionService.decrypt(encrypted)
      );

      const decrypted = await Promise.all(decryptOperations);

      for (let i = 0; i < 100; i++) {
        expect(decrypted[i]).toBe(`test-data-${i}`);
      }
    });

    it('should handle concurrent secret operations', async () => {
      const operations = [];

      // Store multiple secrets concurrently
      for (let i = 0; i < 50; i++) {
        operations.push(
          secretManager.storeSecret(`concurrent-secret-${i}`, `value-${i}`)
        );
      }

      await Promise.all(operations);

      // Retrieve all secrets concurrently
      const retrieveOperations = [];

      for (let i = 0; i < 50; i++) {
        retrieveOperations.push(
          secretManager.getSecret(`concurrent-secret-${i}`)
        );
      }

      const secrets = await Promise.all(retrieveOperations);

      expect(secrets).toHaveLength(50);
      for (let i = 0; i < 50; i++) {
        expect(secrets[i].value).toBe(`value-${i}`);
      }
    });
  });
});
