import logger from '../utils/logger';
import {
  BaseIntegration,
  IntegrationConfig,
  SyncResult,
} from './base-integration';
import { CustomCRMIntegration } from './custom-crm';
import { HubSpotIntegration } from './hubspot';
import { PipedriveIntegration } from './pipedrive';
import { SalesforceIntegration } from './salesforce';

export interface IntegrationMapping {
  localId: string;
  externalId: string;
  integrationType: string;
  recordType: 'contact' | 'deal' | 'company';
  lastSynced: Date;
  syncDirection: 'to_external' | 'from_external' | 'bidirectional';
}

export class IntegrationManager {
  private integrations: Map<string, BaseIntegration> = new Map();
  private mappings: Map<string, IntegrationMapping[]> = new Map();

  constructor() {
    // Initialize with empty mappings
  }

  async addIntegration(config: IntegrationConfig): Promise<boolean> {
    try {
      let integration: BaseIntegration;

      switch (config.type) {
        case 'salesforce':
          integration = new SalesforceIntegration(config);
          break;
        case 'hubspot':
          integration = new HubSpotIntegration(config);
          break;
        case 'pipedrive':
          integration = new PipedriveIntegration(config);
          break;
        case 'custom':
          integration = new CustomCRMIntegration(config);
          break;
        default:
          throw new Error(`Unsupported integration type: ${config.type}`);
      }

      // Test the integration
      if (!(await integration.testConnection())) {
        throw new Error(`Failed to connect to ${config.name}`);
      }

      this.integrations.set(config.id, integration);
      this.mappings.set(config.id, []);

      logger.info(`Integration ${config.name} added successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to add integration ${config.name}:`, error);
      return false;
    }
  }

  async removeIntegration(integrationId: string): Promise<boolean> {
    try {
      this.integrations.delete(integrationId);
      this.mappings.delete(integrationId);

      logger.info(`Integration ${integrationId} removed successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to remove integration ${integrationId}:`, error);
      return false;
    }
  }

  async updateIntegration(
    integrationId: string,
    updates: Partial<IntegrationConfig>
  ): Promise<boolean> {
    try {
      const integration = this.integrations.get(integrationId);
      if (!integration) {
        throw new Error(`Integration ${integrationId} not found`);
      }

      integration.updateConfig(updates);

      // Test the updated integration
      if (!(await integration.testConnection())) {
        throw new Error(`Failed to connect with updated configuration`);
      }

      logger.info(`Integration ${integrationId} updated successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to update integration ${integrationId}:`, error);
      return false;
    }
  }

  getIntegration(integrationId: string): BaseIntegration | undefined {
    return this.integrations.get(integrationId);
  }

  getAllIntegrations(): BaseIntegration[] {
    return Array.from(this.integrations.values());
  }

  getActiveIntegrations(): BaseIntegration[] {
    return Array.from(this.integrations.values()).filter(
      integration => integration.getConfig().isActive
    );
  }

  async syncIntegration(
    integrationId: string,
    direction: 'to_external' | 'from_external' | 'bidirectional'
  ): Promise<SyncResult> {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    const config = integration.getConfig();
    if (!config.isActive) {
      throw new Error(`Integration ${integrationId} is not active`);
    }

    try {
      let result: SyncResult;

      switch (direction) {
        case 'to_external':
          result = await integration.syncToExternal();
          break;
        case 'from_external':
          result = await integration.syncFromExternal();
          break;
        case 'bidirectional':
          const toExternalResult = await integration.syncToExternal();
          const fromExternalResult = await integration.syncFromExternal();

          result = {
            success: toExternalResult.success && fromExternalResult.success,
            recordsProcessed:
              toExternalResult.recordsProcessed +
              fromExternalResult.recordsProcessed,
            recordsCreated:
              toExternalResult.recordsCreated +
              fromExternalResult.recordsCreated,
            recordsUpdated:
              toExternalResult.recordsUpdated +
              fromExternalResult.recordsUpdated,
            recordsSkipped:
              toExternalResult.recordsSkipped +
              fromExternalResult.recordsSkipped,
            errors: [...toExternalResult.errors, ...fromExternalResult.errors],
            duration: toExternalResult.duration + fromExternalResult.duration,
          };
          break;
        default:
          throw new Error(`Invalid sync direction: ${direction}`);
      }

      // Update last sync time
      config.syncSettings.lastSync = new Date();
      integration.updateConfig(config);

      logger.info(`Sync completed for integration ${integrationId}:`, result);
      return result;
    } catch (error) {
      logger.error(`Sync failed for integration ${integrationId}:`, error);
      throw error;
    }
  }

  async syncAllIntegrations(): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();
    const activeIntegrations = this.getActiveIntegrations();

    for (const integration of activeIntegrations) {
      const config = integration.getConfig();

      try {
        const direction = config.syncSettings.bidirectional
          ? 'bidirectional'
          : 'from_external';
        const result = await this.syncIntegration(config.id, direction);
        results.set(config.id, result);
      } catch (error) {
        logger.error(`Failed to sync integration ${config.id}:`, error);
        results.set(config.id, {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          errors: [
            {
              recordId: 'sync',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
          duration: 0,
        });
      }
    }

    return results;
  }

  async testIntegration(integrationId: string): Promise<boolean> {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    return await integration.testConnection();
  }

  async testAllIntegrations(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [id, integration] of this.integrations) {
      try {
        const result = await integration.testConnection();
        results.set(id, result);
      } catch (error) {
        logger.error(`Test failed for integration ${id}:`, error);
        results.set(id, false);
      }
    }

    return results;
  }

  addMapping(mapping: IntegrationMapping): void {
    const integrationMappings =
      this.mappings.get(mapping.integrationType) || [];
    integrationMappings.push(mapping);
    this.mappings.set(mapping.integrationType, integrationMappings);
  }

  getMapping(
    integrationType: string,
    localId: string,
    recordType: string
  ): IntegrationMapping | undefined {
    const integrationMappings = this.mappings.get(integrationType) || [];
    return integrationMappings.find(
      mapping =>
        mapping.localId === localId && mapping.recordType === recordType
    );
  }

  getMappings(integrationType: string): IntegrationMapping[] {
    return this.mappings.get(integrationType) || [];
  }

  removeMapping(
    integrationType: string,
    localId: string,
    recordType: string
  ): boolean {
    const integrationMappings = this.mappings.get(integrationType) || [];
    const index = integrationMappings.findIndex(
      mapping =>
        mapping.localId === localId && mapping.recordType === recordType
    );

    if (index !== -1) {
      integrationMappings.splice(index, 1);
      this.mappings.set(integrationType, integrationMappings);
      return true;
    }

    return false;
  }

  getIntegrationStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [id, integration] of this.integrations) {
      const config = integration.getConfig();
      const mappings = this.getMappings(id);

      stats[id] = {
        name: config.name,
        type: config.type,
        isActive: config.isActive,
        lastSync: config.syncSettings.lastSync,
        syncInterval: config.syncSettings.syncInterval,
        mappingCount: mappings.length,
        contactMappings: mappings.filter(m => m.recordType === 'contact')
          .length,
        dealMappings: mappings.filter(m => m.recordType === 'deal').length,
        companyMappings: mappings.filter(m => m.recordType === 'company')
          .length,
      };
    }

    return stats;
  }
}
