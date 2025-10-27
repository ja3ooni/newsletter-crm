import { SecretManager, createSecretManager } from '../SecretManager';

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager');
jest.mock('@aws-sdk/client-kms');

describe('SecretManager', () => {
  let secretManager: SecretManager;

  beforeEach(() => {
    secretManager = createSecretManager({
      provider: 'local',
      local: {
        encryptionKey: 'test-key-32-bytes-long-for-testing',
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Local Provider', () => {
    it('should store and retrieve a secret', async () => {
      const secretName = 'test-secret';
      const secretValue = 'test-value';

      await secretManager.storeSecret(secretName, secretValue);
      const retrievedSecret = await secretManager.getSecret(secretName);

      expect(retrievedSecret.name).toBe(secretName);
      expect(retrievedSecret.value).toBe(secretValue);
    });

    it('should update an existing secret', async () => {
      const secretName = 'test-secret';
      const originalValue = 'original-value';
      const updatedValue = 'updated-value';

      await secretManager.storeSecret(secretName, originalValue);
      await secretManager.updateSecret(secretName, updatedValue);

      const retrievedSecret = await secretManager.getSecret(secretName);

      expect(retrievedSecret.value).toBe(updatedValue);
    });

    it('should delete a secret', async () => {
      const secretName = 'test-secret';
      const secretValue = 'test-value';

      await secretManager.storeSecret(secretName, secretValue);
      await secretManager.deleteSecret(secretName);

      await expect(secretManager.getSecret(secretName)).rejects.toThrow();
    });

    it('should encrypt and decrypt data', async () => {
      const plaintext = 'sensitive-data';

      const encrypted = await secretManager.encrypt(plaintext);

      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.algorithm).toBe('AES-256-GCM');
      expect(encrypted.iv).toBeDefined();

      const decrypted = await secretManager.decrypt(
        encrypted.encryptedData,
        undefined,
        encrypted.iv
      );

      expect(decrypted.decryptedData).toBe(plaintext);
    });

    it('should handle metadata when storing secrets', async () => {
      const secretName = 'test-secret-with-metadata';
      const secretValue = 'test-value';
      const metadata = { description: 'Test secret', environment: 'test' };

      await secretManager.storeSecret(secretName, secretValue, metadata);
      const retrievedSecret = await secretManager.getSecret(secretName);

      expect(retrievedSecret.metadata).toEqual(metadata);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent secret', async () => {
      await expect(secretManager.getSecret('non-existent')).rejects.toThrow();
    });

    it('should handle encryption errors gracefully', async () => {
      const invalidSecretManager = createSecretManager({
        provider: 'local',
        local: {
          encryptionKey: 'invalid-key', // Too short
        },
      });

      await expect(invalidSecretManager.encrypt('test')).rejects.toThrow();
    });
  });
});
