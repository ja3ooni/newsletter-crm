export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  type: 'freemium' | 'premium' | 'enterprise'
  billingInterval: 'month' | 'year'
  price: number // in cents
  currency: string
  features: PlanFeature[]
  limits: PlanLimits
  trialDays?: number
  isActive: boolean
  stripePriceId: string
  stripeProductId: string
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface PlanFeature {
  name: string
  description: string
  included: boolean
  limit?: number
}

export interface PlanLimits {
  newsletters: number
  subscribers: number
  emailsPerMonth: number
  automations: number
  templates: number
  apiCalls: number
}

export interface Subscription {
  id: string
  userId: string
  planId: string
  status: SubscriptionStatus
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  cancelledAt?: Date
  trialStart?: Date
  trialEnd?: Date
  stripeSubscriptionId: string
  stripeCustomerId: string
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
  plan?: SubscriptionPlan
}

export type SubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'past_due'
  | 'trialing'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'

export interface Invoice {
  id: string
  subscriptionId: string
  userId: string
  stripeInvoiceId: string
  status: InvoiceStatus
  amount: number
  currency: string
  dueDate: Date
  paidAt?: Date
  periodStart: Date
  periodEnd: Date
  items: InvoiceItem[]
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible'

export interface InvoiceItem {
  id: string
  description: string
  amount: number
  quantity: number
  unitAmount: number
  metadata: Record<string, any>
}

export interface UsageRecord {
  id: string
  subscriptionId: string
  userId: string
  metricName: string
  quantity: number
  timestamp: Date
  stripeUsageRecordId?: string
  metadata: Record<string, any>
}

export interface PromoCode {
  id: string
  code: string
  name: string
  description?: string
  type: 'percentage' | 'fixed_amount'
  value: number
  currency?: string
  maxRedemptions?: number
  currentRedemptions: number
  validFrom: Date
  validUntil?: Date
  applicablePlans: string[]
  isActive: boolean
  stripePromotionCodeId?: string
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface BillingAnalytics {
  totalRevenue: number
  monthlyRecurringRevenue: number
  annualRecurringRevenue: number
  churnRate: number
  averageRevenuePerUser: number
  lifetimeValue: number
  subscriptionsByPlan: Record<string, number>
  revenueByPlan: Record<string, number>
  period: {
    start: Date
    end: Date
  }
}

export interface PaymentMethod {
  id: string
  userId: string
  stripePaymentMethodId: string
  type: 'card' | 'bank_account'
  isDefault: boolean
  last4?: string
  brand?: string
  expiryMonth?: number
  expiryYear?: number
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

// Request types
export interface CreateSubscriptionRequest {
  userId: string
  planId: string
  paymentMethodId?: string
  promoCode?: string
  trialDays?: number
  metadata?: Record<string, any>
}

export interface UpdateSubscriptionRequest {
  planId?: string
  cancelAtPeriodEnd?: boolean
  promoCode?: string
  metadata?: Record<string, any>
}

export interface CreatePromoCodeRequest {
  code: string
  name: string
  description?: string
  type: 'percentage' | 'fixed_amount'
  value: number
  currency?: string
  maxRedemptions?: number
  validFrom: Date
  validUntil?: Date
  applicablePlans: string[]
  metadata?: Record<string, any>
}

export interface UsageTrackingData {
  metricName: string
  currentUsage: number
  limit: number
  percentage: number
  resetDate: Date
}

export interface BillingHistory {
  subscriptions: Subscription[]
  invoices: Invoice[]
  paymentMethods: PaymentMethod[]
  usageRecords: UsageRecord[]
}
