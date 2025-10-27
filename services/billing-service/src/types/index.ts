export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  type: 'freemium' | 'premium' | 'enterprise';
  billingInterval: 'month' | 'year';
  price: number; // in cents
  currency: string;
  features: PlanFeature[];
  limits: PlanLimits;
  trialDays?: number;
  isActive: boolean;
  stripePriceId: string;
  stripeProductId: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanFeature {
  name: string;
  description: string;
  included: boolean;
  limit?: number;
}

export interface PlanLimits {
  newsletters: number;
  subscribers: number;
  emailsPerMonth: number;
  automations: number;
  templates: number;
  apiCalls: number;
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
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'past_due'
  | 'trialing'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid';

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  userId: string;
  metricName: string;
  quantity: number;
  timestamp: Date;
  stripeUsageRecordId?: string;
  metadata: Record<string, any>;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  userId: string;
  stripeInvoiceId: string;
  status: InvoiceStatus;
  amount: number;
  currency: string;
  dueDate: Date;
  paidAt?: Date;
  periodStart: Date;
  periodEnd: Date;
  items: InvoiceItem[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible';

export interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  quantity: number;
  unitAmount: number;
  metadata: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'bank_account';
  isDefault: boolean;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DunningAttempt {
  id: string;
  subscriptionId: string;
  invoiceId: string;
  attemptNumber: number;
  status: 'pending' | 'failed' | 'succeeded';
  failureReason?: string;
  nextAttemptAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromoCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed_amount';
  value: number; // percentage (0-100) or amount in cents
  currency?: string;
  maxRedemptions?: number;
  currentRedemptions: number;
  validFrom: Date;
  validUntil?: Date;
  applicablePlans: string[];
  isActive: boolean;
  stripePromotionCodeId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingEvent {
  id: string;
  type: BillingEventType;
  subscriptionId?: string;
  userId: string;
  data: Record<string, any>;
  processedAt?: Date;
  createdAt: Date;
}

export type BillingEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'subscription.trial_will_end'
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'payment_method.attached'
  | 'payment_method.detached'
  | 'usage.recorded';

// Request/Response types
export interface CreateSubscriptionRequest {
  userId: string;
  planId: string;
  paymentMethodId?: string;
  promoCode?: string;
  trialDays?: number;
  metadata?: Record<string, any>;
}

export interface UpdateSubscriptionRequest {
  planId?: string;
  cancelAtPeriodEnd?: boolean;
  promoCode?: string;
  metadata?: Record<string, any>;
}

export interface CreateUsageRecordRequest {
  subscriptionId: string;
  metricName: string;
  quantity: number;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface CreatePromoCodeRequest {
  code: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  currency?: string;
  maxRedemptions?: number;
  validFrom: Date;
  validUntil?: Date;
  applicablePlans: string[];
  metadata?: Record<string, any>;
}

export interface BillingAnalytics {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  churnRate: number;
  averageRevenuePerUser: number;
  lifetimeValue: number;
  subscriptionsByPlan: Record<string, number>;
  revenueByPlan: Record<string, number>;
  period: {
    start: Date;
    end: Date;
  };
}

export interface DatabaseSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  cancelled_at?: Date;
  trial_start?: Date;
  trial_end?: Date;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseSubscriptionPlan {
  id: string;
  name: string;
  description: string;
  type: string;
  billing_interval: string;
  price: number;
  currency: string;
  features: PlanFeature[];
  limits: PlanLimits;
  trial_days?: number;
  is_active: boolean;
  stripe_price_id: string;
  stripe_product_id: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}
