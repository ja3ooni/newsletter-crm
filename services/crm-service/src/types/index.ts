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

export type ContactActivityType = 'note' | 'call' | 'email' | 'meeting' | 'task' | 'deal';
export type ActivityPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ActivityStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

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
}

export interface Deal {
  id: string;
  name: string;
  contactId?: string;
  pipelineId: string;
  stage: string;
  value?: number;
  currency: string;
  probability: number;
  expectedCloseDate?: Date;
  actualCloseDate?: Date;
  status: DealStatus;
  lostReason?: string;
  ownerId?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DealStatus = 'open' | 'won' | 'lost';

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

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

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
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

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

export type EnrichmentProvider = 'clearbit' | 'fullcontact' | 'hunter' | 'pipl' | 'internal';
export type EnrichmentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

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

export type DuplicateStatus = 'pending' | 'merged' | 'ignored' | 'false_positive';

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
  type: 'update' | 'delete' | 'add_tags' | 'remove_tags' | 'change_lifecycle' | 'assign_owner';
  params: Record<string, any>;
}

export interface BulkOperationResponse {
  jobId: string;
  totalRecords: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
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
