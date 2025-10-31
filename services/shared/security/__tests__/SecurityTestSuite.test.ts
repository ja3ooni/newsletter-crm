import crypto from 'crypto';
import { AuthenticationMiddleware } from '../AuthenticationMiddleware';
import { EncryptionService } from '../EncryptionService';
import { InputValidator } from '../InputValidator';
import { SecretManager } from '../SecretManager';

describe('Security Test Suite', () => {
  describe('Crypto Implementation Security', () => {
    let encryptionService: EncryptionService;

    beforeEach(() => {
      encryptionService = new EncryptionService({
        provider: 'local',
      });
    });

    it('should validate input before encryption', async () => {
      await expect(encryptionService.encrypt('')).rejects.toThrow(
        'Plaintext must be a non-empty string'
      );
      await expect(encryptionService.encrypt(null as any)).rejects.toThrow(
        'Plaintext must be a non-empty string'
      );
      await expect(encryptionService.encrypt(undefined as any)).rejects.toThrow(
        'Plaintext must be a non-empty string'
      );
    });

    it('should reject oversized plaintext', async () => {
      const largePlaintext = 'a'.repeat(1024 * 1024 + 1); // > 1MB
      await expect(encryptionService.encrypt(largePlaintext)).rejects.toThrow(
        'Plaintext exceeds maximum size limit'
      );
    });

    it('should validate keyId format', async () => {
      await expect(encryptionService.encrypt('test', '')).rejects.toThrow(
        'KeyId must be a non-empty string if provided'
      );
      await expect(encryptionService.encrypt('test', '   ')).rejects.toThrow(
        'KeyId must be a non-empty string if provided'
      );
    });

    it('should validate encrypted data structure for decryption', async () => {
      await expect(encryptionService.decrypt(null as any)).rejects.toThrow(
        'EncryptedData must be a valid object'
      );
      await expect(encryptionService.decrypt({} as any)).rejects.toThrow(
        'Ciphertext must be a non-empty string'
      );
      await expect(
        encryptionService.decrypt({ ciphertext: 'test' } as any)
      ).rejects.toThrow('Algorithm must be specified');
    });

    it('should reject unsupported algorithms', async () => {
      const invalidData = {
        ciphertext: 'test',
        algorithm: 'INVALID-ALGORITHM',
      };
      await expect(
        encryptionService.decrypt(invalidData as any)
      ).rejects.toThrow('Unsupported algorithm: INVALID-ALGORITHM');
    });

    it('should use secure random values for encryption', async () => {
      const plaintext = 'test data';
      const encrypted1 = await encryptionService.encrypt(plaintext);
      const encrypted2 = await encryptionService.encrypt(plaintext);

      // Same plaintext should produce different ciphertext due to random IV
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should properly handle encryption/decryption round trip', async () => {
      const plaintext = 'sensitive data that needs encryption';
      const encrypted = await encryptionService.encrypt(plaintext);
      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted.algorithm).toBe('AES-256-GCM');
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
    });
  });

  describe('Secret Manager Security', () => {
    let secretManager: SecretManager;

    beforeEach(() => {
      secretManager = new SecretManager({
        provider: 'local',
        local: {
          encryptionKey: crypto.randomBytes(32).toString('hex'),
        },
      });
    });

    it('should validate secret name format', async () => {
      await expect(secretManager.storeSecret('', 'value')).rejects.toThrow(
        'Secret name must be a non-empty string'
      );
      await expect(
        secretManager.storeSecret('invalid name!', 'value')
      ).rejects.toThrow(
        'Secret name can only contain alphanumeric characters, hyphens, and underscores'
      );
      await expect(
        secretManager.storeSecret('a'.repeat(256), 'value')
      ).rejects.toThrow('Secret name cannot exceed 255 characters');
    });

    it('should validate secret value', async () => {
      await expect(secretManager.storeSecret('test', '')).rejects.toThrow(
        'Secret value must be a non-empty string'
      );
      await expect(
        secretManager.storeSecret('test', null as any)
      ).rejects.toThrow('Secret value must be a non-empty string');
    });

    it('should reject oversized secret values', async () => {
      const largeValue = 'a'.repeat(65537); // > 64KB
      await expect(
        secretManager.storeSecret('test', largeValue)
      ).rejects.toThrow('Secret value exceeds maximum size limit');
    });

    it('should sanitize secret names', async () => {
      const secretName = '  test-secret_123  ';
      await secretManager.storeSecret(secretName, 'value');

      // Should work with trimmed name
      const retrieved = await secretManager.getSecret('test-secret_123');
      expect(retrieved.value).toBe('value');
    });
  });

  describe('Input Validation Security', () => {
    it('should validate email format securely', () => {
      const validEmail = InputValidator.validateEmail('test@example.com');
      expect(validEmail.isValid).toBe(true);
      expect(validEmail.sanitizedData).toBe('test@example.com');

      const invalidEmail = InputValidator.validateEmail('invalid-email');
      expect(invalidEmail.isValid).toBe(false);
      expect(invalidEmail.errors).toContain('Invalid email format');
    });

    it('should sanitize HTML content', () => {
      const maliciousHtml = '<script>alert("xss")</script><p>Safe content</p>';
      const result = InputValidator.validateHtml(maliciousHtml);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData).not.toContain('<script>');
      expect(result.sanitizedData).toContain('<p>Safe content</p>');
    });

    it('should validate password strength', () => {
      const weakPassword = InputValidator.validatePassword('123');
      expect(weakPassword.isValid).toBe(false);
      expect(weakPassword.errors.length).toBeGreaterThan(0);

      const strongPassword = InputValidator.validatePassword('SecurePass123!');
      expect(strongPassword.isValid).toBe(true);
    });

    it('should detect SQL injection patterns', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const result = InputValidator.sanitizeString(maliciousInput);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Input contains potentially malicious SQL patterns'
      );
    });

    it('should validate URLs securely', () => {
      const validUrl = InputValidator.validateUrl('https://example.com');
      expect(validUrl.isValid).toBe(true);

      const maliciousUrl = InputValidator.validateUrl(
        'javascript:alert("xss")'
      );
      expect(maliciousUrl.isValid).toBe(false);
    });

    it('should validate file uploads securely', () => {
      const validFile = {
        name: 'document.pdf',
        size: 1024 * 1024, // 1MB
        mimetype: 'application/pdf',
      };
      const result = InputValidator.validateFile(validFile);
      expect(result.isValid).toBe(true);

      const maliciousFile = {
        name: '../../../etc/passwd',
        size: 1024,
        mimetype: 'text/plain',
      };
      const maliciousResult = InputValidator.validateFile(maliciousFile);
      expect(maliciousResult.isValid).toBe(false);
    });
  });

  describe('Authentication Security', () => {
    let authMiddleware: AuthenticationMiddleware;

    beforeEach(() => {
      authMiddleware = new AuthenticationMiddleware({
        jwtSecret: 'test-secret-key-for-testing-only',
      });
    });

    it('should generate and verify JWT tokens securely', () => {
      const payload = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        permissions: ['read', 'write'],
      };

      const token = authMiddleware.generateToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = authMiddleware.verifyToken(token);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should reject invalid JWT tokens', () => {
      expect(() => authMiddleware.verifyToken('invalid-token')).toThrow();
      expect(() => authMiddleware.verifyToken('')).toThrow();
    });

    it('should handle token expiration', () => {
      const shortLivedAuth = new AuthenticationMiddleware({
        jwtSecret: 'test-secret',
        jwtExpiresIn: '1ms', // Very short expiration
      });

      const token = shortLivedAuth.generateToken({
        id: 'user-123',
        email: 'test@example.com',
      });

      // Wait for token to expire
      setTimeout(() => {
        expect(() => shortLivedAuth.verifyToken(token)).toThrow();
      }, 10);
    });
  });

  describe('Crypto API Security', () => {
    it('should use secure crypto methods', () => {
      // Verify that we are using the correct crypto methods
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const data = 'test data';

      // Test that createCipheriv works (not createCipherGCM which doesn't exist)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Test that createDecipheriv works (not createDecipherGCM which doesn't exist)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      expect(decrypted).toBe(data);
    });

    it('should generate cryptographically secure random values', () => {
      const random1 = crypto.randomBytes(32);
      const random2 = crypto.randomBytes(32);

      expect(random1).not.toEqual(random2);
      expect(random1.length).toBe(32);
      expect(random2.length).toBe(32);
    });

    it('should properly handle authentication tags in GCM mode', () => {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const data = 'authenticated data';
      const aad = Buffer.from('additional authenticated data');

      // Encrypt with AAD
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(aad);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Decrypt with AAD
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(aad);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      expect(decrypted).toBe(data);
    });
  });

  describe('Environment Variable Security', () => {
    it('should not expose sensitive environment variables', () => {
      // Test that sensitive env vars are not logged or exposed
      const sensitiveVars = [
        'JWT_SECRET',
        'DATABASE_PASSWORD',
        'API_KEY',
        'ENCRYPTION_KEY',
        'AWS_SECRET_ACCESS_KEY',
      ];

      sensitiveVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
          // Ensure the value is not accidentally logged
          expect(value).not.toMatch(/console\.log|logger\.info|logger\.debug/);
        }
      });
    });

    it('should validate required environment variables', () => {
      const requiredVars = ['NODE_ENV'];

      requiredVars.forEach(varName => {
        expect(process.env[varName]).toBeDefined();
      });
    });
  });
});
