import { z } from 'zod';

// UUID validation schema
const uuidSchema = z.string().uuid('Invalid UUID format');

// Base schemas
export const createSubscriptionSchema = z.object({
  body: z.object({
    userId: uuidSchema.optional(), // Will be set from auth token if not provided
    planId: uuidSchema,
    paymentMethodId: z.string().optional(),
    promoCode: z.string().optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

export const updateSubscriptionSchema = z.object({
  body: z.object({
    planId: uuidSchema.optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    promoCode: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

export const createUsageRecordSchema = z.object({
  body: z.object({
    subscriptionId: uuidSchema,
    metricName: z.string().min(1).max(100),
    quantity: z.number().int().min(0),
    timestamp: z.string().datetime().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

export const createSubscriptionPlanSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    type: z.enum(['freemium', 'premium', 'enterprise']),
    billingInterval: z.enum(['month', 'year']),
    price: z.number().int().min(0), // in cents
    currency: z.string().length(3).default('usd'),
    features: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        included: z.boolean(),
        limit: z.number().optional(),
      })
    ),
    limits: z.object({
      newsletters: z.number().int().min(0),
      subscribers: z.number().int().min(0),
      emailsPerMonth: z.number().int().min(0),
      automations: z.number().int().min(0),
      templates: z.number().int().min(0),
      apiCalls: z.number().int().min(0),
    }),
    trialDays: z.number().int().min(0).max(365).optional(),
    stripePriceId: z.string().min(1),
    stripeProductId: z.string().min(1),
    metadata: z.record(z.any()).optional().default({}),
  }),
});

export const createPromoCodeSchema = z.object({
  body: z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    type: z.enum(['percentage', 'fixed_amount']),
    value: z.number().min(0),
    currency: z.string().length(3).optional(),
    maxRedemptions: z.number().int().min(1).optional(),
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime().optional(),
    applicablePlans: z.array(uuidSchema),
    metadata: z.record(z.any()).optional().default({}),
  }),
});

// Query parameter schemas
export const paginationSchema = z.object({
  page: z
    .string()
    .transform(val => parseInt(val) || 1)
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .transform(val => parseInt(val) || 20)
    .pipe(z.number().int().min(1).max(100)),
});

export const subscriptionQuerySchema = z.object({
  query: paginationSchema.extend({
    status: z
      .enum([
        'active',
        'cancelled',
        'past_due',
        'trialing',
        'incomplete',
        'incomplete_expired',
        'unpaid',
      ])
      .optional(),
    planId: uuidSchema.optional(),
  }),
});

export const invoiceQuerySchema = z.object({
  query: paginationSchema.extend({
    status: z
      .enum(['draft', 'open', 'paid', 'void', 'uncollectible'])
      .optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

export const usageQuerySchema = z.object({
  query: paginationSchema.extend({
    metricName: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

// Webhook validation
export const stripeWebhookSchema = z.object({
  headers: z.object({
    'stripe-signature': z.string(),
  }),
  body: z.any(), // Raw body for signature verification
});

// Response schemas for documentation
export const subscriptionResponseSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  planId: uuidSchema,
  status: z.enum([
    'active',
    'cancelled',
    'past_due',
    'trialing',
    'incomplete',
    'incomplete_expired',
    'unpaid',
  ]),
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  cancelAtPeriodEnd: z.boolean(),
  cancelledAt: z.string().datetime().optional(),
  trialStart: z.string().datetime().optional(),
  trialEnd: z.string().datetime().optional(),
  stripeSubscriptionId: z.string(),
  stripeCustomerId: z.string(),
  metadata: z.record(z.any()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const subscriptionPlanResponseSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  description: z.string(),
  type: z.enum(['freemium', 'premium', 'enterprise']),
  billingInterval: z.enum(['month', 'year']),
  price: z.number(),
  currency: z.string(),
  features: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      included: z.boolean(),
      limit: z.number().optional(),
    })
  ),
  limits: z.object({
    newsletters: z.number(),
    subscribers: z.number(),
    emailsPerMonth: z.number(),
    automations: z.number(),
    templates: z.number(),
    apiCalls: z.number(),
  }),
  trialDays: z.number().optional(),
  isActive: z.boolean(),
  stripePriceId: z.string(),
  stripeProductId: z.string(),
  metadata: z.record(z.any()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const invoiceResponseSchema = z.object({
  id: uuidSchema,
  subscriptionId: uuidSchema,
  userId: uuidSchema,
  stripeInvoiceId: z.string(),
  status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']),
  amount: z.number(),
  currency: z.string(),
  dueDate: z.string().datetime(),
  paidAt: z.string().datetime().optional(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  items: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      amount: z.number(),
      quantity: z.number(),
      unitAmount: z.number(),
      metadata: z.record(z.any()),
    })
  ),
  metadata: z.record(z.any()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const usageRecordResponseSchema = z.object({
  id: uuidSchema,
  subscriptionId: uuidSchema,
  userId: uuidSchema,
  metricName: z.string(),
  quantity: z.number(),
  timestamp: z.string().datetime(),
  stripeUsageRecordId: z.string().optional(),
  metadata: z.record(z.any()),
});

// Error response schema
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.any().optional(),
});

// Success response schema
export const successResponseSchema = <T>(dataSchema: z.ZodSchema<T>) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

// Validation helper types
export type CreateSubscriptionRequest = z.infer<
  typeof createSubscriptionSchema
>['body'];
export type UpdateSubscriptionRequest = z.infer<
  typeof updateSubscriptionSchema
>['body'];
export type CreateUsageRecordRequest = z.infer<
  typeof createUsageRecordSchema
>['body'];
export type CreateSubscriptionPlanRequest = z.infer<
  typeof createSubscriptionPlanSchema
>['body'];
export type CreatePromoCodeRequest = z.infer<
  typeof createPromoCodeSchema
>['body'];
