import crypto from 'crypto';
import cron from 'node-cron';
import { StructuredLogger } from '../logging/StructuredLogger';
import { EncryptionService, getEncryptionService } from './EncryptionService';
import { SecretManager, getSecretManager } from './SecretManager';

const logger = new StructuredLogger({
  service: 'KeyRotationService',
  environment: process.env.NODE_ENV || 'development',
});

export interface RotationConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  secrets: RotationSecretConfig[];
  notifications?: {
    webhook?: string;
    email?: string[];
  };
}

export interface RotationSecretConfig {
  name: string;
  type: 'database' | 'api_key' | 'jwt_secret' | 'encryption_key' | 'custom';
  rotationStrategy: 'immediate' | 'gradual' | 'blue_green';
  maxAge: number; // in days
  customRotationHandler?: (secretName: string) => Promise<string>;
}

export interface RotationResult {
  secretName: string;
  success: boolean;
  oldVersion?: string;
  newVersion?: string;
  error?: string;
  timestamp: Date;
}

export class KeyRotationService {
  private config: RotationConfig;
  private secretManager: SecretManager;
  private encryptionService: EncryptionService;
  private rotationJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(
    config: RotationConfig,
    secretManager?: SecretManager,
    encryptionService?: EncryptionService
  ) {
    this.config = config;
    this.secretManager = secretManager || getSecretManager();
    this.encryptionService = encryptionService || getEncryptionService();
  }

  /**
   * Start the key rotation service
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Key rotation service is disabled');

      return;
    }

    logger.info('Starting key rotation service', {
      schedule: this.config.schedule,
      secretCount: this.config.secrets.length,
    });

    // Schedule rotation job
    const job = cron.schedule(
      this.config.schedule,
      async () => {
        await this.performRotation();
      },
      {
        scheduled: false,
      }
    );

    this.rotationJobs.set('main', job);
    job.start();

    logger.info('Key rotation service started successfully');
  }

  /**
   * Stop the key rotation service
   */
  stop(): void {
    this.rotationJobs.forEach((job, name) => {
      job.stop();
      job.destroy();
      logger.info('Stopped rotation job', { jobName: name });
    });
    this.rotationJobs.clear();
    logger.info('Key rotation service stopped');
  }

  /**
   * Perform manual rotation for a specific secret
   */
  async rotateSecret(secretName: string): Promise<RotationResult> {
    const secretConfig = this.config.secrets.find(s => s.name === secretName);

    if (!secretConfig) {
      throw new Error(`Secret configuration not found: ${secretName}`);
    }

    return await this.performSecretRotation(secretConfig);
  }

  /**
   * Perform rotation for all configured secrets
   */
  async performRotation(): Promise<RotationResult[]> {
    logger.info('Starting scheduled key rotation');
    const results: RotationResult[] = [];

    for (const secretConfig of this.config.secrets) {
      try {
        const result = await this.performSecretRotation(secretConfig);

        results.push(result);
      } catch (error) {
        logger.error('Failed to rotate secret', {
          secretName: secretConfig.name,
          error,
        });
        results.push({
          secretName: secretConfig.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });
      }
    }

    // Send notifications if configured
    if (this.config.notifications) {
      await this.sendRotationNotifications(results);
    }

    logger.info('Completed scheduled key rotation', {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });

    return results;
  }

  /**
   * Check if a secret needs rotation based on its age
   */
  async needsRotation(secretConfig: RotationSecretConfig): Promise<boolean> {
    try {
      const secret = await this.secretManager.getSecret(secretConfig.name);

      if (!secret.createdAt) {
        return true; // Rotate if we don't know when it was created
      }

      const ageInDays =
        (Date.now() - secret.createdAt.getTime()) / (1000 * 60 * 60 * 24);

      return ageInDays >= secretConfig.maxAge;
    } catch (error) {
      logger.warn('Could not check secret age, assuming rotation needed', {
        secretName: secretConfig.name,
        error,
      });

      return true;
    }
  }

  /**
   * Perform rotation for a single secret
   */
  private async performSecretRotation(
    secretConfig: RotationSecretConfig
  ): Promise<RotationResult> {
    const startTime = new Date();

    logger.info('Starting rotation for secret', {
      secretName: secretConfig.name,
    });

    try {
      // Check if rotation is needed
      const needsRotation = await this.needsRotation(secretConfig);

      if (!needsRotation) {
        logger.info('Secret does not need rotation yet', {
          secretName: secretConfig.name,
          maxAge: secretConfig.maxAge,
        });

        return {
          secretName: secretConfig.name,
          success: true,
          timestamp: startTime,
        };
      }

      // Get current secret for version tracking
      let oldVersion: string | undefined;

      try {
        const currentSecret = await this.secretManager.getSecret(
          secretConfig.name
        );

        oldVersion = currentSecret.version;
      } catch (error) {
        // Secret might not exist yet
        logger.info('Current secret not found, creating new one', {
          secretName: secretConfig.name,
        });
      }

      // Generate new secret value
      const newSecretValue = await this.generateNewSecretValue(secretConfig);

      // Perform rotation based on strategy
      await this.executeRotationStrategy(secretConfig, newSecretValue);

      // Get new version
      const updatedSecret = await this.secretManager.getSecret(
        secretConfig.name
      );
      const newVersion = updatedSecret.version;

      logger.info('Secret rotation completed successfully', {
        secretName: secretConfig.name,
        strategy: secretConfig.rotationStrategy,
        oldVersion,
        newVersion,
      });

      return {
        secretName: secretConfig.name,
        success: true,
        oldVersion,
        newVersion,
        timestamp: startTime,
      };
    } catch (error) {
      logger.error('Secret rotation failed', {
        secretName: secretConfig.name,
        error,
      });

      return {
        secretName: secretConfig.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime,
      };
    }
  }

  /**
   * Generate a new secret value based on the secret type
   */
  private async generateNewSecretValue(
    secretConfig: RotationSecretConfig
  ): Promise<string> {
    if (secretConfig.customRotationHandler) {
      return await secretConfig.customRotationHandler(secretConfig.name);
    }

    switch (secretConfig.type) {
      case 'database':
        return this.generateDatabasePassword();
      case 'api_key':
        return this.generateApiKey();
      case 'jwt_secret':
        return this.generateJwtSecret();
      case 'encryption_key':
        return this.generateEncryptionKey();
      default:
        return this.generateGenericSecret();
    }
  }

  /**
   * Execute the rotation strategy
   */
  private async executeRotationStrategy(
    secretConfig: RotationSecretConfig,
    newValue: string
  ): Promise<void> {
    switch (secretConfig.rotationStrategy) {
      case 'immediate':
        await this.secretManager.updateSecret(secretConfig.name, newValue, {
          rotated_at: new Date().toISOString(),
          rotation_strategy: 'immediate',
        });
        break;

      case 'gradual':
        // Store new secret with a temporary name first
        const tempName = `${secretConfig.name}_new`;

        await this.secretManager.storeSecret(tempName, newValue, {
          original_secret: secretConfig.name,
          rotation_strategy: 'gradual',
          rotation_phase: 'pending',
        });

        // In a real implementation, you would coordinate with services to switch over
        // For now, we'll just replace the original after a short delay
        setTimeout(async () => {
          await this.secretManager.updateSecret(secretConfig.name, newValue, {
            rotated_at: new Date().toISOString(),
            rotation_strategy: 'gradual',
          });
          await this.secretManager.deleteSecret(tempName);
        }, 30000); // 30 second delay
        break;

      case 'blue_green':
        // Similar to gradual but with explicit blue/green deployment pattern
        const blueGreenName = `${secretConfig.name}_blue_green`;

        await this.secretManager.storeSecret(blueGreenName, newValue, {
          original_secret: secretConfig.name,
          rotation_strategy: 'blue_green',
          deployment_color: 'green',
        });

        // Switch over (in real implementation, this would coordinate with load balancers)
        setTimeout(async () => {
          await this.secretManager.updateSecret(secretConfig.name, newValue, {
            rotated_at: new Date().toISOString(),
            rotation_strategy: 'blue_green',
          });
          await this.secretManager.deleteSecret(blueGreenName);
        }, 60000); // 1 minute delay
        break;
    }
  }

  /**
   * Send rotation notifications
   */
  private async sendRotationNotifications(
    results: RotationResult[]
  ): Promise<void> {
    const failedRotations = results.filter(r => !r.success);

    if (failedRotations.length > 0 && this.config.notifications?.webhook) {
      try {
        await fetch(this.config.notifications.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'key_rotation_failures',
            failures: failedRotations,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (error) {
        logger.error('Failed to send webhook notification', error as Error);
      }
    }

    // Email notifications would be implemented here
    if (this.config.notifications?.email && failedRotations.length > 0) {
      logger.info('Email notifications not yet implemented', {
        recipients: this.config.notifications.email,
        failureCount: failedRotations.length,
      });
    }
  }

  // Secret generation methods
  private generateDatabasePassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < 32; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return password;
  }

  private generateApiKey(): string {
    return `ak_${Buffer.from(crypto.randomBytes(32)).toString('base64url')}`;
  }

  private generateJwtSecret(): string {
    return Buffer.from(crypto.randomBytes(64)).toString('base64url');
  }

  private generateEncryptionKey(): string {
    return Buffer.from(crypto.randomBytes(32)).toString('hex');
  }

  private generateGenericSecret(): string {
    return Buffer.from(crypto.randomBytes(32)).toString('base64url');
  }
}

// Factory function
export function createKeyRotationService(
  config: RotationConfig
): KeyRotationService {
  return new KeyRotationService(config);
}

// Default configuration
export const defaultRotationConfig: RotationConfig = {
  enabled: process.env.KEY_ROTATION_ENABLED === 'true',
  schedule: process.env.KEY_ROTATION_SCHEDULE || '0 2 * * 0', // Weekly at 2 AM on Sunday
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
};
