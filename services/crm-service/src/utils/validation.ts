import {
    ContactLifecycle,
    EngagementEventType,
    SegmentOperator
} from '@/types';
import { z } from 'zod';

// Base validation schemas
export const emailSchema = z.string().email('Invalid email format');
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const phoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone format').optional();
export const urlSchema = z.string().url('Invalid URL format').optional();

// Contact validation schemas
export const contactLifecycleSchema = z.enum([
  'subscriber',
  'lead',
  'marketing_qualified_lead',
  'sales_qualified_lead',
  'opportunity',
  'customer',
  'evangelist'
] as const);

export const contactAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
}).optional();

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

export const updateContactSchema = createContactSchema.partial().omit({ email: true });

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
  'date_between'
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
  'review_left'
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

export const updateLeadScoringRuleSchema = createLeadScoringRuleSchema.partial();

// Contact activity validation schemas
export const contactActivityTypeSchema = z.enum(['note', 'call', 'email', 'meeting', 'task', 'deal'] as const);
export const activityPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'] as const);
export const activityStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled'] as const);

export const createContactActivitySchema = z.object({
  contactId: uuidSchema,
  type: contactActivityTypeSchema,
  subject: z.string().max(255).optional(),
  content: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  priority: activityPrioritySchema.optional(),
  assignedTo: uuidSchema.optional(),
});

export const updateContactActivitySchema = createContactActivitySchema.partial().omit({ contactId: true });

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
  type: z.enum(['update', 'delete', 'add_tags', 'remove_tags', 'change_lifecycle', 'assign_owner']),
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
export const enrichmentProviderSchema = z.enum(['clearbit', 'fullcontact', 'hunter', 'pipl', 'internal'] as const);

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

export function validateContactLifecycle(lifecycle: string): lifecycle is ContactLifecycle {
  return contactLifecycleSchema.safeParse(lifecycle).success;
}

export function validateSegmentOperator(operator: string): operator is SegmentOperator {
  return segmentOperatorSchema.safeParse(operator).success;
}

export function validateEngagementEventType(eventType: string): eventType is EngagementEventType {
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

export function validateCustomFields(customFields: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(customFields)) {
    // Sanitize field names
    const sanitizedKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

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
// Validation error class
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Generic validation function
export function validateSchema<T>(data: unknown, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new ValidationError(`Validation failed: ${messages.join(', ')}`);
    }
    throw error;
  }
}

// Specific validation functions
export const validateCreateContact = (data: unknown) => validateSchema(data, createContactSchema);
export const validateUpdateContact = (data: unknown) => validateSchema(data, updateContactSchema);
export const validateCreateSegment = (data: unknown) => validateSchema(data, createSegmentSchema);
export const validateUpdateSegment = (data: unknown) => validateSchema(data, updateSegmentSchema);
export const validateBulkOperation = (data: unknown) => validateSchema(data, bulkOperationRequestSchema);
export const validateContactSearch = (data: unknown) => validateSchema(data, contactSearchSchema);
export const validateCreateLeadScoringRule = (data: unknown) => validateSchema(data, createLeadScoringRuleSchema);
export const validateUpdateLeadScoringRule = (data: unknown) => validateSchema(data, updateLeadScoringRuleSchema);
export const validateCreateContactActivity = (data: unknown) => validateSchema(data, createContactActivitySchema);
export const validateUpdateContactActivity = (data: unknown) => validateSchema(data, updateContactActivitySchema);
export const validateCreateEngagementEvent = (data: unknown) => validateSchema(data, createEngagementEventSchema);
