import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import {
  BaseMarketingIntegration,
  ConversionEvent,
  IntegrationStats,
  MarketingIntegrationConfig,
  TrackingEvent,
  TrackingResult,
} from './base-marketing-integration';

interface ZapierCredentials {
  webhookUrl: string;
  apiKey?: string;
  appId?: string;
  platformApiKey?: string; // For Zapier Platform API
  subscribeKey?: string; // For webhook subscriptions
}

interface ZapierWebhook {
  id: string;
  url: string;
  event: string;
  isActive: boolean;
  createdAt: Date;
}

interface ZapierTrigger {
  event: string;
  data: Record<string, any>;
  timestamp: Date;
  source: string;
}

export class ZapierIntegration extends BaseMarketingIntegration {
  private client: AxiosInstance;
  private platformClient: AxiosInstance;
  private webhookUrl: string;
  private apiKey: string | undefined;
  private platformApiKey: string | undefined;
  private subscribeKey: string | undefined;
  private webhooks: Map<string, ZapierWebhook> = new Map();
  private appConnections: Map<string, ZapierAppConnection> = new Map();

  constructor(config: MarketingIntegrationConfig) {
    super(config);
    const credentials = this.config.credentials as ZapierCredentials;

    if (!credentials.webhookUrl) {
      throw new Error('Zapier webhook URL is required');
    }

    this.webhookUrl = credentials.webhookUrl;
    this.apiKey = credentials.apiKey ?? undefined;
    this.platformApiKey = credentials.platformApiKey ?? undefined;
    this.subscribeKey = credentials.subscribeKey ?? undefined;

    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });

    // Zapier Platform API client
    this.platformClient = axios.create({
      baseURL: 'https://zapier.com/api/platform/v4',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.platformApiKey && {
          Authorization: `Bearer ${this.platformApiKey}`,
        }),
      },
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      // Test the webhook by sending a test payload
      const testPayload = {
        event: 'test_connection',
        timestamp: new Date().toISOString(),
        data: {
          test: true,
          source: 'datatechtoncrm_platform',
        },
      };

      const response = await this.client.post(this.webhookUrl, testPayload);

      logger.info('Zapier authentication successful');

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error('Zapier authentication failed:', error);

      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    return await this.authenticate();
  }

  async trackPageView(
    userId: string,
    page: string,
    properties?: Record<string, any>
  ): Promise<TrackingResult> {
    try {
      const payload = {
        event: 'page_view',
        timestamp: new Date().toISOString(),
        user_id: userId,
        data: {
          page_url: page,
          page_title: properties?.title,
          referrer: properties?.referrer,
          user_agent: properties?.user_agent,
          ip_address: properties?.ip_address,
          ...properties,
        },
      };

      const response = await this.sendWebhook(payload);

      return {
        success: response.success,
        eventId: `zapier_${Date.now()}`,
        ...(response.error && { error: response.error }),
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track page view in Zapier:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async trackEvent(event: TrackingEvent): Promise<TrackingResult> {
    try {
      const payload = {
        event: event.eventName,
        event_type: event.eventType,
        timestamp: event.timestamp.toISOString(),
        user_id: event.userId,
        session_id: event.sessionId,
        source: event.source,
        data: event.properties,
      };

      const response = await this.sendWebhook(payload);

      return {
        success: response.success,
        eventId: `zapier_${Date.now()}`,
        ...(response.error && { error: response.error }),
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track event in Zapier:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async trackConversion(conversion: ConversionEvent): Promise<TrackingResult> {
    try {
      const payload = {
        event: 'conversion',
        conversion_type: conversion.conversionType,
        timestamp: conversion.timestamp.toISOString(),
        user_id: conversion.userId,
        session_id: conversion.sessionId,
        data: {
          event_name: conversion.eventName,
          value: conversion.value,
          currency: conversion.currency,
          ...conversion.properties,
        },
      };

      const response = await this.sendWebhook(payload);

      return {
        success: response.success,
        eventId: `zapier_conv_${Date.now()}`,
        ...(response.error && { error: response.error }),
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track conversion in Zapier:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async trackCustomEvent(
    eventName: string,
    properties: Record<string, any>
  ): Promise<TrackingResult> {
    try {
      const payload = {
        event: eventName,
        event_type: 'custom',
        timestamp: new Date().toISOString(),
        user_id: properties.userId,
        session_id: properties.sessionId,
        source: 'datatechtoncrm_platform',
        data: this.sanitizeProperties(properties),
      };

      const response = await this.sendWebhook(payload);

      return {
        success: response.success,
        eventId: `zapier_custom_${Date.now()}`,
        ...(response.error && { error: response.error }),
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track custom event in Zapier:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async getStats(): Promise<IntegrationStats> {
    // Zapier doesn't provide built-in analytics, so we return basic stats
    return {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      errorRate: 0,
    };
  }

  // Zapier-specific methods

  async registerWebhook(event: string, url: string): Promise<boolean> {
    try {
      const webhook: ZapierWebhook = {
        id: `webhook_${Date.now()}`,
        url,
        event,
        isActive: true,
        createdAt: new Date(),
      };

      this.webhooks.set(webhook.id, webhook);

      logger.info(`Registered Zapier webhook for event: ${event}`);

      return true;
    } catch (error) {
      logger.error('Failed to register Zapier webhook:', error);

      return false;
    }
  }

  async unregisterWebhook(webhookId: string): Promise<boolean> {
    try {
      const webhook = this.webhooks.get(webhookId);

      if (webhook) {
        this.webhooks.delete(webhookId);
        logger.info(`Unregistered Zapier webhook: ${webhookId}`);

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to unregister Zapier webhook:', error);

      return false;
    }
  }

  async triggerZap(
    zapName: string,
    data: Record<string, any>
  ): Promise<TrackingResult> {
    try {
      const payload = {
        event: 'zap_trigger',
        zap_name: zapName,
        timestamp: new Date().toISOString(),
        data: this.sanitizeProperties(data),
      };

      const response = await this.sendWebhook(payload);

      return {
        success: response.success,
        eventId: `zap_${Date.now()}`,
        ...(response.error && { error: response.error }),
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to trigger Zap:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  override async handleWebhook(payload: any): Promise<void> {
    try {
      logger.info('Received Zapier webhook:', payload);

      // Process the webhook payload
      const event = payload.event || 'unknown';
      const data = payload.data || {};

      // You can add custom logic here to handle different webhook events
      switch (event) {
        case 'contact_created':
          await this.handleContactCreated(data);
          break;
        case 'deal_updated':
          await this.handleDealUpdated(data);
          break;
        case 'email_sent':
          await this.handleEmailSent(data);
          break;
        default:
          logger.info(`Unhandled Zapier webhook event: ${event}`);
      }
    } catch (error) {
      logger.error('Failed to handle Zapier webhook:', error);
    }
  }

  private async sendWebhook(
    payload: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.client.post(this.webhookUrl, payload);

      return {
        success: response.status >= 200 && response.status < 300,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private sanitizeProperties(
    properties: Record<string, any>
  ): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      // Remove internal fields
      if (!key.startsWith('_') && value !== undefined && value !== null) {
        // Convert complex objects to strings
        if (
          typeof value === 'object' &&
          !Array.isArray(value) &&
          !(value instanceof Date)
        ) {
          sanitized[key] = JSON.stringify(value);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  private async handleContactCreated(data: any): Promise<void> {
    // Handle contact creation webhook from Zapier
    logger.info('Handling contact created webhook:', data);
    // Add your custom logic here
  }

  private async handleDealUpdated(data: any): Promise<void> {
    // Handle deal update webhook from Zapier
    logger.info('Handling deal updated webhook:', data);
    // Add your custom logic here
  }

  private async handleEmailSent(data: any): Promise<void> {
    // Handle email sent webhook from Zapier
    logger.info('Handling email sent webhook:', data);
    // Add your custom logic here
  }

  // Batch operations for Zapier
  async sendBatchWebhook(events: any[]): Promise<TrackingResult[]> {
    const results: TrackingResult[] = [];

    // Zapier typically handles one event at a time, so we send them individually
    for (const event of events) {
      try {
        const result = await this.sendWebhook(event);

        results.push({
          success: result.success,
          eventId: `zapier_batch_${Date.now()}`,
          ...(result.error && { error: result.error }),
          timestamp: new Date(),
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  // Enhanced App Connection Management

  async getAvailableApps(): Promise<ZapierApp[]> {
    try {
      if (!this.platformApiKey) {
        logger.warn('Platform API key required for app discovery');

        return [];
      }

      const response = await this.platformClient.get('/apps');

      return response.data.objects.map((app: any) => ({
        id: app.id,
        title: app.title,
        description: app.description,
        category: app.category,
        imageUrl: app.image_url,
        isPublic: app.public,
        triggers: app.triggers || [],
        actions: app.actions || [],
        searches: app.searches || [],
      }));
    } catch (error) {
      logger.error('Failed to get available apps:', error);

      return [];
    }
  }

  async connectApp(
    appId: string,
    connectionData: ZapierConnectionData
  ): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    try {
      const connection: ZapierAppConnection = {
        id: `conn_${Date.now()}`,
        appId,
        name: connectionData.name,
        credentials: connectionData.credentials,
        isActive: true,
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      this.appConnections.set(connection.id, connection);

      // Test the connection
      const testResult = await this.testAppConnection(connection.id);

      if (!testResult) {
        this.appConnections.delete(connection.id);

        return {
          success: false,
          error: 'Connection test failed',
        };
      }

      logger.info(`Connected to Zapier app: ${appId}`);

      return {
        success: true,
        connectionId: connection.id,
      };
    } catch (error) {
      logger.error('Failed to connect app:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async disconnectApp(connectionId: string): Promise<boolean> {
    try {
      const connection = this.appConnections.get(connectionId);

      if (connection) {
        this.appConnections.delete(connectionId);
        logger.info(`Disconnected from app connection: ${connectionId}`);

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to disconnect app:', error);

      return false;
    }
  }

  async testAppConnection(connectionId: string): Promise<boolean> {
    try {
      const connection = this.appConnections.get(connectionId);

      if (!connection) {
        return false;
      }

      // Send a test trigger to verify the connection
      const testPayload = {
        event: 'connection_test',
        connection_id: connectionId,
        app_id: connection.appId,
        timestamp: new Date().toISOString(),
        data: {
          test: true,
        },
      };

      const response = await this.sendWebhook(testPayload);

      if (response.success) {
        connection.lastUsed = new Date();
        this.appConnections.set(connectionId, connection);
      }

      return response.success;
    } catch (error) {
      logger.error('Failed to test app connection:', error);

      return false;
    }
  }

  async executeAppAction(
    connectionId: string,
    actionKey: string,
    inputData: Record<string, any>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const connection = this.appConnections.get(connectionId);

      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      const payload = {
        event: 'app_action',
        connection_id: connectionId,
        action_key: actionKey,
        timestamp: new Date().toISOString(),
        data: inputData,
      };

      const response = await this.sendWebhook(payload);

      if (response.success) {
        connection.lastUsed = new Date();
        this.appConnections.set(connectionId, connection);
      }

      return {
        success: response.success,
        result: response,
        error: response.error,
      };
    } catch (error) {
      logger.error('Failed to execute app action:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createMultiStepZap(
    zapConfig: MultiStepZapConfig
  ): Promise<{ success: boolean; zapId?: string; error?: string }> {
    try {
      const zapId = `zap_${Date.now()}`;

      // Create a multi-step automation workflow
      const zapPayload = {
        event: 'create_multi_step_zap',
        zap_id: zapId,
        name: zapConfig.name,
        description: zapConfig.description,
        steps: zapConfig.steps.map((step, index) => ({
          id: `step_${index + 1}`,
          type: step.type,
          app_id: step.appId,
          action_key: step.actionKey,
          input_data: step.inputData,
          conditions: step.conditions,
        })),
        trigger: zapConfig.trigger,
        timestamp: new Date().toISOString(),
      };

      const response = await this.sendWebhook(zapPayload);

      return {
        success: response.success,
        zapId: response.success ? zapId : undefined,
        error: response.error,
      };
    } catch (error) {
      logger.error('Failed to create multi-step Zap:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getConnectedApps(): Promise<ZapierAppConnection[]> {
    return Array.from(this.appConnections.values());
  }

  async getAppConnectionStats(): Promise<Record<string, any>> {
    const connections = Array.from(this.appConnections.values());

    return {
      totalConnections: connections.length,
      activeConnections: connections.filter(c => c.isActive).length,
      appBreakdown: connections.reduce(
        (acc, conn) => {
          acc[conn.appId] = (acc[conn.appId] || 0) + 1;

          return acc;
        },
        {} as Record<string, number>
      ),
      lastUsed: connections.reduce(
        (latest, conn) => {
          return !latest || conn.lastUsed > latest ? conn.lastUsed : latest;
        },
        null as Date | null
      ),
    };
  }

  // Enhanced webhook management for 1000+ app connections
  async subscribeToAppEvents(
    appId: string,
    eventTypes: string[]
  ): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    try {
      if (!this.subscribeKey) {
        throw new Error('Subscribe key required for app event subscriptions');
      }

      const subscriptionId = `sub_${appId}_${Date.now()}`;

      const subscriptionPayload = {
        event: 'subscribe_app_events',
        subscription_id: subscriptionId,
        app_id: appId,
        event_types: eventTypes,
        webhook_url: this.webhookUrl,
        timestamp: new Date().toISOString(),
      };

      const response = await this.sendWebhook(subscriptionPayload);

      return {
        success: response.success,
        subscriptionId: response.success ? subscriptionId : undefined,
        error: response.error,
      };
    } catch (error) {
      logger.error('Failed to subscribe to app events:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get available Zaps (enhanced with Platform API)
  async getAvailableZaps(): Promise<ZapierZap[]> {
    try {
      if (!this.platformApiKey) {
        logger.warn('Platform API key required for Zap discovery');

        return [];
      }

      const response = await this.platformClient.get('/zaps');

      return response.data.objects.map((zap: any) => ({
        id: zap.id,
        title: zap.title,
        status: zap.status,
        steps: zap.steps,
        createdAt: new Date(zap.created_at),
        updatedAt: new Date(zap.updated_at),
      }));
    } catch (error) {
      logger.error('Failed to get available Zaps:', error);

      return [];
    }
  }
}

interface ZapierApp {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  isPublic: boolean;
  triggers: string[];
  actions: string[];
  searches: string[];
}

interface ZapierAppConnection {
  id: string;
  appId: string;
  name: string;
  credentials: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  lastUsed: Date;
}

interface ZapierConnectionData {
  name: string;
  credentials: Record<string, any>;
}

interface MultiStepZapConfig {
  name: string;
  description: string;
  trigger: {
    type: string;
    appId: string;
    eventKey: string;
    conditions?: Record<string, any>;
  };
  steps: ZapStep[];
}

interface ZapStep {
  type: 'action' | 'filter' | 'delay';
  appId: string;
  actionKey: string;
  inputData: Record<string, any>;
  conditions?: Record<string, any>;
}

interface ZapierZap {
  id: string;
  title: string;
  status: string;
  steps: any[];
  createdAt: Date;
  updatedAt: Date;
}
