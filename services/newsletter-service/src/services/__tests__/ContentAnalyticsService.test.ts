import { ContentAnalyticsService } from '../ContentAnalyticsService'

// Mock dependencies
jest.mock('../../utils/database', () => ({
  database: {
    queryOne: jest.fn(),
    query: jest.fn(),
  },
}))

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock('../../utils/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}))

describe('ContentAnalyticsService', () => {
  let service: ContentAnalyticsService
  const mockDatabase = require('../../utils/database').database
  const mockRedis = require('../../utils/redis').redis

  beforeEach(() => {
    service = new ContentAnalyticsService()
    jest.clearAllMocks()
  })

  describe('trackPerformance', () => {
    it('should track content performance metrics', async () => {
      const mockMetric = {
        id: 'metric-1',
        content_id: 'content-1',
        newsletter_id: null,
        campaign_id: null,
        metric_type: 'views',
        metric_value: '100',
        recorded_at: new Date(),
        metadata: {},
      }

      mockDatabase.queryOne.mockResolvedValue(mockMetric)

      const result = await service.trackPerformance({
        contentId: 'content-1',
        metricType: 'views',
        metricValue: 100,
      })

      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO content_performance'),
        expect.arrayContaining(['content-1', null, null, 'views', 100, '{}'])
      )

      expect(result).toEqual({
        id: 'metric-1',
        contentId: 'content-1',
        newsletterId: null,
        campaignId: null,
        metricType: 'views',
        metricValue: 100,
        recordedAt: mockMetric.recorded_at,
        metadata: {},
      })
    })
  })

  describe('calculatePerformanceScore', () => {
    it('should calculate performance score correctly', () => {
      const metrics = {
        totalViews: 1000,
        totalClicks: 50,
        totalShares: 10,
        avgEngagementTime: 120,
        conversionRate: 5,
      }

      // Access private method for testing
      const score = (service as any).calculatePerformanceScore(metrics)

      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(100)
      expect(typeof score).toBe('number')
    })
  })

  describe('generateRecommendations', () => {
    it('should generate recommendations for low engagement', () => {
      const data = {
        totalViews: 1000,
        totalClicks: 5, // Low click rate
        totalShares: 0,
        avgEngagementTime: 15, // Low engagement time
        conversionRate: 0.5,
        trend: 'down' as const,
        type: 'article',
      }

      // Access private method for testing
      const recommendations = (service as any).generateRecommendations(data)

      expect(recommendations).toContain('Consider improving call-to-action placement and clarity')
      expect(recommendations).toContain('Content may be too complex or not engaging enough - consider simplifying or adding visual elements')
      expect(recommendations).toContain('Add social sharing buttons and encourage sharing with compelling content')
    })

    it('should generate positive recommendations for good performance', () => {
      const data = {
        totalViews: 1000,
        totalClicks: 50,
        totalShares: 20,
        avgEngagementTime: 180,
        conversionRate: 5,
        trend: 'up' as const,
        type: 'article',
      }

      // Access private method for testing
      const recommendations = (service as any).generateRecommendations(data)

      expect(recommendations).toContain('Content is performing well - consider creating similar content or expanding on successful themes')
    })
  })

  describe('getContentAnalytics', () => {
    it('should return cached analytics if available', async () => {
      const cachedAnalytics = {
        id: 'analytics-1',
        contentId: 'content-1',
        totalViews: 100,
        performanceScore: 75,
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedAnalytics))

      const result = await service.getContentAnalytics(
        'content-1',
        new Date('2023-01-01'),
        new Date('2023-01-31')
      )

      expect(result).toEqual(cachedAnalytics)
      expect(mockDatabase.queryOne).not.toHaveBeenCalled()
    })

    it('should generate analytics if not cached', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockDatabase.queryOne.mockResolvedValue(null)

      // Mock the metrics query for generateContentAnalytics
      mockDatabase.query.mockResolvedValue([
        { metric_type: 'views', total_value: '100', avg_value: '10', count: '10' },
        { metric_type: 'clicks', total_value: '20', avg_value: '2', count: '10' },
      ])

      // Mock the upsert query
      const mockAnalytics = {
        id: 'analytics-1',
        content_id: 'content-1',
        period_start: new Date('2023-01-01'),
        period_end: new Date('2023-01-31'),
        total_views: 100,
        total_clicks: 20,
        total_shares: 0,
        avg_engagement_time: 0,
        conversion_rate: 0,
        performance_score: 25.5,
        created_at: new Date(),
        updated_at: new Date(),
      }

      mockDatabase.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce(mockAnalytics)

      const result = await service.getContentAnalytics(
        'content-1',
        new Date('2023-01-01'),
        new Date('2023-01-31')
      )

      expect(result).toBeDefined()
      expect(result?.contentId).toBe('content-1')
      expect(result?.totalViews).toBe(100)
      expect(result?.totalClicks).toBe(20)
    })
  })
})
