import { database } from '../utils/database'
import { logger } from '../utils/logger'
import { redis } from '../utils/redis'

export interface ContentPerformanceMetric {
  id: string
  contentId: string
  newsletterId?: string
  campaignId?: string
  metricType: 'views' | 'clicks' | 'shares' | 'engagement_time' | 'conversions'
  metricValue: number
  recordedAt: Date
  metadata: Record<string, any>
}

export interface ContentAnalytics {
  id: string
  contentId: string
  periodStart: Date
  periodEnd: Date
  totalViews: number
  totalClicks: number
  totalShares: number
  avgEngagementTime: number
  conversionRate: number
  performanceScore: number
  createdAt: Date
  updatedAt: Date
}

export interface ContentPerformanceReport {
  contentId: string
  title: string
  type: string
  category: string
  totalViews: number
  totalClicks: number
  totalShares: number
  avgEngagementTime: number
  conversionRate: number
  performanceScore: number
  trend: 'up' | 'down' | 'stable'
  trendPercentage: number
  topPerformingPeriods: Array<{
    period: string
    score: number
  }>
  recommendations: string[]
}

export interface TrackPerformanceData {
  contentId: string
  newsletterId?: string
  campaignId?: string
  metricType: 'views' | 'clicks' | 'shares' | 'engagement_time' | 'conversions'
  metricValue: number
  metadata?: Record<string, any>
}

export class ContentAnalyticsService {
  async trackPerformance(data: TrackPerformanceData): Promise<ContentPerformanceMetric> {
    try {
      const query = `
        INSERT INTO content_performance (
          content_id, newsletter_id, campaign_id, metric_type, metric_value, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `

      const values = [
        data.contentId,
        data.newsletterId || null,
        data.campaignId || null,
        data.metricType,
        data.metricValue,
        JSON.stringify(data.metadata || {}),
      ]

      const result = await database.queryOne<any>(query, values)
      const metric = this.mapToContentPerformanceMetric(result)

      // Invalidate analytics cache for this content
      await this.invalidateContentAnalyticsCache(data.contentId)

      logger.info('Content performance tracked', {
        contentId: data.contentId,
        metricType: data.metricType,
        metricValue: data.metricValue,
      })

      return metric
    } catch (error) {
      logger.error('Error tracking content performance:', error)
      throw error
    }
  }

  async getContentAnalytics(
    contentId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ContentAnalytics | null> {
    try {
      const cacheKey = `content_analytics:${contentId}:${periodStart.toISOString()}:${periodEnd.toISOString()}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const query = `
        SELECT * FROM content_analytics
        WHERE content_id = $1 AND period_start = $2 AND period_end = $3
      `

      const result = await database.queryOne<any>(query, [contentId, periodStart, periodEnd])

      if (!result) {
        // Generate analytics if not exists
        return await this.generateContentAnalytics(contentId, periodStart, periodEnd)
      }

      const analytics = this.mapToContentAnalytics(result)

      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(analytics), 3600)

      return analytics
    } catch (error) {
      logger.error('Error getting content analytics:', error)
      throw error
    }
  }

  async generateContentAnalytics(
    contentId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ContentAnalytics> {
    try {
      // Aggregate performance metrics for the period
      const metricsQuery = `
        SELECT
          metric_type,
          SUM(metric_value) as total_value,
          AVG(metric_value) as avg_value,
          COUNT(*) as count
        FROM content_performance
        WHERE content_id = $1
          AND recorded_at >= $2
          AND recorded_at <= $3
        GROUP BY metric_type
      `

      const metricsResults = await database.query<{
        metric_type: string
        total_value: string
        avg_value: string
        count: string
      }>(metricsQuery, [contentId, periodStart, periodEnd])

      // Initialize analytics data
      let totalViews = 0
      let totalClicks = 0
      let totalShares = 0
      let avgEngagementTime = 0
      let conversions = 0

      // Process metrics
      metricsResults.forEach(metric => {
        const totalValue = parseFloat(metric.total_value)
        const avgValue = parseFloat(metric.avg_value)

        switch (metric.metric_type) {
          case 'views':
            totalViews = totalValue
            break
          case 'clicks':
            totalClicks = totalValue
            break
          case 'shares':
            totalShares = totalValue
            break
          case 'engagement_time':
            avgEngagementTime = avgValue
            break
          case 'conversions':
            conversions = totalValue
            break
        }
      })

      // Calculate conversion rate and performance score
      const conversionRate = totalViews > 0 ? (conversions / totalViews) * 100 : 0
      const performanceScore = this.calculatePerformanceScore({
        totalViews,
        totalClicks,
        totalShares,
        avgEngagementTime,
        conversionRate,
      })

      // Insert or update analytics record
      const upsertQuery = `
        INSERT INTO content_analytics (
          content_id, period_start, period_end, total_views, total_clicks,
          total_shares, avg_engagement_time, conversion_rate, performance_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (content_id, period_start, period_end)
        DO UPDATE SET
          total_views = EXCLUDED.total_views,
          total_clicks = EXCLUDED.total_clicks,
          total_shares = EXCLUDED.total_shares,
          avg_engagement_time = EXCLUDED.avg_engagement_time,
          conversion_rate = EXCLUDED.conversion_rate,
          performance_score = EXCLUDED.performance_score,
          updated_at = NOW()
        RETURNING *
      `

      const upsertValues = [
        contentId,
        periodStart,
        periodEnd,
        totalViews,
        totalClicks,
        totalShares,
        avgEngagementTime,
        conversionRate,
        performanceScore,
      ]

      const result = await database.queryOne<any>(upsertQuery, upsertValues)
      const analytics = this.mapToContentAnalytics(result)

      logger.info('Content analytics generated', {
        contentId,
        periodStart,
        periodEnd,
        performanceScore,
      })

      return analytics
    } catch (error) {
      logger.error('Error generating content analytics:', error)
      throw error
    }
  }

  async getContentPerformanceReport(
    contentId: string,
    days: number = 30
  ): Promise<ContentPerformanceReport> {
    try {
      const cacheKey = `content_performance_report:${contentId}:${days}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // Get content details
      const contentQuery = `
        SELECT title, type, category FROM content_library_items WHERE id = $1
      `
      const contentResult = await database.queryOne<{
        title: string
        type: string
        category: string
      }>(contentQuery, [contentId])

      if (!contentResult) {
        throw new Error('Content not found')
      }

      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      // Get current period analytics
      const currentAnalytics = await this.getContentAnalytics(contentId, startDate, endDate)

      // Get previous period for trend calculation
      const prevEndDate = new Date(startDate.getTime() - 1)
      const prevStartDate = new Date(prevEndDate.getTime() - days * 24 * 60 * 60 * 1000)
      const previousAnalytics = await this.getContentAnalytics(contentId, prevStartDate, prevEndDate)

      // Calculate trend
      const currentScore = currentAnalytics?.performanceScore || 0
      const previousScore = previousAnalytics?.performanceScore || 0
      const trendPercentage = previousScore > 0
        ? ((currentScore - previousScore) / previousScore) * 100
        : 0

      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (Math.abs(trendPercentage) > 5) {
        trend = trendPercentage > 0 ? 'up' : 'down'
      }

      // Get top performing periods
      const topPeriodsQuery = `
        SELECT
          to_char(period_start, 'YYYY-MM-DD') as period,
          performance_score as score
        FROM content_analytics
        WHERE content_id = $1
        ORDER BY performance_score DESC
        LIMIT 5
      `
      const topPeriods = await database.query<{
        period: string
        score: string
      }>(topPeriodsQuery, [contentId])

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        totalViews: currentAnalytics?.totalViews || 0,
        totalClicks: currentAnalytics?.totalClicks || 0,
        totalShares: currentAnalytics?.totalShares || 0,
        avgEngagementTime: currentAnalytics?.avgEngagementTime || 0,
        conversionRate: currentAnalytics?.conversionRate || 0,
        trend,
        type: contentResult.type,
      })

      const report: ContentPerformanceReport = {
        contentId,
        title: contentResult.title,
        type: contentResult.type,
        category: contentResult.category,
        totalViews: currentAnalytics?.totalViews || 0,
        totalClicks: currentAnalytics?.totalClicks || 0,
        totalShares: currentAnalytics?.totalShares || 0,
        avgEngagementTime: currentAnalytics?.avgEngagementTime || 0,
        conversionRate: currentAnalytics?.conversionRate || 0,
        performanceScore: currentAnalytics?.performanceScore || 0,
        trend,
        trendPercentage,
        topPerformingPeriods: topPeriods.map(p => ({
          period: p.period,
          score: parseFloat(p.score),
        })),
        recommendations,
      }

      // Cache for 30 minutes
      await redis.set(cacheKey, JSON.stringify(report), 1800)

      return report
    } catch (error) {
      logger.error('Error getting content performance report:', error)
      throw error
    }
  }

  async getTopPerformingContent(
    limit: number = 10,
    days: number = 30,
    category?: string,
    type?: string
  ): Promise<ContentPerformanceReport[]> {
    try {
      const cacheKey = `top_performing_content:${limit}:${days}:${category || 'all'}:${type || 'all'}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      let whereClause = 'WHERE ca.period_start >= $1 AND ca.period_end <= $2'
      const values: any[] = [startDate, endDate]
      let paramCount = 2

      if (category) {
        whereClause += ` AND cli.category = $${++paramCount}`
        values.push(category)
      }

      if (type) {
        whereClause += ` AND cli.type = $${++paramCount}`
        values.push(type)
      }

      const query = `
        SELECT
          cli.id as content_id,
          cli.title,
          cli.type,
          cli.category,
          AVG(ca.total_views) as total_views,
          AVG(ca.total_clicks) as total_clicks,
          AVG(ca.total_shares) as total_shares,
          AVG(ca.avg_engagement_time) as avg_engagement_time,
          AVG(ca.conversion_rate) as conversion_rate,
          AVG(ca.performance_score) as performance_score
        FROM content_analytics ca
        JOIN content_library_items cli ON ca.content_id = cli.id
        ${whereClause}
        GROUP BY cli.id, cli.title, cli.type, cli.category
        ORDER BY AVG(ca.performance_score) DESC
        LIMIT $${++paramCount}
      `
      values.push(limit)

      const results = await database.query<{
        content_id: string
        title: string
        type: string
        category: string
        total_views: string
        total_clicks: string
        total_shares: string
        avg_engagement_time: string
        conversion_rate: string
        performance_score: string
      }>(query, values)

      const reports: ContentPerformanceReport[] = results.map(result => ({
        contentId: result.content_id,
        title: result.title,
        type: result.type,
        category: result.category,
        totalViews: parseFloat(result.total_views),
        totalClicks: parseFloat(result.total_clicks),
        totalShares: parseFloat(result.total_shares),
        avgEngagementTime: parseFloat(result.avg_engagement_time),
        conversionRate: parseFloat(result.conversion_rate),
        performanceScore: parseFloat(result.performance_score),
        trend: 'stable', // Would need additional calculation for trend
        trendPercentage: 0,
        topPerformingPeriods: [],
        recommendations: [],
      }))

      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(reports), 3600)

      return reports
    } catch (error) {
      logger.error('Error getting top performing content:', error)
      throw error
    }
  }

  async getContentAnalyticsSummary(days: number = 30): Promise<{
    totalContent: number
    totalViews: number
    totalClicks: number
    totalShares: number
    avgPerformanceScore: number
    topCategories: Array<{ category: string; score: number }>
    topTypes: Array<{ type: string; score: number }>
  }> {
    try {
      const cacheKey = `content_analytics_summary:${days}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      // Get overall summary
      const summaryQuery = `
        SELECT
          COUNT(DISTINCT ca.content_id) as total_content,
          SUM(ca.total_views) as total_views,
          SUM(ca.total_clicks) as total_clicks,
          SUM(ca.total_shares) as total_shares,
          AVG(ca.performance_score) as avg_performance_score
        FROM content_analytics ca
        WHERE ca.period_start >= $1 AND ca.period_end <= $2
      `

      const summaryResult = await database.queryOne<{
        total_content: string
        total_views: string
        total_clicks: string
        total_shares: string
        avg_performance_score: string
      }>(summaryQuery, [startDate, endDate])

      // Get top categories
      const categoriesQuery = `
        SELECT
          cli.category,
          AVG(ca.performance_score) as avg_score
        FROM content_analytics ca
        JOIN content_library_items cli ON ca.content_id = cli.id
        WHERE ca.period_start >= $1 AND ca.period_end <= $2
        GROUP BY cli.category
        ORDER BY avg_score DESC
        LIMIT 5
      `

      const categoriesResults = await database.query<{
        category: string
        avg_score: string
      }>(categoriesQuery, [startDate, endDate])

      // Get top types
      const typesQuery = `
        SELECT
          cli.type,
          AVG(ca.performance_score) as avg_score
        FROM content_analytics ca
        JOIN content_library_items cli ON ca.content_id = cli.id
        WHERE ca.period_start >= $1 AND ca.period_end <= $2
        GROUP BY cli.type
        ORDER BY avg_score DESC
        LIMIT 5
      `

      const typesResults = await database.query<{
        type: string
        avg_score: string
      }>(typesQuery, [startDate, endDate])

      const summary = {
        totalContent: parseInt(summaryResult?.total_content || '0', 10),
        totalViews: parseInt(summaryResult?.total_views || '0', 10),
        totalClicks: parseInt(summaryResult?.total_clicks || '0', 10),
        totalShares: parseInt(summaryResult?.total_shares || '0', 10),
        avgPerformanceScore: parseFloat(summaryResult?.avg_performance_score || '0'),
        topCategories: categoriesResults.map(r => ({
          category: r.category,
          score: parseFloat(r.avg_score),
        })),
        topTypes: typesResults.map(r => ({
          type: r.type,
          score: parseFloat(r.avg_score),
        })),
      }

      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(summary), 3600)

      return summary
    } catch (error) {
      logger.error('Error getting content analytics summary:', error)
      throw error
    }
  }

  private calculatePerformanceScore(metrics: {
    totalViews: number
    totalClicks: number
    totalShares: number
    avgEngagementTime: number
    conversionRate: number
  }): number {
    // Weighted scoring algorithm
    const weights = {
      views: 0.2,
      clicks: 0.3,
      shares: 0.2,
      engagement: 0.15,
      conversion: 0.15,
    }

    // Normalize metrics (simple approach - could be more sophisticated)
    const normalizedViews = Math.min(metrics.totalViews / 1000, 1) * 100
    const normalizedClicks = Math.min(metrics.totalClicks / 100, 1) * 100
    const normalizedShares = Math.min(metrics.totalShares / 50, 1) * 100
    const normalizedEngagement = Math.min(metrics.avgEngagementTime / 300, 1) * 100 // 5 minutes max
    const normalizedConversion = Math.min(metrics.conversionRate, 100)

    const score =
      normalizedViews * weights.views +
      normalizedClicks * weights.clicks +
      normalizedShares * weights.shares +
      normalizedEngagement * weights.engagement +
      normalizedConversion * weights.conversion

    return Math.round(score * 100) / 100 // Round to 2 decimal places
  }

  private generateRecommendations(data: {
    totalViews: number
    totalClicks: number
    totalShares: number
    avgEngagementTime: number
    conversionRate: number
    trend: 'up' | 'down' | 'stable'
    type: string
  }): string[] {
    const recommendations: string[] = []

    // Low engagement recommendations
    if (data.totalViews > 0 && data.totalClicks / data.totalViews < 0.02) {
      recommendations.push('Consider improving call-to-action placement and clarity')
    }

    if (data.avgEngagementTime < 30) {
      recommendations.push('Content may be too complex or not engaging enough - consider simplifying or adding visual elements')
    }

    if (data.totalShares === 0 && data.totalViews > 100) {
      recommendations.push('Add social sharing buttons and encourage sharing with compelling content')
    }

    if (data.conversionRate < 1 && data.totalViews > 50) {
      recommendations.push('Optimize conversion funnel and add clear value propositions')
    }

    // Trend-based recommendations
    if (data.trend === 'down') {
      recommendations.push('Performance is declining - consider refreshing content or trying different distribution channels')
    }

    // Type-specific recommendations
    if (data.type === 'article' && data.avgEngagementTime < 60) {
      recommendations.push('Articles should aim for longer engagement - consider adding more valuable insights or breaking into sections')
    }

    if (data.type === 'template' && data.totalViews < 10) {
      recommendations.push('Template usage is low - ensure it\'s discoverable and meets user needs')
    }

    // Default recommendation if no specific issues found
    if (recommendations.length === 0) {
      recommendations.push('Content is performing well - consider creating similar content or expanding on successful themes')
    }

    return recommendations
  }

  private async invalidateContentAnalyticsCache(contentId: string): Promise<void> {
    try {
      // Pattern-based cache invalidation would be ideal here
      // For now, we'll invalidate specific known patterns
      const patterns = [
        `content_analytics:${contentId}:*`,
        `content_performance_report:${contentId}:*`,
        'top_performing_content:*',
        'content_analytics_summary:*',
      ]

      // In a real implementation, you'd use Redis SCAN with patterns
      // For now, we'll just delete the summary caches
      await redis.del('content_analytics_summary:30')
      await redis.del('content_analytics_summary:7')

      logger.debug('Content analytics cache invalidated', { contentId })
    } catch (error) {
      logger.error('Error invalidating content analytics cache:', error)
    }
  }

  private mapToContentPerformanceMetric(row: any): ContentPerformanceMetric {
    return {
      id: row.id,
      contentId: row.content_id,
      newsletterId: row.newsletter_id,
      campaignId: row.campaign_id,
      metricType: row.metric_type,
      metricValue: parseFloat(row.metric_value),
      recordedAt: row.recorded_at,
      metadata: row.metadata || {},
    }
  }

  private mapToContentAnalytics(row: any): ContentAnalytics {
    return {
      id: row.id,
      contentId: row.content_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalViews: row.total_views,
      totalClicks: row.total_clicks,
      totalShares: row.total_shares,
      avgEngagementTime: parseFloat(row.avg_engagement_time),
      conversionRate: parseFloat(row.conversion_rate),
      performanceScore: parseFloat(row.performance_score),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
