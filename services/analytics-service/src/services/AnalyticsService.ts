import {
  CohortAnalysis,
  EngagementEvent,
  EngagementMetrics,
  NewsletterMetrics,
  ROICalculation,
} from '@/types';
import { database } from '@/utils/database';
import { logger } from '@/utils/logger';
import { redis } from '@/utils/redis';
// import { format, subDays } from 'date-fns'

export class AnalyticsService {
  async trackEngagementEvent(
    event: Omit<EngagementEvent, 'id'>
  ): Promise<EngagementEvent> {
    const id = crypto.randomUUID();
    const engagementEvent: EngagementEvent = { id, ...event };

    try {
      // Store in database
      await database.query(
        `INSERT INTO engagement_events
         (id, contact_id, newsletter_id, campaign_id, event_type, timestamp, metadata, score, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          engagementEvent.id,
          engagementEvent.contactId,
          engagementEvent.newsletterId,
          engagementEvent.campaignId,
          engagementEvent.eventType,
          engagementEvent.timestamp,
          JSON.stringify(engagementEvent.metadata),
          engagementEvent.score,
          engagementEvent.ipAddress,
          engagementEvent.userAgent,
        ]
      );

      // Update real-time metrics in Redis
      await this.updateRealTimeMetrics(engagementEvent);

      // Trigger real-time updates via WebSocket
      await this.broadcastMetricUpdate(engagementEvent);

      logger.info('Engagement event tracked', {
        eventId: id,
        eventType: event.eventType,
      });
      return engagementEvent;
    } catch (error) {
      logger.error('Failed to track engagement event', { event, error });
      throw error;
    }
  }

  async getEngagementMetrics(
    contactId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<EngagementMetrics> {
    try {
      const whereClause = timeRange
        ? 'WHERE contact_id = $1 AND timestamp BETWEEN $2 AND $3'
        : 'WHERE contact_id = $1';

      const params = timeRange
        ? [contactId, timeRange.start, timeRange.end]
        : [contactId];

      const result = await database.queryOne<{
        opens: string;
        unique_opens: string;
        clicks: string;
        unique_clicks: string;
        unsubscribes: string;
        bounces: string;
        complaints: string;
        last_engagement: Date;
      }>(
        `
        SELECT
          COUNT(CASE WHEN event_type = 'email_open' THEN 1 END) as opens,
          COUNT(DISTINCT CASE WHEN event_type = 'email_open' THEN newsletter_id END) as unique_opens,
          COUNT(CASE WHEN event_type = 'email_click' THEN 1 END) as clicks,
          COUNT(DISTINCT CASE WHEN event_type = 'email_click' THEN newsletter_id END) as unique_clicks,
          COUNT(CASE WHEN event_type = 'unsubscribe' THEN 1 END) as unsubscribes,
          COUNT(CASE WHEN event_type = 'bounce' THEN 1 END) as bounces,
          COUNT(CASE WHEN event_type = 'complaint' THEN 1 END) as complaints,
          MAX(timestamp) as last_engagement
        FROM engagement_events
        ${whereClause}
      `,
        params
      );

      if (!result) {
        return this.getDefaultEngagementMetrics();
      }

      const opens = parseInt(result.opens);
      const clicks = parseInt(result.clicks);
      const unsubscribes = parseInt(result.unsubscribes);
      const bounces = parseInt(result.bounces);
      const totalSent = opens + bounces; // Approximation

      return {
        opens,
        uniqueOpens: parseInt(result.unique_opens),
        clicks,
        uniqueClicks: parseInt(result.unique_clicks),
        unsubscribes,
        bounces: parseInt(result.bounces),
        complaints: parseInt(result.complaints),
        engagementScore: this.calculateEngagementScore(
          opens,
          clicks,
          unsubscribes
        ),
        openRate: totalSent > 0 ? (opens / totalSent) * 100 : 0,
        clickRate: opens > 0 ? (clicks / opens) * 100 : 0,
        unsubscribeRate: totalSent > 0 ? (unsubscribes / totalSent) * 100 : 0,
        bounceRate:
          totalSent > 0 ? (parseInt(result.bounces) / totalSent) * 100 : 0,
        lastEngagement: result.last_engagement || new Date(),
      };
    } catch (error) {
      logger.error('Failed to get engagement metrics', { contactId, error });
      throw error;
    }
  }

  async getNewsletterMetrics(newsletterId: string): Promise<NewsletterMetrics> {
    try {
      // Check cache first
      const cacheKey = `newsletter_metrics:${newsletterId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await database.queryOne<{
        sent: string;
        delivered: string;
        opens: string;
        unique_opens: string;
        clicks: string;
        unique_clicks: string;
        unsubscribes: string;
        bounces: string;
        complaints: string;
        revenue_attribution: string;
        conversion_count: string;
      }>(
        `
        SELECT
          COALESCE(nm.sent, 0) as sent,
          COALESCE(nm.delivered, 0) as delivered,
          COUNT(CASE WHEN ee.event_type = 'email_open' THEN 1 END) as opens,
          COUNT(DISTINCT CASE WHEN ee.event_type = 'email_open' THEN ee.contact_id END) as unique_opens,
          COUNT(CASE WHEN ee.event_type = 'email_click' THEN 1 END) as clicks,
          COUNT(DISTINCT CASE WHEN ee.event_type = 'email_click' THEN ee.contact_id END) as unique_clicks,
          COUNT(CASE WHEN ee.event_type = 'unsubscribe' THEN 1 END) as unsubscribes,
          COUNT(CASE WHEN ee.event_type = 'bounce' THEN 1 END) as bounces,
          COUNT(CASE WHEN ee.event_type = 'complaint' THEN 1 END) as complaints,
          COALESCE(SUM(ra.conversion_value * ra.attribution_weight), 0) as revenue_attribution,
          COUNT(DISTINCT ra.id) as conversion_count
        FROM newsletters n
        LEFT JOIN newsletter_metrics nm ON n.id = nm.newsletter_id
        LEFT JOIN engagement_events ee ON n.id = ee.newsletter_id
        LEFT JOIN revenue_attribution ra ON n.id = ra.newsletter_id
        WHERE n.id = $1
        GROUP BY n.id, nm.sent, nm.delivered
      `,
        [newsletterId]
      );

      if (!result) {
        throw new Error(`Newsletter ${newsletterId} not found`);
      }

      const sent = parseInt(result.sent);
      const delivered = parseInt(result.delivered);
      const opens = parseInt(result.opens);
      const clicks = parseInt(result.clicks);
      const uniqueOpens = parseInt(result.unique_opens);

      const metrics: NewsletterMetrics = {
        newsletterId,
        sent,
        delivered,
        opens,
        uniqueOpens,
        clicks,
        uniqueClicks: parseInt(result.unique_clicks),
        unsubscribes: parseInt(result.unsubscribes),
        bounces: parseInt(result.bounces),
        complaints: parseInt(result.complaints),
        openRate: delivered > 0 ? (opens / delivered) * 100 : 0,
        clickRate: opens > 0 ? (clicks / opens) * 100 : 0,
        unsubscribeRate:
          delivered > 0 ? (parseInt(result.unsubscribes) / delivered) * 100 : 0,
        bounceRate: sent > 0 ? (parseInt(result.bounces) / sent) * 100 : 0,
        engagementScore: this.calculateEngagementScore(
          opens,
          clicks,
          parseInt(result.unsubscribes)
        ),
        revenueAttribution: parseFloat(result.revenue_attribution),
        conversionCount: parseInt(result.conversion_count),
        conversionRate:
          delivered > 0
            ? (parseInt(result.conversion_count) / delivered) * 100
            : 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Cache for 5 minutes
      await redis.set(cacheKey, JSON.stringify(metrics), 300);

      return metrics;
    } catch (error) {
      logger.error('Failed to get newsletter metrics', { newsletterId, error });
      throw error;
    }
  }

  async getCohortAnalysis(
    period: 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<CohortAnalysis[]> {
    try {
      const cohorts = await database.query<{
        cohort_id: string;
        cohort_name: string;
        start_date: Date;
        total_subscribers: string;
        retention_data: string;
        engagement_data: string;
        revenue_data: string;
      }>(
        `
        WITH cohort_data AS (
          SELECT
            DATE_TRUNC($1, c.created_at) as cohort_period,
            c.id as contact_id,
            c.created_at,
            COUNT(*) OVER (PARTITION BY DATE_TRUNC($1, c.created_at)) as cohort_size
          FROM contacts c
          WHERE c.created_at BETWEEN $2 AND $3
        ),
        retention_analysis AS (
          SELECT
            cd.cohort_period,
            cd.cohort_size,
            EXTRACT(EPOCH FROM (ee.timestamp - cd.created_at)) / 86400 as days_since_signup,
            COUNT(DISTINCT cd.contact_id) as active_users,
            AVG(ee.score) as avg_engagement,
            SUM(COALESCE(ra.conversion_value, 0)) as cohort_revenue
          FROM cohort_data cd
          LEFT JOIN engagement_events ee ON cd.contact_id = ee.contact_id
          LEFT JOIN revenue_attribution ra ON cd.contact_id = ra.contact_id
          GROUP BY cd.cohort_period, cd.cohort_size, days_since_signup
        )
        SELECT
          cohort_period::text as cohort_id,
          TO_CHAR(cohort_period, 'YYYY-MM-DD') as cohort_name,
          cohort_period as start_date,
          MAX(cohort_size)::text as total_subscribers,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'period', days_since_signup,
              'retention_rate', (active_users::float / MAX(cohort_size)) * 100
            ) ORDER BY days_since_signup
          ) as retention_data,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'period', days_since_signup,
              'engagement_rate', COALESCE(avg_engagement, 0)
            ) ORDER BY days_since_signup
          ) as engagement_data,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'period', days_since_signup,
              'revenue', COALESCE(cohort_revenue, 0)
            ) ORDER BY days_since_signup
          ) as revenue_data
        FROM retention_analysis
        GROUP BY cohort_period
        ORDER BY cohort_period
      `,
        [period, startDate, endDate]
      );

      return cohorts.map(cohort => ({
        cohortId: cohort.cohort_id,
        cohortName: cohort.cohort_name,
        period,
        startDate: cohort.start_date,
        endDate,
        totalSubscribers: parseInt(cohort.total_subscribers),
        retentionRates: JSON.parse(cohort.retention_data).map(
          (d: any) => d.retention_rate
        ),
        engagementRates: JSON.parse(cohort.engagement_data).map(
          (d: any) => d.engagement_rate
        ),
        churnRates: JSON.parse(cohort.retention_data).map(
          (d: any) => 100 - d.retention_rate
        ),
        revenuePerCohort: JSON.parse(cohort.revenue_data).reduce(
          (sum: number, d: any) => sum + d.revenue,
          0
        ),
        averageLifetimeValue:
          JSON.parse(cohort.revenue_data).reduce(
            (sum: number, d: any) => sum + d.revenue,
            0
          ) / parseInt(cohort.total_subscribers),
      }));
    } catch (error) {
      logger.error('Failed to get cohort analysis', {
        period,
        startDate,
        endDate,
        error,
      });
      throw error;
    }
  }

  async calculateROI(
    campaignId?: string,
    newsletterId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<ROICalculation> {
    try {
      const whereConditions = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (campaignId) {
        whereConditions.push(`ra.campaign_id = $${paramIndex}`);
        params.push(campaignId);
        paramIndex++;
      }

      if (newsletterId) {
        whereConditions.push(`ra.newsletter_id = $${paramIndex}`);
        params.push(newsletterId);
        paramIndex++;
      }

      if (timeRange) {
        whereConditions.push(
          `ra.conversion_timestamp BETWEEN $${paramIndex} AND $${paramIndex + 1}`
        );
        params.push(timeRange.start, timeRange.end);
        paramIndex += 2;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      const result = await database.queryOne<{
        total_revenue: string;
        conversion_count: string;
        unique_contacts: string;
        avg_conversion_value: string;
      }>(
        `
        SELECT
          SUM(ra.conversion_value * ra.attribution_weight) as total_revenue,
          COUNT(*) as conversion_count,
          COUNT(DISTINCT ra.contact_id) as unique_contacts,
          AVG(ra.conversion_value) as avg_conversion_value
        FROM revenue_attribution ra
        ${whereClause}
      `,
        params
      );

      // Estimate costs (this would typically come from campaign/newsletter cost data)
      const estimatedCost = 100; // This should be calculated based on actual campaign costs
      const totalRevenue = parseFloat(result?.total_revenue || '0');
      const conversionCount = parseInt(result?.conversion_count || '0');
      const uniqueContacts = parseInt(result?.unique_contacts || '0');

      return {
        campaignId,
        newsletterId,
        timeRange: timeRange || {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        totalCost: estimatedCost,
        totalRevenue,
        roi:
          estimatedCost > 0
            ? ((totalRevenue - estimatedCost) / estimatedCost) * 100
            : 0,
        roas: estimatedCost > 0 ? totalRevenue / estimatedCost : 0,
        costPerAcquisition:
          uniqueContacts > 0 ? estimatedCost / uniqueContacts : 0,
        customerLifetimeValue: parseFloat(result?.avg_conversion_value || '0'),
        paybackPeriod: 30, // This would be calculated based on subscription/revenue patterns
        marginContribution: totalRevenue * 0.7, // Assuming 70% margin
        conversions: conversionCount,
        conversionRate:
          uniqueContacts > 0 ? (conversionCount / uniqueContacts) * 100 : 0,
      };
    } catch (error) {
      logger.error('Failed to calculate ROI', {
        campaignId,
        newsletterId,
        error,
      });
      throw error;
    }
  }

  private async updateRealTimeMetrics(event: EngagementEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const metricKey = `realtime:${today}`;

    try {
      // Update daily counters
      await redis.incr(`${metricKey}:${event.eventType}`);
      await redis.expire(`${metricKey}:${event.eventType}`, 86400); // 24 hours

      // Update contact-specific metrics
      if (event.contactId) {
        await redis.incr(`contact:${event.contactId}:${event.eventType}`);
        await redis.set(
          `contact:${event.contactId}:last_activity`,
          new Date().toISOString()
        );
      }

      // Update newsletter-specific metrics
      if (event.newsletterId) {
        await redis.incr(`newsletter:${event.newsletterId}:${event.eventType}`);
      }
    } catch (error) {
      logger.error('Failed to update real-time metrics', { event, error });
    }
  }

  private async broadcastMetricUpdate(event: EngagementEvent): Promise<void> {
    try {
      const message = {
        type: 'metric_update',
        payload: {
          eventType: event.eventType,
          contactId: event.contactId,
          newsletterId: event.newsletterId,
          timestamp: event.timestamp,
        },
        timestamp: new Date(),
      };

      await redis.publish('analytics:updates', JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to broadcast metric update', { event, error });
    }
  }

  private calculateEngagementScore(
    opens: number,
    clicks: number,
    unsubscribes: number
  ): number {
    // Simple engagement scoring algorithm
    const openScore = opens * 1;
    const clickScore = clicks * 3;
    const unsubscribeScore = unsubscribes * -5;

    return Math.max(0, openScore + clickScore + unsubscribeScore);
  }

  private getDefaultEngagementMetrics(): EngagementMetrics {
    return {
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
      lastEngagement: new Date(),
    };
  }
}
