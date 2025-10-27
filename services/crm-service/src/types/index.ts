// ============================================================================
// CORE CRM TYPES
// ============================================================================

export interface Contact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  website?: string;
  address?: ContactAddress;
  customFields: Record<string, any>;
  tags: string[];
  leadScore: number;
  lifecycle: ContactLifecycle;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  preferences: ContactPreferences;
  consent: ContactConsent;
  lastActivityAt?: Date;
  ownerId?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export type ContactLifecycle =
  | 'subscriber'
  | 'lead'
  | 'marketing_qualified_lead'
  | 'sales_qualified_lead'
  | 'opportunity'
  | 'customer'
  | 'evangelist';

export interface ContactPreferences {
  emailFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
  contentTypes: string[];
  communicationChannels: string[];
  timezone: string;
  language: string;
  optInDate?: Date;
  optOutDate?: Date;
}

export interface ContactConsent {
  marketing: boolean;
  analytics: boolean;
  thirdParty: boolean;
  consentDate: Date;
  consentSource: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// SEGMENTATION TYPES
// ============================================================================

export interface Segment {
  id: string;
  name: string;
  description?: string;
  conditions: SegmentCondition[];
  contactCount: number;
  isAutoUpdating: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SegmentCondition {
  field: string;
  operator: SegmentOperator;
  value: any;
  logicalOperator?: 'AND' | 'OR';
  group?: string;
}

export type SegmentOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty'
  | 'date_before'
  | 'date_after'
  | 'date_between';

export interface ContactSegment {
  contactId: string;
  segmentId: string;
  addedAt: Date;
  addedBy?: string;
}

// ============================================================================
// ENGAGEMENT TRACKING TYPES
// ============================================================================

export interface EngagementEvent {
  id: string;
  contactId: string;
  eventType: EngagementEventType;
  eventName?: string;
  timestamp: Date;
  metadata: Record<string, any>;
  score: number;
  newsletterId?: string;
  campaignId?: string;
  workflowId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type EngagementEventType =
  | 'email_open'
  | 'email_click'
  | 'email_bounce'
  | 'email_unsubscribe'
  | 'website_visit'
  | 'form_submit'
  | 'download'
  | 'purchase'
  | 'signup'
  | 'login'
  | 'page_view'
  | 'video_watch'
  | 'social_share'
  | 'survey_response'
  | 'webinar_attend'
  | 'demo_request'
  | 'trial_start'
  | 'subscription_upgrade'
  | 'support_ticket'
  | 'referral'
  | 'review_left';

// ============================================================================
// LEAD SCORING TYPES
// ============================================================================

export interface LeadScoringRule {
  id: string;
  name: string;
  description?: string;
  trigger: ScoringTrigger;
  points: number;
  decayRate: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoringTrigger {
  eventType: EngagementEventType;
  conditions: ScoringCondition[];
  frequency: 'once' | 'daily' | 'weekly' | 'unlimited';
  maxPoints?: number;
}

export interface ScoringCondition {
  field: string;
  operator: SegmentOperator;
  value: any;
}

export interface LeadScoreHistory {
  id: string;
  contactId: string;
  ruleId: string;
  pointsAwarded: number;
  previousScore: number;
  newScore: number;
  reason: string;
  timestamp: Date;
}

// ============================================================================
// CONTACT ACTIVITIES TYPES
// ============================================================================

export interface ContactActivity {
  id: string;
  contactId: string;
  type: ContactActivityType;
  subject?: string;
  content?: string;
  dueDate?: Date;
  completedAt?: Date;
  priority: ActivityPriority;
  status: ActivityStatus;
  assignedTo?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ContactActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'task'
  | 'deal';
export type ActivityPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ActivityStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

// ============================================================================
// SALES PIPELINE TYPES
// ============================================================================

export interface SalesPipeline {
  id: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  isDefault: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  probability: number;
  isClosedWon: boolean;
  isClosedLost: boolean;
  color?: string;
  rottenDays?: number; // Days after which deals in this stage are considered stale
}

export interface Deal {
  id: string;
  name: string;
  contactId?: string;
  companyId?: string;
  pipelineId: string;
  stageId: string;
  value?: number;
  currency: string;
  probability: number;
  expectedCloseDate?: Date;
  actualCloseDate?: Date;
  status: DealStatus;
  lostReason?: string;
  wonReason?: string;
  ownerId?: string;
  customFields: Record<string, any>;
  tags: string[];
  source?: string;
  priority: DealPriority;
  lastActivityAt?: Date;
  rottenDate?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DealStatus = 'open' | 'won' | 'lost';
export type DealPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface DealActivity {
  id: string;
  dealId: string;
  contactId?: string;
  type: DealActivityType;
  subject: string;
  content?: string;
  dueDate?: Date;
  completedAt?: Date;
  priority: ActivityPriority;
  status: ActivityStatus;
  assignedTo?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DealActivityType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'task'
  | 'note'
  | 'proposal'
  | 'demo';

export interface Opportunity {
  id: string;
  name: string;
  contactId: string;
  companyId?: string;
  dealId?: string;
  value: number;
  currency: string;
  probability: number;
  stage: OpportunityStage;
  source?: string;
  description?: string;
  expectedCloseDate?: Date;
  actualCloseDate?: Date;
  ownerId?: string;
  customFields: Record<string, any>;
  tags: string[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OpportunityStage =
  | 'identified'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

// ============================================================================
// COMPANY/ACCOUNT TYPES
// ============================================================================

export interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: CompanySize;
  revenue?: number;
  currency: string;
  website?: string;
  phone?: string;
  address?: ContactAddress;
  description?: string;
  customFields: Record<string, any>;
  tags: string[];
  ownerId?: string;
  parentCompanyId?: string;
  subsidiaries?: string[];
  contacts?: string[];
  deals?: string[];
  opportunities?: string[];
  lastActivityAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CompanySize =
  | 'startup'
  | 'small'
  | 'medium'
  | 'large'
  | 'enterprise';

export interface ContactCompanyRelation {
  contactId: string;
  companyId: string;
  role?: string;
  isPrimary: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
}

// ============================================================================
// TASK AND ACTIVITY MANAGEMENT TYPES
// ============================================================================

export interface Task {
  id: string;
  title: string;
  description?: string;
  type: TaskType;
  priority: ActivityPriority;
  status: TaskStatus;
  dueDate?: Date;
  completedAt?: Date;
  assignedTo?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  opportunityId?: string;
  reminderAt?: Date;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  customFields: Record<string, any>;
  tags: string[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'follow_up'
  | 'demo'
  | 'proposal'
  | 'contract'
  | 'other';
export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'overdue';

export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every N days/weeks/months/years
  daysOfWeek?: number[]; // For weekly: 0=Sunday, 1=Monday, etc.
  dayOfMonth?: number; // For monthly
  endDate?: Date;
  occurrences?: number; // Number of times to repeat
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  meetingUrl?: string;
  attendees: MeetingAttendee[];
  contactIds: string[];
  companyIds: string[];
  dealId?: string;
  opportunityId?: string;
  status: MeetingStatus;
  outcome?: string;
  followUpTasks?: string[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingAttendee {
  email: string;
  name?: string;
  status: AttendeeStatus;
  isOrganizer: boolean;
}

export type MeetingStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';
export type AttendeeStatus = 'pending' | 'accepted' | 'declined' | 'tentative';

// ============================================================================
// CUSTOM FIELDS TYPES
// ============================================================================

export interface CustomField {
  id: string;
  name: string;
  label: string;
  type: CustomFieldType;
  entityType: CustomFieldEntity;
  options?: CustomFieldOption[];
  validation?: CustomFieldValidation;
  isRequired: boolean;
  isUnique: boolean;
  isSearchable: boolean;
  defaultValue?: any;
  helpText?: string;
  order: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'url'
  | 'email'
  | 'phone'
  | 'currency'
  | 'percentage';

export type CustomFieldEntity =
  | 'contact'
  | 'company'
  | 'deal'
  | 'opportunity'
  | 'task';

export interface CustomFieldOption {
  value: string;
  label: string;
  color?: string;
  order: number;
  isActive: boolean;
}

export interface CustomFieldValidation {
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  required?: boolean;
}

// ============================================================================
// TERRITORY MANAGEMENT TYPES
// ============================================================================

export interface Territory {
  id: string;
  name: string;
  description?: string;
  type: TerritoryType;
  rules: TerritoryRule[];
  assignedUsers: string[];
  isActive: boolean;
  priority: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TerritoryType =
  | 'geographic'
  | 'industry'
  | 'company_size'
  | 'revenue'
  | 'custom';

export interface TerritoryRule {
  field: string;
  operator: SegmentOperator;
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface TerritoryAssignment {
  id: string;
  territoryId: string;
  userId: string;
  role: TerritoryRole;
  assignedAt: Date;
  assignedBy?: string;
}

export type TerritoryRole = 'owner' | 'member' | 'viewer';

// ============================================================================
// REVENUE FORECASTING TYPES
// ============================================================================

export interface RevenueForecast {
  id: string;
  name: string;
  period: ForecastPeriod;
  startDate: Date;
  endDate: Date;
  targetRevenue: number;
  predictedRevenue: number;
  actualRevenue: number;
  confidence: number;
  deals: ForecastDeal[];
  opportunities: ForecastOpportunity[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ForecastPeriod = 'monthly' | 'quarterly' | 'yearly';

export interface ForecastDeal {
  dealId: string;
  value: number;
  probability: number;
  expectedCloseDate: Date;
  weightedValue: number;
}

export interface ForecastOpportunity {
  opportunityId: string;
  value: number;
  probability: number;
  expectedCloseDate: Date;
  weightedValue: number;
}

// ============================================================================
// WIN/LOSS TRACKING TYPES
// ============================================================================

export interface WinLossAnalysis {
  id: string;
  dealId?: string;
  opportunityId?: string;
  outcome: 'won' | 'lost';
  primaryReason: string;
  secondaryReasons: string[];
  competitorId?: string;
  feedback?: string;
  lessonsLearned?: string;
  actionItems: string[];
  analyzedBy?: string;
  analyzedAt: Date;
  createdBy?: string;
  createdAt: Date;
}

export interface Competitor {
  id: string;
  name: string;
  website?: string;
  description?: string;
  strengths: string[];
  weaknesses: string[];
  pricing?: CompetitorPricing;
  marketShare?: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetitorPricing {
  model: 'subscription' | 'one_time' | 'usage_based' | 'freemium' | 'custom';
  startingPrice?: number;
  currency: string;
  notes?: string;
}

// ============================================================================
// IMPORT/EXPORT TYPES
// ============================================================================

export interface ImportJob {
  id: string;
  fileName: string;
  fileSize: number;
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  status: ImportStatus;
  errors: ImportError[];
  mapping: FieldMapping;
  options: ImportOptions;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

export type ImportStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  data?: Record<string, any>;
}

export interface FieldMapping {
  [csvColumn: string]: string; // Maps CSV column to Contact field
}

export interface ImportOptions {
  skipDuplicates: boolean;
  updateExisting: boolean;
  duplicateField: string; // Field to check for duplicates (usually 'email')
  defaultLifecycle?: ContactLifecycle;
  defaultSource?: string;
  defaultTags?: string[];
}

export interface ExportJob {
  id: string;
  fileName: string;
  format: ExportFormat;
  filters: ExportFilter[];
  fields: string[];
  totalRecords: number;
  status: ExportStatus;
  downloadUrl?: string;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

export type ExportFormat = 'csv' | 'xlsx' | 'json';
export type ExportStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired';

export interface ExportFilter {
  field: string;
  operator: SegmentOperator;
  value: any;
}

// ============================================================================
// CONTACT ENRICHMENT TYPES
// ============================================================================

export interface EnrichmentJob {
  id: string;
  contactId: string;
  provider: EnrichmentProvider;
  status: EnrichmentStatus;
  requestData: Record<string, any>;
  responseData?: Record<string, any>;
  enrichedFields: string[];
  confidence: number;
  cost?: number;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export type EnrichmentProvider =
  | 'clearbit'
  | 'fullcontact'
  | 'hunter'
  | 'pipl'
  | 'internal';
export type EnrichmentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface EnrichmentRule {
  id: string;
  name: string;
  provider: EnrichmentProvider;
  triggers: EnrichmentTrigger[];
  fields: string[];
  isActive: boolean;
  priority: number;
  costLimit?: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnrichmentTrigger {
  event: 'contact_created' | 'contact_updated' | 'manual' | 'scheduled';
  conditions?: SegmentCondition[];
}

// ============================================================================
// DUPLICATE DETECTION TYPES
// ============================================================================

export interface DuplicateGroup {
  id: string;
  masterContactId: string;
  duplicateContactIds: string[];
  confidence: number;
  matchingFields: string[];
  status: DuplicateStatus;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export type DuplicateStatus =
  | 'pending'
  | 'merged'
  | 'ignored'
  | 'false_positive';

export interface DuplicateRule {
  id: string;
  name: string;
  fields: DuplicateField[];
  threshold: number;
  isActive: boolean;
  autoMerge: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DuplicateField {
  field: string;
  weight: number;
  matchType: 'exact' | 'fuzzy' | 'phonetic' | 'domain';
  threshold?: number;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateContactRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  website?: string;
  address?: ContactAddress;
  customFields?: Record<string, any>;
  tags?: string[];
  lifecycle?: ContactLifecycle;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  preferences?: Partial<ContactPreferences>;
  consent?: Partial<ContactConsent>;
  ownerId?: string;
}

export interface UpdateContactRequest {
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  website?: string;
  address?: ContactAddress;
  customFields?: Record<string, any>;
  tags?: string[];
  lifecycle?: ContactLifecycle;
  source?: string;
  preferences?: Partial<ContactPreferences>;
  ownerId?: string;
}

export interface ContactSearchRequest {
  query?: string;
  filters?: ContactFilter[];
  segments?: string[];
  tags?: string[];
  lifecycle?: ContactLifecycle[];
  source?: string[];
  ownerId?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  lastActivityAfter?: Date;
  lastActivityBefore?: Date;
  leadScoreMin?: number;
  leadScoreMax?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ContactFilter {
  field: string;
  operator: SegmentOperator;
  value: any;
}

export interface ContactSearchResponse {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CreateSegmentRequest {
  name: string;
  description?: string;
  conditions: SegmentCondition[];
  isAutoUpdating?: boolean;
}

export interface UpdateSegmentRequest {
  name?: string;
  description?: string;
  conditions?: SegmentCondition[];
  isAutoUpdating?: boolean;
  isActive?: boolean;
}

export interface CreateLeadScoringRuleRequest {
  name: string;
  description?: string;
  trigger: ScoringTrigger;
  points: number;
  decayRate?: number;
}

export interface UpdateLeadScoringRuleRequest {
  name?: string;
  description?: string;
  trigger?: ScoringTrigger;
  points?: number;
  decayRate?: number;
  isActive?: boolean;
}

export interface CreateContactActivityRequest {
  contactId: string;
  type: ContactActivityType;
  subject?: string;
  content?: string;
  dueDate?: Date;
  priority?: ActivityPriority;
  assignedTo?: string;
}

export interface UpdateContactActivityRequest {
  subject?: string;
  content?: string;
  dueDate?: Date;
  priority?: ActivityPriority;
  status?: ActivityStatus;
  assignedTo?: string;
}

export interface BulkOperationRequest {
  contactIds: string[];
  operation: BulkOperation;
  data?: Record<string, any>;
}

export interface BulkOperation {
  type:
    | 'update'
    | 'delete'
    | 'add_tags'
    | 'remove_tags'
    | 'change_lifecycle'
    | 'assign_owner';
  params: Record<string, any>;
}

export interface BulkOperationResponse {
  jobId: string;
  totalRecords: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// ============================================================================
// SALES PIPELINE REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateSalesPipelineRequest {
  name: string;
  description?: string;
  stages: CreatePipelineStageRequest[];
  isDefault?: boolean;
}

export interface CreatePipelineStageRequest {
  name: string;
  order: number;
  probability: number;
  isClosedWon?: boolean;
  isClosedLost?: boolean;
  color?: string;
  rottenDays?: number;
}

export interface UpdateSalesPipelineRequest {
  name?: string;
  description?: string;
  stages?: UpdatePipelineStageRequest[];
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdatePipelineStageRequest {
  id?: string;
  name?: string;
  order?: number;
  probability?: number;
  isClosedWon?: boolean;
  isClosedLost?: boolean;
  color?: string;
  rottenDays?: number;
}

export interface CreateDealRequest {
  name: string;
  contactId?: string;
  companyId?: string;
  pipelineId: string;
  stageId: string;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: Date;
  ownerId?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  source?: string;
  priority?: DealPriority;
}

export interface UpdateDealRequest {
  name?: string;
  contactId?: string;
  companyId?: string;
  stageId?: string;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: Date;
  actualCloseDate?: Date;
  status?: DealStatus;
  lostReason?: string;
  wonReason?: string;
  ownerId?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  priority?: DealPriority;
}

export interface DealSearchRequest {
  query?: string;
  pipelineId?: string;
  stageId?: string;
  status?: DealStatus[];
  ownerId?: string[];
  contactId?: string;
  companyId?: string;
  valueMin?: number;
  valueMax?: number;
  priority?: DealPriority[];
  tags?: string[];
  expectedCloseBefore?: Date;
  expectedCloseAfter?: Date;
  createdAfter?: Date;
  createdBefore?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface DealSearchResponse {
  deals: Deal[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// COMPANY REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateCompanyRequest {
  name: string;
  domain?: string;
  industry?: string;
  size?: CompanySize;
  revenue?: number;
  currency?: string;
  website?: string;
  phone?: string;
  address?: ContactAddress;
  description?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  ownerId?: string;
  parentCompanyId?: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  domain?: string;
  industry?: string;
  size?: CompanySize;
  revenue?: number;
  currency?: string;
  website?: string;
  phone?: string;
  address?: ContactAddress;
  description?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  ownerId?: string;
  parentCompanyId?: string;
}

export interface CompanySearchRequest {
  query?: string;
  industry?: string[];
  size?: CompanySize[];
  ownerId?: string[];
  tags?: string[];
  revenueMin?: number;
  revenueMax?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CompanySearchResponse {
  companies: Company[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// TASK REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateTaskRequest {
  title: string;
  description?: string;
  type: TaskType;
  priority?: ActivityPriority;
  dueDate?: Date;
  assignedTo?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  opportunityId?: string;
  reminderAt?: Date;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
  customFields?: Record<string, any>;
  tags?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  type?: TaskType;
  priority?: ActivityPriority;
  status?: TaskStatus;
  dueDate?: Date;
  completedAt?: Date;
  assignedTo?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  opportunityId?: string;
  reminderAt?: Date;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
  customFields?: Record<string, any>;
  tags?: string[];
}

export interface TaskSearchRequest {
  query?: string;
  type?: TaskType[];
  status?: TaskStatus[];
  priority?: ActivityPriority[];
  assignedTo?: string[];
  contactId?: string;
  companyId?: string;
  dealId?: string;
  opportunityId?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  tags?: string[];
  isOverdue?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TaskSearchResponse {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// MEETING REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateMeetingRequest {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  meetingUrl?: string;
  attendees: CreateMeetingAttendeeRequest[];
  contactIds?: string[];
  companyIds?: string[];
  dealId?: string;
  opportunityId?: string;
}

export interface CreateMeetingAttendeeRequest {
  email: string;
  name?: string;
  isOrganizer?: boolean;
}

export interface UpdateMeetingRequest {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  meetingUrl?: string;
  attendees?: UpdateMeetingAttendeeRequest[];
  contactIds?: string[];
  companyIds?: string[];
  dealId?: string;
  opportunityId?: string;
  status?: MeetingStatus;
  outcome?: string;
  followUpTasks?: string[];
}

export interface UpdateMeetingAttendeeRequest {
  email: string;
  name?: string;
  status?: AttendeeStatus;
  isOrganizer?: boolean;
}

// ============================================================================
// CUSTOM FIELD REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateCustomFieldRequest {
  name: string;
  label: string;
  type: CustomFieldType;
  entityType: CustomFieldEntity;
  options?: CreateCustomFieldOptionRequest[];
  validation?: CustomFieldValidation;
  isRequired?: boolean;
  isUnique?: boolean;
  isSearchable?: boolean;
  defaultValue?: any;
  helpText?: string;
  order?: number;
}

export interface CreateCustomFieldOptionRequest {
  value: string;
  label: string;
  color?: string;
  order: number;
}

export interface UpdateCustomFieldRequest {
  name?: string;
  label?: string;
  options?: UpdateCustomFieldOptionRequest[];
  validation?: CustomFieldValidation;
  isRequired?: boolean;
  isUnique?: boolean;
  isSearchable?: boolean;
  defaultValue?: any;
  helpText?: string;
  order?: number;
  isActive?: boolean;
}

export interface UpdateCustomFieldOptionRequest {
  value: string;
  label: string;
  color?: string;
  order: number;
  isActive?: boolean;
}

// ============================================================================
// OPPORTUNITY REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateOpportunityRequest {
  name: string;
  contactId: string;
  companyId?: string;
  dealId?: string;
  value: number;
  currency?: string;
  probability?: number;
  stage?: OpportunityStage;
  source?: string;
  description?: string;
  expectedCloseDate?: Date;
  ownerId?: string;
  customFields?: Record<string, any>;
  tags?: string[];
}

export interface UpdateOpportunityRequest {
  name?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: OpportunityStage;
  source?: string;
  description?: string;
  expectedCloseDate?: Date;
  actualCloseDate?: Date;
  ownerId?: string;
  customFields?: Record<string, any>;
  tags?: string[];
}

export interface OpportunitySearchRequest {
  query?: string;
  stage?: OpportunityStage[];
  ownerId?: string[];
  contactId?: string;
  companyId?: string;
  dealId?: string;
  valueMin?: number;
  valueMax?: number;
  probabilityMin?: number;
  probabilityMax?: number;
  tags?: string[];
  expectedCloseBefore?: Date;
  expectedCloseAfter?: Date;
  createdAfter?: Date;
  createdBefore?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface OpportunitySearchResponse {
  opportunities: Opportunity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface DatabaseContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  job_title?: string;
  phone?: string;
  website?: string;
  address?: Record<string, any>;
  custom_fields: Record<string, any>;
  tags: string[];
  lead_score: number;
  lifecycle: string;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  preferences: Record<string, any>;
  consent: Record<string, any>;
  last_activity_at?: Date;
  owner_id?: string;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseSegment {
  id: string;
  name: string;
  description?: string;
  conditions: Record<string, any>;
  contact_count: number;
  is_auto_updating: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseEngagementEvent {
  id: string;
  contact_id: string;
  event_type: string;
  event_name?: string;
  timestamp: Date;
  metadata: Record<string, any>;
  score: number;
  newsletter_id?: string;
  campaign_id?: string;
  workflow_id?: string;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class CRMError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CRMError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends CRMError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class ConflictError extends CRMError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class DuplicateContactError extends ConflictError {
  constructor(email: string) {
    super(`Contact with email ${email} already exists`);
  }
}

export class UnauthorizedError extends CRMError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface JobStatus {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
