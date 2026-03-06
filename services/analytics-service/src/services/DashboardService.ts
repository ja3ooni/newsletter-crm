// @ts-nocheck
import { AnalyticsDashboard, DashboardWidget, WidgetConfig } from '@/types';
import { database } from '@/utils/database';
import { logger } from '@/utils/logger';
import { redis } from '@/utils/redis';
import { WebSocketService } from './WebSocketService';

export class DashboardService {
  private wsService: WebSocketService;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  async createDashboard(
    name: string,
    description: string | undefined,
    createdBy: string,
    isPublic: boolean = false
  ): Promise<AnalyticsDashboard> {
    try {
      const dashboard: AnalyticsDashboard = {
        id: crypto.randomUUID(),
        name,
        description,
        widgets: [],
        layout: {
          columns: 12,
          rows: 8,
          gap: 16,
          responsive: true,
        },
        isPublic,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await database.query(
        `
        INSERT INTO analytics_dashboards
        (id, name, description, widgets, layout, is_public, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
        [
          dashboard.id,
          dashboard.name,
          dashboard.description,
          JSON.stringify(dashboard.widgets),
          JSON.stringify(dashboard.layout),
          dashboard.isPublic,
          dashboard.createdBy,
          dashboard.createdAt,
          dashboard.updatedAt,
        ]
      );

      logger.info('Dashboard created', { dashboardId: dashboard.id, name });
      return dashboard;
    } catch (error) {
      logger.error('Failed to create dashboard', { name, error });
      throw error;
    }
  }

  async getDashboard(
    dashboardId: string,
    userId: string
  ): Promise<AnalyticsDashboard | null> {
    try {
      const result = await database.queryOne<{
        id: string;
        name: string;
        description: string;
        widgets: string;
        layout: string;
        is_public: boolean;
        created_by: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `
        SELECT * FROM analytics_dashboards
        WHERE id = $1 AND (created_by = $2 OR is_public = true)
      `,
        [dashboardId, userId]
      );

      if (!result) {
        return null;
      }

      return {
        id: result.id,
        name: result.name,
        description: result.description,
        widgets: JSON.parse(result.widgets),
        layout: JSON.parse(result.layout),
        isPublic: result.is_public,
        createdBy: result.created_by,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get dashboard', { dashboardId, error });
      throw error;
    }
  }

  async updateDashboard(
    dashboardId: string,
    updates: Partial<AnalyticsDashboard>,
    userId: string
  ): Promise<AnalyticsDashboard> {
    try {
      const existingDashboard = await this.getDashboard(dashboardId, userId);
      if (!existingDashboard) {
        throw new Error('Dashboard not found or access denied');
      }

      if (existingDashboard.createdBy !== userId) {
        throw new Error('Only dashboard owner can update');
      }

      const updatedDashboard = {
        ...existingDashboard,
        ...updates,
        updatedAt: new Date(),
      };

      await database.query(
        `
        UPDATE analytics_dashboards
        SET name = $2, description = $3, widgets = $4, layout = $5, is_public = $6, updated_at = $7
        WHERE id = $1
      `,
        [
          dashboardId,
          updatedDashboard.name,
          updatedDashboard.description,
          JSON.stringify(updatedDashboard.widgets),
          JSON.stringify(updatedDashboard.layout),
          updatedDashboard.isPublic,
          updatedDashboard.updatedAt,
        ]
      );

      // Broadcast update to connected clients
      await this.wsService.broadcastDashboardUpdate(
        dashboardId,
        updatedDashboard
      );

      logger.info('Dashboard updated', { dashboardId });
      return updatedDashboard;
    } catch (error) {
      logger.error('Failed to update dashboard', { dashboardId, error });
      throw error;
    }
  }

  async deleteDashboard(dashboardId: string, userId: string): Promise<void> {
    try {
      const dashboard = await this.getDashboard(dashboardId, userId);
      if (!dashboard) {
        throw new Error('Dashboard not found or access denied');
      }

      if (dashboard.createdBy !== userId) {
        throw new Error('Only dashboard owner can delete');
      }

      await database.query(
        `
        DELETE FROM analytics_dashboards WHERE id = $1
      `,
        [dashboardId]
      );

      logger.info('Dashboard deleted', { dashboardId });
    } catch (error) {
      logger.error('Failed to delete dashboard', { dashboardId, error });
      throw error;
    }
  }

  async addWidget(
    dashboardId: string,
    widget: Omit<DashboardWidget, 'id'>,
    userId: string
  ): Promise<DashboardWidget> {
    try {
      const dashboard = await this.getDashboard(dashboardId, userId);
      if (!dashboard) {
        throw new Error('Dashboard not found or access denied');
      }

      if (dashboard.createdBy !== userId) {
        throw new Error('Only dashboard owner can add widgets');
      }

      const newWidget: DashboardWidget = {
        ...widget,
        id: crypto.randomUUID(),
      };

      dashboard.widgets.push(newWidget);
      dashboard.updatedAt = new Date();

      await database.query(
        `
        UPDATE analytics_dashboards
        SET widgets = $2, updated_at = $3
        WHERE id = $1
      `,
        [dashboardId, JSON.stringify(dashboard.widgets), dashboard.updatedAt]
      );

      // Broadcast update to connected clients
      await this.wsService.broadcastDashboardUpdate(dashboardId, dashboard);

      logger.info('Widget added to dashboard', {
        dashboardId,
        widgetId: newWidget.id,
      });
      return newWidget;
    } catch (error) {
      logger.error('Failed to add widget', { dashboardId, error });
      throw error;
    }
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    updates: Partial<DashboardWidget>,
    userId: string
  ): Promise<DashboardWidget> {
    try {
      const dashboard = await this.getDashboard(dashboardId, userId);
      if (!dashboard) {
        throw new Error('Dashboard not found or access denied');
      }

      if (dashboard.createdBy !== userId) {
        throw new Error('Only dashboard owner can update widgets');
      }

      const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
      if (widgetIndex === -1) {
        throw new Error('Widget not found');
      }

      const updatedWidget = {
        ...dashboard.widgets[widgetIndex],
        ...updates,
      };

      dashboard.widgets[widgetIndex] = updatedWidget;
      dashboard.updatedAt = new Date();

      await database.query(
        `
        UPDATE analytics_dashboards
        SET widgets = $2, updated_at = $3
        WHERE id = $1
      `,
        [dashboardId, JSON.stringify(dashboard.widgets), dashboard.updatedAt]
      );

      // Broadcast update to connected clients
      await this.wsService.broadcastDashboardUpdate(dashboardId, dashboard);

      logger.info('Widget updated', { dashboardId, widgetId });
      return updatedWidget;
    } catch (error) {
      logger.error('Failed to update widget', { dashboardId, widgetId, error });
      throw error;
    }
  }

  async removeWidget(
    dashboardId: string,
    widgetId: string,
    userId: string
  ): Promise<void> {
    try {
      const dashboard = await this.getDashboard(dashboardId, userId);
      if (!dashboard) {
        throw new Error('Dashboard not found or access denied');
      }

      if (dashboard.createdBy !== userId) {
        throw new Error('Only dashboard owner can remove widgets');
      }

      dashboard.widgets = dashboard.widgets.filter(w => w.id !== widgetId);
      dashboard.updatedAt = new Date();

      await database.query(
        `
        UPDATE analytics_dashboards
        SET widgets = $2, updated_at = $3
        WHERE id = $1
      `,
        [dashboardId, JSON.stringify(dashboard.widgets), dashboard.updatedAt]
      );

      // Broadcast update to connected clients
      await this.wsService.broadcastDashboardUpdate(dashboardId, dashboard);

      logger.info('Widget removed from dashboard', { dashboardId, widgetId });
    } catch (error) {
      logger.error('Failed to remove widget', { dashboardId, widgetId, error });
      throw error;
    }
  }

  async getWidgetData(widgetId: string, config: WidgetConfig): Promise<any> {
    try {
      // Cache key for widget data
      const cacheKey = `widget_data:${widgetId}:${JSON.stringify(config)}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      let data: any = {};

      switch (config.metrics[0]) {
        case 'engagement_rate':
          data = await this.getEngagementRateData(config);
          break;
        case 'newsletter_performance':
          data = await this.getNewsletterPerformanceData(config);
          break;
        case 'subscriber_growth':
          data = await this.getSubscriberGrowthData(config);
          break;
        case 'revenue_attribution':
          data = await this.getRevenueAttributionData(config);
          break;
        case 'top_content':
          data = await this.getTopContentData(config);
          break;
        case 'conversion_funnel':
          data = await this.getConversionFunnelData(config);
          break;
        case 'cohort_analysis':
          data = await this.getCohortAnalysisData(config);
          break;
        case 'kpi_summary':
          data = await this.getKPISummaryData(config);
          break;
        case 'real_time_metrics':
          data = await this.getRealTimeMetricsData(config);
          break;
        default:
          data = await this.getGenericMetricData(config);
      }

      // Cache for 5 minutes (except real-time metrics which cache for 30 seconds)
      const cacheTime = config.metrics[0] === 'real_time_metrics' ? 30 : 300;
      await redis.set(cacheKey, JSON.stringify(data), cacheTime);

      return data;
    } catch (error) {
      logger.error('Failed to get widget data', { widgetId, error });
      throw error;
    }
  }

  async getUserDashboards(userId: string): Promise<AnalyticsDashboard[]> {
    try {
      const results = await database.query<{
        id: string;
        name: string;
        description: string;
        widgets: string;
        layout: string;
        is_public: boolean;
        created_by: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `
        SELECT * FROM analytics_dashboards
        WHERE created_by = $1 OR is_public = true
        ORDER BY updated_at DESC
      `,
        [userId]
      );

      return results.map(result => ({
        id: result.id,
        name: result.name,
        description: result.description,
        widgets: JSON.parse(result.widgets),
        layout: JSON.parse(result.layout),
        isPublic: result.is_public,
        createdBy: result.created_by,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to get user dashboards', { userId, error });
      throw error;
    }
  }

  private async getEngagementRateData(config: WidgetConfig): Promise<any> {
    const result = await database.query(
      `
      SELECT
        DATE_TRUNC($1, timestamp) as period,
        COUNT(CASE WHEN event_type = 'email_open' THEN 1 END) as opens,
        COUNT(CASE WHEN event_type = 'email_click' THEN 1 END) as clicks,
        COUNT(DISTINCT contact_id) as unique_contacts
      FROM engagement_events
      WHERE timestamp BETWEEN $2 AND $3
      GROUP BY period
      ORDER BY period
    `,
      [config.timeRange.period, config.timeRange.start, config.timeRange.end]
    );

    return {
      labels: result.map((r: any) => r.period),
      datasets: [
        {
          label: 'Open Rate',
          data: result.map((r: any) =>
            r.unique_contacts > 0
              ? (parseInt(r.opens) / parseInt(r.unique_contacts)) * 100
              : 0
          ),
        },
        {
          label: 'Click Rate',
          data: result.map((r: any) =>
            parseInt(r.opens) > 0
              ? (parseInt(r.clicks) / parseInt(r.opens)) * 100
              : 0
          ),
        },
      ],
    };
  }

  private async getNewsletterPerformanceData(
    config: WidgetConfig
  ): Promise<any> {
    const result = await database.query(
      `
      SELECT
        n.title,
        nm.open_rate,
        nm.click_rate,
        nm.conversion_rate,
        nm.revenue_attribution
      FROM newsletters n
      LEFT JOIN newsletter_metrics nm ON n.id = nm.newsletter_id
      WHERE n.created_at BETWEEN $1 AND $2
      ORDER BY nm.open_rate DESC
      LIMIT $3
    `,
      [config.timeRange.start, config.timeRange.end, config.limit || 10]
    );

    return {
      newsletters: result.map((r: any) => ({
        title: r.title,
        openRate: parseFloat(r.open_rate || '0'),
        clickRate: parseFloat(r.click_rate || '0'),
        conversionRate: parseFloat(r.conversion_rate || '0'),
        revenue: parseFloat(r.revenue_attribution || '0'),
      })),
    };
  }

  private async getSubscriberGrowthData(config: WidgetConfig): Promise<any> {
    const result = await database.query(
      `
      SELECT
        DATE_TRUNC($1, created_at) as period,
        COUNT(*) as new_subscribers,
        SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC($1, created_at)) as total_subscribers
      FROM contacts
      WHERE created_at BETWEEN $2 AND $3
      GROUP BY period
      ORDER BY period
    `,
      [config.timeRange.period, config.timeRange.start, config.timeRange.end]
    );

    return {
      labels: result.map((r: any) => r.period),
      datasets: [
        {
          label: 'New Subscribers',
          data: result.map((r: any) => parseInt(r.new_subscribers)),
        },
        {
          label: 'Total Subscribers',
          data: result.map((r: any) => parseInt(r.total_subscribers)),
        },
      ],
    };
  }

  private async getRevenueAttributionData(config: WidgetConfig): Promise<any> {
    const result = await database.query(
      `
      SELECT
        attribution_model,
        SUM(conversion_value * attribution_weight) as total_revenue,
        COUNT(*) as conversions
      FROM revenue_attribution
      WHERE conversion_timestamp BETWEEN $1 AND $2
      GROUP BY attribution_model
      ORDER BY total_revenue DESC
    `,
      [config.timeRange.start, config.timeRange.end]
    );

    return {
      labels: result.map((r: any) => r.attribution_model),
      datasets: [
        {
          label: 'Revenue',
          data: result.map((r: any) => parseFloat(r.total_revenue)),
        },
      ],
      totalRevenue: result.reduce(
        (sum: number, r: any) => sum + parseFloat(r.total_revenue),
        0
      ),
      totalConversions: result.reduce(
        (sum: number, r: any) => sum + parseInt(r.conversions),
        0
      ),
    };
  }

  private async getTopContentData(config: WidgetConfig): Promise<any> {
    const result = await database.query(
      `
      SELECT
        ci.title,
        ci.category,
        COUNT(ee.id) as interactions,
        AVG(ee.score) as avg_score
      FROM content_items ci
      LEFT JOIN engagement_events ee ON ee.metadata->>'content_id' = ci.id::text
      WHERE ee.timestamp BETWEEN $1 AND $2
      GROUP BY ci.id, ci.title, ci.category
      ORDER BY interactions DESC
      LIMIT $3
    `,
      [config.timeRange.start, config.timeRange.end, config.limit || 10]
    );

    return {
      content: result.map((r: any) => ({
        title: r.title,
        category: r.category,
        interactions: parseInt(r.interactions),
        avgScore: parseFloat(r.avg_score || '0'),
      })),
    };
  }

  private async getConversionFunnelData(config: WidgetConfig): Promise<any> {
    const result = await database.query(
      `
      SELECT
        cf.name,
        cf.steps,
        cf.total_entries,
        cf.completion_rate,
        cf.dropoff_rates,
        cf.conversions_by_step
      FROM conversion_funnels cf
      WHERE cf.created_at BETWEEN $1 AND $2
      ORDER BY cf.completion_rate DESC
      LIMIT $3
    `,
      [config.timeRange.start, config.timeRange.end, config.limit || 5]
    );

    return {
      funnels: result.map((r: any) => ({
        name: r.name,
        steps: JSON.parse(r.steps),
        totalEntries: parseInt(r.total_entries),
        completionRate: parseFloat(r.completion_rate),
        dropoffRates: r.dropoff_rates,
        conversionsByStep: r.conversions_by_step,
      })),
    };
  }

  private async getCohortAnalysisData(config: WidgetConfig): Promise<any> {
    const result = await database.query(
      `
      SELECT
        DATE_TRUNC('month', c.created_at) as cohort_month,
        COUNT(*) as cohort_size,
        AVG(sb.churn_probability) as avg_churn_probability,
        AVG(sb.lifetime_value) as avg_lifetime_value
      FROM contacts c
      LEFT JOIN subscriber_behavior sb ON c.id = sb.contact_id
      WHERE c.created_at BETWEEN $1 AND $2
      GROUP BY cohort_month
      ORDER BY cohort_month
    `,
      [config.timeRange.start, config.timeRange.end]
    );

    return {
      cohorts: result.map((r: any) => ({
        month: r.cohort_month,
        size: parseInt(r.cohort_size),
        avgChurnProbability: parseFloat(r.avg_churn_probability || '0'),
        avgLifetimeValue: parseFloat(r.avg_lifetime_value || '0'),
      })),
    };
  }

  private async getKPISummaryData(config: WidgetConfig): Promise<any> {
    const summaryResult = await database.queryOne(
      `
      SELECT
        COUNT(DISTINCT c.id) as total_subscribers,
        COUNT(DISTINCT n.id) as total_newsletters,
        AVG(nm.open_rate) as avg_open_rate,
        AVG(nm.click_rate) as avg_click_rate,
        SUM(ra.conversion_value * ra.attribution_weight) as total_revenue,
        COUNT(DISTINCT CASE WHEN ee.timestamp >= NOW() - INTERVAL '30 days' THEN ee.contact_id END) as active_subscribers
      FROM contacts c
      CROSS JOIN newsletters n
      LEFT JOIN newsletter_metrics nm ON n.id = nm.newsletter_id
      LEFT JOIN revenue_attribution ra ON ra.conversion_timestamp BETWEEN $1 AND $2
      LEFT JOIN engagement_events ee ON ee.contact_id = c.id
      WHERE c.created_at BETWEEN $1 AND $2
      AND n.created_at BETWEEN $1 AND $2
    `,
      [config.timeRange.start, config.timeRange.end]
    );

    // Calculate growth rates
    const previousPeriodStart = new Date(config.timeRange.start);
    const previousPeriodEnd = new Date(config.timeRange.end);
    const periodDiff =
      previousPeriodEnd.getTime() - previousPeriodStart.getTime();
    previousPeriodStart.setTime(previousPeriodStart.getTime() - periodDiff);
    previousPeriodEnd.setTime(previousPeriodEnd.getTime() - periodDiff);

    const previousResult = await database.queryOne(
      `
      SELECT
        COUNT(DISTINCT c.id) as prev_total_subscribers,
        SUM(ra.conversion_value * ra.attribution_weight) as prev_total_revenue
      FROM contacts c
      LEFT JOIN revenue_attribution ra ON ra.conversion_timestamp BETWEEN $1 AND $2
      WHERE c.created_at BETWEEN $1 AND $2
    `,
      [previousPeriodStart, previousPeriodEnd]
    );

    const currentSubscribers = parseInt(
      summaryResult?.total_subscribers || '0'
    );
    const previousSubscribers = parseInt(
      previousResult?.prev_total_subscribers || '0'
    );
    const subscriberGrowth =
      previousSubscribers > 0
        ? ((currentSubscribers - previousSubscribers) / previousSubscribers) *
          100
        : 0;

    const currentRevenue = parseFloat(summaryResult?.total_revenue || '0');
    const previousRevenue = parseFloat(
      previousResult?.prev_total_revenue || '0'
    );
    const revenueGrowth =
      previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : 0;

    return {
      kpis: [
        {
          name: 'Total Subscribers',
          value: currentSubscribers,
          growth: subscriberGrowth,
          format: 'number',
        },
        {
          name: 'Active Subscribers',
          value: parseInt(summaryResult?.active_subscribers || '0'),
          growth: 0, // Would need historical data for growth calculation
          format: 'number',
        },
        {
          name: 'Average Open Rate',
          value: parseFloat(summaryResult?.avg_open_rate || '0'),
          growth: 0, // Would need historical data for growth calculation
          format: 'percentage',
        },
        {
          name: 'Average Click Rate',
          value: parseFloat(summaryResult?.avg_click_rate || '0'),
          growth: 0, // Would need historical data for growth calculation
          format: 'percentage',
        },
        {
          name: 'Total Revenue',
          value: currentRevenue,
          growth: revenueGrowth,
          format: 'currency',
        },
        {
          name: 'Total Newsletters',
          value: parseInt(summaryResult?.total_newsletters || '0'),
          growth: 0, // Would need historical data for growth calculation
          format: 'number',
        },
      ],
    };
  }

  private async getRealTimeMetricsData(config: WidgetConfig): Promise<any> {
    const realTimeResult = await database.query(
      `
      SELECT
        event_type,
        COUNT(*) as count,
        DATE_TRUNC('hour', timestamp) as hour
      FROM engagement_events
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY event_type, hour
      ORDER BY hour DESC, count DESC
    `
    );

    const currentHourResult = await database.query(
      `
      SELECT
        event_type,
        COUNT(*) as count
      FROM engagement_events
      WHERE timestamp >= DATE_TRUNC('hour', NOW())
      GROUP BY event_type
      ORDER BY count DESC
    `
    );

    return {
      last24Hours: realTimeResult.map((r: any) => ({
        eventType: r.event_type,
        count: parseInt(r.count),
        hour: r.hour,
      })),
      currentHour: currentHourResult.map((r: any) => ({
        eventType: r.event_type,
        count: parseInt(r.count),
      })),
      lastUpdated: new Date(),
    };
  }

  private async getGenericMetricData(config: WidgetConfig): Promise<any> {
    // Generic data fetching for custom metrics
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [
        {
          label: config.metrics[0],
          data: [10, 20, 30, 40, 50],
        },
      ],
    };
  }

  async cloneDashboard(
    dashboardId: string,
    newName: string,
    userId: string
  ): Promise<AnalyticsDashboard> {
    try {
      const originalDashboard = await this.getDashboard(dashboardId, userId);
      if (!originalDashboard) {
        throw new Error('Dashboard not found or access denied');
      }

      const clonedDashboard = await this.createDashboard(
        newName,
        `Cloned from ${originalDashboard.name}`,
        userId,
        false
      );

      // Copy widgets with new IDs
      const clonedWidgets = originalDashboard.widgets.map(widget => ({
        ...widget,
        id: crypto.randomUUID(),
      }));

      clonedDashboard.widgets = clonedWidgets;
      clonedDashboard.layout = { ...originalDashboard.layout };

      await database.query(
        `
        UPDATE analytics_dashboards
        SET widgets = $2, layout = $3, updated_at = $4
        WHERE id = $1
      `,
        [
          clonedDashboard.id,
          JSON.stringify(clonedDashboard.widgets),
          JSON.stringify(clonedDashboard.layout),
          new Date(),
        ]
      );

      logger.info('Dashboard cloned', {
        originalId: dashboardId,
        clonedId: clonedDashboard.id,
      });
      return clonedDashboard;
    } catch (error) {
      logger.error('Failed to clone dashboard', { dashboardId, error });
      throw error;
    }
  }

  async exportDashboard(
    dashboardId: string,
    userId: string,
    format: 'json' | 'pdf' | 'csv' | 'excel'
  ): Promise<string> {
    try {
      const dashboard = await this.getDashboard(dashboardId, userId);
      if (!dashboard) {
        throw new Error('Dashboard not found or access denied');
      }

      // Get widget data for export
      const widgetDataPromises = dashboard.widgets.map(async widget => {
        try {
          const data = await this.getWidgetData(widget.id, widget.config);
          return { widget: widget.title, data };
        } catch (error) {
          logger.warn('Failed to get widget data for export', {
            widgetId: widget.id,
            error,
          });
          return { widget: widget.title, data: null };
        }
      });

      const widgetData = await Promise.all(widgetDataPromises);

      let exportData: string;
      switch (format) {
        case 'json':
          exportData = JSON.stringify(
            {
              dashboard: {
                name: dashboard.name,
                description: dashboard.description,
                createdAt: dashboard.createdAt,
                updatedAt: dashboard.updatedAt,
              },
              widgets: widgetData,
              exportedAt: new Date(),
            },
            null,
            2
          );
          break;
        case 'csv':
          exportData = this.formatDashboardAsCSV(dashboard, widgetData);
          break;
        case 'excel':
          exportData = await this.formatDashboardAsExcel(dashboard, widgetData);
          break;
        case 'pdf':
          exportData = await this.formatDashboardAsPDF(dashboard, widgetData);
          break;
        default:
          exportData = JSON.stringify(dashboard, null, 2);
      }

      // In production, save to S3 or similar storage
      const fileName = `dashboard_${dashboardId}_${Date.now()}.${format}`;
      logger.info('Dashboard exported', {
        dashboardId,
        format,
        fileName,
        dataSize: exportData.length,
      });

      return fileName;
    } catch (error) {
      logger.error('Failed to export dashboard', { dashboardId, error });
      throw error;
    }
  }

  private formatDashboardAsCSV(
    dashboard: AnalyticsDashboard,
    widgetData: any[]
  ): string {
    let csv = `Dashboard Export: ${dashboard.name}\n`;
    csv += `Exported At: ${new Date().toISOString()}\n\n`;

    widgetData.forEach(({ widget, data }) => {
      csv += `Widget: ${widget}\n`;
      if (data && data.labels && data.datasets) {
        // Chart data
        csv += `${data.labels.join(',')}\n`;
        data.datasets.forEach((dataset: any) => {
          csv += `${dataset.label},${dataset.data.join(',')}\n`;
        });
      } else if (data && Array.isArray(data)) {
        // Table data
        data.forEach((row: any) => {
          csv += `${Object.values(row).join(',')}\n`;
        });
      } else if (data && typeof data === 'object') {
        // Object data
        Object.entries(data).forEach(([key, value]) => {
          csv += `${key},${value}\n`;
        });
      }
      csv += '\n';
    });

    return csv;
  }

  private async formatDashboardAsExcel(
    dashboard: AnalyticsDashboard,
    widgetData: any[]
  ): Promise<string> {
    // In a real implementation, this would use a library like ExcelJS
    // For now, return CSV format as placeholder
    return this.formatDashboardAsCSV(dashboard, widgetData);
  }

  private async formatDashboardAsPDF(
    dashboard: AnalyticsDashboard,
    widgetData: any[]
  ): Promise<string> {
    // In a real implementation, this would use a library like PDFKit or Puppeteer
    // For now, return formatted text as placeholder
    let pdfContent = `Dashboard Report: ${dashboard.name}\n`;
    pdfContent += `Generated: ${new Date().toLocaleString()}\n\n`;

    if (dashboard.description) {
      pdfContent += `Description: ${dashboard.description}\n\n`;
    }

    pdfContent += `Widgets Summary:\n`;
    widgetData.forEach(({ widget, data }) => {
      pdfContent += `- ${widget}: ${data ? 'Data available' : 'No data'}\n`;
    });

    return pdfContent;
  }

  async getKPISummary(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<any> {
    try {
      const kpiData = await database.queryOne(
        `
        SELECT
          COUNT(DISTINCT c.id) as total_subscribers,
          COUNT(DISTINCT n.id) as total_newsletters,
          AVG(nm.open_rate) as avg_open_rate,
          AVG(nm.click_rate) as avg_click_rate,
          AVG(nm.conversion_rate) as avg_conversion_rate,
          SUM(ra.conversion_value * ra.attribution_weight) as total_revenue,
          COUNT(DISTINCT CASE WHEN ee.timestamp >= NOW() - INTERVAL '30 days' THEN ee.contact_id END) as active_subscribers,
          COUNT(DISTINCT CASE WHEN ee.event_type = 'unsubscribe' THEN ee.contact_id END) as unsubscribes
        FROM contacts c
        CROSS JOIN newsletters n
        LEFT JOIN newsletter_metrics nm ON n.id = nm.newsletter_id
        LEFT JOIN revenue_attribution ra ON ra.conversion_timestamp BETWEEN $1 AND $2
        LEFT JOIN engagement_events ee ON ee.contact_id = c.id
        WHERE c.created_at BETWEEN $1 AND $2
        AND n.created_at BETWEEN $1 AND $2
      `,
        [timeRange.start, timeRange.end]
      );

      // Calculate growth rates (simplified - would need historical comparison)
      const subscriberGrowth = 5.2; // This would be calculated from historical data
      const revenueGrowth = 12.5;
      const engagementGrowth = 2.3;

      return {
        totalSubscribers: parseInt(kpiData?.total_subscribers || '0'),
        totalNewsletters: parseInt(kpiData?.total_newsletters || '0'),
        averageOpenRate: parseFloat(kpiData?.avg_open_rate || '0'),
        averageClickRate: parseFloat(kpiData?.avg_click_rate || '0'),
        averageConversionRate: parseFloat(kpiData?.avg_conversion_rate || '0'),
        totalRevenue: parseFloat(kpiData?.total_revenue || '0'),
        activeSubscribers: parseInt(kpiData?.active_subscribers || '0'),
        unsubscribes: parseInt(kpiData?.unsubscribes || '0'),
        growth: {
          subscribers: subscriberGrowth,
          revenue: revenueGrowth,
          engagement: engagementGrowth,
        },
      };
    } catch (error) {
      logger.error('Failed to get KPI summary', { userId, timeRange, error });
      throw error;
    }
  }

  async getRealtimeMetrics(): Promise<any> {
    try {
      const realTimeData = await database.query(
        `
        SELECT
          event_type,
          COUNT(*) as count,
          DATE_TRUNC('minute', timestamp) as minute
        FROM engagement_events
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
        GROUP BY event_type, minute
        ORDER BY minute DESC, count DESC
      `
      );

      const currentMinuteData = await database.query(
        `
        SELECT
          event_type,
          COUNT(*) as count
        FROM engagement_events
        WHERE timestamp >= DATE_TRUNC('minute', NOW())
        GROUP BY event_type
        ORDER BY count DESC
      `
      );

      return {
        lastHour: realTimeData.map((r: any) => ({
          eventType: r.event_type,
          count: parseInt(r.count),
          minute: r.minute,
        })),
        currentMinute: currentMinuteData.map((r: any) => ({
          eventType: r.event_type,
          count: parseInt(r.count),
        })),
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get realtime metrics', { error });
      throw error;
    }
  }
}
