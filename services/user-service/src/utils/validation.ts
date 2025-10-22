import { z } from 'zod';

// Base schemas
export const emailSchema = z.string().email('Invalid email format').toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  'Invalid timezone'
);

export const languageSchema = z.enum(['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh']);

// User profile schema
export const userProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  avatar: z.string().url().optional(),
  timezone: timezoneSchema.default('UTC'),
  language: languageSchema.default('en'),
  company: z.string().max(255).optional(),
  jobTitle: z.string().max(255).optional(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format').optional(),
});

// User preferences schema
export const userPreferencesSchema = z.object({
  emailNotifications: z.boolean().default(true),
  marketingEmails: z.boolean().default(true),
  newsletterFrequency: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  contentTypes: z.array(z.string()).default([]),
  theme: z.enum(['light', 'dark', 'auto']).default('light'),
  timezone: timezoneSchema.default('UTC'),
  language: languageSchema.default('en'),
});

// Permission schema
export const permissionSchema = z.object({
  resource: z.string().min(1),
  action: z.string().min(1),
  conditions: z.record(z.any()).optional(),
});

// Request validation schemas
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  profile: userProfileSchema,
  preferences: userPreferencesSchema.partial().optional(),
});

export const updateUserSchema = z.object({
  profile: userProfileSchema.partial().optional(),
  preferences: userPreferencesSchema.partial().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
});

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(255),
  permissions: z.array(permissionSchema).min(1, 'At least one permission is required'),
  rateLimit: z.number().int().min(1).max(10000).default(1000),
  expiresAt: z.string().datetime().optional(),
});

export const updateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  permissions: z.array(permissionSchema).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  isActive: z.boolean().optional(),
});

// Role schemas
export const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(50),
  description: z.string().max(500).optional(),
  permissions: z.array(permissionSchema).min(1, 'At least one permission is required'),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(permissionSchema).optional(),
});

export const assignRoleSchema = z.object({
  userId: uuidSchema,
  roleId: uuidSchema,
});

// Subscription schemas
export const createSubscriptionPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100),
  description: z.string().max(500).optional(),
  priceMonthly: z.number().min(0).optional(),
  priceYearly: z.number().min(0).optional(),
  features: z.array(z.string()).default([]),
  limits: z.record(z.number().int().min(0)).default({}),
});

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial();

export const createSubscriptionSchema = z.object({
  userId: uuidSchema,
  planId: uuidSchema,
  trialDays: z.number().int().min(0).max(365).optional(),
});

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const userQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  role: z.string().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

export const roleQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
});

export const subscriptionQuerySchema = paginationSchema.extend({
  status: z.enum(['active', 'cancelled', 'past_due', 'trialing', 'incomplete']).optional(),
  planId: uuidSchema.optional(),
});

// OAuth schemas
export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional(),
});

// Validation middleware helper
export const validateSchema = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): T => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        throw new Error(`Validation failed: ${messages.join(', ')}`);
      }
      throw error;
    }
  };
};

// Custom validation functions
export const isValidEmail = (email: string): boolean => {
  return emailSchema.safeParse(email).success;
};

export const isValidPassword = (password: string): boolean => {
  return passwordSchema.safeParse(password).success;
};

export const isValidUuid = (uuid: string): boolean => {
  return uuidSchema.safeParse(uuid).success;
};

export const sanitizeString = (str: string, maxLength = 255): string => {
  return str.trim().slice(0, maxLength);
};

export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

// Password strength checker
export const getPasswordStrength = (password: string): {
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (password.length >= 12) score += 1;
  else if (password.length >= 8) feedback.push('Consider using 12+ characters for better security');

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');

  if (/\d/.test(password)) score += 1;
  else feedback.push('Include numbers');

  if (/[@$!%*?&]/.test(password)) score += 1;
  else feedback.push('Include special characters (@$!%*?&)');

  if (!/(.)\1{2,}/.test(password)) score += 1;
  else feedback.push('Avoid repeating characters');

  return { score, feedback };
};
