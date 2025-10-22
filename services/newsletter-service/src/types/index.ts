export interface Newsletter {
  id: string
  title: string
  content: NewsletterContent
  templateId?: string
  status: 'draft' | 'scheduled' | 'sent' | 'failed'
  scheduledAt?: Date
  sentAt?: Date
  metrics: NewsletterMetrics
  abTest?: ABTest
  segments: string[]
  personalization: PersonalizationSettings
  deliverabilitySettings: DeliverabilitySettings
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface NewsletterContent {
  sections: ContentSection[]
  personalization: PersonalizationData
  metadata: ContentMetadata
  dynamicContent: DynamicContentBlock[]
}

export interface ContentSection {
  id: string
  type: 'news' | 'research' | 'github' | 'events' | 'products' | 'custom'
  title: string
  items: ContentItem[]
  order: number
  isPersonalized: boolean
  displayRules?: DisplayRule[]
}

export interface ContentItem {
  id: string
  title: string
  summary: string
  url: string
  source: string
  publishedAt: Date
  score: number
  tags: string[]
  sentiment: number
  readingTime: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category: string
}

export interface DisplayRule {
  condition: string
  action: 'show' | 'hide' | 'highlight'
}

export interface DynamicContentBlock {
  id: string
  name: string
  conditions: ContentCondition[]
  variants: ContentVariant[]
}

export interface ContentCondition {
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in'
  value: any
}

export interface ContentVariant {
  id: string
  content: string
  isDefault: boolean
}

export interface PersonalizationData {
  subscriberId: string
  preferences: Record<string, any>
  behaviorData: Record<string, any>
  demographics: Record<string, any>
}

export interface ContentMetadata {
  generatedAt: Date
  version: string
  totalItems: number
  sources: string[]
  categories: string[]
}

export interface PersonalizationSettings {
  enabled: boolean
  rules: PersonalizationRule[]
  fallbackContent: string
}

export interface PersonalizationRule {
  id: string
  condition: string
  action: string
  priority: number
}

export interface DeliverabilitySettings {
  fromName: string
  fromEmail: string
  replyTo: string
  trackOpens: boolean
  trackClicks: boolean
  unsubscribeLink: boolean
  customHeaders: Record<string, string>
}

export interface NewsletterMetrics {
  sent: number
  delivered: number
  opens: number
  uniqueOpens: number
  clicks: number
  uniqueClicks: number
  unsubscribes: number
  bounces: number
  complaints: number
  openRate: number
  clickRate: number
  unsubscribeRate: number
  bounceRate: number
}

export interface ABTest {
  id: string
  name: string
  type: 'subject' | 'content' | 'send_time' | 'template'
  variants: ABTestVariant[]
  trafficSplit: number[]
  winnerCriteria: 'open_rate' | 'click_rate' | 'conversion_rate'
  status: 'running' | 'completed' | 'paused'
  results?: ABTestResults
  startedAt: Date
  endedAt?: Date
}

export interface ABTestVariant {
  id: string
  name: string
  content: any
  metrics: VariantMetrics
}

export interface VariantMetrics {
  sent: number
  opens: number
  clicks: number
  conversions: number
  openRate: number
  clickRate: number
  conversionRate: number
}

export interface ABTestResults {
  winner: string
  confidence: number
  improvement: number
  statisticalSignificance: boolean
}

export interface NewsletterTemplate {
  id: string
  name: string
  category: 'business' | 'tech' | 'creative' | 'minimal'
  html: string
  css: string
  variables: TemplateVariable[]
  previewImage: string
  isPublic: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface TemplateVariable {
  name: string
  type: 'text' | 'image' | 'color' | 'boolean'
  defaultValue: any
  description: string
  required: boolean
}

export interface ContentLibraryItem {
  id: string
  title: string
  content: string
  type: 'article' | 'block' | 'template' | 'image'
  tags: string[]
  category: string
  status: 'draft' | 'approved' | 'archived'
  createdBy: string
  approvedBy?: string
  createdAt: Date
  updatedAt: Date
  approvedAt?: Date
  metadata: Record<string, any>
}

export interface ContentBlock {
  id: string
  name: string
  html: string
  css?: string
  variables: TemplateVariable[]
  category: string
  isReusable: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface ApprovalWorkflow {
  id: string
  contentId: string
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested'
  stages: ApprovalStage[]
  currentStage: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface ApprovalStage {
  id: string
  name: string
  approvers: string[]
  requiredApprovals: number
  approvals: Approval[]
  status: 'pending' | 'approved' | 'rejected'
  order: number
}

export interface Approval {
  id: string
  approverId: string
  status: 'approved' | 'rejected' | 'revision_requested'
  comments?: string
  timestamp: Date
}

export interface ScheduledNewsletter {
  id: string
  newsletterId: string
  scheduledAt: Date
  timezone: string
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled'
  jobId?: string
  createdAt: Date
  updatedAt: Date
}

export interface NewsletterQueue {
  id: string
  newsletterId: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  attempts: number
  maxAttempts: number
  scheduledAt: Date
  processedAt?: Date
  error?: string
  metadata: Record<string, any>
}

export interface CreateNewsletterRequest {
  title: string
  templateId?: string
  sections: string[]
  segments: string[]
  personalization?: Partial<PersonalizationSettings>
  deliverabilitySettings?: Partial<DeliverabilitySettings>
  scheduledAt?: Date
  abTest?: Partial<ABTest>
}

export interface UpdateNewsletterRequest {
  title?: string
  content?: Partial<NewsletterContent>
  status?: Newsletter['status']
  scheduledAt?: Date
  personalization?: Partial<PersonalizationSettings>
  deliverabilitySettings?: Partial<DeliverabilitySettings>
}

export interface GenerateNewsletterRequest {
  sections: string[]
  personalization?: PersonalizationData
  templateId?: string
  userId: string
}

export interface NewsletterAnalytics {
  newsletterId: string
  timeRange: {
    start: Date
    end: Date
  }
  metrics: NewsletterMetrics
  engagement: {
    opensByHour: Record<string, number>
    clicksByDevice: Record<string, number>
    geographicDistribution: Record<string, number>
    topLinks: Array<{ url: string; clicks: number }>
  }
  comparisons: {
    previousNewsletter?: NewsletterMetrics
    averageMetrics?: NewsletterMetrics
  }
}

export interface DeliverabilityReport {
  newsletterId: string
  deliveryRate: number
  bounceRate: number
  spamRate: number
  reputationScore: number
  domainReputation: Record<string, number>
  recommendations: string[]
  detailedMetrics: {
    hardBounces: number
    softBounces: number
    spamComplaints: number
    unsubscribes: number
    deliveredToInbox: number
    deliveredToSpam: number
  }
  generatedAt: Date
}
