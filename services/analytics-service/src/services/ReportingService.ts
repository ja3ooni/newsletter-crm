import { config } from '@/config';
import { AnalyticsReport, ReportConfig } from '@/types';
import { database } from '@/utils/database';
import { logger } from '@/utils/logger';

interface ReportData {
  summary: {
    totalSubscribers: number;
    totalNewsletters: number;
    averageOpenRate: number;
    averageClickRate: number;
    totalRevenue: number;
    growthRate: number;
  };
  charts: Array<{
    title: string;
    type: 'line' | 'bar' | 'pie';
    data: any;
  }>;
  tables: Array<{
    title: string;
    headers: string[];
    rows: any[][];
  }>;
  insights: string[];
}

export class ReportingService {
  async createReport(
    name: string,
    description: string | undefined,
    type: 'scheduled' | 'on_demand',
    format: 'pdf' | 'csv' | 'excel' | 'json',
    reportConfig: ReportConfig,
    recipients: string[],
    createdBy: string,
    schedule?: any
  ): Promise<AnalyticsReport> {
    try {
      const report: AnalyticsReport = {
        id: crypto.randomUUID(),
        name,
        description,
        type,
        format,
        schedule,
        recipients,
        config: reportConfig,
        status: 'active',
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (type === 'scheduled' && schedule) {
        report.nextScheduled = this.calculateNextScheduledTime(schedule);
      }

      await database.query(
        `
        INSERT INTO analytics_reports
        (id, name, description, type, format, schedule, recipients, config, status, created_by, created_at, updated_at, next_scheduled)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
        [
          report.id,
          report.name,
          report.description,
          report.type,
          report.format,
          JSON.stringify(report.schedule),
          report.recipients,
          JSON.stringify(report.config),
          report.status,
          report.createdBy,
          report.createdAt,
          report.updatedAt,
          report.nextScheduled,
        ]
      );

      logger.info('Report created', { reportId: report.id, name });
      return report;
    } catch (error) {
      logger.error('Failed to create report', { name, error });
      throw error;
    }
  }

  async generateReport(reportId: string): Promise<string> {
    try {
      const report = await this.getReport(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Generate report data
      const reportData = await this.generateReportData(report.config);

      // Format report based on format type
      let formattedReport: string;
      switch (report.format) {
        case 'json':
          formattedReport = JSON.stringify(reportData, null, 2);
          break;
        case 'csv':
          formattedReport = this.formatAsCSV(reportData);
          break;
        case 'excel':
          formattedReport = await this.formatAsExcel(reportData);
          break;
        case 'pdf':
          formattedReport = await this.formatAsPDF(reportData);
          break;
        default:
          formattedReport = JSON.stringify(reportData, null, 2);
      }

      // Update last generated timestamp
      await database.query(
        `
        UPDATE analytics_reports
        SET last_generated = $2, next_scheduled = $3
        WHERE id = $1
      `,
        [
          reportId,
          new Date(),
          report.type === 'scheduled' && report.schedule
            ? this.calculateNextScheduledTime(report.schedule)
            : null,
        ]
      );

      // Save report file (in production, this would save to S3 or similar)
      const fileName = `report_${reportId}_${Date.now()}.${report.format}`;
      const filePath = `${config.reports.outputDir}/${fileName}`;

      // In a real implementation, you would save the file
      logger.info('Report generated', {
        reportId,
        fileName,
        size: formattedReport.length,
      });

      return filePath;
    } catch (error) {
      logger.error('Failed to generate report', { reportId, error });
      throw error;
    }
  }

  async getReport(reportId: string): Promise<AnalyticsReport | null> {
    try {
      const result = await database.queryOne<{
        id: string;
        name: string;
        description: string;
        type: string;
        format: string;
        schedule: string;
        recipients: string[];
        config: string;
        last_generated: Date;
        next_scheduled: Date;
        status: string;
        created_by: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `
        SELECT * FROM analytics_reports WHERE id = $1
      `,
        [reportId]
      );

      if (!result) {
        return null;
      }

      return {
        id: result.id,
        name: result.name,
        description: result.description,
        type: result.type as 'scheduled' | 'on_demand',
        format: result.format as 'pdf' | 'csv' | 'excel' | 'json',
        schedule: result.schedule ? JSON.parse(result.schedule) : undefined,
        recipients: result.recipients,
        config: JSON.parse(result.config),
        lastGenerated: result.last_generated,
        nextScheduled: result.next_scheduled,
        status: result.status as 'active' | 'paused' | 'error',
        createdBy: result.created_by,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get report', { reportId, error });
      throw error;
    }
  }

  async getUserReports(userId: string): Promise<AnalyticsReport[]> {
    try {
      const results = await database.query<{
        id: string;
        name: string;
        description: string;
        type: string;
        format: string;
        schedule: string;
        recipients: string[];
        config: string;
        last_generated: Date;
        next_scheduled: Date;
        status: string;
        created_by: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `
        SELECT * FROM analytics_reports
        WHERE created_by = $1
        ORDER BY updated_at DESC
      `,
        [userId]
      );

      return results.map(result => ({
        id: result.id,
        name: result.name,
        description: result.description,
        type: result.type as 'scheduled' | 'on_demand',
        format: result.format as 'pdf' | 'csv' | 'excel' | 'json',
        schedule: result.schedule ? JSON.parse(result.schedule) : undefined,
        recipients: result.recipients,
        config: JSON.parse(result.config),
        lastGenerated: result.last_generated,
        nextScheduled: result.next_scheduled,
        status: result.status as 'active' | 'paused' | 'error',
        createdBy: result.created_by,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to get user reports', { userId, error });
      throw error;
    }
  }

  async updateReport(
    reportId: string,
    updates: Partial<AnalyticsReport>,
    userId: string
  ): Promise<AnalyticsReport> {
    try {
      const existingReport = await this.getReport(reportId);
      if (!existingReport) {
        throw new Error('Report not found');
      }

      if (existingReport.createdBy !== userId) {
        throw new Error('Only report owner can update');
      }

      const updatedReport = {
        ...existingReport,
        ...updates,
        updatedAt: new Date(),
      };

      if (updatedReport.type === 'scheduled' && updatedReport.schedule) {
        updatedReport.nextScheduled = this.calculateNextScheduledTime(
          updatedReport.schedule
        );
      }

      await database.query(
        `
        UPDATE analytics_reports
        SET name = $2, description = $3, type = $4, format = $5, schedule = $6,
            recipients = $7, config = $8, status = $9, updated_at = $10, next_scheduled = $11
        WHERE id = $1
      `,
        [
          reportId,
          updatedReport.name,
          updatedReport.description,
          updatedReport.type,
          updatedReport.format,
          JSON.stringify(updatedReport.schedule),
          updatedReport.recipients,
          JSON.stringify(updatedReport.config),
          updatedReport.status,
          updatedReport.updatedAt,
          updatedReport.nextScheduled,
        ]
      );

      logger.info('Report updated', { reportId });
      return updatedReport;
    } catch (error) {
      logger.error('Failed to update report', { reportId, error });
      throw error;
    }
  }

  async deleteReport(reportId: string, userId: string): Promise<void> {
    try {
      const report = await this.getReport(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      if (report.createdBy !== userId) {
        throw new Error('Only report owner can delete');
      }

      await database.query(
        `
        DELETE FROM analytics_reports WHERE id = $1
      `,
        [reportId]
      );

      logger.info('Report deleted', { reportId });
    } catch (error) {
      logger.error('Failed to delete report', { reportId, error });
      throw error;
    }
  }

  async getScheduledReports(): Promise<AnalyticsReport[]> {
    try {
      const results = await database.query<{
        id: string;
        name: string;
        description: string;
        type: string;
        format: string;
        schedule: string;
        recipients: string[];
        config: string;
        last_generated: Date;
        next_scheduled: Date;
        status: string;
        created_by: string;
        created_at: Date;
        updated_at: Date;
      }>(`
        SELECT * FROM analytics_reports
        WHERE type = 'scheduled'
        AND status = 'active'
        AND next_scheduled <= NOW()
        ORDER BY next_scheduled
      `);

      return results.map(result => ({
        id: result.id,
        name: result.name,
        description: result.description,
        type: result.type as 'scheduled' | 'on_demand',
        format: result.format as 'pdf' | 'csv' | 'excel' | 'json',
        schedule: result.schedule ? JSON.parse(result.schedule) : undefined,
        recipients: result.recipients,
        config: JSON.parse(result.config),
        lastGenerated: result.last_generated,
        nextScheduled: result.next_scheduled,
        status: result.status as 'active' | 'paused' | 'error',
        createdBy: result.created_by,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to get scheduled reports', { error });
      throw error;
    }
  }

  private async generateReportData(config: ReportConfig): Promise<ReportData> {
    const reportData: ReportData = {
      summary: await this.generateSummaryData(config),
      charts: [],
      tables: [],
      insights: [],
    };

    // Generate charts if requested
    if (config.includeCharts) {
      reportData.charts = await this.generateChartData(config);
    }

    // Generate tables if requested
    if (config.includeTables) {
      reportData.tables = await this.generateTableData(config);
    }

    // Generate executive summary if requested
    if (config.includeExecutiveSummary) {
      reportData.insights = await this.generateInsights(
        config,
        reportData.summary
      );
    }

    return reportData;
  }

  private async generateSummaryData(config: ReportConfig): Promise<any> {
    const summaryData = await database.queryOne(
      `
      SELECT
        COUNT(DISTINCT c.id) as total_subscribers,
        COUNT(DISTINCT n.id) as total_newsletters,
        AVG(nm.open_rate) as avg_open_rate,
        AVG(nm.click_rate) as avg_click_rate,
        SUM(ra.conversion_value * ra.attribution_weight) as total_revenue
      FROM contacts c
      CROSS JOIN newsletters n
      LEFT JOIN newsletter_metrics nm ON n.id = nm.newsletter_id
      LEFT JOIN revenue_attribution ra ON ra.conversion_timestamp BETWEEN $1 AND $2
      WHERE c.created_at BETWEEN $1 AND $2
      AND n.created_at BETWEEN $1 AND $2
    `,
      [config.timeRange.start, config.timeRange.end]
    );

    return {
      totalSubscribers: parseInt(summaryData?.total_subscribers || '0'),
      totalNewsletters: parseInt(summaryData?.total_newsletters || '0'),
      averageOpenRate: parseFloat(summaryData?.avg_open_rate || '0'),
      averageClickRate: parseFloat(summaryData?.avg_click_rate || '0'),
      totalRevenue: parseFloat(summaryData?.total_revenue || '0'),
      growthRate: 5.2, // This would be calculated from historical data
    };
  }

  private async generateChartData(config: ReportConfig): Promise<any[]> {
    const charts = [];

    // Engagement trends chart
    const engagementData = await database.query(
      `
      SELECT
        DATE_TRUNC($1, timestamp) as period,
        COUNT(CASE WHEN event_type = 'email_open' THEN 1 END) as opens,
        COUNT(CASE WHEN event_type = 'email_click' THEN 1 END) as clicks
      FROM engagement_events
      WHERE timestamp BETWEEN $2 AND $3
      GROUP BY period
      ORDER BY period
    `,
      [config.timeRange.period, config.timeRange.start, config.timeRange.end]
    );

    charts.push({
      title: 'Engagement Trends',
      type: 'line',
      data: {
        labels: engagementData.map((d: any) => d.period),
        datasets: [
          {
            label: 'Opens',
            data: engagementData.map((d: any) => parseInt(d.opens)),
          },
          {
            label: 'Clicks',
            data: engagementData.map((d: any) => parseInt(d.clicks)),
          },
        ],
      },
    });

    return charts;
  }

  private async generateTableData(config: ReportConfig): Promise<any[]> {
    const tables = [];

    // Top performing newsletters table
    const topNewsletters = await database.query(
      `
      SELECT
        n.title,
        nm.open_rate,
        nm.click_rate,
        nm.conversion_rate
      FROM newsletters n
      LEFT JOIN newsletter_metrics nm ON n.id = nm.newsletter_id
      WHERE n.created_at BETWEEN $1 AND $2
      ORDER BY nm.open_rate DESC
      LIMIT 10
    `,
      [config.timeRange.start, config.timeRange.end]
    );

    tables.push({
      title: 'Top Performing Newsletters',
      headers: ['Newsletter', 'Open Rate', 'Click Rate', 'Conversion Rate'],
      rows: topNewsletters.map((n: any) => [
        n.title,
        `${parseFloat(n.open_rate || '0').toFixed(2)}%`,
        `${parseFloat(n.click_rate || '0').toFixed(2)}%`,
        `${parseFloat(n.conversion_rate || '0').toFixed(2)}%`,
      ]),
    });

    return tables;
  }

  private async generateInsights(
    config: ReportConfig,
    summary: any
  ): Promise<string[]> {
    const insights = [];

    // Performance insights
    if (summary.averageOpenRate > 25) {
      insights.push(
        '📈 Excellent performance: Your open rates are performing above industry average (25%)'
      );
    } else if (summary.averageOpenRate > 20) {
      insights.push(
        '📊 Good performance: Your open rates are solid but have room for improvement'
      );
    } else {
      insights.push('⚠️ Action needed: Consider optimizing subject lines to improve open rates');
    }

    if (summary.averageClickRate > 3) {
      insights.push(
        '🎯 Strong engagement: Your click rates indicate excellent content relevance'
      );
    } else if (summary.averageClickRate > 2) {
      insights.push(
        '👍 Moderate engagement: Click rates are decent but could be optimized'
      );
    } else {
      insights.push(
        '🔧 Improvement opportunity: Focus on content relevance to increase click-through rates'
      );
    }

    if (summary.growthRate > 10) {
      insights.push(
        `🚀 Exceptional growth: Subscriber growth is strong at ${summary.growthRate.toFixed(1)}% this period`
      );
    } else if (summary.growthRate > 0) {
      insights.push(
        `📈 Positive trend: Subscriber growth is ${summary.growthRate.toFixed(1)}% this period`
      );
    } else {
      insights.push(
        '📉 Growth concern: Subscriber growth has slowed - consider new acquisition strategies'
      );
    }

    // Revenue insights
    if (summary.totalRevenue > 0) {
      const revenuePerSubscriber = summary.totalRevenue / summary.totalSubscribers;
      if (revenuePerSubscriber > 10) {
        insights.push(
          `💰 High value: Revenue per subscriber is $${revenuePerSubscriber.toFixed(2)}, indicating strong monetization`
        );
      } else {
        insights.push(
          `💡 Monetization opportunity: Revenue per subscriber is $${revenuePerSubscriber.toFixed(2)} - consider upselling strategies`
        );
      }
    }

    // Engagement pattern insights
    const engagementScore = (summary.averageOpenRate * 0.6) + (summary.averageClickRate * 0.4);
    if (engagementScore > 20) {
      insights.push('🌟 Highly engaged audience: Your subscribers are very active');
    } else if (engagementScore > 15) {
      insights.push('👥 Moderately engaged audience: Good foundation for growth');
    } else {
      insights.push('📢 Re-engagement needed: Consider segmentation and personalization strategies');
    }

    // Seasonal or trend insights
    const currentMonth = new Date().getMonth();
    if (currentMonth === 11 || currentMonth === 0) { // December or January
      insights.push('🎄 Seasonal opportunity: Holiday season typically shows higher engagement rates');
    } else if (currentMonth >= 5 && currentMonth <= 7) { // Summer months
      insights.push('☀️ Summer consideration: Engagement may be lower during vacation season');
    }

    return insights;
  }

  private formatAsCSV(data: ReportData): string {
    let csv = 'Analytics Report\n\n';

    // Summary section
    csv += 'Summary\n';
    csv += `Total Subscribers,${data.summary.totalSubscribers}\n`;
    csv += `Total Newsletters,${data.summary.totalNewsletters}\n`;
    csv += `Average Open Rate,${data.summary.averageOpenRate}%\n`;
    csv += `Average Click Rate,${data.summary.averageClickRate}%\n`;
    csv += `Total Revenue,$${data.summary.totalRevenue}\n\n`;

    // Tables section
    data.tables.forEach(table => {
      csv += `${table.title}\n`;
      csv += `${table.headers.join(',')}\n`;
      table.rows.forEach(row => {
        csv += `${row.join(',')}\n`;
      });
      csv += '\n';
    });

    return csv;
  }

  private async formatAsExcel(data: ReportData): Promise<string> {
    // In a real implementation, this would use a library like ExcelJS
    // For now, return CSV format as placeholder
    return this.formatAsCSV(data);
  }

  private async formatAsPDF(data: ReportData): Promise<string> {
    // In a real implementation, this would use a library like PDFKit or Puppeteer
    // For now, return JSON format as placeholder
    return JSON.stringify(data, null, 2);
  }

  async generateExecutiveSummary(
    reportId: string
  ): Promise<{
    summary: string;
    keyMetrics: Array<{ name: string; value: string; trend: string }>;
    recommendations: string[];
  }> {
    try {
      const report = await this.getReport(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      const reportData = await this.generateReportData(report.config);

      // Generate executive summary text
      const summary = `
        During the reporting period from ${report.config.timeRange.start.toLocaleDateString()} to ${report.config.timeRange.end.toLocaleDateString()},
        your newsletter platform achieved ${reportData.summary.totalSubscribers} total subscribers with an average open rate of ${reportData.summary.averageOpenRate.toFixed(1)}%
        and click rate of ${reportData.summary.averageClickRate.toFixed(1)}%.
        Total revenue generated was $${reportData.summary.totalRevenue.toFixed(2)} with a growth rate of ${reportData.summary.growthRate.toFixed(1)}%.

        ${reportData.insights.length > 0 ? 'Key insights include: ' + reportData.insights.slice(0, 3).join(' ') : ''}
      `.trim();

      // Key metrics for executive view
      const keyMetrics = [
        {
          name: 'Total Subscribers',
          value: reportData.summary.totalSubscribers.toLocaleString(),
          trend: reportData.summary.growthRate > 0 ? 'up' : 'down',
        },
        {
          name: 'Open Rate',
          value: `${reportData.summary.averageOpenRate.toFixed(1)}%`,
          trend: reportData.summary.averageOpenRate > 25 ? 'up' : 'stable',
        },
        {
          name: 'Revenue',
          value: `$${reportData.summary.totalRevenue.toFixed(2)}`,
          trend: reportData.summary.totalRevenue > 0 ? 'up' : 'stable',
        },
        {
          name: 'Newsletters Sent',
          value: reportData.summary.totalNewsletters.toString(),
          trend: 'stable',
        },
      ];

      // Strategic recommendations
      const recommendations = [
        ...reportData.insights.slice(0, 5),
        'Consider A/B testing subject lines to improve open rates',
        'Implement segmentation to deliver more personalized content',
        'Monitor subscriber engagement patterns for churn prevention',
      ];

      return {
        summary,
        keyMetrics,
        recommendations,
      };
    } catch (error) {
      logger.error('Failed to generate executive summary', { reportId, error });
      throw error;
    }
  }

  async scheduleReportGeneration(): Promise<void> {
    try {
      const scheduledReports = await this.getScheduledReports();

      for (const report of scheduledReports) {
        try {
          await this.generateReport(report.id);
          logger.info('Scheduled report generated', { reportId: report.id });
        } catch (error) {
          logger.error('Failed to generate scheduled report', {
            reportId: report.id,
            error,
          });

          // Update report status to error
          await database.query(
            `
            UPDATE analytics_reports
            SET status = 'error', updated_at = $2
            WHERE id = $1
          `,
            [report.id, new Date()]
          );
        }
      }
    } catch (error) {
      logger.error('Failed to process scheduled reports', { error });
      throw error;
    }
  }

  async getReportTemplates(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    config: Partial<ReportConfig>;
  }>> {
    return [
      {
        id: 'weekly-performance',
        name: 'Weekly Performance Report',
        description: 'Comprehensive weekly overview of newsletter performance',
        config: {
          metrics: ['engagement_rate', 'subscriber_growth', 'revenue_attribution'],
          timeRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end: new Date(),
            period: 'day' as const,
          },
          includeCharts: true,
          includeTables: true,
          includeExecutiveSummary: true,
        },
      },
      {
        id: 'monthly-executive',
        name: 'Monthly Executive Summary',
        description: 'High-level monthly summary for executives',
        config: {
          metrics: ['kpi_summary', 'revenue_attribution', 'subscriber_growth'],
          timeRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date(),
            period: 'week' as const,
          },
          includeCharts: true,
          includeTables: false,
          includeExecutiveSummary: true,
        },
      },
      {
        id: 'content-performance',
        name: 'Content Performance Analysis',
        description: 'Detailed analysis of content engagement and performance',
        config: {
          metrics: ['top_content', 'engagement_rate', 'newsletter_performance'],
          timeRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date(),
            period: 'week' as const,
          },
          includeCharts: true,
          includeTables: true,
          includeExecutiveSummary: false,
        },
      },
      {
        id: 'subscriber-insights',
        name: 'Subscriber Behavior Insights',
        description: 'Deep dive into subscriber behavior and segmentation',
        config: {
          metrics: ['cohort_analysis', 'conversion_funnel', 'subscriber_growth'],
          timeRange: {
            start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            end: new Date(),
            period: 'week' as const,
          },
          includeCharts: true,
          includeTables: true,
          includeExecutiveSummary: true,
        },
      },
    ];
  }

  private calculateNextScheduledTime(schedule: any): Date {
    const now = new Date();
    const nextRun = new Date(now);

    switch (schedule.frequency) {
      case 'daily':
        nextRun.setDate(now.getDate() + 1);
        break;
      case 'weekly': {
        const daysUntilNext = (schedule.dayOfWeek - now.getDay() + 7) % 7;
        nextRun.setDate(now.getDate() + (daysUntilNext || 7));
        break;
      }
      case 'monthly':
        nextRun.setMonth(now.getMonth() + 1);
        nextRun.setDate(schedule.dayOfMonth || 1);
        break;
      case 'quarterly':
        nextRun.setMonth(now.getMonth() + 3);
        nextRun.setDate(1);
        break;
    }

    // Set the time
    const [hours, minutes] = schedule.time.split(':');
    nextRun.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    return nextRun;
  }
}
