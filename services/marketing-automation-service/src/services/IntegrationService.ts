import {
  ConversionEvent,
  MarketingIntegrationConfig,
  TrackingEvent,
} from '../integrations/base-marketing-integration';
import { MarketingIntegrationManager } from '../integrations/marketing-integration-manager';
import { logger } from '../utils/logger';

export interface IntegrationTemplate {
  type: 'google_analytics' | 'facebook_pixel' | 'zapier' | 'segment';
  name: string;
  description: string;
  requiredCredentials: string[];
  optionalCredentials: string[];
  features: string[];
  setupInstructions: string[];
}

export class IntegrationService {
  private integrationManager: MarketingIntegrationManager;
  private templates: Map<string, IntegrationTemplate> = new Map();

  constructor() {
    this.integrationManager = new MarketingIntegrationManager();
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Google Analytics Template
    this.templates.set('google_analytics', {
      type: 'google_analytics',
      name: 'Google Analytics 4',
      description:
        'Track website analytics, conversions, and user behavior with enhanced ecommerce support',
      requiredCredentials: ['measurementId', 'apiSecret'],
      optionalCredentials: ['serviceAccountKey', 'propertyId'],
      features: [
        'Page view tracking',
        'Event tracking',
        'Enhanced ecommerce',
        'Goal conversion tracking',
        'Custom dimensions',
        'Audience insights',
      ],
      setupInstructions: [
        'Create a Google Analytics 4 property',
        'Enable Measurement Protocol in your GA4 property',
        'Generate an API secret for server-side tracking',
        'Copy your Measurement ID (G-XXXXXXXXXX)',
        'Optional: Set up service account for reporting API access',
      ],
    });

    // Facebook Pixel Template
    this.templates.set('facebook_pixel', {
      type: 'facebook_pixel',
      name: 'Facebook Pixel',
      description:
        'Track conversions, optimize ads, and build targeted audiences for Facebook advertising',
      requiredCredentials: ['pixelId', 'accessToken'],
      optionalCredentials: ['testEventCode', 'adAccountId', 'appId'],
      features: [
        'Conversion tracking',
        'Custom audience creation',
        'Lookalike audience generation',
        'Retargeting events',
        'Enhanced ecommerce tracking',
        'App event tracking',
      ],
      setupInstructions: [
        'Create a Facebook Pixel in your Facebook Ads Manager',
        'Generate a system user access token with ads_management permissions',
        'Copy your Pixel ID from the Events Manager',
        'Optional: Set up test events for validation',
        'Optional: Configure ad account for audience management',
      ],
    });

    // Zapier Template
    this.templates.set('zapier', {
      type: 'zapier',
      name: 'Zapier',
      description:
        'Connect with 1000+ apps through automated workflows and webhooks',
      requiredCredentials: ['webhookUrl'],
      optionalCredentials: ['apiKey', 'platformApiKey', 'subscribeKey'],
      features: [
        'Webhook triggers',
        'Multi-step automation',
        'App connections',
        'Event forwarding',
        'Custom Zap creation',
        'Workflow management',
      ],
      setupInstructions: [
        'Create a Zapier webhook trigger',
        'Copy the webhook URL from your Zap',
        'Optional: Get Platform API access for advanced features',
        'Configure event mappings for your workflows',
        'Test the webhook connection',
      ],
    });

    // Segment Template
    this.templates.set('segment', {
      type: 'segment',
      name: 'Segment',
      description:
        'Unified customer data platform with advanced profile management and audience creation',
      requiredCredentials: ['writeKey'],
      optionalCredentials: [
        'dataPlaneUrl',
        'profileApiToken',
        'spaceId',
        'computeApiToken',
      ],
      features: [
        'Unified customer profiles',
        'Event tracking',
        'Computed traits',
        'Audience creation',
        'Customer journey mapping',
        'Profile insights',
      ],
      setupInstructions: [
        'Create a Segment source in your workspace',
        'Copy the Write Key from your source settings',
        'Optional: Set up Profile API access for unified profiles',
        'Optional: Configure Computed Traits for advanced segmentation',
        'Configure destination integrations',
      ],
    });
  }

  // Template Management

  getIntegrationTemplates(): IntegrationTemplate[] {
    return Array.from(this.templates.values());
  }

  getIntegrationTemplate(type: string): IntegrationTemplate | undefined {
    return this.templates.get(type);
  }

  // Integration Management

  async createIntegration(config: MarketingIntegrationConfig): Promise<{
    success: boolean;
    integrationId?: string;
    error?: string;
  }> {
    try {
      // Validate configuration against template
      const template = this.templates.get(config.type);

      if (!template) {
        throw new Error(`Unsupported integration type: ${config.type}`);
      }

      const validationResult = this.validateIntegrationConfig(config, template);

      if (!validationResult.isValid) {
        throw new Error(
          `Configuration validation failed: ${validationResult.errors.join(', ')}`
        );
      }

      const success = await this.integrationManager.addIntegration(config);

      if (success) {
        logger.info(`Integration ${config.name} created successfully`);

        return {
          success: true,
          integrationId: config.id,
        };
      } else {
        throw new Error('Failed to create integration');
      }
    } catch (error) {
      logger.error('Error creating integration:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateIntegration(
    integrationId: string,
    updates: Partial<MarketingIntegrationConfig>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const success = await this.integrationManager.updateIntegration(
        integrationId,
        updates
      );

      if (success) {
        logger.info(`Integration ${integrationId} updated successfully`);

        return { success: true };
      } else {
        throw new Error('Failed to update integration');
      }
    } catch (error) {
      logger.error('Error updating integration:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteIntegration(
    integrationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const success =
        await this.integrationManager.removeIntegration(integrationId);

      if (success) {
        logger.info(`Integration ${integrationId} deleted successfully`);

        return { success: true };
      } else {
        throw new Error('Integration not found');
      }
    } catch (error) {
      logger.error('Error deleting integration:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Event Tracking with Enhanced Features

  async trackUnifiedEvent(
    eventData: UnifiedEventData
  ): Promise<{ success: boolean; results: any[]; summary: any }> {
    try {
      const trackingEvent: TrackingEvent = {
        eventName: eventData.eventName,
        eventType: eventData.eventType,
        userId: eventData.userId || undefined,
        sessionId: eventData.sessionId || undefined,
        properties: eventData.properties,
        timestamp: eventData.timestamp || new Date(),
        source: eventData.source || 'datatechtoncrm_platform',
      };

      const results = await this.integrationManager.trackEvent(trackingEvent);

      const trackingResults = Array.from(results.entries()).map(
        ([integrationId, result]) => ({
          integrationId,
          success: result.success,
          eventId: result.eventId,
          error: result.error,
          timestamp: result.timestamp,
        })
      );

      const summary = {
        total: trackingResults.length,
        successful: trackingResults.filter(r => r.success).length,
        failed: trackingResults.filter(r => !r.success).length,
        successRate:
          trackingResults.length > 0
            ? (trackingResults.filter(r => r.success).length /
                trackingResults.length) *
              100
            : 0,
      };

      return {
        success: summary.successful > 0,
        results: trackingResults,
        summary,
      };
    } catch (error) {
      logger.error('Error tracking unified event:', error);

      return {
        success: false,
        results: [],
        summary: { total: 0, successful: 0, failed: 0, successRate: 0 },
      };
    }
  }

  async trackConversionWithAttribution(
    conversionData: ConversionWithAttribution
  ): Promise<{ success: boolean; results: any[]; attribution: any }> {
    try {
      const conversionEvent: ConversionEvent = {
        eventName: conversionData.eventName,
        userId: conversionData.userId || undefined,
        sessionId: conversionData.sessionId || undefined,
        value: conversionData.value || undefined,
        currency: conversionData.currency || undefined,
        conversionType: conversionData.conversionType,
        properties: {
          ...conversionData.properties,
          attribution: conversionData.attribution,
        },
        timestamp: conversionData.timestamp || new Date(),
      };

      const results =
        await this.integrationManager.trackConversion(conversionEvent);

      const trackingResults = Array.from(results.entries()).map(
        ([integrationId, result]) => ({
          integrationId,
          success: result.success,
          eventId: result.eventId,
          error: result.error,
          timestamp: result.timestamp,
        })
      );

      // Calculate attribution insights
      const attribution = this.calculateAttribution(conversionData.attribution);

      return {
        success: trackingResults.some(r => r.success),
        results: trackingResults,
        attribution,
      };
    } catch (error) {
      logger.error('Error tracking conversion with attribution:', error);

      return {
        success: false,
        results: [],
        attribution: null,
      };
    }
  }

  // Analytics and Insights

  async getIntegrationInsights(): Promise<IntegrationInsights> {
    try {
      const stats = await this.integrationManager.getIntegrationStats();
      const integrations = this.integrationManager.getAllIntegrations();

      const insights: IntegrationInsights = {
        totalIntegrations: integrations.length,
        activeIntegrations: integrations.filter(i => i.getConfig().isActive)
          .length,
        integrationTypes: this.getIntegrationTypeBreakdown(integrations),
        healthStatus: await this.getHealthStatus(),
        recommendations: this.generateRecommendations(integrations),
        performance: this.calculatePerformanceMetrics(stats),
      };

      return insights;
    } catch (error) {
      logger.error('Error getting integration insights:', error);

      return {
        totalIntegrations: 0,
        activeIntegrations: 0,
        integrationTypes: {},
        healthStatus: 'unknown',
        recommendations: [],
        performance: { averageResponseTime: 0, successRate: 0, errorRate: 0 },
      };
    }
  }

  // Validation and Health Checks

  private validateIntegrationConfig(
    config: MarketingIntegrationConfig,
    template: IntegrationTemplate
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required credentials
    for (const requiredField of template.requiredCredentials) {
      if (!config.credentials[requiredField]) {
        errors.push(`Missing required credential: ${requiredField}`);
      }
    }

    // Validate tracking settings
    if (!config.trackingSettings) {
      errors.push('Tracking settings are required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async getHealthStatus(): Promise<
    'healthy' | 'degraded' | 'unhealthy'
  > {
    try {
      const testResults = await this.integrationManager.testAllIntegrations();
      const totalIntegrations = testResults.size;
      const healthyIntegrations = Array.from(testResults.values()).filter(
        Boolean
      ).length;

      if (totalIntegrations === 0) return 'healthy';

      const healthRatio = healthyIntegrations / totalIntegrations;

      if (healthRatio >= 0.8) return 'healthy';
      if (healthRatio >= 0.5) return 'degraded';

      return 'unhealthy';
    } catch (error) {
      logger.error('Error checking health status:', error);

      return 'unhealthy';
    }
  }

  private getIntegrationTypeBreakdown(
    integrations: any[]
  ): Record<string, number> {
    return integrations.reduce(
      (acc, integration) => {
        const type = integration.getConfig().type;

        acc[type] = (acc[type] || 0) + 1;

        return acc;
      },
      {} as Record<string, number>
    );
  }

  private generateRecommendations(integrations: any[]): string[] {
    const recommendations: string[] = [];
    const types = new Set(integrations.map(i => i.getConfig().type));

    if (!types.has('google_analytics')) {
      recommendations.push(
        'Consider adding Google Analytics for comprehensive website tracking'
      );
    }

    if (!types.has('segment')) {
      recommendations.push('Add Segment for unified customer data management');
    }

    if (integrations.length > 0 && !types.has('zapier')) {
      recommendations.push(
        'Connect Zapier to automate workflows with 1000+ apps'
      );
    }

    const inactiveIntegrations = integrations.filter(
      i => !i.getConfig().isActive
    );

    if (inactiveIntegrations.length > 0) {
      recommendations.push(
        `${inactiveIntegrations.length} integration(s) are inactive - consider activating or removing them`
      );
    }

    return recommendations;
  }

  private calculatePerformanceMetrics(stats: Record<string, any>): {
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
  } {
    // This would be calculated from actual performance data
    // For now, return mock metrics
    return {
      averageResponseTime: 150, // ms
      successRate: 98.5, // %
      errorRate: 1.5, // %
    };
  }

  private calculateAttribution(attributionData: any): any {
    // Simple attribution calculation
    return {
      firstTouch: attributionData.firstTouch || 'direct',
      lastTouch: attributionData.lastTouch || 'direct',
      touchpoints: attributionData.touchpoints || [],
      timeToConversion: attributionData.timeToConversion || 0,
    };
  }
}

// Interfaces

export interface UnifiedEventData {
  eventName: string;
  eventType: 'page_view' | 'click' | 'conversion' | 'custom';
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  timestamp?: Date;
  source?: string;
}

export interface ConversionWithAttribution {
  eventName: string;
  userId?: string;
  sessionId?: string;
  value?: number;
  currency?: string;
  conversionType: 'purchase' | 'signup' | 'lead' | 'custom';
  properties: Record<string, any>;
  timestamp?: Date;
  attribution: {
    firstTouch?: string;
    lastTouch?: string;
    touchpoints?: string[];
    timeToConversion?: number;
  };
}

export interface IntegrationInsights {
  totalIntegrations: number;
  activeIntegrations: number;
  integrationTypes: Record<string, number>;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  recommendations: string[];
  performance: {
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
  };
}
