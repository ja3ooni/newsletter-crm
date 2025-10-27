import { NotFoundError, ValidationError } from '@shared/errors';
import { AnalyticsRepository } from '../../src/repositories/AnalyticsRepository';
import { AnalyticsService } from '../../src/services/AnalyticsService';
import { MetricsCalculator } from '../../src/utils/MetricsCalculator';

// Mock dependencies
jest.mock('../../src/repositories/AnalyticsRepository');
jest.mock('../../src/utils/MetricsCalculator');

const MockAnalyticsRepository = AnalyticsRepository as jest.MockedClass<
  typeof AnalyticsRepository
>;
const MockMetricsCalculator = MetricsCalculator as jest.MockedClass<
  typeof MetricsCalculator
>;

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockAnalyticsRepository: jest.Mocked<AnalyticsRepository>;
  let mockMetricsCalculator: jest.Mocked<MetricsCalculator>;

  const mockEngagementEvent = {
    id: 'event-123',
    type: 'newsletter_open',
    userId: 'user-123',
    newsletterId: 'newsletter-123',
    timestamp: new Date(),
    metadata: {
      userAgent: 'Mozilla/5.0...',
      ipAddress: '192.168.1.1',
    },
  };

  const mockMetrics = {
    totalUsers: 1000,
    activeUsers: 750,
    newslettersSent: 50,
    totalOpens: 18500,
    totalClicks: 4200,
    averageOpenRate: 37.2,
    averageClickRate: 22.7,
    engagementScore: 8.5,
  };

  beforeEach(() => {
    mockAnalyticsRepository =
      new MockAnalyticsRepository() as jest.Mocked<AnalyticsRepository>;
    mockMetricsCalculator =
      new MockMetricsCalculator() as jest.Mocked<MetricsCalculator>;

    analyticsService = new AnalyticsService(
      mockAnalyticsRepository,
      mockMetricsCalculator
    );

    jest.clearAllMocks();
  });

  describe('trackEvent', () => {
    const validEventData = {
      type: 'newsletter_open',
      userId: 'user-123',
      newsletterId: 'newsletter-123',
      metadata: {
        userAgent: 'Mozilla/5.0...',
      },
    };

    it('should track engagement event successfully', async () => {
      mockAnalyticsRepository.createEvent.mockResolvedValue(
        mockEngagementEvent
      );

      const result = await analyticsService.trackEvent(validEventData);

      expect(result).toEqual(mockEngagementEvent);
      expect(mockAnalyticsRepository.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: validEventData.type,
          userId: validEventData.userId,
          newsletterId: validEventData.newsletterId,
        })
      );
    });

    it('should validate required event fields', async () => {
      const invalidEventData = {
        type: 'newsletter_open',
        // Missing userId
        newsletterId: 'newsletter-123',
      };

      await expect(
        analyticsService.trackEvent(invalidEventData)
      ).rejects.toThrow(ValidationError);
    });

    it('should validate event type', async () => {
      const invalidEventData = {
        ...validEventData,
        type: 'invalid_event_type',
      };

      await expect(
        analyticsService.trackEvent(invalidEventData)
      ).rejects.toThrow(ValidationError);
    });

    it('should handle repository errors gracefully', async () => {
      mockAnalyticsRepository.createEvent.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(analyticsService.trackEvent(validEventData)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('getNewsletterMetrics', () => {
    const newsletterId = 'newsletter-123';
    const mockNewsletterMetrics = {
      sent: 1000,
      delivered: 950,
      opens: 380,
      uniqueOpens: 350,
      clicks: 95,
      uniqueClicks: 85,
      unsubscribes: 5,
      bounces: 50,
      openRate: 36.8,
      clickRate: 24.3,
      unsubscribeRate: 0.5,
    };

    it('should return newsletter metrics', async () => {
      mockAnalyticsRepository.getNewsletterMetrics.mockResolvedValue(
        mockNewsletterMetrics
      );

      const result = await analyticsService.getNewsletterMetrics(newsletterId);

      expect(result).toEqual(mockNewsletterMetrics);
      expect(mockAnalyticsRepository.getNewsletterMetrics).toHaveBeenCalledWith(
        newsletterId
      );
    });

    it('should calculate engagement rates correctly', async () => {
      mockAnalyticsRepository.getNewsletterMetrics.mockResolvedValue(
        mockNewsletterMetrics
      );
      mockMetricsCalculator.calculateEngagementRate.mockReturnValue(36.8);
      mockMetricsCalculator.calculateClickThroughRate.mockReturnValue(24.3);

      const result = await analyticsService.getNewsletterMetrics(newsletterId);

      expect(
        mockMetricsCalculator.calculateEngagementRate
      ).toHaveBeenCalledWith(
        mockNewsletterMetrics.opens,
        mockNewsletterMetrics.delivered
      );
      expect(
        mockMetricsCalculator.calculateClickThroughRate
      ).toHaveBeenCalledWith(
        mockNewsletterMetrics.clicks,
        mockNewsletterMetrics.opens
      );
    });

    it('should handle missing newsletter gracefully', async () => {
      mockAnalyticsRepository.getNewsletterMetrics.mockResolvedValue(null);

      await expect(
        analyticsService.getNewsletterMetrics('non-existent')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getUserEngagement', () => {
    const userId = 'user-123';
    const mockUserEngagement = {
      totalOpens: 45,
      totalClicks: 12,
      newslettersReceived: 20,
      averageOpenRate: 45.0,
      averageClickRate: 26.7,
      engagementScore: 7.8,
      lastEngagement: new Date(),
      preferredTopics: ['ai', 'technology'],
      engagementTrend: 'increasing',
    };

    it('should return user engagement metrics', async () => {
      mockAnalyticsRepository.getUserEngagement.mockResolvedValue(
        mockUserEngagement
      );

      const result = await analyticsService.getUserEngagement(userId);

      expect(result).toEqual(mockUserEngagement);
      expect(mockAnalyticsRepository.getUserEngagement).toHaveBeenCalledWith(
        userId
      );
    });

    it('should calculate engagement score', async () => {
      mockAnalyticsRepository.getUserEngagement.mockResolvedValue(
        mockUserEngagement
      );
      mockMetricsCalculator.calculateEngagementScore.mockReturnValue(7.8);

      const result = await analyticsService.getUserEngagement(userId);

      expect(
        mockMetricsCalculator.calculateEngagementScore
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          opens: mockUserEngagement.totalOpens,
          clicks: mockUserEngagement.totalClicks,
        })
      );
    });
  });

  describe('getOverallMetrics', () => {
    const timeframe = '30d';

    it('should return platform-wide metrics', async () => {
      mockAnalyticsRepository.getOverallMetrics.mockResolvedValue(mockMetrics);

      const result = await analyticsService.getOverallMetrics(timeframe);

      expect(result).toEqual(mockMetrics);
      expect(mockAnalyticsRepository.getOverallMetrics).toHaveBeenCalledWith(
        timeframe
      );
    });

    it('should validate timeframe parameter', async () => {
      await expect(
        analyticsService.getOverallMetrics('invalid')
      ).rejects.toThrow(ValidationError);
    });

    it('should support different timeframes', async () => {
      const validTimeframes = ['7d', '30d', '90d', '1y'];

      for (const timeframe of validTimeframes) {
        mockAnalyticsRepository.getOverallMetrics.mockResolvedValue(
          mockMetrics
        );

        await analyticsService.getOverallMetrics(timeframe);

        expect(mockAnalyticsRepository.getOverallMetrics).toHaveBeenCalledWith(
          timeframe
        );
      }
    });
  });

  describe('getEngagementTrends', () => {
    const mockTrends = {
      daily: [
        { date: '2024-01-01', opens: 150, clicks: 35 },
        { date: '2024-01-02', opens: 180, clicks: 42 },
      ],
      weekly: [
        { week: '2024-W01', opens: 1050, clicks: 245 },
        { week: '2024-W02', opens: 1200, clicks: 280 },
      ],
      monthly: [
        { month: '2024-01', opens: 4500, clicks: 1050 },
        { month: '2024-02', opens: 5200, clicks: 1200 },
      ],
    };

    it('should return engagement trends', async () => {
      mockAnalyticsRepository.getEngagementTrends.mockResolvedValue(mockTrends);

      const result = await analyticsService.getEngagementTrends('30d');

      expect(result).toEqual(mockTrends);
      expect(mockAnalyticsRepository.getEngagementTrends).toHaveBeenCalledWith(
        '30d'
      );
    });

    it('should calculate trend percentages', async () => {
      mockAnalyticsRepository.getEngagementTrends.mockResolvedValue(mockTrends);
      mockMetricsCalculator.calculateTrendPercentage.mockReturnValue(14.3);

      const result = await analyticsService.getEngagementTrends('30d');

      expect(mockMetricsCalculator.calculateTrendPercentage).toHaveBeenCalled();
    });
  });

  describe('getTopContent', () => {
    const mockTopContent = [
      {
        id: 'article-1',
        title: 'AI Breakthrough',
        clicks: 450,
        opens: 1200,
        clickRate: 37.5,
        source: 'TechCrunch',
      },
      {
        id: 'article-2',
        title: 'ML Research',
        clicks: 380,
        opens: 1100,
        clickRate: 34.5,
        source: 'ArXiv',
      },
    ];

    it('should return top performing content', async () => {
      mockAnalyticsRepository.getTopContent.mockResolvedValue(mockTopContent);

      const result = await analyticsService.getTopContent('30d', 10);

      expect(result).toEqual(mockTopContent);
      expect(mockAnalyticsRepository.getTopContent).toHaveBeenCalledWith(
        '30d',
        10
      );
    });

    it('should validate limit parameter', async () => {
      await expect(analyticsService.getTopContent('30d', 0)).rejects.toThrow(
        ValidationError
      );

      await expect(analyticsService.getTopContent('30d', 101)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('generateReport', () => {
    const reportParams = {
      type: 'engagement',
      timeframe: '30d',
      format: 'json',
      includeCharts: true,
    };

    const mockReport = {
      id: 'report-123',
      type: 'engagement',
      generatedAt: new Date(),
      data: mockMetrics,
      charts: [
        {
          type: 'line',
          title: 'Engagement Trends',
          data: mockTrends.daily,
        },
      ],
    };

    it('should generate analytics report', async () => {
      mockAnalyticsRepository.generateReport.mockResolvedValue(mockReport);

      const result = await analyticsService.generateReport(reportParams);

      expect(result).toEqual(mockReport);
      expect(mockAnalyticsRepository.generateReport).toHaveBeenCalledWith(
        reportParams
      );
    });

    it('should validate report parameters', async () => {
      const invalidParams = {
        ...reportParams,
        type: 'invalid_type',
      };

      await expect(
        analyticsService.generateReport(invalidParams)
      ).rejects.toThrow(ValidationError);
    });

    it('should support different report formats', async () => {
      const formats = ['json', 'csv', 'pdf'];

      for (const format of formats) {
        const params = { ...reportParams, format };
        mockAnalyticsRepository.generateReport.mockResolvedValue(mockReport);

        await analyticsService.generateReport(params);

        expect(mockAnalyticsRepository.generateReport).toHaveBeenCalledWith(
          expect.objectContaining({ format })
        );
      }
    });
  });

  describe('predictChurn', () => {
    const mockChurnPrediction = {
      userId: 'user-123',
      churnProbability: 0.75,
      riskLevel: 'high',
      factors: [
        'Declining open rates',
        'No clicks in last 30 days',
        'Reduced engagement frequency',
      ],
      recommendations: [
        'Send re-engagement campaign',
        'Personalize content based on past interests',
        'Offer subscription preferences update',
      ],
    };

    it('should predict user churn risk', async () => {
      mockAnalyticsRepository.predictChurn.mockResolvedValue(
        mockChurnPrediction
      );

      const result = await analyticsService.predictChurn('user-123');

      expect(result).toEqual(mockChurnPrediction);
      expect(mockAnalyticsRepository.predictChurn).toHaveBeenCalledWith(
        'user-123'
      );
    });

    it('should handle users with insufficient data', async () => {
      mockAnalyticsRepository.predictChurn.mockResolvedValue(null);

      const result = await analyticsService.predictChurn('new-user');

      expect(result).toBeNull();
    });
  });
});
