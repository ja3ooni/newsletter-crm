import { AnalyticsService } from '../services/AnalyticsService';
import { database } from '../utils/database';
import { redis } from '../utils/redis';

// Mock dependencies
jest.mock('../utils/database');
jest.mock('../utils/redis');
jest.mock('../utils/logger');

const mockDatabase = database as jest.Mocked<typeof database>;
const mockRedis = redis as jest.Mocked<typeof redis>;

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService();
    jest.clearAllMocks();
  });

  describe('trackEngagementEvent', () => {
    it('should track an engagement event successfully', async () => {
      const eventData = {
        contactId: '123e4567-e89b-12d3-a456-426614174000',
        eventType: 'email_open' as const,
        timestamp: new Date(),
        metadata: { source: 'newsletter' },
        score: 1,
      };

      mockDatabase.query.mockResolvedValueOnce([]);
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(true);
      mockRedis.set.mockResolvedValueOnce(true);
      mockRedis.publish.mockResolvedValueOnce(true);

      const result = await analyticsService.trackEngagementEvent(eventData);

      expect(result).toMatchObject({
        contactId: eventData.contactId,
        eventType: eventData.eventType,
        metadata: eventData.metadata,
        score: eventData.score,
      });
      expect(result.id).toBeDefined();
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO engagement_events'),
        expect.arrayContaining([
          result.id,
          eventData.contactId,
          undefined,
          undefined,
          eventData.eventType,
          eventData.timestamp,
          JSON.stringify(eventData.metadata),
          eventData.score,
          undefined,
          undefined,
        ])
      );
    });

    it('should handle database errors gracefully', async () => {
      const eventData = {
        contactId: '123e4567-e89b-12d3-a456-426614174000',
        eventType: 'email_open' as const,
        timestamp: new Date(),
        metadata: {},
        score: 1,
      };

      mockDatabase.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        analyticsService.trackEngagementEvent(eventData)
      ).rejects.toThrow('Database error');
    });
  });

  describe('getEngagementMetrics', () => {
    it('should return engagement metrics for a contact', async () => {
      const contactId = '123e4567-e89b-12d3-a456-426614174000';
      const mockResult = {
        opens: '10',
        unique_opens: '8',
        clicks: '5',
        unique_clicks: '4',
        unsubscribes: '0',
        bounces: '1',
        complaints: '0',
        last_engagement: new Date(),
      };

      mockDatabase.queryOne.mockResolvedValueOnce(mockResult);

      const result = await analyticsService.getEngagementMetrics(contactId);

      expect(result).toMatchObject({
        opens: 10,
        uniqueOpens: 8,
        clicks: 5,
        uniqueClicks: 4,
        unsubscribes: 0,
        bounces: 1,
        complaints: 0,
        engagementScore: expect.any(Number),
        openRate: expect.any(Number),
        clickRate: expect.any(Number),
        unsubscribeRate: expect.any(Number),
        bounceRate: expect.any(Number),
        lastEngagement: mockResult.last_engagement,
      });
    });

    it('should return default metrics when no data found', async () => {
      const contactId = '123e4567-e89b-12d3-a456-426614174000';

      mockDatabase.queryOne.mockResolvedValueOnce(null);

      const result = await analyticsService.getEngagementMetrics(contactId);

      expect(result).toMatchObject({
        opens: 0,
        uniqueOpens: 0,
        clicks: 0,
        uniqueClicks: 0,
        unsubscribes: 0,
        bounces: 0,
        complaints: 0,
        engagementScore: 0,
        openRate: 0,
        clickRate: 0,
        unsubscribeRate: 0,
        bounceRate: 0,
        lastEngagement: expect.any(Date),
      });
    });
  });

  describe('getNewsletterMetrics', () => {
    it('should return cached metrics if available', async () => {
      const newsletterId = '123e4567-e89b-12d3-a456-426614174000';
      const cachedMetrics = {
        newsletterId,
        sent: 1000,
        delivered: 950,
        opens: 400,
        uniqueOpens: 380,
        clicks: 50,
        uniqueClicks: 45,
        unsubscribes: 5,
        bounces: 50,
        complaints: 2,
        openRate: 42.11,
        clickRate: 12.5,
        unsubscribeRate: 0.53,
        bounceRate: 5.26,
        engagementScore: 435,
        revenueAttribution: 1500.0,
        conversionCount: 10,
        conversionRate: 1.05,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedMetrics));

      const result = await analyticsService.getNewsletterMetrics(newsletterId);

      expect(result).toEqual(cachedMetrics);
      expect(mockDatabase.queryOne).not.toHaveBeenCalled();
    });

    it('should fetch and cache metrics when not in cache', async () => {
      const newsletterId = '123e4567-e89b-12d3-a456-426614174000';
      const mockResult = {
        sent: '1000',
        delivered: '950',
        opens: '400',
        unique_opens: '380',
        clicks: '50',
        unique_clicks: '45',
        unsubscribes: '5',
        bounces: '50',
        complaints: '2',
        revenue_attribution: '1500.00',
        conversion_count: '10',
      };

      mockRedis.get.mockResolvedValueOnce(null);
      mockDatabase.queryOne.mockResolvedValueOnce(mockResult);
      mockRedis.set.mockResolvedValueOnce(true);

      const result = await analyticsService.getNewsletterMetrics(newsletterId);

      expect(result.newsletterId).toBe(newsletterId);
      expect(result.sent).toBe(1000);
      expect(result.delivered).toBe(950);
      expect(result.opens).toBe(400);
      expect(result.openRate).toBeCloseTo(42.11, 2);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `newsletter_metrics:${newsletterId}`,
        expect.any(String),
        300
      );
    });
  });

  describe('calculateROI', () => {
    it('should calculate ROI for a campaign', async () => {
      const campaignId = '123e4567-e89b-12d3-a456-426614174000';
      const mockResult = {
        total_revenue: '5000.00',
        conversion_count: '25',
        unique_contacts: '20',
        avg_conversion_value: '200.00',
      };

      mockDatabase.queryOne.mockResolvedValueOnce(mockResult);

      const result = await analyticsService.calculateROI(campaignId);

      expect(result).toMatchObject({
        campaignId,
        totalRevenue: 5000,
        conversions: 25,
        roi: expect.any(Number),
        roas: expect.any(Number),
        costPerAcquisition: expect.any(Number),
        customerLifetimeValue: 200,
        conversionRate: expect.any(Number),
      });
    });
  });
});
