export interface MarketingIntegrationConfig {
  id: string;
  name: string;
  type: 'google_analytics' | 'facebook_pixel' | 'zapier' | 'segment';
  credentials: Record<string, any>;
  settings: Record<string, any>;
  isActive: boolean;
  trackingSettings: {
    trackPageViews: boolean;
    trackEvents: boolean;
    trackConversions: boolean;
    trackCustomEvents: boolean;
    customEventMappings: Record<string, string>;
  };
}

export interface TrackingEvent {
  eventName: string;
  eventType: 'page_view' | 'click' | 'conversion' | 'custom';
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  timestamp: Date;
  source: string;
}

export interface ConversionEvent {
  eventName: string;
  userId?: string;
  sessionId?: string;
  value?: number;
  currency?: string;
  conversionType: 'purchase' | 'signup' | 'lead' | 'custom';
  properties: Record<string, any>;
  timestamp: Date;
}

export interface TrackingResult {
  success: boolean;
  eventId?: string | undefined;
  error?: string | undefined;
  timestamp: Date;
}

export interface IntegrationStats {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  lastEventTime?: Date | undefined;
  errorRate: number;
}

export abstract class BaseMarketingIntegration {
  protected config: MarketingIntegrationConfig;

  constructor(config: MarketingIntegrationConfig) {
    this.config = config;
  }

  abstract authenticate(): Promise<boolean>;
  abstract testConnection(): Promise<boolean>;

  // Event tracking
  abstract trackPageView(
    userId: string,
    page: string,
    properties?: Record<string, any>
  ): Promise<TrackingResult>;
  abstract trackEvent(event: TrackingEvent): Promise<TrackingResult>;
  abstract trackConversion(
    conversion: ConversionEvent
  ): Promise<TrackingResult>;

  // Custom event tracking
  abstract trackCustomEvent(
    eventName: string,
    properties: Record<string, any>
  ): Promise<TrackingResult>;

  // Batch operations
  async trackBatchEvents(events: TrackingEvent[]): Promise<TrackingResult[]> {
    const results: TrackingResult[] = [];

    for (const event of events) {
      try {
        const result = await this.trackEvent(event);

        results.push(result);
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

  // Configuration management
  getConfig(): MarketingIntegrationConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<MarketingIntegrationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // Stats and monitoring
  abstract getStats(): Promise<IntegrationStats>;

  // Webhook handling (for integrations that support it)
  async handleWebhook?(payload: any): Promise<void>;

  // Data export/import
  async exportData?(startDate: Date, endDate: Date): Promise<any>;
  async importData?(data: any): Promise<boolean>;
}
