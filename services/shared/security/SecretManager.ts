import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  RotateSecretCommand,
  SecretsManagerClient,
  UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import crypto from 'crypto';
import { StructuredLogger } from '../logging/StructuredLogger';

const logger = new StructuredLogger({
  service: 'SecretManager',
  environment: process.env.NODE_ENV || 'development',
});

export interface SecretConfig {
  provider: 'aws' | 'hashicorp' | 'local';
  aws?: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  hashicorp?: {
    endpoint: string;
    token: string;
    namespace?: string;
  };
  local?: {
    encryptionKey: string;
  };
}

export interface Secret {
  name: string;
  value: string;
  version?: string;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: Record<string, any>;
}

export interface EncryptionResult {
  encryptedData: string;
  keyId?: string;
  algorithm: string;
  iv?: string;
}

export interface DecryptionResult {
  decryptedData: string;
  algorithm: string;
}

export class SecretManager {
  private config: SecretConfig;
  private secretsClient?: SecretsManagerClient;
  private kmsClient?: KMSClient;
  private localEncryptionKey?: Buffer;

  constructor(config: SecretConfig) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients(): void {
    switch (this.config.provider) {
      case 'aws':
        this.secretsClient = new SecretsManagerClient({
          region:
            this.config.aws?.region || process.env.AWS_REGION || 'us-east-1',
          credentials: this.config.aws?.accessKeyId
            ? {
                accessKeyId: this.config.aws.accessKeyId,
                secretAccessKey: this.config.aws.secretAccessKey!,
              }
            : undefined,
        });

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
        if (this.config.local?.encryptionKey) {
          this.localEncryptionKey = Buffer.from(
            this.config.local.encryptionKey,
            'hex'
          );
        } else {
          // Generate a random key if none provided (for development only)
          this.localEncryptionKey = crypto.randomBytes(32);
          logger.warn(
            'Using randomly generated encryption key. This should only be used in development!'
          );
        }
        break;

      case 'hashicorp':
        // HashiCorp Vault implementation would go here
        throw new Error('HashiCorp Vault provider not yet implemented');
    }
  }

  /**
   * Store a secret
   */
  async storeSecret(
    name: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'aws':
          await this.storeSecretAWS(name, value, metadata);
          break;
        case 'local':
          await this.storeSecretLocal(name, value, metadata);
          break;
        case 'hashicorp':
          await this.storeSecretHashiCorp(name, value, metadata);
          break;
      }

      logger.info('Secret stored successfully', {
        name,
        provider: this.config.provider,
      });
    } catch (error) {
      logger.error('Failed to store secret', {
        name,
        error,
        provider: this.config.provider,
      });
      throw error;
    }
  }

  /**
   * Retrieve a secret
   */
  async getSecret(name: string): Promise<Secret> {
    try {
      let secret: Secret;

      switch (this.config.provider) {
        case 'aws':
          secret = await this.getSecretAWS(name);
          break;
        case 'local':
          secret = await this.getSecretLocal(name);
          break;
        case 'hashicorp':
          secret = await this.getSecretHashiCorp(name);
          break;
        default:
          throw new Error(`Unsupported provider: ${this.config.provider}`);
      }

      logger.info('Secret retrieved successfully', {
        name,
        provider: this.config.provider,
      });

      return secret;
    } catch (error) {
      logger.error('Failed to retrieve secret', {
        name,
        error,
        provider: this.config.provider,
      });
      throw error;
    }
  }

  /**
   * Update a secret
   */
  async updateSecret(
    name: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'aws':
          await this.updateSecretAWS(name, value, metadata);
          break;
        case 'local':
          await this.updateSecretLocal(name, value, metadata);
          break;
        case 'hashicorp':
          await this.updateSecretHashiCorp(name, value, metadata);
          break;
      }

      logger.info('Secret updated successfully', {
        name,
        provider: this.config.provider,
      });
    } catch (error) {
      logger.error('Failed to update secret', {
        name,
        error,
        provider: this.config.provider,
      });
      throw error;
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(name: string): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'aws':
          await this.deleteSecretAWS(name);
          break;
        case 'local':
          await this.deleteSecretLocal(name);
          break;
        case 'hashicorp':
          await this.deleteSecretHashiCorp(name);
          break;
      }

      logger.info('Secret deleted successfully', {
        name,
        provider: this.config.provider,
      });
    } catch (error) {
      logger.error('Failed to delete secret', {
        name,
        error,
        provider: this.config.provider,
      });
      throw error;
    }
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(name: string): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'aws':
          await this.rotateSecretAWS(name);
          break;
        case 'local':
          await this.rotateSecretLocal(name);
          break;
        case 'hashicorp':
          await this.rotateSecretHashiCorp(name);
          break;
      }

      logger.info('Secret rotated successfully', {
        name,
        provider: this.config.provider,
      });
    } catch (error) {
      logger.error('Failed to rotate secret', {
        name,
        error,
        provider: this.config.provider,
      });
      throw error;
    }
  }

  /**
   * Encrypt data
   */
  async encrypt(data: string, keyId?: string): Promise<EncryptionResult> {
    try {
      let result: EncryptionResult;

      switch (this.config.provider) {
        case 'aws':
          result = await this.encryptAWS(data, keyId);
          break;
        case 'local':
          result = await this.encryptLocal(data);
          break;
        case 'hashicorp':
          result = await this.encryptHashiCorp(data, keyId);
          break;
        default:
          throw new Error(`Unsupported provider: ${this.config.provider}`);
      }

      logger.info('Data encrypted successfully', {
        algorithm: result.algorithm,
        provider: this.config.provider,
      });

      return result;
    } catch (error) {
      logger.error('Failed to encrypt data', {
        error,
        provider: this.config.provider,
      });
      throw error;
    }
  }

  /**
   * Decrypt data
   */
  async decrypt(
    encryptedData: string,
    keyId?: string,
    iv?: string
  ): Promise<DecryptionResult> {
    try {
      let result: DecryptionResult;

      switch (this.config.provider) {
        case 'aws':
          result = await this.decryptAWS(encryptedData);
          break;
        case 'local':
          result = await this.decryptLocal(encryptedData, iv);
          break;
        case 'hashicorp':
          result = await this.decryptHashiCorp(encryptedData, keyId);
          break;
        default:
          throw new Error(`Unsupported provider: ${this.config.provider}`);
      }

      logger.info('Data decrypted successfully', {
        algorithm: result.algorithm,
        provider: this.config.provider,
      });

      return result;
    } catch (error) {
      logger.error('Failed to decrypt data', {
        error,
        provider: this.config.provider,
      });
      throw error;
    }
  }

  // AWS Secrets Manager implementations
  private async storeSecretAWS(
    name: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const command = new CreateSecretCommand({
      Name: name,
      SecretString: value,
      Description: metadata?.description,
      Tags: metadata
        ? Object.entries(metadata).map(([key, val]) => ({
            Key: key,
            Value: String(val),
          }))
        : undefined,
    });

    await this.secretsClient!.send(command);
  }

  private async getSecretAWS(name: string): Promise<Secret> {
    const command = new GetSecretValueCommand({ SecretId: name });
    const response = await this.secretsClient!.send(command);

    return {
      name: response.Name!,
      value: response.SecretString!,
      version: response.VersionId,
      createdAt: response.CreatedDate,
      metadata: response.Tags
        ? Object.fromEntries(response.Tags.map(tag => [tag.Key!, tag.Value!]))
        : undefined,
    };
  }

  private async updateSecretAWS(
    name: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const command = new UpdateSecretCommand({
      SecretId: name,
      SecretString: value,
      Description: metadata?.description,
    });

    await this.secretsClient!.send(command);
  }

  private async deleteSecretAWS(name: string): Promise<void> {
    const command = new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    });

    await this.secretsClient!.send(command);
  }

  private async rotateSecretAWS(name: string): Promise<void> {
    const command = new RotateSecretCommand({ SecretId: name });

    await this.secretsClient!.send(command);
  }

  private async encryptAWS(
    data: string,
    keyId?: string
  ): Promise<EncryptionResult> {
    const command = new EncryptCommand({
      KeyId: keyId || 'alias/ailert-encryption-key',
      Plaintext: Buffer.from(data, 'utf8'),
    });

    const response = await this.kmsClient!.send(command);

    return {
      encryptedData: Buffer.from(response.CiphertextBlob!).toString('base64'),
      keyId: response.KeyId,
      algorithm: 'AWS-KMS',
    };
  }

  private async decryptAWS(encryptedData: string): Promise<DecryptionResult> {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedData, 'base64'),
    });

    const response = await this.kmsClient!.send(command);

    return {
      decryptedData: Buffer.from(response.Plaintext!).toString('utf8'),
      algorithm: 'AWS-KMS',
    };
  }

  // Local encryption implementations
  private async storeSecretLocal(
    name: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // In a real implementation, this would store to a secure local database
    // For now, we'll use environment variables or a secure file
    const encrypted = await this.encryptLocal(value);

    process.env[`SECRET_${name.toUpperCase()}`] = JSON.stringify({
      ...encrypted,
      metadata,
      createdAt: new Date().toISOString(),
    });
  }

  private async getSecretLocal(name: string): Promise<Secret> {
    const envValue = process.env[`SECRET_${name.toUpperCase()}`];

    if (!envValue) {
      throw new Error(`Secret ${name} not found`);
    }

    const stored = JSON.parse(envValue);
    const decrypted = await this.decryptLocal(stored.encryptedData, stored.iv);

    return {
      name,
      value: decrypted.decryptedData,
      createdAt: new Date(stored.createdAt),
      metadata: stored.metadata,
    };
  }

  private async updateSecretLocal(
    name: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.storeSecretLocal(name, value, metadata);
  }

  private async deleteSecretLocal(name: string): Promise<void> {
    delete process.env[`SECRET_${name.toUpperCase()}`];
  }

  private async rotateSecretLocal(name: string): Promise<void> {
    // Generate new value (this would be application-specific)
    const newValue = crypto.randomBytes(32).toString('hex');

    await this.updateSecretLocal(name, newValue);
  }

  private async encryptLocal(data: string): Promise<EncryptionResult> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM(
      'aes-256-gcm',
      this.localEncryptionKey!,
      iv
    );

    cipher.setAAD(Buffer.from('ailert-encryption', 'utf8'));

    let encrypted = cipher.update(data, 'utf8', 'hex');

    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encryptedData: `${encrypted}:${authTag.toString('hex')}`,
      algorithm: 'AES-256-GCM',
      iv: iv.toString('hex'),
    };
  }

  private async decryptLocal(
    encryptedData: string,
    iv?: string
  ): Promise<DecryptionResult> {
    if (!iv) {
      throw new Error('IV is required for local decryption');
    }

    const [encrypted, authTagHex] = encryptedData.split(':');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ivBuffer = Buffer.from(iv, 'hex');

    const decipher = crypto.createDecipherGCM(
      'aes-256-gcm',
      this.localEncryptionKey!,
      ivBuffer
    );

    decipher.setAAD(Buffer.from('ailert-encryption', 'utf8'));
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');

    decrypted += decipher.final('utf8');

    return {
      decryptedData: decrypted,
      algorithm: 'AES-256-GCM',
    };
  }

  // HashiCorp Vault implementations
  private async storeSecretHashiCorp(
    name: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const vaultConfig = this.config.hashicorp!;
    const secretPath = `secret/data/${name}`;

    const response = await fetch(`${vaultConfig.endpoint}/v1/${secretPath}`, {
      method: 'POST',
      headers: {
        'X-Vault-Token': vaultConfig.token,
        'Content-Type': 'application/json',
        ...(vaultConfig.namespace && {
          'X-Vault-Namespace': vaultConfig.namespace,
        }),
      },
      body: JSON.stringify({
        data: {
          value,
          metadata: metadata || {},
          created_at: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to store secret in Vault: ${response.statusText}`
      );
    }
  }

  private async getSecretHashiCorp(name: string): Promise<Secret> {
    const vaultConfig = this.config.hashicorp!;
    const secretPath = `secret/data/${name}`;

    const response = await fetch(`${vaultConfig.endpoint}/v1/${secretPath}`, {
      method: 'GET',
      headers: {
        'X-Vault-Token': vaultConfig.token,
        ...(vaultConfig.namespace && {
          'X-Vault-Namespace': vaultConfig.namespace,
        }),
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Secret ${name} not found in Vault`);
      }
      throw new Error(
        `Failed to retrieve secret from Vault: ${response.statusText}`
      );
    }

    const data = await response.json();
    const secretData = data.data.data;

    return {
      name,
      value: secretData.value,
      version: String(data.data.metadata.version),
      createdAt: new Date(secretData.created_at),
      metadata: secretData.metadata,
    };
  }

  private async updateSecretHashiCorp(
    name: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // In Vault, updating is the same as storing
    await this.storeSecretHashiCorp(name, value, metadata);
  }

  private async deleteSecretHashiCorp(name: string): Promise<void> {
    const vaultConfig = this.config.hashicorp!;
    const secretPath = `secret/data/${name}`;

    const response = await fetch(`${vaultConfig.endpoint}/v1/${secretPath}`, {
      method: 'DELETE',
      headers: {
        'X-Vault-Token': vaultConfig.token,
        ...(vaultConfig.namespace && {
          'X-Vault-Namespace': vaultConfig.namespace,
        }),
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(
        `Failed to delete secret from Vault: ${response.statusText}`
      );
    }
  }

  private async rotateSecretHashiCorp(name: string): Promise<void> {
    // Get current secret
    const currentSecret = await this.getSecretHashiCorp(name);

    // Generate new value (this would be application-specific)
    const newValue = crypto.randomBytes(32).toString('hex');

    // Update with new value
    await this.updateSecretHashiCorp(name, newValue, {
      ...currentSecret.metadata,
      rotated_at: new Date().toISOString(),
      previous_version: currentSecret.version,
    });
  }

  private async encryptHashiCorp(
    data: string,
    keyId?: string
  ): Promise<EncryptionResult> {
    const vaultConfig = this.config.hashicorp!;
    const transitPath = 'transit';
    const keyName = keyId || 'ailert-encryption-key';

    const response = await fetch(
      `${vaultConfig.endpoint}/v1/${transitPath}/encrypt/${keyName}`,
      {
        method: 'POST',
        headers: {
          'X-Vault-Token': vaultConfig.token,
          'Content-Type': 'application/json',
          ...(vaultConfig.namespace && {
            'X-Vault-Namespace': vaultConfig.namespace,
          }),
        },
        body: JSON.stringify({
          plaintext: Buffer.from(data, 'utf8').toString('base64'),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Vault encryption failed: ${response.statusText}`);
    }

    const responseData = await response.json();

    return {
      encryptedData: responseData.data.ciphertext,
      keyId: keyName,
      algorithm: 'Vault-Transit',
    };
  }

  private async decryptHashiCorp(
    encryptedData: string,
    keyId?: string
  ): Promise<DecryptionResult> {
    const vaultConfig = this.config.hashicorp!;
    const transitPath = 'transit';
    const keyName = keyId || 'ailert-encryption-key';

    const response = await fetch(
      `${vaultConfig.endpoint}/v1/${transitPath}/decrypt/${keyName}`,
      {
        method: 'POST',
        headers: {
          'X-Vault-Token': vaultConfig.token,
          'Content-Type': 'application/json',
          ...(vaultConfig.namespace && {
            'X-Vault-Namespace': vaultConfig.namespace,
          }),
        },
        body: JSON.stringify({
          ciphertext: encryptedData,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Vault decryption failed: ${response.statusText}`);
    }

    const responseData = await response.json();

    return {
      decryptedData: Buffer.from(
        responseData.data.plaintext,
        'base64'
      ).toString('utf8'),
      algorithm: 'Vault-Transit',
    };
  }
}

// Factory function to create secret manager
export function createSecretManager(
  config?: Partial<SecretConfig>
): SecretManager {
  const defaultConfig: SecretConfig = {
    provider: (process.env.SECRET_PROVIDER as any) || 'local',
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
    },
    local: {
      encryptionKey:
        process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
    },
  };

  return new SecretManager({ ...defaultConfig, ...config });
}

// Singleton instance
let secretManagerInstance: SecretManager | null = null;

export function getSecretManager(): SecretManager {
  if (!secretManagerInstance) {
    secretManagerInstance = createSecretManager();
  }

  return secretManagerInstance;
}
