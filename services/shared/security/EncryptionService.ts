import {
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import crypto from 'crypto';
import { StructuredLogger } from '../logging/StructuredLogger';

const logger = new StructuredLogger({
  service: 'EncryptionService',
  environment: process.env.NODE_ENV || 'development',
});

export interface EncryptionConfig {
  provider: 'aws-kms' | 'local' | 'vault';
  keyId?: string;
  algorithm?: string;
  aws?: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  vault?: {
    endpoint: string;
    token: string;
    transitPath?: string;
  };
}

export interface EncryptedData {
  ciphertext: string;
  algorithm: string;
  keyId?: string;
  iv?: string;
  authTag?: string;
  metadata?: Record<string, any>;
}

export interface FieldEncryptionConfig {
  fields: string[];
  keyId?: string;
  preserveNull?: boolean;
}

export class EncryptionService {
  private config: EncryptionConfig;
  private kmsClient?: KMSClient;
  private masterKey?: Buffer;

  constructor(config: EncryptionConfig) {
    this.config = config;
    this.initializeProvider();
  }

  private initializeProvider(): void {
    switch (this.config.provider) {
      case 'aws-kms':
        this.kmsClient = new KMSClient({
          region:
            this.config.aws?.region || process.env.AWS_REGION || 'us-east-1',
          credentials: this.config.aws?.accessKeyId
            ? {
                accessKeyId: this.config.aws.accessKeyId,
                secretAccessKey: this.config.aws.secretAccessKey!,
              }
            : undefined,
        });
        break;

      case 'local':
        // Generate or load master key for local encryption
        const keyHex = process.env.MASTER_ENCRYPTION_KEY;

        if (keyHex) {
          this.masterKey = Buffer.from(keyHex, 'hex');
        } else {
          logger.warn('Generated random master key for local encryption. This should only be used in development!', {
            provider: 'local',
            keyGenerated: true
          });
        }
        break;

      case 'vault':
        // HashiCorp Vault will be initialized when needed
        break;

      default:
        throw new Error(
          `Unsupported encryption provider: ${this.config.provider}`
        );
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(plaintext: string, keyId?: string): Promise<EncryptedData> {
    // Input validation
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Plaintext must be a non-empty string');
    }

    if (plaintext.length > 1024 * 1024) {
      // 1MB limit
      throw new Error('Plaintext exceeds maximum size limit');
    }

    if (keyId && (typeof keyId !== 'string' || keyId.trim().length === 0)) {
      throw new Error('KeyId must be a non-empty string if provided');
    }

    try {
      switch (this.config.provider) {
        case 'aws-kms':
          return await this.encryptWithKMS(plaintext, keyId);
        case 'local':
          return await this.encryptLocal(plaintext);
        case 'vault':
          return await this.encryptWithVault(plaintext, keyId);
        default:
          throw new Error(
            `Unsupported encryption provider: ${this.config.provider}`
          );
      }
    } catch (error) {
      logger.error('Encryption failed', error as Error, {
        provider: this.config.provider,
        plaintextLength: plaintext.length,
      });
      throw error;
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    // Input validation
    if (!encryptedData || typeof encryptedData !== 'object') {
      throw new Error('EncryptedData must be a valid object');
    }

    if (
      !encryptedData.ciphertext ||
      typeof encryptedData.ciphertext !== 'string'
    ) {
      throw new Error('Ciphertext must be a non-empty string');
    }

    if (
      !encryptedData.algorithm ||
      typeof encryptedData.algorithm !== 'string'
    ) {
      throw new Error('Algorithm must be specified');
    }

    // Validate algorithm is supported
    const supportedAlgorithms = ['AWS-KMS', 'AES-256-GCM', 'Vault-Transit'];
    if (!supportedAlgorithms.includes(encryptedData.algorithm)) {
      throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`);
    }

    try {
      switch (this.config.provider) {
        case 'aws-kms':
          return await this.decryptWithKMS(encryptedData);
        case 'local':
          return await this.decryptLocal(encryptedData);
        case 'vault':
          return await this.decryptWithVault(encryptedData);
        default:
          throw new Error(
            `Unsupported encryption provider: ${this.config.provider}`
          );
      }
    } catch (error) {
      logger.error('Decryption failed', error as Error, {
        provider: this.config.provider,
        algorithm: encryptedData.algorithm,
      });
      throw error;
    }
  }

  /**
   * Encrypt multiple fields in an object
   */
  async encryptFields<T extends Record<string, any>>(
    data: T,
    config: FieldEncryptionConfig
  ): Promise<T> {
    const result = { ...data } as T;

    for (const field of config.fields) {
      if (field in result) {
        const value = (result as any)[field];

        if (value !== null && value !== undefined) {
          const encrypted = await this.encrypt(String(value), config.keyId);

          (result as any)[field] = JSON.stringify(encrypted);
        } else if (!config.preserveNull) {
          (result as any)[field] = null;
        }
      }
    }

    return result;
  }

  /**
   * Decrypt multiple fields in an object
   */
  async decryptFields<T extends Record<string, any>>(
    data: T,
    config: FieldEncryptionConfig
  ): Promise<T> {
    const result = { ...data };

    for (const field of config.fields) {
      if (field in result && result[field]) {
        try {
          const encryptedData = JSON.parse(result[field]);

          (result as any)[field] = await this.decrypt(encryptedData);
        } catch (error) {
          logger.warn(`Failed to decrypt field ${field}`, { 
            error: error instanceof Error ? error.message : 'Unknown error',
            field 
          });
          // Keep original value if decryption fails
        }
      }
    }

    return result;
  }

  /**
   * Generate a data encryption key
   */
  async generateDataKey(
    keyId?: string
  ): Promise<{ plaintext: Buffer; ciphertext: Buffer }> {
    if (this.config.provider !== 'aws-kms') {
      throw new Error('Data key generation is only supported with AWS KMS');
    }

    const command = new GenerateDataKeyCommand({
      KeyId: keyId || this.config.keyId || 'alias/datatechtoncrm-encryption-key',
      KeySpec: 'AES_256',
    });

    const response = await this.kmsClient!.send(command);

    return {
      plaintext: Buffer.from(response.Plaintext!),
      ciphertext: Buffer.from(response.CiphertextBlob!),
    };
  }

  /**
   * Encrypt using AWS KMS
   */
  private async encryptWithKMS(
    plaintext: string,
    keyId?: string
  ): Promise<EncryptedData> {
    const command = new EncryptCommand({
      KeyId: keyId || this.config.keyId || 'alias/datatechtoncrm-encryption-key',
      Plaintext: Buffer.from(plaintext, 'utf8'),
    });

    const response = await this.kmsClient!.send(command);

    return {
      ciphertext: Buffer.from(response.CiphertextBlob!).toString('base64'),
      algorithm: 'AWS-KMS',
      keyId: response.KeyId,
    };
  }

  /**
   * Decrypt using AWS KMS
   */
  private async decryptWithKMS(encryptedData: EncryptedData): Promise<string> {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedData.ciphertext, 'base64'),
    });

    const response = await this.kmsClient!.send(command);

    return Buffer.from(response.Plaintext!).toString('utf8');
  }

  /**
   * Encrypt using local AES-256-GCM
   */
  private async encryptLocal(plaintext: string): Promise<EncryptedData> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey!, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');

    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      algorithm: 'AES-256-GCM',
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt using local AES-256-GCM
   */
  private async decryptLocal(encryptedData: EncryptedData): Promise<string> {
    if (!encryptedData.iv || !encryptedData.authTag) {
      throw new Error('IV and auth tag are required for local decryption');
    }

    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.masterKey!,
      iv
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let plaintext = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');

    plaintext += decipher.final('utf8');

    return plaintext;
  }

  /**
   * Encrypt using HashiCorp Vault Transit Engine
   */
  private async encryptWithVault(
    plaintext: string,
    keyId?: string
  ): Promise<EncryptedData> {
    const vaultConfig = this.config.vault!;
    const transitPath = vaultConfig.transitPath || 'transit';
    const keyName = keyId || 'datatechtoncrm-encryption-key';

    const response = await fetch(
      `${vaultConfig.endpoint}/v1/${transitPath}/encrypt/${keyName}`,
      {
        method: 'POST',
        headers: {
          'X-Vault-Token': vaultConfig.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plaintext: Buffer.from(plaintext, 'utf8').toString('base64'),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Vault encryption failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      ciphertext: data.data.ciphertext,
      algorithm: 'Vault-Transit',
      keyId: keyName,
    };
  }

  /**
   * Decrypt using HashiCorp Vault Transit Engine
   */
  private async decryptWithVault(
    encryptedData: EncryptedData
  ): Promise<string> {
    const vaultConfig = this.config.vault!;
    const transitPath = vaultConfig.transitPath || 'transit';
    const keyName = encryptedData.keyId || 'datatechtoncrm-encryption-key';

    const response = await fetch(
      `${vaultConfig.endpoint}/v1/${transitPath}/decrypt/${keyName}`,
      {
        method: 'POST',
        headers: {
          'X-Vault-Token': vaultConfig.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ciphertext: encryptedData.ciphertext,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Vault decryption failed: ${response.statusText}`);
    }

    const data = await response.json();

    return Buffer.from(data.data.plaintext, 'base64').toString('utf8');
  }

  /**
   * Rotate encryption key (Vault only)
   */
  async rotateKey(keyId?: string): Promise<void> {
    if (this.config.provider !== 'vault') {
      throw new Error('Key rotation is only supported with HashiCorp Vault');
    }

    const vaultConfig = this.config.vault!;
    const transitPath = vaultConfig.transitPath || 'transit';
    const keyName = keyId || 'datatechtoncrm-encryption-key';

    const response = await fetch(
      `${vaultConfig.endpoint}/v1/${transitPath}/keys/${keyName}/rotate`,
      {
        method: 'POST',
        headers: {
          'X-Vault-Token': vaultConfig.token,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Key rotation failed: ${response.statusText}`);
    }

    logger.info('Encryption key rotated successfully', { keyName });
  }
}

// Factory function
export function createEncryptionService(
  config?: Partial<EncryptionConfig>
): EncryptionService {
  const defaultConfig: EncryptionConfig = {
    provider:
      (process.env.ENCRYPTION_PROVIDER as 'aws-kms' | 'local' | 'vault') ||
      'local',
    keyId: process.env.ENCRYPTION_KEY_ID,
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
    },
    vault: {
      endpoint: process.env.VAULT_ENDPOINT || 'http://localhost:8200',
      token: process.env.VAULT_TOKEN || '',
      transitPath: process.env.VAULT_TRANSIT_PATH || 'transit',
    },
  };

  return new EncryptionService({ ...defaultConfig, ...config });
}

// Singleton instance
let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = createEncryptionService();
  }

  return encryptionServiceInstance;
}
