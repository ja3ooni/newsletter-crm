import { EncryptionService } from '../EncryptionService';
import {
  KeyRotationService,
  defaultRotationConfig,
} from '../KeyRotationService';
import { SecretManager } from '../SecretManager';

// Mock node-cron
jest.mock('node-cron');
const mockCron = require('node-cron');

describe('KeyRotationService', () => {
  let keyRotationService: KeyRotationService;
  let mockSecretManager: jest.Mocked<SecretManager>;
  let mockEncryptionService: jest.Mocked<EncryptionService>;

  beforeEach(() => {
    // Mock SecretManager
    mockSecretManager = {
      getSecret: jest.fn(),
      storeSecret: jest.fn(),
      updateSecret: jest.fn(),
      deleteSecret: jest.fn(),
      rotateSecret: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    } as any;

    // Mock EncryptionService
    mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      encryptFields: jest.fn(),
      decryptFields: jest.fn(),
      generateDataKey: jest.fn(),
      rotateKey: jest.fn(),
    } as any;

    const config = {
      enabled: true,
      schedule: '0 2 * * 0',
      secrets: [
        {
          name: 'test-secret',
          type: 'database' as const,
          rotationStrategy: 'immediate' as const,
          maxAge: 30,
        },
      ],
    };

    keyRotationService = new KeyRotationService(
      config,
      mockSecretManager,
      mockEncryptionService
    );

    // Mock cron.schedule
    mockCron.schedule.mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Lifecycle', () => {
    it('should start the rotation service', () => {
      keyRotationService.start();
      expect(mockCron.schedule).toHaveBeenCalledWith(
        '0 2 * * 0',
        expect.any(Function),
        { scheduled: false }
      );
    });

    it('should not start if disabled', () => {
      const disabledService = new KeyRotationService(
        { ...defaultRotationConfig, enabled: false },
        mockSecretManager,
        mockEncryptionService
      );

      disabledService.start();
      expect(mockCron.schedule).not.toHaveBeenCalled();
    });

    it('should stop the rotation service', () => {
      const mockJob = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn(),
      };

      mockCron.schedule.mockReturnValue(mockJob);

      keyRotationService.start();
      keyRotationService.stop();

      expect(mockJob.stop).toHaveBeenCalled();
      expect(mockJob.destroy).toHaveBeenCalled();
    });
  });

  describe('Secret Rotation', () => {
    it('should rotate a secret that needs rotation', async () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago

      mockSecretManager.getSecret.mockResolvedValue({
        name: 'test-secret',
        value: 'old-value',
        version: 'v1',
        createdAt: oldDate,
      });

      mockSecretManager.updateSecret.mockResolvedValue();
      mockSecretManager.getSecret
        .mockResolvedValueOnce({
          name: 'test-secret',
          value: 'old-value',
          version: 'v1',
          createdAt: oldDate,
        })
        .mockResolvedValueOnce({
          name: 'test-secret',
          value: 'new-value',
          version: 'v2',
          createdAt: new Date(),
        });

      const result = await keyRotationService.rotateSecret('test-secret');

      expect(result.success).toBe(true);
      expect(result.secretName).toBe('test-secret');
      expect(result.oldVersion).toBe('v1');
      expect(result.newVersion).toBe('v2');
      expect(mockSecretManager.updateSecret).toHaveBeenCalled();
    });

    it('should not rotate a secret that does not need rotation', async () => {
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      mockSecretManager.getSecret.mockResolvedValue({
        name: 'test-secret',
        value: 'current-value',
        version: 'v1',
        createdAt: recentDate,
      });

      const result = await keyRotationService.rotateSecret('test-secret');

      expect(result.success).toBe(true);
      expect(mockSecretManager.updateSecret).not.toHaveBeenCalled();
    });

    it('should handle rotation errors gracefully', async () => {
      mockSecretManager.getSecret.mockRejectedValue(
        new Error('Secret not found')
      );

      const result = await keyRotationService.rotateSecret('test-secret');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Secret not found');
    });

    it('should rotate all configured secrets', async () => {
      const config = {
        enabled: true,
        schedule: '0 2 * * 0',
        secrets: [
          {
            name: 'secret1',
            type: 'database' as const,
            rotationStrategy: 'immediate' as const,
            maxAge: 30,
          },
          {
            name: 'secret2',
            type: 'api_key' as const,
            rotationStrategy: 'gradual' as const,
            maxAge: 60,
          },
        ],
      };

      const service = new KeyRotationService(
        config,
        mockSecretManager,
        mockEncryptionService
      );

      // Mock both secrets as needing rotation
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      mockSecretManager.getSecret
        .mockResolvedValueOnce({
          name: 'secret1',
          value: 'old-value1',
          createdAt: oldDate,
        })
        .mockResolvedValueOnce({
          name: 'secret1',
          value: 'new-value1',
          version: 'v2',
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          name: 'secret2',
          value: 'old-value2',
          createdAt: oldDate,
        })
        .mockResolvedValueOnce({
          name: 'secret2',
          value: 'new-value2',
          version: 'v2',
          createdAt: new Date(),
        });

      const results = await service.performRotation();

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('Secret Generation', () => {
    it('should generate different types of secrets', async () => {
      const service = keyRotationService as any;

      const dbPassword = service.generateDatabasePassword();
      const apiKey = service.generateApiKey();
      const jwtSecret = service.generateJwtSecret();
      const encryptionKey = service.generateEncryptionKey();
      const genericSecret = service.generateGenericSecret();

      expect(typeof dbPassword).toBe('string');
      expect(dbPassword.length).toBe(32);

      expect(typeof apiKey).toBe('string');
      expect(apiKey.startsWith('ak_')).toBe(true);

      expect(typeof jwtSecret).toBe('string');
      expect(jwtSecret.length).toBeGreaterThan(0);

      expect(typeof encryptionKey).toBe('string');
      expect(encryptionKey.length).toBe(64); // 32 bytes in hex

      expect(typeof genericSecret).toBe('string');
      expect(genericSecret.length).toBeGreaterThan(0);
    });

    it('should use custom rotation handler when provided', async () => {
      const customHandler = jest.fn().mockResolvedValue('custom-secret-value');

      const config = {
        enabled: true,
        schedule: '0 2 * * 0',
        secrets: [
          {
            name: 'custom-secret',
            type: 'custom' as const,
            rotationStrategy: 'immediate' as const,
            maxAge: 30,
            customRotationHandler: customHandler,
          },
        ],
      };

      const service = new KeyRotationService(
        config,
        mockSecretManager,
        mockEncryptionService
      );

      // Mock secret as needing rotation
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      mockSecretManager.getSecret
        .mockResolvedValueOnce({
          name: 'custom-secret',
          value: 'old-value',
          createdAt: oldDate,
        })
        .mockResolvedValueOnce({
          name: 'custom-secret',
          value: 'custom-secret-value',
          version: 'v2',
          createdAt: new Date(),
        });

      await service.rotateSecret('custom-secret');

      expect(customHandler).toHaveBeenCalledWith('custom-secret');
      expect(mockSecretManager.updateSecret).toHaveBeenCalledWith(
        'custom-secret',
        'custom-secret-value',
        expect.any(Object)
      );
    });
  });

  describe('Rotation Strategies', () => {
    it('should handle immediate rotation strategy', async () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      mockSecretManager.getSecret
        .mockResolvedValueOnce({
          name: 'test-secret',
          value: 'old-value',
          createdAt: oldDate,
        })
        .mockResolvedValueOnce({
          name: 'test-secret',
          value: 'new-value',
          version: 'v2',
          createdAt: new Date(),
        });

      const result = await keyRotationService.rotateSecret('test-secret');

      expect(result.success).toBe(true);
      expect(mockSecretManager.updateSecret).toHaveBeenCalledWith(
        'test-secret',
        expect.any(String),
        expect.objectContaining({
          rotation_strategy: 'immediate',
        })
      );
    });

    it('should handle gradual rotation strategy', async () => {
      const config = {
        enabled: true,
        schedule: '0 2 * * 0',
        secrets: [
          {
            name: 'test-secret',
            type: 'database' as const,
            rotationStrategy: 'gradual' as const,
            maxAge: 30,
          },
        ],
      };

      const service = new KeyRotationService(
        config,
        mockSecretManager,
        mockEncryptionService
      );

      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      mockSecretManager.getSecret
        .mockResolvedValueOnce({
          name: 'test-secret',
          value: 'old-value',
          createdAt: oldDate,
        })
        .mockResolvedValueOnce({
          name: 'test-secret',
          value: 'new-value',
          version: 'v2',
          createdAt: new Date(),
        });

      const result = await service.rotateSecret('test-secret');

      expect(result.success).toBe(true);
      expect(mockSecretManager.storeSecret).toHaveBeenCalledWith(
        'test-secret_new',
        expect.any(String),
        expect.objectContaining({
          rotation_strategy: 'gradual',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown secret configuration', async () => {
      await expect(
        keyRotationService.rotateSecret('unknown-secret')
      ).rejects.toThrow('Secret configuration not found: unknown-secret');
    });

    it('should handle secret manager errors', async () => {
      mockSecretManager.getSecret.mockRejectedValue(
        new Error('Connection failed')
      );

      const result = await keyRotationService.rotateSecret('test-secret');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });
});
