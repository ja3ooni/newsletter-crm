export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  profile: UserProfile;
  preferences: UserPreferences;
  engagementMetrics: EngagementMetrics;
  status: UserStatus;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  timezone: string;
  language: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
}

export interface UserPreferences {
  emailNotifications: boolean;
  marketingEmails: boolean;
  newsletterFrequency: 'daily' | 'weekly' | 'monthly';
  contentTypes: string[];
  theme: 'light' | 'dark' | 'auto';
  timezone: string;
  language: string;
}

export interface EngagementMetrics {
  totalLogins: number;
  lastLoginAt?: Date;
  newslettersOpened: number;
  linksClicked: number;
  engagementScore: number;
  averageSessionDuration: number;
}

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  createdAt: Date;
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing' | 'incomplete';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  priceMonthly?: number;
  priceYearly?: number;
  features: string[];
  limits: Record<string, number>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  permissions: Permission[];
  rateLimit: number;
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  permissions: Permission[];
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  iat: number;
  exp: number;
}

export interface OAuthProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  provider: 'google' | 'github';
}

// Request/Response types
export interface CreateUserRequest {
  email: string;
  password: string;
  profile: Partial<UserProfile>;
  preferences?: Partial<UserPreferences>;
}

export interface UpdateUserRequest {
  email?: string;
  profile?: Partial<UserProfile>;
  preferences?: Partial<UserPreferences>;
  passwordHash?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: Permission[];
  rateLimit?: number;
  expiresAt?: Date;
}

// Database types
export interface DatabaseUser {
  id: string;
  email: string;
  password_hash?: string;
  profile: Record<string, any>;
  preferences: Record<string, any>;
  engagement_metrics: Record<string, any>;
  status: string;
  email_verified: boolean;
  email_verified_at?: Date;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseUserRole {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, any>[];
  created_at: Date;
}

export interface DatabaseSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  cancelled_at?: Date;
  trial_start?: Date;
  trial_end?: Date;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// Error types
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
