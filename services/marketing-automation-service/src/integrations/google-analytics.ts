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

interface GoogleAnalyticsCredentials {
  measurementId: string;
  apiSecret: string;
  serviceAccountKey?: string; // For GA4 Reporting API
  propertyId?: string; // For GA4 Reporting API
  goals?: GoalConfiguration[]; // Custom goal configurations
}

interface GoalConfiguration {
  id: string;
  name: string;
  type: 'destination' | 'duration' | 'pages_per_session' | 'event';
  value?: number;
  conditions: GoalCondition[];
}

interface GoalCondition {
  field: string;
  operator: 'equals' | 'begins_with' | 'regex' | 'greater_than' | 'less_than';
  value: string | number;
}

interface GA4Event {
  name: string;
  params: Record<string, any>;
}

export class GoogleAnalyticsIntegration extends BaseMarketingIntegration {
  private client: AxiosInstance;
  private reportingClient: AxiosInstance;
  private measurementId: string;
  private apiSecret: string;
  private propertyId: string | undefined;
  private goals: GoalConfiguration[];

  constructor(config: MarketingIntegrationConfig) {
    super(config);
    const credentials = this.config.credentials as GoogleAnalyticsCredentials;

    this.measurementId = credentials.measurementId;
    this.apiSecret = credentials.apiSecret;
    this.propertyId = credentials.propertyId;
    this.goals = credentials.goals || [];

    this.client = axios.create({
      baseURL: 'https://www.google-analytics.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // GA4 Reporting API client
    this.reportingClient = axios.create({
      baseURL: 'https://analyticsreporting.googleapis.com/v4',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      // Test the Measurement Protocol by sending a test event
      const testEvent = {
        client_id: 'test_client_id',
        events: [
          {
            name: 'test_connection',
            params: {
              test: true,
            },
          },
        ],
      };

      const response = await this.client.post(
        `/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        testEvent
      );

      logger.info('Google Analytics authentication successful');

      return response.status === 204; // GA4 Measurement Protocol returns 204 on success
    } catch (error) {
      logger.error('Google Analytics authentication failed:', error);

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
      const event = {
        client_id: userId,
        events: [
          {
            name: 'page_view',
            params: {
              page_title: properties?.title || page,
              page_location: page,
              page_referrer: properties?.referrer,
              ...properties,
            },
          },
        ],
      };

      const response = await this.client.post(
        `/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        event
      );

      return {
        success: response.status === 204,
        eventId: `ga_${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track page view in Google Analytics:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async trackEvent(event: TrackingEvent): Promise<TrackingResult> {
    try {
      const ga4Event = this.convertToGA4Event(event);

      const payload = {
        client_id: event.userId || event.sessionId || 'anonymous',
        events: [ga4Event],
      };

      const response = await this.client.post(
        `/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        payload
      );

      return {
        success: response.status === 204,
        eventId: `ga_${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track event in Google Analytics:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async trackConversion(conversion: ConversionEvent): Promise<TrackingResult> {
    try {
      const ga4Event: GA4Event = {
        name: this.mapConversionType(conversion.conversionType),
        params: {
          currency: conversion.currency || 'USD',
          value: conversion.value || 0,
          transaction_id: `conv_${Date.now()}`,
          ...conversion.properties,
        },
      };

      const payload = {
        client_id: conversion.userId || conversion.sessionId || 'anonymous',
        events: [ga4Event],
      };

      const response = await this.client.post(
        `/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        payload
      );

      return {
        success: response.status === 204,
        eventId: `ga_conv_${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track conversion in Google Analytics:', error);

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
      const ga4Event: GA4Event = {
        name: this.sanitizeEventName(eventName),
        params: this.sanitizeEventParams(properties),
      };

      const payload = {
        client_id: properties.userId || properties.sessionId || 'anonymous',
        events: [ga4Event],
      };

      const response = await this.client.post(
        `/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        payload
      );

      return {
        success: response.status === 204,
        eventId: `ga_custom_${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track custom event in Google Analytics:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async getStats(): Promise<IntegrationStats> {
    // This would typically integrate with GA4 Reporting API
    // For now, return mock stats
    return {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      errorRate: 0,
    };
  }

  private convertToGA4Event(event: TrackingEvent): GA4Event {
    const eventName =
      this.config.trackingSettings.customEventMappings[event.eventName] ||
      event.eventName;

    return {
      name: this.sanitizeEventName(eventName),
      params: this.sanitizeEventParams({
        event_category: event.eventType,
        event_source: event.source,
        ...event.properties,
      }),
    };
  }

  private mapConversionType(conversionType: string): string {
    const mapping: Record<string, string> = {
      purchase: 'purchase',
      signup: 'sign_up',
      lead: 'generate_lead',
      custom: 'conversion',
    };

    return mapping[conversionType] || 'conversion';
  }

  private sanitizeEventName(eventName: string): string {
    // GA4 event names must be 40 characters or fewer and can only contain letters, numbers, and underscores
    return eventName
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .substring(0, 40);
  }

  private sanitizeEventParams(
    params: Record<string, any>
  ): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      // GA4 parameter names must be 40 characters or fewer
      const sanitizedKey = key
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .substring(0, 40);

      // Convert values to appropriate types
      if (typeof value === 'string' && value.length > 100) {
        sanitized[sanitizedKey] = value.substring(0, 100);
      } else if (
        typeof value === 'number' ||
        typeof value === 'string' ||
        typeof value === 'boolean'
      ) {
        sanitized[sanitizedKey] = value;
      } else {
        sanitized[sanitizedKey] = String(value);
      }
    }

    return sanitized;
  }

  // Enhanced Goal Conversion Tracking

  async trackGoalConversion(
    goalId: string,
    userId: string,
    value?: number,
    properties?: Record<string, any>
  ): Promise<TrackingResult> {
    try {
      const goal = this.goals.find(g => g.id === goalId);

      if (!goal) {
        throw new Error(`Goal ${goalId} not found`);
      }

      const ga4Event: GA4Event = {
        name: 'conversion',
        params: {
          goal_id: goalId,
          goal_name: goal.name,
          goal_type: goal.type,
          value: value || goal.value || 1,
          currency: 'USD',
          ...properties,
        },
      };

      const payload = {
        client_id: userId,
        events: [ga4Event],
      };

      const response = await this.client.post(
        `/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        payload
      );

      return {
        success: response.status === 204,
        eventId: `ga_goal_${goalId}_${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(
        'Failed to track goal conversion in Google Analytics:',
        error
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async trackEnhancedEcommerce(
    action:
      | 'purchase'
      | 'add_to_cart'
      | 'remove_from_cart'
      | 'begin_checkout'
      | 'view_item',
    userId: string,
    items: EcommerceItem[],
    transactionData?: EcommerceTransaction
  ): Promise<TrackingResult> {
    try {
      const ga4Event: GA4Event = {
        name: action,
        params: {
          currency: transactionData?.currency || 'USD',
          value: transactionData?.value || 0,
          transaction_id: transactionData?.transactionId,
          coupon: transactionData?.coupon,
          shipping: transactionData?.shipping,
          tax: transactionData?.tax,
          items: items.map(item => ({
            item_id: item.itemId,
            item_name: item.itemName,
            item_category: item.category,
            item_category2: item.category2,
            item_category3: item.category3,
            item_category4: item.category4,
            item_category5: item.category5,
            item_brand: item.brand,
            item_variant: item.variant,
            price: item.price,
            quantity: item.quantity,
            index: item.index,
            coupon: item.coupon,
            affiliation: item.affiliation,
            location_id: item.locationId,
          })),
        },
      };

      const payload = {
        client_id: userId,
        events: [ga4Event],
      };

      const response = await this.client.post(
        `/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        payload
      );

      return {
        success: response.status === 204,
        eventId: `ga_ecommerce_${action}_${Date.now()}`,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(
        'Failed to track enhanced ecommerce in Google Analytics:',
        error
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async getConversionData(startDate: Date, endDate: Date): Promise<any> {
    try {
      if (!this.propertyId) {
        throw new Error('Property ID required for conversion data retrieval');
      }

      // This would use GA4 Reporting API to get conversion data
      const reportRequest = {
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
          },
        ],
        dimensions: [{ name: 'eventName' }, { name: 'date' }],
        metrics: [
          { name: 'eventCount' },
          { name: 'eventValue' },
          { name: 'conversions' },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: {
              matchType: 'CONTAINS',
              value: 'conversion',
            },
          },
        },
      };

      // Note: This would require proper authentication with service account
      logger.info('GA4 Reporting API integration needed for conversion data');

      return null;
    } catch (error) {
      logger.error(
        'Failed to get conversion data from Google Analytics:',
        error
      );

      return null;
    }
  }

  override async exportData(startDate: Date, endDate: Date): Promise<any> {
    try {
      if (!this.propertyId) {
        logger.warn(
          'Property ID not configured for Google Analytics data export'
        );

        return null;
      }

      // Export comprehensive analytics data including conversions
      const conversionData = await this.getConversionData(startDate, endDate);

      return {
        propertyId: this.propertyId,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        conversions: conversionData,
        goals: this.goals,
        exportedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to export Google Analytics data:', error);

      return null;
    }
  }

  // Goal Management

  addGoal(goal: GoalConfiguration): void {
    this.goals.push(goal);
  }

  removeGoal(goalId: string): boolean {
    const index = this.goals.findIndex(g => g.id === goalId);

    if (index !== -1) {
      this.goals.splice(index, 1);

      return true;
    }

    return false;
  }

  getGoals(): GoalConfiguration[] {
    return [...this.goals];
  }

  updateGoal(goalId: string, updates: Partial<GoalConfiguration>): boolean {
    const goal = this.goals.find(g => g.id === goalId);

    if (goal) {
      Object.assign(goal, updates);

      return true;
    }

    return false;
  }
}

interface EcommerceItem {
  itemId: string;
  itemName: string;
  category?: string;
  category2?: string;
  category3?: string;
  category4?: string;
  category5?: string;
  brand?: string;
  variant?: string;
  price: number;
  quantity: number;
  index?: number;
  coupon?: string;
  affiliation?: string;
  locationId?: string;
}

interface EcommerceTransaction {
  transactionId: string;
  value: number;
  currency?: string;
  coupon?: string;
  shipping?: number;
  tax?: number;
}
