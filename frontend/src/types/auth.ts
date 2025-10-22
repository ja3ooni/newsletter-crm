export interface User {
  id: string
  email: string
  profile: UserProfile
  preferences: UserPreferences
  subscription: Subscription
  role: UserRole
  createdAt: string
  updatedAt: string
}

export interface UserProfile {
  firstName: string
  lastName: string
  avatar?: string
  timezone: string
  language: string
  company?: string
  jobTitle?: string
}

export interface UserPreferences {
  emailFrequency: 'daily' | 'weekly' | 'monthly'
  contentTypes: string[]
  communicationChannels: string[]
  theme: 'light' | 'dark' | 'system'
  notifications: NotificationPreferences
}

export interface NotificationPreferences {
  email: boolean
  push: boolean
  inApp: boolean
  marketing: boolean
}

export interface Subscription {
  id: string
  plan: SubscriptionPlan
  status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  interval: 'month' | 'year'
  features: string[]
  limits: PlanLimits
}

export interface PlanLimits {
  contacts: number
  newsletters: number
  emailsPerMonth: number
  automations: number
  integrations: number
}

export type UserRole = 'admin' | 'editor' | 'subscriber' | 'api_user'

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  company?: string
  agreeToTerms: boolean
}

export interface AuthResponse {
  user: User
  token: string
  refreshToken: string
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordReset {
  token: string
  password: string
  confirmPassword: string
}

export interface OAuthProvider {
  id: string
  name: string
  icon: string
  url: string
}
