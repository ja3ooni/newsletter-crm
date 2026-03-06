// @ts-nocheck
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
  ConversionEvent,
  MarketingIntegrationConfig,
  TrackingEvent,
} from '../integrations/base-marketing-integration';
import { MarketingIntegrationManager } from '../integrations/marketing-integration-manager';
import { logger } from '../utils/logger';

export class IntegrationController {
  private integrationManager: MarketingIntegrationManager;

  constructor() {
    this.integrationManager = new MarketingIntegrationManager();
  }

  // Integration Management

  async createIntegration(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });

        return;
      }

      const config: MarketingIntegrationConfig = req.body;
      const success = await this.integrationManager.addIntegration(config);

      if (success) {
        res.status(201).json({
          success: true,
          message: 'Integration created successfully',
          data: { integrationId: config.id },
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to create integration',
        });
      }
    } catch (error) {
      logger.error('Error creating integration:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getIntegrations(req: Request, res: Response): Promise<void> {
    try {
      const integrations = this.integrationManager.getAllIntegrations();
      const integrationsData = integrations.map(integration => {
        const config = integration.getConfig();

        return {
          id: config.id,
          name: config.name,
          type: config.type,
          isActive: config.isActive,
          trackingSettings: config.trackingSettings,
        };
      });

      res.json({
        success: true,
        data: integrationsData,
        total: integrationsData.length,
      });
    } catch (error) {
      logger.error('Error getting integrations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });

        return;
      }
      const integration = this.integrationManager.getIntegration(id);

      if (!integration) {
        res.status(404).json({
          success: false,
          message: 'Integration not found',
        });

        return;
      }

      const config = integration.getConfig();
      const stats = await integration.getStats();

      res.json({
        success: true,
        data: {
          id: config.id,
          name: config.name,
          type: config.type,
          isActive: config.isActive,
          trackingSettings: config.trackingSettings,
          stats,
        },
      });
    } catch (error) {
      logger.error('Error getting integration:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateIntegration(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });

        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });

        return;
      }
      const updates = req.body;

      const success = await this.integrationManager.updateIntegration(
        id,
        updates
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
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });

        return;
      }
      const success = await this.integrationManager.removeIntegration(id);

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
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Integration Testing

  async testIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });

        return;
      }
      const result = await this.integrationManager.testIntegration(id);

      res.json({
        success: true,
        data: {
          integrationId: id,
          connectionStatus: result ? 'connected' : 'failed',
          tested: true,
        },
      });
    } catch (error) {
      logger.error('Error testing integration:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async testAllIntegrations(req: Request, res: Response): Promise<void> {
    try {
      const results = await this.integrationManager.testAllIntegrations();
      const testResults = Array.from(results.entries()).map(([id, status]) => ({
        integrationId: id,
        connectionStatus: status ? 'connected' : 'failed',
      }));

      res.json({
        success: true,
        data: testResults,
        summary: {
          total: testResults.length,
          connected: testResults.filter(r => r.connectionStatus === 'connected')
            .length,
          failed: testResults.filter(r => r.connectionStatus === 'failed')
            .length,
        },
      });
    } catch (error) {
      logger.error('Error testing all integrations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Event Tracking

  async trackPageView(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });

        return;
      }

      const { userId, page, properties } = req.body;
      const results = await this.integrationManager.trackPageView(
        userId as string,
        page as string,
        properties
      );

      const trackingResults = Array.from(results.entries()).map(
        ([integrationId, result]) => ({
          integrationId,
          success: result.success,
          eventId: result.eventId,
          error: result.error,
          timestamp: result.timestamp,
        })
      );

      res.json({
        success: true,
        message: 'Page view tracked',
        data: trackingResults,
        summary: {
          total: trackingResults.length,
          successful: trackingResults.filter(r => r.success).length,
          failed: trackingResults.filter(r => !r.success).length,
        },
      });
    } catch (error) {
      logger.error('Error tracking page view:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async trackEvent(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });

        return;
      }

      const event: TrackingEvent = req.body;
      const results = await this.integrationManager.trackEvent(event);

      const trackingResults = Array.from(results.entries()).map(
        ([integrationId, result]) => ({
          integrationId,
          success: result.success,
          eventId: result.eventId,
          error: result.error,
          timestamp: result.timestamp,
        })
      );

      res.json({
        success: true,
        message: 'Event tracked',
        data: trackingResults,
        summary: {
          total: trackingResults.length,
          successful: trackingResults.filter(r => r.success).length,
          failed: trackingResults.filter(r => !r.success).length,
        },
      });
    } catch (error) {
      logger.error('Error tracking event:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async trackConversion(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });

        return;
      }

      const conversion: ConversionEvent = req.body;
      const results = await this.integrationManager.trackConversion(conversion);

      const trackingResults = Array.from(results.entries()).map(
        ([integrationId, result]) => ({
          integrationId,
          success: result.success,
          eventId: result.eventId,
          error: result.error,
          timestamp: result.timestamp,
        })
      );

      res.json({
        success: true,
        message: 'Conversion tracked',
        data: trackingResults,
        summary: {
          total: trackingResults.length,
          successful: trackingResults.filter(r => r.success).length,
          failed: trackingResults.filter(r => !r.success).length,
        },
      });
    } catch (error) {
      logger.error('Error tracking conversion:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async trackCustomEvent(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });

        return;
      }

      const { eventName, properties } = req.body;
      const results = await this.integrationManager.trackCustomEvent(
        eventName,
        properties
      );

      const trackingResults = Array.from(results.entries()).map(
        ([integrationId, result]) => ({
          integrationId,
          success: result.success,
          eventId: result.eventId,
          error: result.error,
          timestamp: result.timestamp,
        })
      );

      res.json({
        success: true,
        message: 'Custom event tracked',
        data: trackingResults,
        summary: {
          total: trackingResults.length,
          successful: trackingResults.filter(r => r.success).length,
          failed: trackingResults.filter(r => !r.success).length,
        },
      });
    } catch (error) {
      logger.error('Error tracking custom event:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Batch Operations

  async trackBatchEvents(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });

        return;
      }

      const { events } = req.body;
      const results = await this.integrationManager.trackBatchEvents(events);

      const batchResults = Array.from(results.entries()).map(
        ([integrationId, eventResults]) => ({
          integrationId,
          events: eventResults.map(result => ({
            success: result.success,
            eventId: result.eventId,
            error: result.error,
            timestamp: result.timestamp,
          })),
          summary: {
            total: eventResults.length,
            successful: eventResults.filter(r => r.success).length,
            failed: eventResults.filter(r => !r.success).length,
          },
        })
      );

      res.json({
        success: true,
        message: 'Batch events tracked',
        data: batchResults,
      });
    } catch (error) {
      logger.error('Error tracking batch events:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Statistics and Analytics

  async getIntegrationStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.integrationManager.getIntegrationStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting integration stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Webhook Handling

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { integrationId } = req.params;

      if (!integrationId) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });

        return;
      }
      const payload = req.body;

      await this.integrationManager.handleWebhook(integrationId, payload);

      res.json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      logger.error('Error handling webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Data Export/Import

  async exportIntegrationData(req: Request, res: Response): Promise<void> {
    try {
      const { integrationId } = req.params;

      if (!integrationId) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });

        return;
      }
      const { startDate, endDate } = req.query;

      const start = startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const data = await this.integrationManager.exportIntegrationData(
        integrationId,
        start,
        end
      );

      res.json({
        success: true,
        data,
        exportInfo: {
          integrationId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          exportedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error exporting integration data:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async importIntegrationData(req: Request, res: Response): Promise<void> {
    try {
      const { integrationId } = req.params;

      if (!integrationId) {
        res.status(400).json({
          success: false,
          message: 'Integration ID is required',
        });

        return;
      }
      const { data } = req.body;

      const success = await this.integrationManager.importIntegrationData(
        integrationId,
        data
      );

      if (success) {
        res.json({
          success: true,
          message: 'Data imported successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to import data',
        });
      }
    } catch (error) {
      logger.error('Error importing integration data:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default IntegrationController;
