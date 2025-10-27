import {
  CampaignTrigger,
  CreateDripCampaignRequest,
  CreateWorkflowRequest,
  DripEmail,
  StepConfig,
  TriggerCondition,
  TriggerWorkflowRequest,
  UpdateDripCampaignRequest,
  UpdateWorkflowRequest,
  WorkflowStep,
  WorkflowTrigger,
} from '@/types';
import { z } from 'zod';

// Base schemas
const triggerConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    'equals',
    'contains',
    'greater_than',
    'less_than',
    'in',
    'not_in',
  ]),
  value: z.any(),
  logicalOperator: z.enum(['AND', 'OR']).optional(),
}) satisfies z.ZodType<TriggerCondition>;

const stepConfigSchema = z
  .object({
    // Email step config
    templateId: z.string().optional(),
    subject: z.string().optional(),
    content: z.string().optional(),
    // Wait step config
    duration: z.number().positive().optional(),
    unit: z.enum(['minutes', 'hours', 'days', 'weeks']).optional(),
    // Condition step config
    conditions: z.array(triggerConditionSchema).optional(),
    // Webhook step config
    url: z.string().url().optional(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
    headers: z.record(z.string()).optional(),
    payload: z.record(z.any()).optional(),
    // Tag step config
    action: z.enum(['add', 'remove']).optional(),
    tags: z.array(z.string()).optional(),
    // Score step config
    points: z.number().optional(),
    reason: z.string().optional(),
    // Segment step config
    segmentId: z.string().optional(),
    segmentAction: z.enum(['add', 'remove']).optional(),
  })
  .passthrough() satisfies z.ZodType<StepConfig>;

const workflowTriggerSchema = z.object({
  type: z.enum(['event', 'schedule', 'manual', 'api']),
  conditions: z.array(triggerConditionSchema),
  settings: z.record(z.any()),
}) satisfies z.ZodType<WorkflowTrigger>;

const workflowStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'email',
    'wait',
    'condition',
    'webhook',
    'tag',
    'score',
    'segment',
  ]),
  config: stepConfigSchema,
  nextSteps: z.array(z.string()),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
}) satisfies z.ZodType<WorkflowStep>;

const campaignTriggerSchema = z.object({
  type: z.enum([
    'signup',
    'tag_added',
    'segment_entry',
    'behavior',
    'date',
    'manual',
  ]),
  conditions: z.array(triggerConditionSchema),
  settings: z.record(z.any()),
}) satisfies z.ZodType<CampaignTrigger>;

const dripEmailSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  preheader: z.string(),
  content: z.string().min(1),
  templateId: z.string().optional(),
  delay: z.number().min(0),
  conditions: z
    .array(
      z.object({
        type: z.enum(['engagement', 'behavior', 'attribute', 'time']),
        field: z.string(),
        operator: z.string(),
        value: z.any(),
      })
    )
    .optional(),
  abTest: z.any().optional(), // ABTest schema would be defined separately
  order: z.number().min(0),
}) satisfies z.ZodType<DripEmail>;

// Workflow validation schemas
export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000),
  trigger: workflowTriggerSchema,
  steps: z.array(workflowStepSchema).min(1),
}) satisfies z.ZodType<CreateWorkflowRequest>;

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  trigger: workflowTriggerSchema.optional(),
  steps: z.array(workflowStepSchema).min(1).optional(),
  status: z.enum(['active', 'paused', 'draft']).optional(),
}) satisfies z.ZodType<UpdateWorkflowRequest>;

export const triggerWorkflowSchema = z.object({
  contactId: z.string().uuid(),
  metadata: z.record(z.any()).optional(),
}) satisfies z.ZodType<TriggerWorkflowRequest>;

// Drip campaign validation schemas
export const createDripCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000),
  emails: z.array(dripEmailSchema.omit({ id: true })).min(1),
  trigger: campaignTriggerSchema,
  targetSegments: z.array(z.string().uuid()),
}) satisfies z.ZodType<CreateDripCampaignRequest>;

export const updateDripCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  emails: z.array(dripEmailSchema).optional(),
  trigger: campaignTriggerSchema.optional(),
  status: z.enum(['active', 'paused', 'completed', 'draft']).optional(),
  targetSegments: z.array(z.string().uuid()).optional(),
}) satisfies z.ZodType<UpdateDripCampaignRequest>;

// Pagination and filtering schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const filterSchema = z.object({
  status: z.array(z.string()).optional(),
  createdBy: z.string().uuid().optional(),
  dateRange: z
    .object({
      start: z.coerce.date(),
      end: z.coerce.date(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
});

// ID validation schemas
export const uuidSchema = z.string().uuid();
export const workflowIdSchema = uuidSchema;
export const campaignIdSchema = uuidSchema;
export const executionIdSchema = uuidSchema;

// Step validation by type
export const validateStepConfig = (
  stepType: string,
  config: StepConfig
): boolean => {
  switch (stepType) {
    case 'email':
      return !!(config.subject && config.content);
    case 'wait':
      return !!(config.duration && config.unit);
    case 'condition':
      return !!(config.conditions && config.conditions.length > 0);
    case 'webhook':
      return !!(config.url && config.method);
    case 'tag':
      return !!(config.action && config.tags && config.tags.length > 0);
    case 'score':
      return typeof config.points === 'number';
    case 'segment':
      return !!(config.segmentId && config.segmentAction);
    default:
      return false;
  }
};

// Workflow validation helpers
export const validateWorkflowSteps = (steps: WorkflowStep[]): string[] => {
  const errors: string[] = [];
  const stepIds = new Set<string>();

  for (const step of steps) {
    // Check for duplicate step IDs
    if (stepIds.has(step.id)) {
      errors.push(`Duplicate step ID: ${step.id}`);
    }
    stepIds.add(step.id);

    // Validate step configuration
    if (!validateStepConfig(step.type, step.config)) {
      errors.push(
        `Invalid configuration for step ${step.id} of type ${step.type}`
      );
    }

    // Validate next steps exist
    for (const nextStepId of step.nextSteps) {
      if (!steps.find(s => s.id === nextStepId)) {
        errors.push(
          `Step ${step.id} references non-existent next step: ${nextStepId}`
        );
      }
    }
  }

  return errors;
};

// Email validation helpers
export const validateEmailSequence = (emails: DripEmail[]): string[] => {
  const errors: string[] = [];

  // Check for proper ordering
  const sortedEmails = [...emails].sort((a, b) => a.order - b.order);

  for (let i = 0; i < sortedEmails.length; i++) {
    if (sortedEmails[i]?.order !== i) {
      errors.push(
        `Email order should be sequential starting from 0, found order ${sortedEmails[i]?.order} at position ${i}`
      );
    }
  }

  // Check for minimum delay between emails
  for (let i = 1; i < sortedEmails.length; i++) {
    const currentEmail = sortedEmails[i];
    const previousEmail = sortedEmails[i - 1];

    if (currentEmail && previousEmail && currentEmail.delay < 1) {
      errors.push(
        `Email ${currentEmail.id} should have a delay of at least 1 hour`
      );
    }
  }

  return errors;
};

export default {
  createWorkflowSchema,
  updateWorkflowSchema,
  triggerWorkflowSchema,
  createDripCampaignSchema,
  updateDripCampaignSchema,
  paginationSchema,
  filterSchema,
  uuidSchema,
  validateStepConfig,
  validateWorkflowSteps,
  validateEmailSequence,
};
