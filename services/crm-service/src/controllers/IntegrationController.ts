import { Request, Response } from 'express';
import { z } from 'zod';
import { IntegrationConfig } from '../integrations/base-integration';
import { IntegrationManager } from '../integrations/integration-manager';
import logger from '../utils/logger';

const CreateIntegrationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['salesforce', 'hubspot', 'pipedrive', 'custom']),
  credentials: z.record(z.any()),
  settings: z.record(z.any()).optional().default({}),
  syncSettings: z
    .object({
      bidirectional: z.boolean().default(false),
      syncContacts: z.boolean().default(true),
      syncDeals: z.boolean().default(true),
      syncCompanies: z.boolean().default(true),
      syncInterval: z.number().min(5).default(60), // minutes
    })
    .optional()
    .default({
      bidirectional: false,
      syncContacts: true,
      syncDeals: true,
      syncCompanies: true,
      syncInterval: 60,
    }),
});

const UpdateIntegrationSchema = z.object({
  name: z.string().min(1).optional(),
  credentials: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
  syncSettings: z
    .object({
      bidirectional: z.boolean().optional(),
      syncContacts: z.boolean().optional(),
      syncDeals: z.boolean().optional(),
      syncCompanies: z.boolean().optional(),
      syncInterval: z.number().min(5).optional(),
    })
    .optional(),
});

type UpdateIntegrationRequest = z.infer<typeof UpdateIntegrationSchema>;

const SyncIntegrationSchema = z.object({
  direction: z
    .enum(['to_external', 'from_external', 'bidirectional'])
    .optional()
    .default('bidirectional'),
});

export class IntegrationController {
  private integrationManager: IntegrationManager;

  constructor() {
    this.integrationManager = new IntegrationManager();
  }

  async createIntegration(req: Request, res: Response): Promise<void> {
    try {
      const data = CreateIntegrationSchema.parse(req.body);

      const config: IntegrationConfig = {
        id: `${data.type}_${Date.now()}`,
        name: data.name,
        type: data.type,
        credentials: data.credentials,
        settings: data.settings,
        isActive: true,
        syncSettings: {
          ...data.syncSettings,
        },
      };
      const success = await this.integrationManager.addIntegration(config);

      if (success) {
        res.status(201).json({
          success: true,
          message: 'Integration created successfully',
          integration: {
            id: config.id,
            name: config.name,
            type: config.type,
            isActive: config.isActive,
            syncSettings: config.syncSettings,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to create integration',
        });
      }
    } catch (error) {
      logger.error('Error creating integration:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    }
  }

  async getIntegrations(req: Request, res: Response): Promise<void> {
    try {
      const integrations = this.integrationManager.getAllIntegrations();
      const integrationData = integrations.map(integration => {
        const config = integration.getConfig();
        return {
          id: config.id,
          name: config.name,
          type: config.type,
          isActive: config.isActive,
          syncSettings: config.syncSettings,
        };
      });

      res.json({
        success: true,
        integrations: integrationData,
      });
    } catch (error) {
      logger.error('Error getting integrations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async getIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { integrationId } = req.params;

      if (!integrationId) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });
        return;
      }

      const integration = this.integrationManager.getIntegration(integrationId);

      if (!integration) {
        res.status(404).json({
          success: false,
          message: 'Integration not found',
        });
        return;
      }

      const config = integration.getConfig();
      res.json({
        success: true,
        integration: {
          id: config.id,
          name: config.name,
          type: config.type,
          isActive: config.isActive,
          syncSettings: config.syncSettings,
          settings: config.settings,
        },
      });
    } catch (error) {
      logger.error('Error getting integration:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async updateIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { integrationId } = req.params;

      if (!integrationId) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });
        return;
      }

      const updates = UpdateIntegrationSchema.parse(req.body);

      // Filter out undefined values to create a proper Partial<IntegrationConfig>
      const filteredUpdates: Partial<IntegrationConfig> = {};
      if (updates.name !== undefined) filteredUpdates.name = updates.name;
      if (updates.credentials !== undefined)
        filteredUpdates.credentials = updates.credentials;
      if (updates.settings !== undefined)
        filteredUpdates.settings = updates.settings;
      if (updates.isActive !== undefined)
        filteredUpdates.isActive = updates.isActive;
      if (updates.syncSettings !== undefined) {
        filteredUpdates.syncSettings = updates.syncSettings as any; // Type assertion needed due to partial sync settings
      }

      const success = await this.integrationManager.updateIntegration(
        integrationId,
        filteredUpdates
      );

      if (success) {
        res.json({
          success: true,
          message: 'Integration updated successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to update integration',
        });
      }
    } catch (error) {
      logger.error('Error updating integration:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    }
  }

  async deleteIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { integrationId } = req.params;

      if (!integrationId) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });
        return;
      }

      const success =
        await this.integrationManager.removeIntegration(integrationId);

      if (success) {
        res.json({
          success: true,
          message: 'Integration deleted successfully',
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Integration not found',
        });
      }
    } catch (error) {
      logger.error('Error deleting integration:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async testIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { integrationId } = req.params;

      if (!integrationId) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });
        return;
      }

      const success =
        await this.integrationManager.testIntegration(integrationId);

      res.json({
        success: true,
        connected: success,
        message: success ? 'Connection successful' : 'Connection failed',
      });
    } catch (error) {
      logger.error('Error testing integration:', error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async testAllIntegrations(req: Request, res: Response): Promise<void> {
    try {
      const results = await this.integrationManager.testAllIntegrations();
      const testResults = Array.from(results.entries()).map(
        ([id, success]) => ({
          integrationId: id,
          connected: success,
        })
      );

      res.json({
        success: true,
        results: testResults,
      });
    } catch (error) {
      logger.error('Error testing all integrations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async syncIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { integrationId } = req.params;

      if (!integrationId) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });
        return;
      }

      const { direction } = SyncIntegrationSchema.parse(req.body);

      const result = await this.integrationManager.syncIntegration(
        integrationId,
        direction
      );

      res.json({
        success: true,
        message: 'Sync completed',
        result,
      });
    } catch (error) {
      logger.error('Error syncing integration:', error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async syncAllIntegrations(req: Request, res: Response): Promise<void> {
    try {
      const results = await this.integrationManager.syncAllIntegrations();
      const syncResults = Array.from(results.entries()).map(([id, result]) => ({
        integrationId: id,
        ...result,
      }));

      res.json({
        success: true,
        message: 'Sync completed for all integrations',
        results: syncResults,
      });
    } catch (error) {
      logger.error('Error syncing all integrations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async getIntegrationStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.integrationManager.getIntegrationStats();

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      logger.error('Error getting integration stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async getMappings(req: Request, res: Response): Promise<void> {
    try {
      const { integrationId } = req.params;

      if (!integrationId) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });
        return;
      }

      const mappings = this.integrationManager.getMappings(integrationId);

      res.json({
        success: true,
        mappings,
      });
    } catch (error) {
      logger.error('Error getting mappings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
}
