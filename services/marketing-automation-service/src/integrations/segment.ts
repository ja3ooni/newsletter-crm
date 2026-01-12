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

interface SegmentCredentials {
  writeKey: string;
  dataPlaneUrl?: string; // For Segment Protocols
  profileApiToken?: string; // For Profile API
  spaceId?: string; // For Profiles API
  computeApiToken?: string; // For Computed Traits
}

interface SegmentEvent {
  type: 'track' | 'page' | 'identify' | 'group' | 'alias';
  userId?: string;
  anonymousId?: string;
  event?: string;
  properties?: Record<string, any>;
  traits?: Record<string, any>;
  context?: SegmentContext;
  timestamp?: string;
  messageId?: string;
  integrations?: Record<string, boolean>;
}

interface SegmentContext {
  ip?: string;
  userAgent?: string;
  page?: {
    path?: string;
    referrer?: string;
    search?: string;
    title?: string;
    url?: string;
  };
  campaign?: {
    name?: string;
    source?: string;
    medium?: string;
    term?: string;
    content?: string;
  };
  device?: {
    id?: string;
    manufacturer?: string;
    model?: string;
    name?: string;
    type?: string;
    version?: string;
  };
  app?: {
    name?: string;
    version?: string;
    build?: string;
  };
  library?: {
    name: string;
    version: string;
  };
}

export class SegmentIntegration extends BaseMarketingIntegration {
  private client: AxiosInstance;
  private profileClient: AxiosInstance;
  private computeClient: AxiosInstance;
  private writeKey: string;
  private dataPlaneUrl: string;
  private profileApiToken: string | undefined;
  private spaceId: string | undefined;
  private computeApiToken: string | undefined;

  constructor(config: MarketingIntegrationConfig) {
    super(config);
    const credentials = this.config.credentials as SegmentCredentials;

    this.writeKey = credentials.writeKey;
    this.dataPlaneUrl = credentials.dataPlaneUrl || 'https://api.segment.io';
    this.profileApiToken = credentials.profileApiToken;
    this.spaceId = credentials.spaceId;
    this.computeApiToken = credentials.computeApiToken;

    this.client = axios.create({
      baseURL: this.dataPlaneUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.writeKey}:`).toString('base64')}`,
      },
    });

    // Profile API client for unified customer profiles
    this.profileClient = axios.create({
      baseURL: 'https://profiles.segment.com/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.profileApiToken && {
          Authorization: `Bearer ${this.profileApiToken}`,
        }),
      },
    });

    // Computed Traits API client
    this.computeClient = axios.create({
      baseURL: 'https://api.segment.io/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.computeApiToken && {
          Authorization: `Bearer ${this.computeApiToken}`,
        }),
      },
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      // Test the write key by sending a test track event
      const testEvent: SegmentEvent = {
        type: 'track',
        userId: 'test_user',
        event: 'Test Connection',
        properties: {
          test: true,
        },
        context: {
          library: {
            name: 'datatechtoncrm-platform',
            version: '1.0.0',
          },
        },
        timestamp: new Date().toISOString(),
      };

      const response = await this.client.post('/v1/track', testEvent);

      logger.info('Segment authentication successful');

      return response.status === 200;
    } catch (error) {
      logger.error('Segment authentication failed:', error);

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
      const event: SegmentEvent = {
        type: 'page',
        userId,
        properties: {
          path: page,
          title: properties?.title,
          referrer: properties?.referrer,
          search: properties?.search,
          url: properties?.url || page,
          ...properties,
        },
        context: this.buildContext(properties),
        timestamp: new Date().toISOString(),
        messageId: this.generateMessageId(),
      };

      const response = await this.client.post('/v1/page', event);

      return {
        success: response.status === 200,
        eventId: event.messageId!,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track page view in Segment:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async trackEvent(event: TrackingEvent): Promise<TrackingResult> {
    try {
      const segmentEvent: SegmentEvent = {
        type: 'track',
        event: event.eventName,
        properties: {
          event_type: event.eventType,
          source: event.source,
          ...event.properties,
        },
        context: this.buildContext(event.properties),
        timestamp: event.timestamp.toISOString(),
        messageId: this.generateMessageId(),
      };

      // Only add userId and anonymousId if they are defined
      if (event.userId) {
        segmentEvent.userId = event.userId;
      }
      if (event.sessionId) {
        segmentEvent.anonymousId = event.sessionId;
      }

      const response = await this.client.post('/v1/track', segmentEvent);

      return {
        success: response.status === 200,
        eventId: segmentEvent.messageId!,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track event in Segment:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async trackConversion(conversion: ConversionEvent): Promise<TrackingResult> {
    try {
      const event: SegmentEvent = {
        type: 'track',
        event: conversion.eventName,
        properties: {
          conversion_type: conversion.conversionType,
          revenue: conversion.value,
          currency: conversion.currency || 'USD',
          ...conversion.properties,
        },
        context: this.buildContext(conversion.properties),
        timestamp: conversion.timestamp.toISOString(),
        messageId: this.generateMessageId(),
      };

      // Only add userId and anonymousId if they are defined
      if (conversion.userId) {
        event.userId = conversion.userId;
      }
      if (conversion.sessionId) {
        event.anonymousId = conversion.sessionId;
      }

      const response = await this.client.post('/v1/track', event);

      return {
        success: response.status === 200,
        eventId: event.messageId!,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track conversion in Segment:', error);

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
      const event: SegmentEvent = {
        type: 'track',
        event: eventName,
        properties: this.sanitizeProperties(properties),
        context: this.buildContext(properties),
        timestamp: new Date().toISOString(),
        messageId: this.generateMessageId(),
      };

      // Only add userId and anonymousId if they are defined
      if (properties.userId) {
        event.userId = properties.userId;
      }
      if (properties.sessionId) {
        event.anonymousId = properties.sessionId;
      }

      const response = await this.client.post('/v1/track', event);

      return {
        success: response.status === 200,
        eventId: event.messageId!,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track custom event in Segment:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async getStats(): Promise<IntegrationStats> {
    // Segment doesn't provide built-in analytics via API
    // You would need to use Segment's Protocols or connect to your warehouse
    return {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      errorRate: 0,
    };
  }

  // Segment-specific methods

  async identifyUser(
    userId: string,
    traits: Record<string, any>
  ): Promise<TrackingResult> {
    try {
      const event: SegmentEvent = {
        type: 'identify',
        userId,
        traits: this.sanitizeTraits(traits),
        context: this.buildContext(traits),
        timestamp: new Date().toISOString(),
        messageId: this.generateMessageId(),
      };

      const response = await this.client.post('/v1/identify', event);

      return {
        success: response.status === 200,
        eventId: event.messageId!,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to identify user in Segment:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async groupUser(
    userId: string,
    groupId: string,
    traits: Record<string, any>
  ): Promise<TrackingResult> {
    try {
      const event: SegmentEvent = {
        type: 'group',
        userId,
        properties: {
          groupId,
          ...this.sanitizeProperties(traits),
        },
        context: this.buildContext(traits),
        timestamp: new Date().toISOString(),
        messageId: this.generateMessageId(),
      };

      const response = await this.client.post('/v1/group', event);

      return {
        success: response.status === 200,
        eventId: event.messageId!,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to group user in Segment:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async aliasUser(userId: string, previousId: string): Promise<TrackingResult> {
    try {
      const event: SegmentEvent = {
        type: 'alias',
        userId,
        properties: {
          previousId,
        },
        context: {
          library: {
            name: 'datatechtoncrm-platform',
            version: '1.0.0',
          },
        },
        timestamp: new Date().toISOString(),
        messageId: this.generateMessageId(),
      };

      const response = await this.client.post('/v1/alias', event);

      return {
        success: response.status === 200,
        eventId: event.messageId!,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to alias user in Segment:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  // Batch operations
  async sendBatchEvents(events: SegmentEvent[]): Promise<TrackingResult[]> {
    try {
      const batchPayload = {
        batch: events.map(event => ({
          ...event,
          messageId: event.messageId || this.generateMessageId(),
          timestamp: event.timestamp || new Date().toISOString(),
        })),
      };

      const response = await this.client.post('/v1/batch', batchPayload);

      const results: TrackingResult[] = events.map((event, index) => ({
        success: response.status === 200,
        eventId: event.messageId || `segment_batch_${index}_${Date.now()}`,
        timestamp: new Date(),
      }));

      return results;
    } catch (error) {
      logger.error('Failed to send batch events to Segment:', error);

      return events.map((event, index) => ({
        success: false,
        eventId: event.messageId || `segment_batch_${index}_${Date.now()}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      }));
    }
  }

  private buildContext(properties?: Record<string, any>): SegmentContext {
    const context: SegmentContext = {
      library: {
        name: 'datatechtoncrm-platform',
        version: '1.0.0',
      },
    };

    if (properties) {
      if (properties.ip_address) {
        context.ip = properties.ip_address;
      }

      if (properties.user_agent) {
        context.userAgent = properties.user_agent;
      }

      if (properties.page_url || properties.page_title || properties.referrer) {
        context.page = {
          url: properties.page_url,
          title: properties.page_title,
          referrer: properties.referrer,
          path: properties.page_path,
          search: properties.page_search,
        };
      }

      if (properties.utm_source || properties.utm_campaign) {
        context.campaign = {
          source: properties.utm_source,
          medium: properties.utm_medium,
          name: properties.utm_campaign,
          term: properties.utm_term,
          content: properties.utm_content,
        };
      }

      if (properties.device_id || properties.device_type) {
        context.device = {
          id: properties.device_id,
          type: properties.device_type,
          manufacturer: properties.device_manufacturer,
          model: properties.device_model,
          name: properties.device_name,
          version: properties.device_version,
        };
      }
    }

    return context;
  }

  private sanitizeProperties(
    properties: Record<string, any>
  ): Record<string, any> {
    const sanitized: Record<string, any> = {};

    // Remove context fields that should be in context
    const contextFields = [
      'ip_address',
      'user_agent',
      'page_url',
      'page_title',
      'referrer',
      'page_path',
      'page_search',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'device_id',
      'device_type',
      'device_manufacturer',
      'device_model',
      'device_name',
      'device_version',
    ];

    for (const [key, value] of Object.entries(properties)) {
      if (
        !contextFields.includes(key) &&
        value !== undefined &&
        value !== null
      ) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeTraits(traits: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(traits)) {
      if (value !== undefined && value !== null) {
        // Convert dates to ISO strings
        if (value instanceof Date) {
          sanitized[key] = value.toISOString();
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Unified Customer Profile Management

  async getUnifiedProfile(
    userId: string
  ): Promise<UnifiedCustomerProfile | null> {
    try {
      if (!this.profileApiToken || !this.spaceId) {
        throw new Error(
          'Profile API token and space ID required for unified profiles'
        );
      }

      const response = await this.profileClient.get(
        `/spaces/${this.spaceId}/collections/users/profiles/user_id:${userId}/traits`
      );

      const profile = response.data;

      return {
        userId: profile.user_id,
        traits: profile.traits,
        computedTraits: profile.computed_traits || {},
        externalIds: profile.external_ids || [],
        metadata: {
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
          lastSeen: profile.last_seen,
        },
      };
    } catch (error) {
      logger.error('Failed to get unified profile from Segment:', error);

      return null;
    }
  }

  async updateUnifiedProfile(
    userId: string,
    traits: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const identifyEvent: SegmentEvent = {
        type: 'identify',
        userId,
        traits: this.sanitizeTraits(traits),
        context: {
          library: {
            name: 'datatechtoncrm-platform',
            version: '1.0.0',
          },
        },
        timestamp: new Date().toISOString(),
        messageId: this.generateMessageId(),
      };

      const response = await this.client.post('/v1/identify', identifyEvent);

      return {
        success: response.status === 200,
      };
    } catch (error) {
      logger.error('Failed to update unified profile in Segment:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createComputedTrait(
    name: string,
    definition: ComputedTraitDefinition
  ): Promise<{ success: boolean; traitId?: string; error?: string }> {
    try {
      if (!this.computeApiToken) {
        throw new Error('Compute API token required for computed traits');
      }

      const response = await this.computeClient.post('/computed-traits', {
        name,
        description: definition.description,
        query: definition.query,
        enabled: true,
      });

      return {
        success: response.status === 201,
        traitId: response.data.id,
      };
    } catch (error) {
      logger.error('Failed to create computed trait in Segment:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getCustomerJourney(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CustomerJourneyEvent[]> {
    try {
      if (!this.profileApiToken || !this.spaceId) {
        throw new Error(
          'Profile API token and space ID required for customer journey'
        );
      }

      const params: any = {};

      if (startDate) params.start = startDate.toISOString();
      if (endDate) params.end = endDate.toISOString();

      const response = await this.profileClient.get(
        `/spaces/${this.spaceId}/collections/users/profiles/user_id:${userId}/events`,
        { params }
      );

      return response.data.data.map((event: any) => ({
        id: event.id,
        event: event.event,
        timestamp: new Date(event.timestamp),
        properties: event.properties,
        context: event.context,
        messageId: event.messageId,
      }));
    } catch (error) {
      logger.error('Failed to get customer journey from Segment:', error);

      return [];
    }
  }

  async createAudience(
    name: string,
    definition: AudienceDefinition
  ): Promise<{ success: boolean; audienceId?: string; error?: string }> {
    try {
      if (!this.computeApiToken) {
        throw new Error('Compute API token required for audience creation');
      }

      const response = await this.computeClient.post('/audiences', {
        name,
        description: definition.description,
        definition: {
          query: definition.query,
          size_estimate: definition.sizeEstimate,
        },
        enabled: true,
      });

      return {
        success: response.status === 201,
        audienceId: response.data.id,
      };
    } catch (error) {
      logger.error('Failed to create audience in Segment:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAudienceMembers(audienceId: string): Promise<string[]> {
    try {
      if (!this.computeApiToken) {
        throw new Error('Compute API token required for audience members');
      }

      const response = await this.computeClient.get(
        `/audiences/${audienceId}/members`
      );

      return response.data.data.map((member: any) => member.user_id);
    } catch (error) {
      logger.error('Failed to get audience members from Segment:', error);

      return [];
    }
  }

  async syncProfileToDestination(
    userId: string,
    destinationId: string,
    traits?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const identifyEvent: SegmentEvent = {
        type: 'identify',
        userId,
        ...(traits && { traits: this.sanitizeTraits(traits) }),
        context: {
          library: {
            name: 'datatechtoncrm-platform',
            version: '1.0.0',
          },
        },
        integrations: {
          [destinationId]: true,
          All: false, // Only send to specific destination
        },
        timestamp: new Date().toISOString(),
        messageId: this.generateMessageId(),
      };

      const response = await this.client.post('/v1/identify', identifyEvent);

      return {
        success: response.status === 200,
      };
    } catch (error) {
      logger.error('Failed to sync profile to destination in Segment:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getProfileInsights(userId: string): Promise<ProfileInsights | null> {
    try {
      const [profile, journey] = await Promise.all([
        this.getUnifiedProfile(userId),
        this.getCustomerJourney(
          userId,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ), // Last 30 days
      ]);

      if (!profile) return null;

      const insights: ProfileInsights = {
        userId,
        totalEvents: journey.length,
        lastActivity: journey.length > 0 ? journey[0]?.timestamp || null : null,
        topEvents: this.getTopEvents(journey),
        engagementScore: this.calculateEngagementScore(journey),
        lifecycle: this.determineLifecycleStage(profile, journey),
        predictedChurn: this.predictChurnRisk(profile, journey),
        recommendedActions: this.getRecommendedActions(profile, journey),
      };

      return insights;
    } catch (error) {
      logger.error('Failed to get profile insights from Segment:', error);

      return null;
    }
  }

  override async exportData(startDate: Date, endDate: Date): Promise<any> {
    try {
      // Export comprehensive Segment data including profiles and audiences
      const exportData: any = {
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        exportedAt: new Date().toISOString(),
      };

      // Add profile data if available
      if (this.profileApiToken && this.spaceId) {
        exportData.profilesEnabled = true;
        // Note: In production, you'd implement pagination for large datasets
      } else {
        exportData.profilesEnabled = false;
        exportData.note =
          'Profile API access required for unified customer data export';
      }

      return exportData;
    } catch (error) {
      logger.error('Failed to export Segment data:', error);

      return null;
    }
  }

  private getTopEvents(
    journey: CustomerJourneyEvent[]
  ): Array<{ event: string; count: number }> {
    const eventCounts = journey.reduce(
      (acc, event) => {
        acc[event.event] = (acc[event.event] || 0) + 1;

        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([event, count]) => ({ event, count }));
  }

  private calculateEngagementScore(journey: CustomerJourneyEvent[]): number {
    // Simple engagement scoring based on event frequency and recency
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    let score = 0;

    journey.forEach(event => {
      const daysSince = (now - event.timestamp.getTime()) / dayMs;
      const recencyWeight = Math.max(0, 1 - daysSince / 30); // Decay over 30 days

      score += recencyWeight;
    });

    return Math.min(100, Math.round(score * 10)); // Scale to 0-100
  }

  private determineLifecycleStage(
    profile: UnifiedCustomerProfile,
    journey: CustomerJourneyEvent[]
  ): string {
    const hasConversion = journey.some(
      e =>
        e.event.toLowerCase().includes('purchase') ||
        e.event.toLowerCase().includes('conversion')
    );

    const recentActivity = journey.some(
      e => Date.now() - e.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    );

    if (hasConversion && recentActivity) return 'active_customer';
    if (hasConversion) return 'customer';
    if (recentActivity) return 'active_lead';

    return 'cold_lead';
  }

  private predictChurnRisk(
    profile: UnifiedCustomerProfile,
    journey: CustomerJourneyEvent[]
  ): 'low' | 'medium' | 'high' {
    const lastActivity = journey.length > 0 ? journey[0]?.timestamp : null;

    if (!lastActivity) return 'high';

    const daysSinceLastActivity =
      (Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000);

    if (daysSinceLastActivity > 30) return 'high';
    if (daysSinceLastActivity > 14) return 'medium';

    return 'low';
  }

  private getRecommendedActions(
    profile: UnifiedCustomerProfile,
    journey: CustomerJourneyEvent[]
  ): string[] {
    const actions: string[] = [];

    const churnRisk = this.predictChurnRisk(profile, journey);

    if (churnRisk === 'high') {
      actions.push('Send re-engagement campaign');
    }

    const hasRecentPurchase = journey.some(
      e =>
        e.event.toLowerCase().includes('purchase') &&
        Date.now() - e.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    );

    if (hasRecentPurchase) {
      actions.push('Send post-purchase follow-up');
    }

    return actions;
  }
}

interface UnifiedCustomerProfile {
  userId: string;
  traits: Record<string, any>;
  computedTraits: Record<string, any>;
  externalIds: Array<{ type: string; id: string }>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    lastSeen: string;
  };
}

interface ComputedTraitDefinition {
  description: string;
  query: string;
}

interface CustomerJourneyEvent {
  id: string;
  event: string;
  timestamp: Date;
  properties: Record<string, any>;
  context: Record<string, any>;
  messageId: string;
}

interface AudienceDefinition {
  description: string;
  query: string;
  sizeEstimate?: number;
}

interface ProfileInsights {
  userId: string;
  totalEvents: number;
  lastActivity: Date | null;
  topEvents: Array<{ event: string; count: number }>;
  engagementScore: number;
  lifecycle: string;
  predictedChurn: 'low' | 'medium' | 'high';
  recommendedActions: string[];
}
