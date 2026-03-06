// @ts-nocheck
import { logger } from '../utils/logger';
import {
  BaseMarketingIntegration,
  ConversionEvent,
  MarketingIntegrationConfig,
  TrackingEvent,
  TrackingResult,
} from './base-marketing-integration';
import { FacebookPixelIntegration } from './facebook-pixel';
import { GoogleAnalyticsIntegration } from './google-analytics';
import { SegmentIntegration } from './segment';
import { ZapierIntegration } from './zapier';

export interface IntegrationEventMapping {
  localEventName: string;
  externalEventName: string;
  integrationType: string;
  properties?: Record<string, string>; // Maps local property names to external property names
}

export class MarketingIntegrationManager {
  private integrations: Map<string, BaseMarketingIntegration> = new Map();
  private eventMappings: Map<string, IntegrationEventMapping[]> = new Map();

  constructor() {
    // Initialize with empty mappings
  }

  async addIntegration(config: MarketingIntegrationConfig): Promise<boolean> {
    try {
      let integration: BaseMarketingIntegration;

      switch (config.type) {
        case 'google_analytics':
          integration = new GoogleAnalyticsIntegration(config);
          break;
        case 'facebook_pixel':
          integration = new FacebookPixelIntegration(config);
          break;
        case 'zapier':
          integration = new ZapierIntegration(config);
          break;
        case 'segment':
          integration = new SegmentIntegration(config);
          break;
        default:
          throw new Error(`Unsupported integration type: ${config.type}`);
      }

      // Test the integration
      if (!(await integration.testConnection())) {
        throw new Error(`Failed to connect to ${config.name}`);
      }

      this.integrations.set(config.id, integration);
      this.eventMappings.set(config.id, []);

      logger.info(`Marketing integration ${config.name} added successfully`);

      return true;
    } catch (error) {
      logger.error(
        `Failed to add marketing integration ${config.name}:`,
        error
      );

      return false;
    }
  }

  async removeIntegration(integrationId: string): Promise<boolean> {
    try {
      this.integrations.delete(integrationId);
      this.eventMappings.delete(integrationId);

      logger.info(
        `Marketing integration ${integrationId} removed successfully`
      );

      return true;
    } catch (error) {
      logger.error(
        `Failed to remove marketing integration ${integrationId}:`,
        error
      );

      return false;
    }
  }

  async updateIntegration(
    integrationId: string,
    updates: Partial<MarketingIntegrationConfig>
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

      logger.info(
        `Marketing integration ${integrationId} updated successfully`
      );

      return true;
    } catch (error) {
      logger.error(
        `Failed to update marketing integration ${integrationId}:`,
        error
      );

      return false;
    }
  }

  getIntegration(integrationId: string): BaseMarketingIntegration | undefined {
    return this.integrations.get(integrationId);
  }

  getAllIntegrations(): BaseMarketingIntegration[] {
    return Array.from(this.integrations.values());
  }

  getActiveIntegrations(): BaseMarketingIntegration[] {
    return Array.from(this.integrations.values()).filter(
      integration => integration.getConfig().isActive
    );
  }

  // Event tracking methods

  async trackPageView(
    userId: string,
    page: string,
    properties?: Record<string, any>
  ): Promise<Map<string, TrackingResult>> {
    const results = new Map<string, TrackingResult>();
    const activeIntegrations = this.getActiveIntegrations();

    for (const integration of activeIntegrations) {
      const config = integration.getConfig();

      if (config.trackingSettings.trackPageViews) {
        try {
          const result = await integration.trackPageView(
            userId,
            page,
            properties
          );

          results.set(config.id, result);
        } catch (error) {
          logger.error(`Failed to track page view in ${config.name}:`, error);
          results.set(config.id, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
        }
      }
    }

    return results;
  }

  async trackEvent(event: TrackingEvent): Promise<Map<string, TrackingResult>> {
    const results = new Map<string, TrackingResult>();
    const activeIntegrations = this.getActiveIntegrations();

    for (const integration of activeIntegrations) {
      const config = integration.getConfig();

      if (config.trackingSettings.trackEvents) {
        try {
          // Apply event mapping if exists
          const mappedEvent = this.applyEventMapping(event, config.id);
          const result = await integration.trackEvent(mappedEvent);

          results.set(config.id, result);
        } catch (error) {
          logger.error(`Failed to track event in ${config.name}:`, error);
          results.set(config.id, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
        }
      }
    }

    return results;
  }

  async trackConversion(
    conversion: ConversionEvent
  ): Promise<Map<string, TrackingResult>> {
    const results = new Map<string, TrackingResult>();
    const activeIntegrations = this.getActiveIntegrations();

    for (const integration of activeIntegrations) {
      const config = integration.getConfig();

      if (config.trackingSettings.trackConversions) {
        try {
          const result = await integration.trackConversion(conversion);

          results.set(config.id, result);
        } catch (error) {
          logger.error(`Failed to track conversion in ${config.name}:`, error);
          results.set(config.id, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
        }
      }
    }

    return results;
  }

  async trackCustomEvent(
    eventName: string,
    properties: Record<string, any>
  ): Promise<Map<string, TrackingResult>> {
    const results = new Map<string, TrackingResult>();
    const activeIntegrations = this.getActiveIntegrations();

    for (const integration of activeIntegrations) {
      const config = integration.getConfig();

      if (config.trackingSettings.trackCustomEvents) {
        try {
          // Apply custom event mapping if exists
          const mappedEventName =
            config.trackingSettings.customEventMappings[eventName] || eventName;
          const result = await integration.trackCustomEvent(
            mappedEventName,
            properties
          );

          results.set(config.id, result);
        } catch (error) {
          logger.error(
            `Failed to track custom event in ${config.name}:`,
            error
          );
          results.set(config.id, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
        }
      }
    }

    return results;
  }

  // Batch operations

  async trackBatchEvents(
    events: TrackingEvent[]
  ): Promise<Map<string, TrackingResult[]>> {
    const results = new Map<string, TrackingResult[]>();
    const activeIntegrations = this.getActiveIntegrations();

    for (const integration of activeIntegrations) {
      const config = integration.getConfig();

      if (config.trackingSettings.trackEvents) {
        try {
          const mappedEvents = events.map(event =>
            this.applyEventMapping(event, config.id)
          );
          const batchResults = await integration.trackBatchEvents(mappedEvents);

          results.set(config.id, batchResults);
        } catch (error) {
          logger.error(
            `Failed to track batch events in ${config.name}:`,
            error
          );
          const errorResults = events.map(() => ({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          }));

          results.set(config.id, errorResults);
        }
      }
    }

    return results;
  }

  // Integration testing

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

  // Event mapping management

  addEventMapping(
    integrationId: string,
    mapping: IntegrationEventMapping
  ): void {
    const mappings = this.eventMappings.get(integrationId) || [];

    mappings.push(mapping);
    this.eventMappings.set(integrationId, mappings);
  }

  removeEventMapping(integrationId: string, localEventName: string): boolean {
    const mappings = this.eventMappings.get(integrationId) || [];
    const index = mappings.findIndex(
      mapping => mapping.localEventName === localEventName
    );

    if (index !== -1) {
      mappings.splice(index, 1);
      this.eventMappings.set(integrationId, mappings);

      return true;
    }

    return false;
  }

  getEventMappings(integrationId: string): IntegrationEventMapping[] {
    return this.eventMappings.get(integrationId) || [];
  }

  private applyEventMapping(
    event: TrackingEvent,
    integrationId: string
  ): TrackingEvent {
    const mappings = this.eventMappings.get(integrationId) || [];
    const mapping = mappings.find(m => m.localEventName === event.eventName);

    if (!mapping) {
      return event;
    }

    const mappedEvent: TrackingEvent = {
      ...event,
      eventName: mapping.externalEventName,
    };

    // Apply property mappings if they exist
    if (mapping.properties) {
      const mappedProperties: Record<string, any> = {};

      for (const [localProp, externalProp] of Object.entries(
        mapping.properties
      )) {
        if (event.properties[localProp] !== undefined) {
          mappedProperties[externalProp] = event.properties[localProp];
        }
      }

      // Include unmapped properties
      for (const [key, value] of Object.entries(event.properties)) {
        if (!mapping.properties[key]) {
          mappedProperties[key] = value;
        }
      }

      mappedEvent.properties = mappedProperties;
    }

    return mappedEvent;
  }

  // Statistics and monitoring

  async getIntegrationStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const [id, integration] of this.integrations) {
      try {
        const config = integration.getConfig();
        const integrationStats = await integration.getStats();

        stats[id] = {
          name: config.name,
          type: config.type,
          isActive: config.isActive,
          trackingSettings: config.trackingSettings,
          stats: integrationStats,
        };
      } catch (error) {
        logger.error(`Failed to get stats for integration ${id}:`, error);
        stats[id] = {
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return stats;
  }

  // Webhook handling

  async handleWebhook(integrationId: string, payload: any): Promise<void> {
    const integration = this.integrations.get(integrationId);

    if (!integration || !integration.handleWebhook) {
      throw new Error(
        `Integration ${integrationId} not found or doesn't support webhooks`
      );
    }

    await integration.handleWebhook(payload);
  }

  // Data export/import

  async exportIntegrationData(
    integrationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const integration = this.integrations.get(integrationId);

    if (!integration || !integration.exportData) {
      throw new Error(
        `Integration ${integrationId} not found or doesn't support data export`
      );
    }

    return await integration.exportData(startDate, endDate);
  }

  async importIntegrationData(
    integrationId: string,
    data: any
  ): Promise<boolean> {
    const integration = this.integrations.get(integrationId);

    if (!integration || !integration.importData) {
      throw new Error(
        `Integration ${integrationId} not found or doesn't support data import`
      );
    }

    return await integration.importData(data);
  }
}
