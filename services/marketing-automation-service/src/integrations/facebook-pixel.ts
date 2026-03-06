// @ts-nocheck
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import {
  BaseMarketingIntegration,
  ConversionEvent,
  IntegrationStats,
  MarketingIntegrationConfig,
  TrackingEvent,
  TrackingResult,
} from './base-marketing-integration';

interface FacebookPixelCredentials {
  pixelId: string;
  accessToken: string;
  testEventCode?: string; // For testing events
  adAccountId?: string; // For creating custom audiences
  appId?: string; // For app events
}

interface FacebookEvent {
  event_name: string;
  event_time: number;
  user_data: {
    em?: string | undefined; // email (hashed)
    ph?: string | undefined; // phone (hashed)
    external_id?: string | undefined;
    client_ip_address?: string | undefined;
    client_user_agent?: string | undefined;
    fbc?: string | undefined; // Facebook click ID
    fbp?: string | undefined; // Facebook browser ID
  };
  custom_data?: Record<string, any>;
  event_source_url?: string;
  action_source:
    | 'email'
    | 'website'
    | 'phone_call'
    | 'chat'
    | 'physical_store'
    | 'system_generated'
    | 'other';
}

export class FacebookPixelIntegration extends BaseMarketingIntegration {
  private client: AxiosInstance;
  private pixelId: string;
  private accessToken: string;
  private testEventCode: string | undefined;
  private adAccountId: string | undefined;
  private appId: string | undefined;

  constructor(config: MarketingIntegrationConfig) {
    super(config);
    const credentials = this.config.credentials as FacebookPixelCredentials;

    this.pixelId = credentials.pixelId;
    this.accessToken = credentials.accessToken;
    this.testEventCode = credentials.testEventCode ?? undefined;
    this.adAccountId = credentials.adAccountId;
    this.appId = credentials.appId;

    this.client = axios.create({
      baseURL: 'https://graph.facebook.com/v18.0',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      // Test the access token by making a request to the pixel endpoint
      const response = await this.client.get(`/${this.pixelId}`, {
        params: {
          access_token: this.accessToken,
          fields: 'id,name',
        },
      });

      logger.info('Facebook Pixel authentication successful');

      return response.status === 200;
    } catch (error) {
      logger.error(
        'Facebook Pixel authentication failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );

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
      const event: FacebookEvent = {
        event_name: 'PageView',
        event_time: Math.floor(Date.now() / 1000),
        user_data: {
          external_id: userId,
          client_ip_address: properties?.ip_address,
          client_user_agent: properties?.user_agent,
          em: properties?.email ? this.hashEmail(properties.email) : undefined,
          fbc: properties?.fbc,
          fbp: properties?.fbp,
        },
        custom_data: {
          content_name: properties?.title || page,
          content_category: properties?.category,
          ...properties,
        },
        event_source_url: page,
        action_source: 'website',
      };

      const response = await this.sendEvent(event);

      return {
        success: response.success,
        eventId: response.eventId,
        error: response.error,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track page view in Facebook Pixel:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async trackEvent(event: TrackingEvent): Promise<TrackingResult> {
    try {
      const facebookEvent = this.convertToFacebookEvent(event);
      const response = await this.sendEvent(facebookEvent);

      return {
        success: response.success,
        eventId: response.eventId,
        error: response.error,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track event in Facebook Pixel:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async trackConversion(conversion: ConversionEvent): Promise<TrackingResult> {
    try {
      const event: FacebookEvent = {
        event_name: this.mapConversionType(conversion.conversionType),
        event_time: Math.floor(conversion.timestamp.getTime() / 1000),
        user_data: {
          external_id: conversion.userId,
          em: conversion.properties.email
            ? this.hashEmail(conversion.properties.email)
            : undefined,
          ph: conversion.properties.phone
            ? this.hashPhone(conversion.properties.phone)
            : undefined,
          client_ip_address: conversion.properties.ip_address,
          client_user_agent: conversion.properties.user_agent,
          fbc: conversion.properties.fbc,
          fbp: conversion.properties.fbp,
        },
        custom_data: {
          currency: conversion.currency || 'USD',
          value: conversion.value || 0,
          content_name: conversion.properties.product_name,
          content_category: conversion.properties.category,
          content_ids: conversion.properties.product_ids,
          num_items: conversion.properties.quantity || 1,
          ...conversion.properties,
        },
        action_source: 'website',
      };

      const response = await this.sendEvent(event);

      return {
        success: response.success,
        eventId: response.eventId,
        error: response.error,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track conversion in Facebook Pixel:', error);

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
      const event: FacebookEvent = {
        event_name: this.sanitizeEventName(eventName),
        event_time: Math.floor(Date.now() / 1000),
        user_data: {
          external_id: properties.userId,
          em: properties.email ? this.hashEmail(properties.email) : undefined,
          ph: properties.phone ? this.hashPhone(properties.phone) : undefined,
          client_ip_address: properties.ip_address,
          client_user_agent: properties.user_agent,
          fbc: properties.fbc,
          fbp: properties.fbp,
        },
        custom_data: this.sanitizeCustomData(properties),
        action_source: 'website',
      };

      const response = await this.sendEvent(event);

      return {
        success: response.success,
        eventId: response.eventId,
        error: response.error,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to track custom event in Facebook Pixel:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async getStats(): Promise<IntegrationStats> {
    try {
      // Get pixel stats from Facebook Marketing API
      const response = await this.client.get(`/${this.pixelId}/stats`, {
        params: {
          access_token: this.accessToken,
          start_time: Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000), // Last 7 days
          end_time: Math.floor(Date.now() / 1000),
        },
      });

      const stats = response.data.data[0] || {};

      return {
        totalEvents: stats.count || 0,
        successfulEvents: stats.count || 0,
        failedEvents: 0,
        errorRate: 0,
        lastEventTime: stats.last_fired_time
          ? new Date(stats.last_fired_time * 1000)
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to get Facebook Pixel stats:', error);

      return {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        errorRate: 0,
      };
    }
  }

  private async sendEvent(
    event: FacebookEvent
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      const payload = {
        data: [event],
        test_event_code: this.testEventCode,
      };

      const response = await this.client.post(
        `/${this.pixelId}/events`,
        payload,
        {
          params: {
            access_token: this.accessToken,
          },
        }
      );

      const result = response.data;

      if (result.events_received && result.events_received > 0) {
        return {
          success: true,
          eventId: `fb_${Date.now()}`,
        };
      } else {
        return {
          success: false,
          error: 'No events received by Facebook',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private convertToFacebookEvent(event: TrackingEvent): FacebookEvent {
    const eventName =
      this.config.trackingSettings.customEventMappings[event.eventName] ||
      event.eventName;

    return {
      event_name: this.sanitizeEventName(eventName),
      event_time: Math.floor(event.timestamp.getTime() / 1000),
      user_data: {
        external_id: event.userId,
        client_ip_address: event.properties.ip_address,
        client_user_agent: event.properties.user_agent,
        em: event.properties.email
          ? this.hashEmail(event.properties.email)
          : undefined,
        fbc: event.properties.fbc,
        fbp: event.properties.fbp,
      },
      custom_data: this.sanitizeCustomData(event.properties),
      event_source_url: event.properties.page_url,
      action_source: 'website',
    };
  }

  private mapConversionType(conversionType: string): string {
    const mapping: Record<string, string> = {
      purchase: 'Purchase',
      signup: 'CompleteRegistration',
      lead: 'Lead',
      custom: 'CustomEvent',
    };

    return mapping[conversionType] || 'CustomEvent';
  }

  private sanitizeEventName(eventName: string): string {
    // Facebook event names should be in PascalCase and contain only letters, numbers, and underscores
    return eventName
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  private sanitizeCustomData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    // Remove user data fields that should be in user_data
    const userDataFields = [
      'email',
      'phone',
      'userId',
      'ip_address',
      'user_agent',
      'fbc',
      'fbp',
    ];

    for (const [key, value] of Object.entries(data)) {
      if (
        !userDataFields.includes(key) &&
        value !== undefined &&
        value !== null
      ) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private hashEmail(email: string): string {
    // Use Node.js built-in crypto module for hashing
    return crypto
      .createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex');
  }

  private hashPhone(phone: string): string {
    // Remove all non-digit characters and hash
    const crypto = require('crypto');
    const cleanPhone = phone.replace(/\D/g, '');

    return crypto.createHash('sha256').update(cleanPhone).digest('hex');
  }

  // Enhanced Retargeting and Custom Audiences

  async createCustomAudience(
    name: string,
    description: string,
    retentionDays: number = 180
  ): Promise<{ success: boolean; audienceId?: string; error?: string }> {
    try {
      if (!this.adAccountId) {
        throw new Error('Ad Account ID required for custom audience creation');
      }

      const response = await this.client.post(
        `/act_${this.adAccountId}/customaudiences`,
        {
          name,
          description,
          subtype: 'CUSTOM',
          customer_file_source: 'BOTH_USER_AND_PARTNER_PROVIDED',
          retention_days: retentionDays,
        },
        {
          params: {
            access_token: this.accessToken,
          },
        }
      );

      return {
        success: true,
        audienceId: response.data.id,
      };
    } catch (error) {
      logger.error('Failed to create custom audience:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async addUsersToCustomAudience(
    audienceId: string,
    users: CustomAudienceUser[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const hashedUsers = users.map(user => ({
        email: user.email ? this.hashEmail(user.email) : undefined,
        phone: user.phone ? this.hashPhone(user.phone) : undefined,
        external_id: user.externalId,
        fn: user.firstName
          ? this.hashString(user.firstName.toLowerCase())
          : undefined,
        ln: user.lastName
          ? this.hashString(user.lastName.toLowerCase())
          : undefined,
        ct: user.city ? this.hashString(user.city.toLowerCase()) : undefined,
        st: user.state ? this.hashString(user.state.toLowerCase()) : undefined,
        zip: user.zipCode ? this.hashString(user.zipCode) : undefined,
        country: user.country
          ? this.hashString(user.country.toLowerCase())
          : undefined,
        dob: user.dateOfBirth ? this.hashString(user.dateOfBirth) : undefined,
        gen: user.gender
          ? this.hashString(user.gender.toLowerCase())
          : undefined,
      }));

      const response = await this.client.post(
        `/${audienceId}/users`,
        {
          payload: {
            schema: [
              'EMAIL',
              'PHONE',
              'EXTERNAL_ID',
              'FN',
              'LN',
              'CT',
              'ST',
              'ZIP',
              'COUNTRY',
              'DOB',
              'GEN',
            ],
            data: hashedUsers.map(user => [
              user.email,
              user.phone,
              user.external_id,
              user.fn,
              user.ln,
              user.ct,
              user.st,
              user.zip,
              user.country,
              user.dob,
              user.gen,
            ]),
          },
        },
        {
          params: {
            access_token: this.accessToken,
          },
        }
      );

      return {
        success: response.status === 200,
      };
    } catch (error) {
      logger.error('Failed to add users to custom audience:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createLookalikeAudience(
    name: string,
    sourceAudienceId: string,
    targetCountries: string[],
    ratio: number = 0.01
  ): Promise<{ success: boolean; audienceId?: string; error?: string }> {
    try {
      if (!this.adAccountId) {
        throw new Error(
          'Ad Account ID required for lookalike audience creation'
        );
      }

      const response = await this.client.post(
        `/act_${this.adAccountId}/customaudiences`,
        {
          name,
          subtype: 'LOOKALIKE',
          lookalike_spec: {
            ratio,
            country: targetCountries,
            type: 'similarity',
          },
          origin_audience_id: sourceAudienceId,
        },
        {
          params: {
            access_token: this.accessToken,
          },
        }
      );

      return {
        success: true,
        audienceId: response.data.id,
      };
    } catch (error) {
      logger.error('Failed to create lookalike audience:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async trackRetargetingEvent(
    eventName: string,
    userId: string,
    properties: Record<string, any>
  ): Promise<TrackingResult> {
    try {
      const event: FacebookEvent = {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        user_data: {
          external_id: userId,
          em: properties.email ? this.hashEmail(properties.email) : undefined,
          ph: properties.phone ? this.hashPhone(properties.phone) : undefined,
          client_ip_address: properties.ip_address,
          client_user_agent: properties.user_agent,
          fbc: properties.fbc,
          fbp: properties.fbp,
        },
        custom_data: {
          content_ids: properties.content_ids,
          content_type: properties.content_type,
          content_name: properties.content_name,
          content_category: properties.content_category,
          value: properties.value,
          currency: properties.currency || 'USD',
          num_items: properties.num_items,
          predicted_ltv: properties.predicted_ltv,
          ...this.sanitizeCustomData(properties),
        },
        action_source: 'website',
      };

      const response = await this.sendEvent(event);

      return {
        success: response.success,
        eventId: response.eventId,
        error: response.error,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(
        'Failed to track retargeting event in Facebook Pixel:',
        error
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async getCustomAudiences(): Promise<CustomAudienceInfo[]> {
    try {
      if (!this.adAccountId) {
        throw new Error('Ad Account ID required to get custom audiences');
      }

      const response = await this.client.get(
        `/act_${this.adAccountId}/customaudiences`,
        {
          params: {
            access_token: this.accessToken,
            fields:
              'id,name,description,approximate_count,data_source,subtype,retention_days',
          },
        }
      );

      return response.data.data.map((audience: any) => ({
        id: audience.id,
        name: audience.name,
        description: audience.description,
        approximateCount: audience.approximate_count,
        dataSource: audience.data_source,
        subtype: audience.subtype,
        retentionDays: audience.retention_days,
      }));
    } catch (error) {
      logger.error('Failed to get custom audiences:', error);

      return [];
    }
  }

  override async exportData(startDate: Date, endDate: Date): Promise<any> {
    try {
      // Export comprehensive Facebook data including audiences and events
      const [eventsData, customAudiences] = await Promise.all([
        this.getPixelEvents(startDate, endDate),
        this.getCustomAudiences(),
      ]);

      return {
        pixelId: this.pixelId,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        events: eventsData,
        customAudiences,
        exportedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to export Facebook Pixel data:', error);

      return null;
    }
  }

  private async getPixelEvents(startDate: Date, endDate: Date): Promise<any> {
    try {
      const response = await this.client.get(`/${this.pixelId}/events`, {
        params: {
          access_token: this.accessToken,
          start_time: Math.floor(startDate.getTime() / 1000),
          end_time: Math.floor(endDate.getTime() / 1000),
          limit: 1000,
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get pixel events:', error);

      return null;
    }
  }

  private hashString(value: string): string {
    const crypto = require('crypto');

    return crypto.createHash('sha256').update(value.trim()).digest('hex');
  }
}

interface CustomAudienceUser {
  email?: string;
  phone?: string;
  externalId?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  dateOfBirth?: string; // YYYYMMDD format
  gender?: 'm' | 'f';
}

interface CustomAudienceInfo {
  id: string;
  name: string;
  description: string;
  approximateCount: number;
  dataSource: string;
  subtype: string;
  retentionDays: number;
}
