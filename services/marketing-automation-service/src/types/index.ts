// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  status: 'active' | 'paused' | 'draft';
  metrics: WorkflowMetrics;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowTrigger {
  type: 'event' | 'schedule' | 'manual' | 'api';
  conditions: TriggerCondition[];
  settings: Record<string, any>;
}

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface WorkflowStep {
  id: string;
  type: 'email' | 'wait' | 'condition' | 'webhook' | 'tag' | 'score' | 'segment';
  config: StepConfig;
  nextSteps: string[];
  position: { x: number; y: number };
}

export interface StepConfig {
  [key: string]: any;
  // Email step config
  templateId?: string;
  subject?: string;
  content?: string;
  // Wait step config
  duration?: number;
  unit?: 'minutes' | 'hours' | 'days' | 'weeks';
  // Condition step config
  conditions?: TriggerCondition[];
  // Webhook step config
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  payload?: Record<string, any>;
  // Tag step config
  action?: 'add' | 'remove';
  tags?: string[];
  // Score step config
  points?: number;
  reason?: string;
  // Segment step config
  segmentId?: string;
  segmentAction?: 'add' | 'remove';
}

export interface WorkflowMetrics {
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  averageCompletionTime: number;
  conversionRate: number;
  stepMetrics: Record<string, StepMetrics>;
}

export interface StepMetrics {
  executions: number;
  completions: number;
  failures: number;
  averageExecutionTime: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  contactId: string;
  currentStep: string | null;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startedAt: Date;
  completedAt: Date | undefined;
  metadata: Record<string, any>;
  executionLog: ExecutionLogEntry[];
}

export interface ExecutionLogEntry {
  stepId: string;
  timestamp: Date;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// DRIP CAMPAIGN TYPES
// ============================================================================

export interface DripCampaign {
  id: string;
  name: string;
  description: string;
  emails: DripEmail[];
  trigger: CampaignTrigger;
  status: 'active' | 'paused' | 'completed' | 'draft';
  metrics: CampaignMetrics;
  targetSegments: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DripEmail {
  id: string;
  subject: string;
  preheader: string;
  content: string;
  templateId?: string;
  delay: number; // hours after previous email or trigger
  conditions?: EmailCondition[];
  abTest?: ABTest;
  order: number;
}

export interface EmailCondition {
  type: 'engagement' | 'behavior' | 'attribute' | 'time';
  field: string;
  operator: string;
  value: any;
}

export interface CampaignTrigger {
  type: 'signup' | 'tag_added' | 'segment_entry' | 'behavior' | 'date' | 'manual';
  conditions: TriggerCondition[];
  settings: Record<string, any>;
}

export interface CampaignMetrics {
  totalSubscribers: number;
  activeSubscribers: number;
  completedSubscribers: number;
  unsubscribed: number;
  totalSent: number;
  totalOpens: number;
  totalClicks: number;
  conversionRate: number;
  emailMetrics: Record<string, EmailMetrics>;
}

export interface EmailMetrics {
  sent: number;
  delivered: number;
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  unsubscribes: number;
  bounces: number;
  openRate: number;
  clickRate: number;
}

export interface CampaignSubscription {
  id: string;
  campaignId: string;
  contactId: string;
  status: 'active' | 'completed' | 'paused' | 'unsubscribed';
  currentEmailIndex: number;
  nextEmailAt: Date | undefined;
  subscribedAt: Date;
  completedAt: Date | undefined;
  metadata: Record<string, any>;
}

// ============================================================================
// A/B TESTING TYPES
// ============================================================================

export interface ABTest {
  id: string;
  name: string;
  type: 'subject' | 'content' | 'send_time' | 'template';
  variants: ABTestVariant[];
  trafficSplit: number[]; // percentage for each variant
  winnerCriteria: 'open_rate' | 'click_rate' | 'conversion_rate';
  status: 'running' | 'completed' | 'paused';
  startDate: Date;
  endDate?: Date;
  results?: ABTestResults;
}

export interface ABTestVariant {
  id: string;
  name: string;
  content: any;
  metrics: VariantMetrics;
}

export interface VariantMetrics {
  sent: number;
  opens: number;
  clicks: number;
  conversions: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}

export interface ABTestResults {
  winner: string;
  confidence: number;
  statisticalSignificance: boolean;
  completedAt: Date;
  summary: string;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface AutomationEvent {
  id: string;
  type: string;
  contactId: string;
  timestamp: Date;
  data: Record<string, any>;
  source: string;
  processed: boolean;
  processedAt: Date | undefined;
}

export interface EventTrigger {
  id: string;
  name: string;
  eventType: string;
  conditions: TriggerCondition[];
  workflowId?: string;
  campaignId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateWorkflowRequest {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  trigger?: WorkflowTrigger;
  steps?: WorkflowStep[];
  status?: 'active' | 'paused' | 'draft';
}

export interface CreateDripCampaignRequest {
  name: string;
  description: string;
  emails: Omit<DripEmail, 'id'>[];
  trigger: CampaignTrigger;
  targetSegments: string[];
}

export interface UpdateDripCampaignRequest {
  name?: string;
  description?: string;
  emails?: DripEmail[];
  trigger?: CampaignTrigger;
  status?: 'active' | 'paused' | 'completed' | 'draft';
  targetSegments?: string[];
}

export interface TriggerWorkflowRequest {
  contactId: string;
  metadata?: Record<string, any>;
}

export interface WorkflowAnalyticsResponse {
  workflow: Workflow;
  metrics: WorkflowMetrics;
  executionHistory: WorkflowExecution[];
  performanceData: {
    completionRate: number;
    averageTime: number;
    dropoffPoints: Array<{
      stepId: string;
      stepName: string;
      dropoffRate: number;
    }>;
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface FilterParams {
  status?: string[];
  createdBy?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface AutomationError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  workflowId?: string;
  executionId?: string;
  stepId?: string;
}
