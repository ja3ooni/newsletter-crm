import {
  ContactLifecycle,
  DealStatus,
  OpportunityStage,
  PaginationOptions,
  TaskStatus,
} from '@/types';
import logger from '@/utils/logger';
import { Pool } from 'pg';

export interface DashboardMetrics {
  contacts: ContactMetrics;
  deals: DealMetrics;
  tasks: TaskMetrics;
  companies: CompanyMetrics;
  opportunities: OpportunityMetrics;
  pipeline: PipelineMetrics;
  activities: ActivityMetrics;
}

export interface ContactMetrics {
  total: number;
  byLifecycle: Record<ContactLifecycle, number>;
  newThisMonth: number;
  newThisWeek: number;
  averageLeadScore: number;
  topSources: Array<{ source: string; count: number }>;
  conversionRates: {
    leadToMQL: number;
    mqlToSQL: number;
    sqlToCustomer: number;
  };
}

export interface DealMetrics {
  total: number;
  byStatus: Record<DealStatus, number>;
  totalValue: number;
  averageValue: number;
  wonThisMonth: number;
  wonValue: number;
  lostThisMonth: number;
  lostValue: number;
  conversionRate: number;
  averageSalesCycle: number;
  topPerformers: Array<{ ownerId: string; wonDeals: number; wonValue: number }>;
}

export interface TaskMetrics {
  total: number;
  byStatus: Record<TaskStatus, number>;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  completedThisWeek: number;
  averageCompletionTime: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface CompanyMetrics {
  total: number;
  bySize: Record<string, number>;
  byIndustry: Record<string, number>;
  newThisMonth: number;
  averageRevenue: number;
  topCompanies: Array<{
    id: string;
    name: string;
    revenue: number;
    contactCount: number;
  }>;
}

export interface OpportunityMetrics {
  total: number;
  byStage: Record<OpportunityStage, number>;
  totalValue: number;
  averageValue: number;
  closedWonThisMonth: number;
  closedWonValue: number;
  averageProbability: number;
  forecastedRevenue: number;
}

export interface PipelineMetrics {
  totalPipelines: number;
  activePipelines: number;
  stageConversionRates: Array<{
    stageId: string;
    stageName: string;
    conversionRate: number;
    averageTimeInStage: number;
  }>;
  bottlenecks: Array<{
    stageId: string;
    stageName: string;
    dealCount: number;
    averageTimeInStage: number;
  }>;
}

export interface ActivityMetrics {
  totalActivities: number;
  activitiesThisWeek: number;
  byType: Record<string, number>;
  topPerformers: Array<{ userId: string; activityCount: number }>;
  engagementTrends: Array<{
    date: string;
    emailOpens: number;
    emailClicks: number;
    websiteVisits: number;
    formSubmissions: number;
  }>;
}

export interface CustomDashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  position: { x: number; y: number; width: number; height: number };
}

export type WidgetType =
  | 'metric_card'
  | 'line_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'table'
  | 'funnel'
  | 'gauge'
  | 'heatmap'
  | 'leaderboard';

export interface WidgetConfig {
  dataSource: string;
  metrics: string[];
  filters?: Record<string, any>;
  groupBy?: string;
  timeRange?: {
    start: Date;
    end: Date;
    period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
  visualization?: {
    colors?: string[];
    showLegend?: boolean;
    showGrid?: boolean;
    stacked?: boolean;
  };
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  type: ReportType;
  config: ReportConfig;
  schedule?: ReportSchedule;
  recipients: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ReportType =
  | 'sales_performance'
  | 'lead_generation'
  | 'pipeline_analysis'
  | 'activity_summary'
  | 'territory_performance'
  | 'custom';

export interface ReportConfig {
  dataSource: string;
  metrics: string[];
  dimensions: string[];
  filters?: Record<string, any>;
  timeRange: {
    start: Date;
    end: Date;
    period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
  format: 'pdf' | 'excel' | 'csv' | 'json';
  visualization?: {
    charts: Array<{
      type: 'line' | 'bar' | 'pie' | 'table';
      title: string;
      metrics: string[];
    }>;
  };
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time: string; // HH:MM format
  dayOfWeek?: number; // 0=Sunday, 1=Monday, etc.
  dayOfMonth?: number; // 1-31
  timezone: string;
}

export class CRMAnalyticsService {
  constructor(private db: Pool) {}

  // ============================================================================
  // DASHBOARD METRICS
  // ============================================================================

  async getDashboardMetrics(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<DashboardMetrics> {
    try {
      logger.info('Generating dashboard metrics', { userId, timeRange });

      const [
        contacts,
        deals,
        tasks,
        companies,
        opportunities,
        pipeline,
        activities,
      ] = await Promise.all([
        this.getContactMetrics(userId, timeRange),
        this.getDealMetrics(userId, timeRange),
        this.getTaskMetrics(userId, timeRange),
        this.getCompanyMetrics(userId, timeRange),
        this.getOpportunityMetrics(userId, timeRange),
        this.getPipelineMetrics(timeRange),
        this.getActivityMetrics(userId, timeRange),
      ]);

      return {
        contacts,
        deals,
        tasks,
        companies,
        opportunities,
        pipeline,
        activities,
      };
    } catch (error) {
      logger.error('Error generating dashboard metrics:', error);
      throw error;
    }
  }

  private async getContactMetrics(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<ContactMetrics> {
    const whereClause = this.buildWhereClause('c', userId, timeRange);

    // Total contacts
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as total FROM contacts c ${whereClause}`
    );
    const total = parseInt(totalResult.rows[0].total);

    // Contacts by lifecycle
    const lifecycleResult = await this.db.query(
      `SELECT lifecycle, COUNT(*) as count
       FROM contacts c ${whereClause}
       GROUP BY lifecycle`
    );
    const byLifecycle = lifecycleResult.rows.reduce(
      (acc, row) => {
        acc[row.lifecycle as ContactLifecycle] = parseInt(row.count);
        return acc;
      },
      {} as Record<ContactLifecycle, number>
    );

    // New contacts this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const newThisMonthResult = await this.db.query(
      `SELECT COUNT(*) as count FROM contacts c
       WHERE c.created_at >= $1 ${userId ? 'AND c.owner_id = $2' : ''}`,
      userId ? [thisMonth, userId] : [thisMonth]
    );
    const newThisMonth = parseInt(newThisMonthResult.rows[0].count);

    // New contacts this week
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay());
    thisWeek.setHours(0, 0, 0, 0);

    const newThisWeekResult = await this.db.query(
      `SELECT COUNT(*) as count FROM contacts c
       WHERE c.created_at >= $1 ${userId ? 'AND c.owner_id = $2' : ''}`,
      userId ? [thisWeek, userId] : [thisWeek]
    );
    const newThisWeek = parseInt(newThisWeekResult.rows[0].count);

    // Average lead score
    const avgScoreResult = await this.db.query(
      `SELECT AVG(lead_score) as avg_score FROM contacts c ${whereClause}`
    );
    const averageLeadScore = parseFloat(avgScoreResult.rows[0].avg_score) || 0;

    // Top sources
    const sourcesResult = await this.db.query(
      `SELECT source, COUNT(*) as count
       FROM contacts c ${whereClause}
       AND source IS NOT NULL
       GROUP BY source
       ORDER BY count DESC
       LIMIT 10`
    );
    const topSources = sourcesResult.rows.map(row => ({
      source: row.source,
      count: parseInt(row.count),
    }));

    // Conversion rates (mock data for now)
    const conversionRates = {
      leadToMQL: 25.5,
      mqlToSQL: 45.2,
      sqlToCustomer: 32.8,
    };

    return {
      total,
      byLifecycle,
      newThisMonth,
      newThisWeek,
      averageLeadScore,
      topSources,
      conversionRates,
    };
  }

  private async getDealMetrics(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<DealMetrics> {
    const whereClause = this.buildWhereClause('d', userId, timeRange);

    // Total deals
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as total FROM deals d ${whereClause}`
    );
    const total = parseInt(totalResult.rows[0].total);

    // Deals by status
    const statusResult = await this.db.query(
      `SELECT status, COUNT(*) as count
       FROM deals d ${whereClause}
       GROUP BY status`
    );
    const byStatus = statusResult.rows.reduce(
      (acc, row) => {
        acc[row.status as DealStatus] = parseInt(row.count);
        return acc;
      },
      {} as Record<DealStatus, number>
    );

    // Total and average value
    const valueResult = await this.db.query(
      `SELECT SUM(value) as total_value, AVG(value) as avg_value
       FROM deals d ${whereClause}
       AND value IS NOT NULL`
    );
    const totalValue = parseFloat(valueResult.rows[0].total_value) || 0;
    const averageValue = parseFloat(valueResult.rows[0].avg_value) || 0;

    // Won deals this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const wonThisMonthResult = await this.db.query(
      `SELECT COUNT(*) as count, SUM(value) as value
       FROM deals d
       WHERE d.status = 'won' AND d.actual_close_date >= $1
       ${userId ? 'AND d.owner_id = $2' : ''}`,
      userId ? [thisMonth, userId] : [thisMonth]
    );
    const wonThisMonth = parseInt(wonThisMonthResult.rows[0].count);
    const wonValue = parseFloat(wonThisMonthResult.rows[0].value) || 0;

    // Lost deals this month
    const lostThisMonthResult = await this.db.query(
      `SELECT COUNT(*) as count, SUM(value) as value
       FROM deals d
       WHERE d.status = 'lost' AND d.actual_close_date >= $1
       ${userId ? 'AND d.owner_id = $2' : ''}`,
      userId ? [thisMonth, userId] : [thisMonth]
    );
    const lostThisMonth = parseInt(lostThisMonthResult.rows[0].count);
    const lostValue = parseFloat(lostThisMonthResult.rows[0].value) || 0;

    // Conversion rate
    const totalClosed = wonThisMonth + lostThisMonth;
    const conversionRate =
      totalClosed > 0 ? (wonThisMonth / totalClosed) * 100 : 0;

    // Average sales cycle (mock data)
    const averageSalesCycle = 45; // days

    // Top performers
    const performersResult = await this.db.query(
      `SELECT owner_id, COUNT(*) as won_deals, SUM(value) as won_value
       FROM deals d
       WHERE d.status = 'won' AND d.actual_close_date >= $1
       GROUP BY owner_id
       ORDER BY won_value DESC
       LIMIT 10`,
      [thisMonth]
    );
    const topPerformers = performersResult.rows.map(row => ({
      ownerId: row.owner_id,
      wonDeals: parseInt(row.won_deals),
      wonValue: parseFloat(row.won_value) || 0,
    }));

    return {
      total,
      byStatus,
      totalValue,
      averageValue,
      wonThisMonth,
      wonValue,
      lostThisMonth,
      lostValue,
      conversionRate,
      averageSalesCycle,
      topPerformers,
    };
  }

  private async getTaskMetrics(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<TaskMetrics> {
    const whereClause = this.buildWhereClause(
      't',
      userId,
      timeRange,
      'assigned_to'
    );

    // Total tasks
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as total FROM tasks t ${whereClause}`
    );
    const total = parseInt(totalResult.rows[0].total);

    // Tasks by status
    const statusResult = await this.db.query(
      `SELECT status, COUNT(*) as count
       FROM tasks t ${whereClause}
       GROUP BY status`
    );
    const byStatus = statusResult.rows.reduce(
      (acc, row) => {
        acc[row.status as TaskStatus] = parseInt(row.count);
        return acc;
      },
      {} as Record<TaskStatus, number>
    );

    // Overdue tasks
    const overdueResult = await this.db.query(
      `SELECT COUNT(*) as count FROM tasks t
       WHERE t.due_date < NOW() AND t.status != 'completed'
       ${userId ? 'AND t.assigned_to = $1' : ''}`
    );
    const overdue = parseInt(overdueResult.rows[0].count);

    // Due today
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const dueTodayResult = await this.db.query(
      `SELECT COUNT(*) as count FROM tasks t
       WHERE DATE(t.due_date) = DATE(NOW()) AND t.status != 'completed'
       ${userId ? 'AND t.assigned_to = $1' : ''}`
    );
    const dueToday = parseInt(dueTodayResult.rows[0].count);

    // Due this week
    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    const dueThisWeekResult = await this.db.query(
      `SELECT COUNT(*) as count FROM tasks t
       WHERE t.due_date <= $1 AND t.status != 'completed'
       ${userId ? 'AND t.assigned_to = $2' : ''}`,
      userId ? [endOfWeek, userId] : [endOfWeek]
    );
    const dueThisWeek = parseInt(dueThisWeekResult.rows[0].count);

    // Completed this week
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const completedThisWeekResult = await this.db.query(
      `SELECT COUNT(*) as count FROM tasks t
       WHERE t.status = 'completed' AND t.completed_at >= $1
       ${userId ? 'AND t.assigned_to = $2' : ''}`,
      userId ? [startOfWeek, userId] : [startOfWeek]
    );
    const completedThisWeek = parseInt(completedThisWeekResult.rows[0].count);

    // Tasks by type
    const typeResult = await this.db.query(
      `SELECT type, COUNT(*) as count
       FROM tasks t ${whereClause}
       GROUP BY type`
    );
    const byType = typeResult.rows.reduce(
      (acc, row) => {
        acc[row.type] = parseInt(row.count);
        return acc;
      },
      {} as Record<string, number>
    );

    // Tasks by priority
    const priorityResult = await this.db.query(
      `SELECT priority, COUNT(*) as count
       FROM tasks t ${whereClause}
       GROUP BY priority`
    );
    const byPriority = priorityResult.rows.reduce(
      (acc, row) => {
        acc[row.priority] = parseInt(row.count);
        return acc;
      },
      {} as Record<string, number>
    );

    // Average completion time (mock data)
    const averageCompletionTime = 2.5; // days

    return {
      total,
      byStatus,
      overdue,
      dueToday,
      dueThisWeek,
      completedThisWeek,
      averageCompletionTime,
      byType,
      byPriority,
    };
  }

  private async getCompanyMetrics(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<CompanyMetrics> {
    const whereClause = this.buildWhereClause('c', userId, timeRange);

    // Total companies
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as total FROM companies c ${whereClause}`
    );
    const total = parseInt(totalResult.rows[0].total);

    // Companies by size
    const sizeResult = await this.db.query(
      `SELECT size, COUNT(*) as count
       FROM companies c ${whereClause}
       AND size IS NOT NULL
       GROUP BY size`
    );
    const bySize = sizeResult.rows.reduce(
      (acc, row) => {
        acc[row.size] = parseInt(row.count);
        return acc;
      },
      {} as Record<string, number>
    );

    // Companies by industry
    const industryResult = await this.db.query(
      `SELECT industry, COUNT(*) as count
       FROM companies c ${whereClause}
       AND industry IS NOT NULL
       GROUP BY industry
       ORDER BY count DESC
       LIMIT 10`
    );
    const byIndustry = industryResult.rows.reduce(
      (acc, row) => {
        acc[row.industry] = parseInt(row.count);
        return acc;
      },
      {} as Record<string, number>
    );

    // New companies this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const newThisMonthResult = await this.db.query(
      `SELECT COUNT(*) as count FROM companies c
       WHERE c.created_at >= $1 ${userId ? 'AND c.owner_id = $2' : ''}`,
      userId ? [thisMonth, userId] : [thisMonth]
    );
    const newThisMonth = parseInt(newThisMonthResult.rows[0].count);

    // Average revenue
    const avgRevenueResult = await this.db.query(
      `SELECT AVG(revenue) as avg_revenue FROM companies c ${whereClause}
       AND revenue IS NOT NULL`
    );
    const averageRevenue =
      parseFloat(avgRevenueResult.rows[0].avg_revenue) || 0;

    // Top companies
    const topCompaniesResult = await this.db.query(
      `SELECT c.id, c.name, c.revenue, COUNT(contacts.id) as contact_count
       FROM companies c
       LEFT JOIN contacts ON c.id = contacts.company_id
       ${whereClause}
       GROUP BY c.id, c.name, c.revenue
       ORDER BY c.revenue DESC NULLS LAST
       LIMIT 10`
    );
    const topCompanies = topCompaniesResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      revenue: parseFloat(row.revenue) || 0,
      contactCount: parseInt(row.contact_count),
    }));

    return {
      total,
      bySize,
      byIndustry,
      newThisMonth,
      averageRevenue,
      topCompanies,
    };
  }

  private async getOpportunityMetrics(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<OpportunityMetrics> {
    const whereClause = this.buildWhereClause('o', userId, timeRange);

    // Total opportunities
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as total FROM opportunities o ${whereClause}`
    );
    const total = parseInt(totalResult.rows[0].total);

    // Opportunities by stage
    const stageResult = await this.db.query(
      `SELECT stage, COUNT(*) as count
       FROM opportunities o ${whereClause}
       GROUP BY stage`
    );
    const byStage = stageResult.rows.reduce(
      (acc, row) => {
        acc[row.stage as OpportunityStage] = parseInt(row.count);
        return acc;
      },
      {} as Record<OpportunityStage, number>
    );

    // Total and average value
    const valueResult = await this.db.query(
      `SELECT SUM(value) as total_value, AVG(value) as avg_value, AVG(probability) as avg_probability
       FROM opportunities o ${whereClause}
       AND value IS NOT NULL`
    );
    const totalValue = parseFloat(valueResult.rows[0].total_value) || 0;
    const averageValue = parseFloat(valueResult.rows[0].avg_value) || 0;
    const averageProbability =
      parseFloat(valueResult.rows[0].avg_probability) || 0;

    // Closed won this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const closedWonResult = await this.db.query(
      `SELECT COUNT(*) as count, SUM(value) as value
       FROM opportunities o
       WHERE o.stage = 'closed_won' AND o.actual_close_date >= $1
       ${userId ? 'AND o.owner_id = $2' : ''}`,
      userId ? [thisMonth, userId] : [thisMonth]
    );
    const closedWonThisMonth = parseInt(closedWonResult.rows[0].count);
    const closedWonValue = parseFloat(closedWonResult.rows[0].value) || 0;

    // Forecasted revenue
    const forecastResult = await this.db.query(
      `SELECT SUM(value * probability / 100) as forecasted_revenue
       FROM opportunities o ${whereClause}
       AND stage NOT IN ('closed_won', 'closed_lost')
       AND value IS NOT NULL AND probability IS NOT NULL`
    );
    const forecastedRevenue =
      parseFloat(forecastResult.rows[0].forecasted_revenue) || 0;

    return {
      total,
      byStage,
      totalValue,
      averageValue,
      closedWonThisMonth,
      closedWonValue,
      averageProbability,
      forecastedRevenue,
    };
  }

  private async getPipelineMetrics(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<PipelineMetrics> {
    // Total pipelines
    const totalResult = await this.db.query(
      'SELECT COUNT(*) as total FROM sales_pipelines'
    );
    const totalPipelines = parseInt(totalResult.rows[0].total);

    // Active pipelines
    const activeResult = await this.db.query(
      'SELECT COUNT(*) as active FROM sales_pipelines WHERE is_active = true'
    );
    const activePipelines = parseInt(activeResult.rows[0].active);

    // Stage conversion rates (mock data for now)
    const stageConversionRates = [
      {
        stageId: 'stage1',
        stageName: 'Initial Contact',
        conversionRate: 75.5,
        averageTimeInStage: 3.2,
      },
      {
        stageId: 'stage2',
        stageName: 'Qualification',
        conversionRate: 65.8,
        averageTimeInStage: 5.1,
      },
      {
        stageId: 'stage3',
        stageName: 'Proposal',
        conversionRate: 45.2,
        averageTimeInStage: 8.7,
      },
    ];

    // Pipeline bottlenecks (mock data)
    const bottlenecks = [
      {
        stageId: 'stage2',
        stageName: 'Qualification',
        dealCount: 25,
        averageTimeInStage: 12.3,
      },
    ];

    return {
      totalPipelines,
      activePipelines,
      stageConversionRates,
      bottlenecks,
    };
  }

  private async getActivityMetrics(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<ActivityMetrics> {
    // Mock implementation for now
    return {
      totalActivities: 1250,
      activitiesThisWeek: 85,
      byType: {
        email_open: 450,
        email_click: 125,
        website_visit: 320,
        form_submit: 85,
        call: 45,
        meeting: 25,
      },
      topPerformers: [
        { userId: 'user1', activityCount: 125 },
        { userId: 'user2', activityCount: 98 },
        { userId: 'user3', activityCount: 87 },
      ],
      engagementTrends: [
        {
          date: '2024-01-01',
          emailOpens: 45,
          emailClicks: 12,
          websiteVisits: 28,
          formSubmissions: 5,
        },
        {
          date: '2024-01-02',
          emailOpens: 52,
          emailClicks: 15,
          websiteVisits: 31,
          formSubmissions: 7,
        },
      ],
    };
  }

  // ============================================================================
  // CUSTOM DASHBOARDS
  // ============================================================================

  async createCustomDashboard(
    data: Omit<CustomDashboard, 'id' | 'createdAt' | 'updatedAt'>,
    createdBy: string
  ): Promise<CustomDashboard> {
    try {
      const result = await this.db.query(
        `INSERT INTO custom_dashboards (name, description, widgets, layout, is_public, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [
          data.name,
          data.description,
          JSON.stringify(data.widgets),
          JSON.stringify(data.layout),
          data.isPublic,
          createdBy,
        ]
      );

      logger.info('Custom dashboard created', {
        dashboardId: result.rows[0].id,
        name: data.name,
      });

      return this.mapDatabaseToDashboard(result.rows[0]);
    } catch (error) {
      logger.error('Error creating custom dashboard:', error);
      throw error;
    }
  }

  async getCustomDashboard(id: string): Promise<CustomDashboard | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM custom_dashboards WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseToDashboard(result.rows[0]);
    } catch (error) {
      logger.error('Error getting custom dashboard:', { id, error });
      throw error;
    }
  }

  async getUserDashboards(
    userId: string,
    options: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<{ dashboards: CustomDashboard[]; total: number }> {
    try {
      const offset = (options.page - 1) * options.limit;

      // Get total count
      const countResult = await this.db.query(
        'SELECT COUNT(*) FROM custom_dashboards WHERE created_by = $1 OR is_public = true',
        [userId]
      );
      const total = parseInt(countResult.rows[0].count);

      // Get dashboards
      const result = await this.db.query(
        `SELECT * FROM custom_dashboards
         WHERE created_by = $1 OR is_public = true
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, options.limit, offset]
      );

      const dashboards = result.rows.map(row =>
        this.mapDatabaseToDashboard(row)
      );

      return { dashboards, total };
    } catch (error) {
      logger.error('Error getting user dashboards:', { userId, error });
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private buildWhereClause(
    tableAlias: string,
    userId?: string,
    timeRange?: { start: Date; end: Date },
    ownerField: string = 'owner_id'
  ): string {
    const conditions = [];

    if (userId) {
      conditions.push(`${tableAlias}.${ownerField} = '${userId}'`);
    }

    if (timeRange) {
      conditions.push(
        `${tableAlias}.created_at >= '${timeRange.start.toISOString()}'`
      );
      conditions.push(
        `${tableAlias}.created_at <= '${timeRange.end.toISOString()}'`
      );
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  private mapDatabaseToDashboard(row: any): CustomDashboard {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      widgets: JSON.parse(row.widgets || '[]'),
      layout: JSON.parse(row.layout || '{}'),
      isPublic: row.is_public,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
