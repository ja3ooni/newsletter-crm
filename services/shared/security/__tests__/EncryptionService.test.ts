import {
  EncryptionService,
  createEncryptionService,
} from '../EncryptionService';

// Mock AWS SDK
jest.mock('@aws-sdk/client-kms');

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    process.env.MASTER_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex
    encryptionService = createEncryptionService({
      provider: 'local',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.MASTER_ENCRYPTION_KEY;
  });

  describe('Local Encryption', () => {
    it('should encrypt and decrypt data successfully', async () => {
      const plaintext = 'Hello, World!';

      const encrypted = await encryptionService.encrypt(plaintext);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.algorithm).toBe('AES-256-GCM');
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt multiple fields in an object', async () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        age: 30,
      };

      const config = {
        fields: ['email', 'password'],
      };

      const encrypted = await encryptionService.encryptFields(data, config);

      expect(encrypted.name).toBe('John Doe'); // Not encrypted
      expect(encrypted.age).toBe(30); // Not encrypted
      expect(encrypted.email).not.toBe('john@example.com'); // Encrypted
      expect(encrypted.password).not.toBe('secret123'); // Encrypted

      const decrypted = await encryptionService.decryptFields(
        encrypted,
        config
      );

      expect(decrypted.email).toBe('john@example.com');
      expect(decrypted.password).toBe('secret123');
      expect(decrypted.name).toBe('John Doe');
      expect(decrypted.age).toBe(30);
    });

    it('should handle null values in field encryption', async () => {
      const data = {
        name: 'John Doe',
        email: null,
        password: undefined,
      };

      const config = {
        fields: ['email', 'password'],
        preserveNull: true,
      };

      const encrypted = await encryptionService.encryptFields(data, config);

      expect(encrypted.email).toBeNull();
      expect(encrypted.password).toBeUndefined();

      const decrypted = await encryptionService.decryptFields(
        encrypted,
        config
      );

      expect(decrypted.email).toBeNull();
      expect(decrypted.password).toBeUndefined();
    });

    it('should generate data encryption keys for AWS KMS', async () => {
      const kmsEncryptionService = createEncryptionService({
        provider: 'aws-kms',
        keyId: 'test-key-id',
      });

      // Mock the KMS client
      const mockSend = jest.fn().mockResolvedValue({
        Plaintext: new Uint8Array(32),
        CiphertextBlob: new Uint8Array(64),
      });

      (kmsEncryptionService as any).kmsClient = { send: mockSend };

      const dataKey = await kmsEncryptionService.generateDataKey();

      expect(dataKey.plaintext).toBeInstanceOf(Buffer);
      expect(dataKey.ciphertext).toBeInstanceOf(Buffer);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid encrypted data', async () => {
      const invalidEncryptedData = {
        ciphertext: 'invalid',
        algorithm: 'AES-256-GCM',
        iv: 'invalid',
        authTag: 'invalid',
      };

      await expect(
        encryptionService.decrypt(invalidEncryptedData)
      ).rejects.toThrow();
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        createEncryptionService({
          provider: 'unsupported' as any,
        });
      }).toThrow();
    });

    it('should handle missing IV and auth tag', async () => {
      const encryptedData = {
        ciphertext: 'test',
        algorithm: 'AES-256-GCM',
      };

      await expect(encryptionService.decrypt(encryptedData)).rejects.toThrow(
        'IV and auth tag are required for local decryption'
      );
    });
  });

  describe('Field Encryption Edge Cases', () => {
    it('should handle empty objects', async () => {
      const data = {};
      const config = { fields: ['nonexistent'] };

      const encrypted = await encryptionService.encryptFields(data, config);
      const decrypted = await encryptionService.decryptFields(
        encrypted,
        config
      );

      expect(encrypted).toEqual({});
      expect(decrypted).toEqual({});
    });

    it('should handle failed decryption gracefully', async () => {
      const data = {
        field1: 'invalid-encrypted-data',
      };
      const config = { fields: ['field1'] };

      // This should not throw, but keep original value
      const decrypted = await encryptionService.decryptFields(data, config);

      expect(decrypted.field1).toBe('invalid-encrypted-data');
    });
  });
});
