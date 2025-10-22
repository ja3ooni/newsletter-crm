import { z } from 'zod'

// Base schemas
export const uuidSchema = z.string().uuid()
export const emailSchema = z.string().email()
export const urlSchema = z.string().url()
export const dateSchema = z.coerce.date()

// Newsletter schemas
export const createNewsletterSchema = z.object({
  title: z.string().min(1).max(255),
  templateId: z.string().uuid().optional(),
  sections: z.array(z.string()).min(1).max(10),
  segments: z.array(z.string().uuid()).min(1),
  personalization: z.object({
    enabled: z.boolean().default(true),
    rules: z.array(z.object({
      id: z.string().uuid(),
      condition: z.string(),
      action: z.string(),
      priority: z.number().int().min(1),
    })).default([]),
    fallbackContent: z.string().default(''),
  }).optional(),
  deliverabilitySettings: z.object({
    fromName: z.string().min(1).max(100),
    fromEmail: emailSchema,
    replyTo: emailSchema,
    trackOpens: z.boolean().default(true),
    trackClicks: z.boolean().default(true),
    unsubscribeLink: z.boolean().default(true),
    customHeaders: z.record(z.string()).default({}),
  }).optional(),
  scheduledAt: dateSchema.optional(),
  abTest: z.object({
    name: z.string().min(1).max(255),
    type: z.enum(['subject', 'content', 'send_time', 'template']),
    variants: z.array(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100),
      content: z.any(),
    })).min(2).max(5),
    trafficSplit: z.array(z.number().min(0).max(100)).min(2).max(5),
    winnerCriteria: z.enum(['open_rate', 'click_rate', 'conversion_rate']),
  }).optional(),
})

export const updateNewsletterSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.object({
    sections: z.array(z.object({
      id: z.string().uuid(),
      type: z.enum(['news', 'research', 'github', 'events', 'products', 'custom']),
      title: z.string().min(1).max(255),
      items: z.array(z.any()),
      order: z.number().int().min(0),
      isPersonalized: z.boolean().default(false),
      displayRules: z.array(z.object({
        condition: z.string(),
        action: z.enum(['show', 'hide', 'highlight']),
      })).optional(),
    })),
    personalization: z.any().optional(),
    metadata: z.any().optional(),
    dynamicContent: z.array(z.any()).optional(),
  }).optional(),
  status: z.enum(['draft', 'scheduled', 'sent', 'failed']).optional(),
  scheduledAt: dateSchema.optional(),
  personalization: z.object({
    enabled: z.boolean(),
    rules: z.array(z.any()),
    fallbackContent: z.string(),
  }).optional(),
  deliverabilitySettings: z.object({
    fromName: z.string().min(1).max(100),
    fromEmail: emailSchema,
    replyTo: emailSchema,
    trackOpens: z.boolean(),
    trackClicks: z.boolean(),
    unsubscribeLink: z.boolean(),
    customHeaders: z.record(z.string()),
  }).optional(),
})

export const generateNewsletterSchema = z.object({
  sections: z.array(z.string()).min(1).max(10),
  personalization: z.object({
    subscriberId: z.string().uuid(),
    preferences: z.record(z.any()).default({}),
    behaviorData: z.record(z.any()).default({}),
    demographics: z.record(z.any()).default({}),
  }).optional(),
  templateId: z.string().uuid().optional(),
  userId: z.string().uuid(),
})

// Template schemas
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['business', 'tech', 'creative', 'minimal']),
  html: z.string().min(1),
  css: z.string().optional(),
  variables: z.array(z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['text', 'image', 'color', 'boolean']),
    defaultValue: z.any(),
    description: z.string().max(500),
    required: z.boolean().default(false),
  })).default([]),
  previewImage: urlSchema.optional(),
  isPublic: z.boolean().default(false),
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.enum(['business', 'tech', 'creative', 'minimal']).optional(),
  html: z.string().min(1).optional(),
  css: z.string().optional(),
  variables: z.array(z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['text', 'image', 'color', 'boolean']),
    defaultValue: z.any(),
    description: z.string().max(500),
    required: z.boolean().default(false),
  })).optional(),
  previewImage: urlSchema.optional(),
  isPublic: z.boolean().optional(),
})

// Content Library schemas
export const createContentLibraryItemSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  type: z.enum(['article', 'block', 'template', 'image']),
  tags: z.array(z.string()).max(20).default([]),
  category: z.string().min(1).max(100),
  metadata: z.record(z.any()).default({}),
})

export const updateContentLibraryItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(['article', 'block', 'template', 'image']).optional(),
  tags: z.array(z.string()).max(20).optional(),
  category: z.string().min(1).max(100).optional(),
  status: z.enum(['draft', 'approved', 'archived']).optional(),
  metadata: z.record(z.any()).optional(),
})

// Content Block schemas
export const createContentBlockSchema = z.object({
  name: z.string().min(1).max(255),
  html: z.string().min(1),
  css: z.string().optional(),
  variables: z.array(z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['text', 'image', 'color', 'boolean']),
    defaultValue: z.any(),
    description: z.string().max(500),
    required: z.boolean().default(false),
  })).default([]),
  category: z.string().min(1).max(100),
  isReusable: z.boolean().default(true),
})

export const updateContentBlockSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  html: z.string().min(1).optional(),
  css: z.string().optional(),
  variables: z.array(z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['text', 'image', 'color', 'boolean']),
    defaultValue: z.any(),
    description: z.string().max(500),
    required: z.boolean().default(false),
  })).optional(),
  category: z.string().min(1).max(100).optional(),
  isReusable: z.boolean().optional(),
})

// A/B Test schemas
export const createABTestSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['subject', 'content', 'send_time', 'template']),
  variants: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    content: z.any(),
  })).min(2).max(5),
  trafficSplit: z.array(z.number().min(0).max(100)).min(2).max(5),
  winnerCriteria: z.enum(['open_rate', 'click_rate', 'conversion_rate']),
  newsletterId: z.string().uuid(),
})

export const updateABTestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['running', 'completed', 'paused']).optional(),
  results: z.object({
    winner: z.string().uuid(),
    confidence: z.number().min(0).max(1),
    improvement: z.number(),
    statisticalSignificance: z.boolean(),
  }).optional(),
})

// Approval Workflow schemas
export const createApprovalWorkflowSchema = z.object({
  contentId: z.string().uuid(),
  stages: z.array(z.object({
    name: z.string().min(1).max(255),
    approvers: z.array(z.string().uuid()).min(1),
    requiredApprovals: z.number().int().min(1),
    order: z.number().int().min(0),
  })).min(1),
})

export const updateApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected', 'revision_requested']),
  comments: z.string().max(1000).optional(),
})

// Schedule schemas
export const scheduleNewsletterSchema = z.object({
  newsletterId: z.string().uuid(),
  scheduledAt: dateSchema,
  timezone: z.string().default('UTC'),
})

// Query schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const newsletterQuerySchema = paginationSchema.extend({
  status: z.enum(['draft', 'scheduled', 'sent', 'failed']).optional(),
  createdBy: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  search: z.string().optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
})

export const templateQuerySchema = paginationSchema.extend({
  category: z.enum(['business', 'tech', 'creative', 'minimal']).optional(),
  isPublic: z.coerce.boolean().optional(),
  createdBy: z.string().uuid().optional(),
  search: z.string().optional(),
})

export const contentLibraryQuerySchema = paginationSchema.extend({
  type: z.enum(['article', 'block', 'template', 'image']).optional(),
  status: z.enum(['draft', 'approved', 'archived']).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
})

// Validation helper functions
export function validateUUID(value: string): boolean {
  return uuidSchema.safeParse(value).success
}

export function validateEmail(value: string): boolean {
  return emailSchema.safeParse(value).success
}

export function validateURL(value: string): boolean {
  return urlSchema.safeParse(value).success
}

export function validateDate(value: any): boolean {
  return dateSchema.safeParse(value).success
}

// Custom validation errors
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function handleValidationError(error: z.ZodError): ValidationError {
  const firstError = error.errors[0]
  const field = firstError?.path.join('.')
  const message = firstError?.message || 'Validation failed'
  return new ValidationError(message, field)
}

export function validateRequest<T>(schema: z.ZodSchema<T>, data: any): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw handleValidationError(error)
    }
    throw error
  }
}
