import {
  ContactLifecycle,
  EngagementEventType,
  SegmentOperator,
  ValidationError,
} from '@/types';
import { z } from 'zod';

// Base validation schemas
export const emailSchema = z.string().email('Invalid email format');
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone format')
  .optional();
export const urlSchema = z.string().url('Invalid URL format').optional();

// Contact validation schemas
export const contactLifecycleSchema = z.enum([
  'subscriber',
  'lead',
  'marketing_qualified_lead',
  'sales_qualified_lead',
  'opportunity',
  'customer',
  'evangelist',
] as const);

export const contactAddressSchema = z
  .object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  })
  .optional();

export const contactPreferencesSchema = z.object({
  emailFrequency: z.enum(['daily', 'weekly', 'monthly', 'never']),
  contentTypes: z.array(z.string()),
  communicationChannels: z.array(z.string()),
  timezone: z.string(),
  language: z.string(),
  optInDate: z.date().optional(),
  optOutDate: z.date().optional(),
});

export const contactConsentSchema = z.object({
  marketing: z.boolean(),
  analytics: z.boolean(),
  thirdParty: z.boolean(),
  consentDate: z.date(),
  consentSource: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export const createContactSchema = z.object({
  email: emailSchema,
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  company: z.string().max(255).optional(),
  jobTitle: z.string().max(255).optional(),
  phone: phoneSchema,
  website: urlSchema,
  address: contactAddressSchema,
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  lifecycle: contactLifecycleSchema.optional(),
  source: z.string().max(100).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  preferences: contactPreferencesSchema.partial().optional(),
  consent: contactConsentSchema.partial().optional(),
  ownerId: uuidSchema.optional(),
});

export const updateContactSchema = createContactSchema
  .partial()
  .omit({ email: true });

// Segmentation validation schemas
export const segmentOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'in',
  'not_in',
  'is_empty',
  'is_not_empty',
  'date_before',
  'date_after',
  'date_between',
] as const);

export const segmentConditionSchema = z.object({
  field: z.string().min(1),
  operator: segmentOperatorSchema,
  value: z.any(),
  logicalOperator: z.enum(['AND', 'OR']).optional(),
  group: z.string().optional(),
});

export const createSegmentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  conditions: z.array(segmentConditionSchema).min(1).max(20),
  isAutoUpdating: z.boolean().optional(),
});

export const updateSegmentSchema = createSegmentSchema.partial();

// Contact search validation
export const contactFilterSchema = z.object({
  field: z.string().min(1),
  operator: segmentOperatorSchema,
  value: z.any(),
});

export const contactSearchSchema = z.object({
  query: z.string().optional(),
  filters: z.array(contactFilterSchema).optional(),
  segments: z.array(uuidSchema).optional(),
  tags: z.array(z.string()).optional(),
  lifecycle: z.array(contactLifecycleSchema).optional(),
  source: z.array(z.string()).optional(),
  ownerId: z.array(uuidSchema).optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  lastActivityAfter: z.coerce.date().optional(),
  lastActivityBefore: z.coerce.date().optional(),
  leadScoreMin: z.number().min(0).optional(),
  leadScoreMax: z.number().min(0).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(1000).optional(),
});

// Lead scoring validation schemas
export const engagementEventTypeSchema = z.enum([
  'email_open',
  'email_click',
  'email_bounce',
  'email_unsubscribe',
  'website_visit',
  'form_submit',
  'download',
  'purchase',
  'signup',
  'login',
  'page_view',
  'video_watch',
  'social_share',
  'survey_response',
  'webinar_attend',
  'demo_request',
  'trial_start',
  'subscription_upgrade',
  'support_ticket',
  'referral',
  'review_left',
] as const);

export const scoringConditionSchema = z.object({
  field: z.string().min(1),
  operator: segmentOperatorSchema,
  value: z.any(),
});

export const scoringTriggerSchema = z.object({
  eventType: engagementEventTypeSchema,
  conditions: z.array(scoringConditionSchema).optional(),
  frequency: z.enum(['once', 'daily', 'weekly', 'unlimited']),
  maxPoints: z.number().optional(),
});

export const createLeadScoringRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  trigger: scoringTriggerSchema,
  points: z.number().int().min(-1000).max(1000),
  decayRate: z.number().min(0).max(1).optional(),
});

export const updateLeadScoringRuleSchema =
  createLeadScoringRuleSchema.partial();

// Contact activity validation schemas
export const contactActivityTypeSchema = z.enum([
  'note',
  'call',
  'email',
  'meeting',
  'task',
  'deal',
] as const);
export const activityPrioritySchema = z.enum([
  'low',
  'medium',
  'high',
  'urgent',
] as const);
export const activityStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'cancelled',
] as const);

export const createContactActivitySchema = z.object({
  contactId: uuidSchema,
  type: contactActivityTypeSchema,
  subject: z.string().max(255).optional(),
  content: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  priority: activityPrioritySchema.optional(),
  assignedTo: uuidSchema.optional(),
});

export const updateContactActivitySchema = createContactActivitySchema
  .partial()
  .omit({ contactId: true });

// Engagement event validation
export const createEngagementEventSchema = z.object({
  contactId: uuidSchema,
  eventType: engagementEventTypeSchema,
  eventName: z.string().max(255).optional(),
  timestamp: z.coerce.date().optional(),
  metadata: z.record(z.any()).optional(),
  score: z.number().int().optional(),
  newsletterId: uuidSchema.optional(),
  campaignId: uuidSchema.optional(),
  workflowId: uuidSchema.optional(),
  sessionId: z.string().max(255).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

// Bulk operations validation
export const bulkOperationSchema = z.object({
  type: z.enum([
    'update',
    'delete',
    'add_tags',
    'remove_tags',
    'change_lifecycle',
    'assign_owner',
  ]),
  params: z.record(z.any()),
});

export const bulkOperationRequestSchema = z.object({
  contactIds: z.array(uuidSchema).min(1).max(1000),
  operation: bulkOperationSchema,
  data: z.record(z.any()).optional(),
});

// Import/Export validation schemas
export const fieldMappingSchema = z.record(z.string());

export const importOptionsSchema = z.object({
  skipDuplicates: z.boolean(),
  updateExisting: z.boolean(),
  duplicateField: z.string(),
  defaultLifecycle: contactLifecycleSchema.optional(),
  defaultSource: z.string().optional(),
  defaultTags: z.array(z.string()).optional(),
});

export const exportFormatSchema = z.enum(['csv', 'xlsx', 'json'] as const);

export const exportFilterSchema = z.object({
  field: z.string().min(1),
  operator: segmentOperatorSchema,
  value: z.any(),
});

export const createExportJobSchema = z.object({
  format: exportFormatSchema,
  filters: z.array(exportFilterSchema).optional(),
  fields: z.array(z.string()).min(1),
  fileName: z.string().min(1).max(255).optional(),
});

// Enrichment validation schemas
export const enrichmentProviderSchema = z.enum([
  'clearbit',
  'fullcontact',
  'hunter',
  'pipl',
  'internal',
] as const);

export const enrichmentTriggerSchema = z.object({
  event: z.enum(['contact_created', 'contact_updated', 'manual', 'scheduled']),
  conditions: z.array(segmentConditionSchema).optional(),
});

export const createEnrichmentRuleSchema = z.object({
  name: z.string().min(1).max(255),
  provider: enrichmentProviderSchema,
  triggers: z.array(enrichmentTriggerSchema).min(1),
  fields: z.array(z.string()).min(1),
  priority: z.number().int().min(1).max(10),
  costLimit: z.number().min(0).optional(),
});

export const updateEnrichmentRuleSchema = createEnrichmentRuleSchema.partial();

// Duplicate detection validation schemas
export const duplicateFieldSchema = z.object({
  field: z.string().min(1),
  weight: z.number().min(0).max(1),
  matchType: z.enum(['exact', 'fuzzy', 'phonetic', 'domain']),
  threshold: z.number().min(0).max(1).optional(),
});

export const createDuplicateRuleSchema = z.object({
  name: z.string().min(1).max(255),
  fields: z.array(duplicateFieldSchema).min(1),
  threshold: z.number().min(0).max(1),
  autoMerge: z.boolean(),
});

export const updateDuplicateRuleSchema = createDuplicateRuleSchema.partial();

// Pagination validation
export const paginationSchema = z.object({
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(1000).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Validation helper functions
export function validateEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

export function validateUUID(uuid: string): boolean {
  return uuidSchema.safeParse(uuid).success;
}

export function validateContactLifecycle(
  lifecycle: string
): lifecycle is ContactLifecycle {
  return contactLifecycleSchema.safeParse(lifecycle).success;
}

export function validateSegmentOperator(
  operator: string
): operator is SegmentOperator {
  return segmentOperatorSchema.safeParse(operator).success;
}

export function validateEngagementEventType(
  eventType: string
): eventType is EngagementEventType {
  return engagementEventTypeSchema.safeParse(eventType).success;
}

export function sanitizeString(input: string, maxLength = 255): string {
  return input.trim().substring(0, maxLength);
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function sanitizeTags(tags: string[]): string[] {
  return tags
    .map(tag => tag.trim().toLowerCase())
    .filter(tag => tag.length > 0)
    .filter((tag, index, array) => array.indexOf(tag) === index); // Remove duplicates
}

export function validateCustomFields(
  customFields: Record<string, any>
): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(customFields)) {
    // Sanitize field names
    const sanitizedKey = key
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');

    if (sanitizedKey.length > 0) {
      // Basic value sanitization
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeString(value, 1000);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      } else if (value instanceof Date) {
        sanitized[sanitizedKey] = value.toISOString();
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.slice(0, 100); // Limit array size
      } else if (typeof value === 'object' && value !== null) {
        sanitized[sanitizedKey] = JSON.stringify(value).substring(0, 5000);
      }
    }
  }

  return sanitized;
}

// Generic validation function
export function validateSchema<T>(data: unknown, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(
        err => `${err.path.join('.')}: ${err.message}`
      );
      throw new ValidationError(`Validation failed: ${messages.join(', ')}`);
    }
    throw error;
  }
}

// Specific validation functions
export const validateCreateContact = (data: unknown) =>
  validateSchema(data, createContactSchema);
export const validateUpdateContact = (data: unknown) =>
  validateSchema(data, updateContactSchema);
export const validateCreateSegment = (data: unknown) =>
  validateSchema(data, createSegmentSchema);
export const validateUpdateSegment = (data: unknown) =>
  validateSchema(data, updateSegmentSchema);
export const validateBulkOperation = (data: unknown) =>
  validateSchema(data, bulkOperationRequestSchema);
export const validateContactSearch = (data: unknown) =>
  validateSchema(data, contactSearchSchema);
export const validateCreateLeadScoringRule = (data: unknown) =>
  validateSchema(data, createLeadScoringRuleSchema);
export const validateUpdateLeadScoringRule = (data: unknown) =>
  validateSchema(data, updateLeadScoringRuleSchema);
export const validateCreateContactActivity = (data: unknown) =>
  validateSchema(data, createContactActivitySchema);
export const validateUpdateContactActivity = (data: unknown) =>
  validateSchema(data, updateContactActivitySchema);
export const validateCreateEngagementEvent = (data: unknown) =>
  validateSchema(data, createEngagementEventSchema);

// ============================================================================
// ADVANCED CRM VALIDATION SCHEMAS
// ============================================================================

// Sales Pipeline validation schemas
export const pipelineStageSchema = z.object({
  name: z.string().min(1).max(255),
  order: z.number().int().min(1).max(20),
  probability: z.number().min(0).max(100),
  isClosedWon: z.boolean().optional(),
  isClosedLost: z.boolean().optional(),
  color: z.string().max(7).optional(), // Hex color code
  rottenDays: z.number().int().min(1).optional(),
});

export const createSalesPipelineSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  stages: z.array(pipelineStageSchema).min(1).max(20),
  isDefault: z.boolean().optional(),
});

export const updatePipelineStageSchema = pipelineStageSchema.extend({
  id: uuidSchema.optional(),
});

export const updateSalesPipelineSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  stages: z.array(updatePipelineStageSchema).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// Deal validation schemas
export const dealStatusSchema = z.enum(['open', 'won', 'lost'] as const);
export const dealPrioritySchema = z.enum([
  'low',
  'medium',
  'high',
  'urgent',
] as const);

export const createDealSchema = z.object({
  name: z.string().min(1).max(255),
  contactId: uuidSchema.optional(),
  companyId: uuidSchema.optional(),
  pipelineId: uuidSchema,
  stageId: uuidSchema,
  value: z.number().min(0).optional(),
  currency: z.string().length(3).optional(), // ISO currency code
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.coerce.date().optional(),
  ownerId: uuidSchema.optional(),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().max(100).optional(),
  priority: dealPrioritySchema.optional(),
});

export const updateDealSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contactId: uuidSchema.optional(),
  companyId: uuidSchema.optional(),
  stageId: uuidSchema.optional(),
  value: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.coerce.date().optional(),
  actualCloseDate: z.coerce.date().optional(),
  status: dealStatusSchema.optional(),
  lostReason: z.string().max(500).optional(),
  wonReason: z.string().max(500).optional(),
  ownerId: uuidSchema.optional(),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  priority: dealPrioritySchema.optional(),
});

// Company validation schemas
export const companySizeSchema = z.enum([
  'startup',
  'small',
  'medium',
  'large',
  'enterprise',
] as const);

export const createCompanySchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  size: companySizeSchema.optional(),
  revenue: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  website: urlSchema,
  phone: phoneSchema,
  address: contactAddressSchema,
  description: z.string().max(2000).optional(),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  ownerId: uuidSchema.optional(),
  parentCompanyId: uuidSchema.optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

// Task validation schemas
export const taskTypeSchema = z.enum([
  'call',
  'email',
  'meeting',
  'follow_up',
  'demo',
  'proposal',
  'contract',
  'other',
] as const);
export const taskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'overdue',
] as const);

export const recurringPatternSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).max(365),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  endDate: z.coerce.date().optional(),
  occurrences: z.number().int().min(1).optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: taskTypeSchema,
  priority: activityPrioritySchema.optional(),
  dueDate: z.coerce.date().optional(),
  assignedTo: uuidSchema.optional(),
  contactId: uuidSchema.optional(),
  companyId: uuidSchema.optional(),
  dealId: uuidSchema.optional(),
  opportunityId: uuidSchema.optional(),
  reminderAt: z.coerce.date().optional(),
  isRecurring: z.boolean().optional(),
  recurringPattern: recurringPatternSchema.optional(),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  type: taskTypeSchema.optional(),
  priority: activityPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
  dueDate: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  assignedTo: uuidSchema.optional(),
  contactId: uuidSchema.optional(),
  companyId: uuidSchema.optional(),
  dealId: uuidSchema.optional(),
  opportunityId: uuidSchema.optional(),
  reminderAt: z.coerce.date().optional(),
  isRecurring: z.boolean().optional(),
  recurringPattern: recurringPatternSchema.optional(),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

// Custom Field validation schemas
export const customFieldTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'select',
  'multiselect',
  'url',
  'email',
  'phone',
  'currency',
  'percentage',
] as const);

export const customFieldEntitySchema = z.enum([
  'contact',
  'company',
  'deal',
  'opportunity',
  'task',
] as const);

export const customFieldOptionSchema = z.object({
  value: z.string().min(1).max(255),
  label: z.string().min(1).max(255),
  color: z.string().max(7).optional(),
  order: z.number().int().min(0),
});

export const customFieldValidationSchema = z.object({
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  pattern: z.string().optional(),
  required: z.boolean().optional(),
});

export const createCustomFieldSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_]*$/,
      'Field name must start with a letter and contain only letters, numbers, and underscores'
    ),
  label: z.string().min(1).max(255),
  type: customFieldTypeSchema,
  entityType: customFieldEntitySchema,
  options: z.array(customFieldOptionSchema).optional(),
  validation: customFieldValidationSchema.optional(),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  defaultValue: z.any().optional(),
  helpText: z.string().max(500).optional(),
  order: z.number().int().min(0).optional(),
});

export const updateCustomFieldOptionSchema = customFieldOptionSchema.extend({
  isActive: z.boolean().optional(),
});

export const updateCustomFieldSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .optional(),
  label: z.string().min(1).max(255).optional(),
  options: z.array(updateCustomFieldOptionSchema).optional(),
  validation: customFieldValidationSchema.optional(),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  defaultValue: z.any().optional(),
  helpText: z.string().max(500).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// Meeting validation schemas
export const meetingStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
] as const);
export const attendeeStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'tentative',
] as const);

export const meetingAttendeeSchema = z.object({
  email: emailSchema,
  name: z.string().max(255).optional(),
  isOrganizer: z.boolean().optional(),
});

export const createMeetingSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  location: z.string().max(500).optional(),
  meetingUrl: urlSchema,
  attendees: z.array(meetingAttendeeSchema).min(1),
  contactIds: z.array(uuidSchema).optional(),
  companyIds: z.array(uuidSchema).optional(),
  dealId: uuidSchema.optional(),
  opportunityId: uuidSchema.optional(),
});

export const updateMeetingAttendeeSchema = meetingAttendeeSchema.extend({
  status: attendeeStatusSchema.optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  location: z.string().max(500).optional(),
  meetingUrl: urlSchema,
  attendees: z.array(updateMeetingAttendeeSchema).optional(),
  contactIds: z.array(uuidSchema).optional(),
  companyIds: z.array(uuidSchema).optional(),
  dealId: uuidSchema.optional(),
  opportunityId: uuidSchema.optional(),
  status: meetingStatusSchema.optional(),
  outcome: z.string().max(2000).optional(),
  followUpTasks: z.array(uuidSchema).optional(),
});

// Opportunity validation schemas
export const opportunityStageSchema = z.enum([
  'identified',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const);

export const createOpportunitySchema = z.object({
  name: z.string().min(1).max(255),
  contactId: uuidSchema,
  companyId: uuidSchema.optional(),
  dealId: uuidSchema.optional(),
  value: z.number().min(0),
  currency: z.string().length(3).optional(),
  probability: z.number().min(0).max(100).optional(),
  stage: opportunityStageSchema.optional(),
  source: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  expectedCloseDate: z.coerce.date().optional(),
  ownerId: uuidSchema.optional(),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateOpportunitySchema = createOpportunitySchema
  .partial()
  .omit({ contactId: true });

// Advanced validation functions
export const validateCreateSalesPipeline = (data: unknown) =>
  validateSchema(data, createSalesPipelineSchema);
export const validateUpdateSalesPipeline = (data: unknown) =>
  validateSchema(data, updateSalesPipelineSchema);
export const validateCreateDeal = (data: unknown) =>
  validateSchema(data, createDealSchema);
export const validateUpdateDeal = (data: unknown) =>
  validateSchema(data, updateDealSchema);
export const validateCreateCompany = (data: unknown) =>
  validateSchema(data, createCompanySchema);
export const validateUpdateCompany = (data: unknown) =>
  validateSchema(data, updateCompanySchema);
export const validateCreateTask = (data: unknown) =>
  validateSchema(data, createTaskSchema);
export const validateUpdateTask = (data: unknown) =>
  validateSchema(data, updateTaskSchema);
export const validateCreateCustomField = (data: unknown) =>
  validateSchema(data, createCustomFieldSchema);
export const validateUpdateCustomField = (data: unknown) =>
  validateSchema(data, updateCustomFieldSchema);
export const validateCreateMeeting = (data: unknown) =>
  validateSchema(data, createMeetingSchema);
export const validateUpdateMeeting = (data: unknown) =>
  validateSchema(data, updateMeetingSchema);
export const validateCreateOpportunity = (data: unknown) =>
  validateSchema(data, createOpportunitySchema);
export const validateUpdateOpportunity = (data: unknown) =>
  validateSchema(data, updateOpportunitySchema);
