import { billingApi } from '@/lib/api/billing'
import {
    BillingAnalytics,
    BillingHistory,
    Invoice,
    PromoCode,
    Subscription,
    SubscriptionPlan,
    UsageTrackingData,
} from '@/types/billing'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface BillingState {
  // Data
  subscriptionPlans: SubscriptionPlan[]
  currentSubscription: Subscription | null
  subscriptionHistory: Subscription[]
  invoices: Invoice[]
  usageTracking: UsageTrackingData[]
  promoCodes: PromoCode[]
  billingAnalytics: BillingAnalytics | null
  billingHistory: BillingHistory | null

  // Loading states
  isLoading: boolean
  isLoadingPlans: boolean
  isLoadingSubscription: boolean
  isLoadingInvoices: boolean
  isLoadingUsage: boolean
  isLoadingAnalytics: boolean

  // Error states
  error: string | null
  subscriptionError: string | null
  invoiceError: string | null

  // Actions
  fetchSubscriptionPlans: () => Promise<void>
  fetchCurrentSubscription: () => Promise<void>
  fetchSubscriptionHistory: () => Promise<void>
  fetchInvoices: () => Promise<void>
  fetchUsageTracking: (subscriptionId: string) => Promise<void>
  fetchBillingAnalytics: (startDate?: Date, endDate?: Date) => Promise<void>
  fetchBillingHistory: () => Promise<void>
  fetchPromoCodes: () => Promise<void>

  // Subscription actions
  createSubscription: (planId: string, paymentMethodId?: string, promoCode?: string) => Promise<Subscription>
  updateSubscription: (subscriptionId: string, planId?: string, cancelAtPeriodEnd?: boolean) => Promise<Subscription>
  cancelSubscription: (subscriptionId: string, immediately?: boolean) => Promise<Subscription>
  reactivateSubscription: (subscriptionId: string) => Promise<Subscription>

  // Promo code actions
  validatePromoCode: (code: string, planId: string) => Promise<{ valid: boolean; discount: number; message?: string }>
  createPromoCode: (data: any) => Promise<PromoCode>

  // Utility actions
  clearError: () => void
  reset: () => void
}

const initialState = {
  subscriptionPlans: [],
  currentSubscription: null,
  subscriptionHistory: [],
  invoices: [],
  usageTracking: [],
  promoCodes: [],
  billingAnalytics: null,
  billingHistory: null,
  isLoading: false,
  isLoadingPlans: false,
  isLoadingSubscription: false,
  isLoadingInvoices: false,
  isLoadingUsage: false,
  isLoadingAnalytics: false,
  error: null,
  subscriptionError: null,
  invoiceError: null,
}

export const useBillingStore = create<BillingState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchSubscriptionPlans: async () => {
        set({ isLoadingPlans: true, error: null })
        try {
          const plans = await billingApi.getSubscriptionPlans()
          set({ subscriptionPlans: plans, isLoadingPlans: false })
        } catch (error: any) {
          set({ error: error.message, isLoadingPlans: false })
        }
      },

      fetchCurrentSubscription: async () => {
        set({ isLoadingSubscription: true, subscriptionError: null })
        try {
          const subscription = await billingApi.getUserActiveSubscription()
          set({ currentSubscription: subscription, isLoadingSubscription: false })
        } catch (error: any) {
          set({ subscriptionError: error.message, isLoadingSubscription: false })
        }
      },

      fetchSubscriptionHistory: async () => {
        set({ isLoading: true, error: null })
        try {
          const history = await billingApi.getUserSubscriptionHistory()
          set({ subscriptionHistory: history, isLoading: false })
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
        }
      },

      fetchInvoices: async () => {
        set({ isLoadingInvoices: true, invoiceError: null })
        try {
          const invoices = await billingApi.getUserInvoices()
          set({ invoices, isLoadingInvoices: false })
        } catch (error: any) {
          set({ invoiceError: error.message, isLoadingInvoices: false })
        }
      },

      fetchUsageTracking: async (subscriptionId: string) => {
        set({ isLoadingUsage: true, error: null })
        try {
          const usage = await billingApi.getUsageTracking(subscriptionId)
          set({ usageTracking: usage, isLoadingUsage: false })
        } catch (error: any) {
          set({ error: error.message, isLoadingUsage: false })
        }
      },

      fetchBillingAnalytics: async (startDate?: Date, endDate?: Date) => {
        set({ isLoadingAnalytics: true, error: null })
        try {
          const analytics = await billingApi.getBillingAnalytics(startDate, endDate)
          set({ billingAnalytics: analytics, isLoadingAnalytics: false })
        } catch (error: any) {
          set({ error: error.message, isLoadingAnalytics: false })
        }
      },

      fetchBillingHistory: async () => {
        set({ isLoading: true, error: null })
        try {
          const history = await billingApi.getBillingHistory()
          set({ billingHistory: history, isLoading: false })
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
        }
      },

      fetchPromoCodes: async () => {
        set({ isLoading: true, error: null })
        try {
          const promoCodes = await billingApi.getPromoCodes()
          set({ promoCodes, isLoading: false })
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
        }
      },

      createSubscription: async (planId: string, paymentMethodId?: string, promoCode?: string) => {
        set({ isLoading: true, subscriptionError: null })
        try {
          const subscription = await billingApi.createSubscription({
            userId: '', // Will be set by backend from auth token
            planId,
            paymentMethodId,
            promoCode,
          })
          set({
            currentSubscription: subscription,
            isLoading: false,
            subscriptionHistory: [subscription, ...get().subscriptionHistory]
          })
          return subscription
        } catch (error: any) {
          set({ subscriptionError: error.message, isLoading: false })
          throw error
        }
      },

      updateSubscription: async (subscriptionId: string, planId?: string, cancelAtPeriodEnd?: boolean) => {
        set({ isLoading: true, subscriptionError: null })
        try {
          const subscription = await billingApi.updateSubscription(subscriptionId, {
            planId,
            cancelAtPeriodEnd,
          })
          set({
            currentSubscription: subscription,
            isLoading: false,
            subscriptionHistory: get().subscriptionHistory.map(s =>
              s.id === subscriptionId ? subscription : s
            )
          })
          return subscription
        } catch (error: any) {
          set({ subscriptionError: error.message, isLoading: false })
          throw error
        }
      },

      cancelSubscription: async (subscriptionId: string, immediately = false) => {
        set({ isLoading: true, subscriptionError: null })
        try {
          const subscription = await billingApi.cancelSubscription(subscriptionId, immediately)
          set({
            currentSubscription: subscription,
            isLoading: false,
            subscriptionHistory: get().subscriptionHistory.map(s =>
              s.id === subscriptionId ? subscription : s
            )
          })
          return subscription
        } catch (error: any) {
          set({ subscriptionError: error.message, isLoading: false })
          throw error
        }
      },

      reactivateSubscription: async (subscriptionId: string) => {
        set({ isLoading: true, subscriptionError: null })
        try {
          const subscription = await billingApi.reactivateSubscription(subscriptionId)
          set({
            currentSubscription: subscription,
            isLoading: false,
            subscriptionHistory: get().subscriptionHistory.map(s =>
              s.id === subscriptionId ? subscription : s
            )
          })
          return subscription
        } catch (error: any) {
          set({ subscriptionError: error.message, isLoading: false })
          throw error
        }
      },

      validatePromoCode: async (code: string, planId: string) => {
        try {
          return await billingApi.validatePromoCode(code, planId)
        } catch (error: any) {
          throw error
        }
      },

      createPromoCode: async (data: any) => {
        set({ isLoading: true, error: null })
        try {
          const promoCode = await billingApi.createPromoCode(data)
          set({
            promoCodes: [promoCode, ...get().promoCodes],
            isLoading: false
          })
          return promoCode
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      clearError: () => {
        set({ error: null, subscriptionError: null, invoiceError: null })
      },

      reset: () => {
        set(initialState)
      },
    }),
    {
      name: 'billing-store',
    }
  )
)
