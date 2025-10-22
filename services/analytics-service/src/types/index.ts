export interface EngagementEvent {
  id: string;
  contactId: string;
  newsletterId?: string;
  campaignId?: string;
  eventType:
    | 'email_open'
    | 'email_click'
    | 'website_visit'
    | 'form_submit'
    | 'purchase'
    | 'unsubscribe'
    | 'bounce'
    | 'complaint';
  timestamp: Date;
  metadata: Record<string, any>;
  score: number;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

export interface EngagementMetrics {
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  unsubscribes: number;
  bounces: number;
  complaints: number;
  engagementScore: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  bounceRate: number;
  lastEngagement: Date;
}

export interface NewsletterMetrics {
  newsletterId: string;
  sent: number;
  delivered: number;
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  unsubscribes: number;
  bounces: number;
  complaints: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  bounceRate: number;
  engagementScore: number;
  revenueAttribution: number;
  conversionCount: number;
  conversionRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CohortAnalysis {
  cohortId: string;
  cohortName: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  totalSubscribers: number;
  retentionRates: number[];
  engagementRates: number[];
  churnRates: number[];
  revenuePerCohort: number;
  averageLifetimeValue: number;
}

export interface RevenueAttribution {
  id: string;
  contactId: string;
  newsletterId?: string;
  campaignId?: string;
  touchpointType: 'email_open' | 'email_click' | 'website_visit' | 'direct';
  touchpointTimestamp: Date;
  conversionTimestamp: Date;
  conversionValue: number;
  conversionType: 'purchase' | 'subscription' | 'upgrade' | 'renewal';
  attributionModel:
    | 'first_touch'
    | 'last_touch'
    | 'linear'
    | 'time_decay'
    | 'position_based';
  attributionWeight: number;
  metadata: Record<string, any>;
}

export interface AnalyticsDashboard {
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
  type: 'metric' | 'chart' | 'table' | 'heatmap' | 'funnel' | 'cohort';
  title: string;
  config: WidgetConfig;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  dataSource: string;
  refreshInterval?: number;
}

export interface WidgetConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  metrics: string[];
  dimensions: string[];
  filters: Record<string, any>;
  timeRange: {
    start: Date;
    end: Date;
    period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  groupBy?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
  responsive: boolean;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  description?: string;
  type: 'scheduled' | 'on_demand';
  format: 'pdf' | 'csv' | 'excel' | 'json';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    timezone: string;
  };
  recipients: string[];
  config: ReportConfig;
  lastGenerated?: Date;
  nextScheduled?: Date;
  status: 'active' | 'paused' | 'error';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportConfig {
  metrics: string[];
  dimensions: string[];
  filters: Record<string, any>;
  timeRange: {
    start: Date;
    end: Date;
    period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
  groupBy?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeCharts: boolean;
  includeTables: boolean;
  includeExecutiveSummary: boolean;
}

export interface WebSocketMessage {
  type:
    | 'metric_update'
    | 'dashboard_update'
    | 'alert'
    | 'heartbeat'
    | 'pong'
    | 'authenticated'
    | 'dashboard_subscribed'
    | 'dashboard_unsubscribed'
    | 'error';
  payload: any;
  timestamp: Date;
  userId?: string;
  dashboardId?: string;
}

export interface AuthenticatedWebSocket {
  userId?: string;
  dashboardIds?: Set<string>;
  isAlive?: boolean;
  on: (event: string, callback: (...args: any[]) => void) => void;
  send: (data: string) => void;
  ping: () => void;
  terminate: () => void;
  readyState: number;
}

export interface AuthenticatedRequest {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
  body: any;
  query: Record<string, any>;
}

export interface AnalyticsAlert {
  id: string;
  name: string;
  description?: string;
  metric: string;
  condition:
    | 'greater_than'
    | 'less_than'
    | 'equals'
    | 'not_equals'
    | 'percentage_change';
  threshold: number;
  timeWindow: number; // minutes
  isActive: boolean;
  lastTriggered?: Date;
  recipients: string[];
  channels: ('email' | 'slack' | 'webhook')[];
  webhookUrl?: string;
  slackChannel?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriberBehavior {
  contactId: string;
  engagementPattern:
    | 'highly_engaged'
    | 'moderately_engaged'
    | 'low_engaged'
    | 'at_risk'
    | 'churned';
  preferredContentTypes: string[];
  optimalSendTime: {
    dayOfWeek: number;
    hour: number;
    timezone: string;
  };
  engagementTrend: 'increasing' | 'stable' | 'decreasing';
  churnProbability: number;
  lifetimeValue: number;
  lastEngagement: Date;
  totalEngagements: number;
  averageEngagementScore: number;
  contentPreferences: Record<string, number>;
  devicePreferences: ('desktop' | 'mobile' | 'tablet')[];
  locationData?: {
    country: string;
    region: string;
    city: string;
    timezone: string;
  };
}

export interface ConversionFunnel {
  id: string;
  name: string;
  steps: FunnelStep[];
  totalEntries: number;
  completionRate: number;
  dropoffRates: number[];
  averageTimeToComplete: number;
  conversionsByStep: number[];
  revenueByStep: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FunnelStep {
  id: string;
  name: string;
  description?: string;
  eventType: string;
  conditions: Record<string, any>;
  order: number;
}

export interface ROICalculation {
  campaignId?: string;
  newsletterId?: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  totalCost: number;
  totalRevenue: number;
  roi: number;
  roas: number; // Return on Ad Spend
  costPerAcquisition: number;
  customerLifetimeValue: number;
  paybackPeriod: number; // days
  marginContribution: number;
  conversions: number;
  conversionRate: number;
}

export interface PredictiveInsight {
  id: string;
  type:
    | 'churn_prediction'
    | 'optimal_send_time'
    | 'content_recommendation'
    | 'revenue_forecast';
  contactId?: string;
  prediction: any;
  confidence: number;
  factors: string[];
  createdAt: Date;
  expiresAt: Date;
  modelVersion: string;
  metadata: Record<string, any>;
}
