export interface Contact {
  id: string
  email: string
  firstName?: string
  lastName?: string
  company?: string
  jobTitle?: string
  phone?: string
  customFields: Record<string, any>
  tags: string[]
  leadScore: number
  lifecycle: 'subscriber' | 'lead' | 'customer' | 'evangelist'
  source: string
  engagementHistory: EngagementEvent[]
  preferences: ContactPreferences
  segments: string[]
  createdAt: string
  updatedAt: string
}

export interface EngagementEvent {
  id: string
  type: 'email_open' | 'email_click' | 'website_visit' | 'form_submit' | 'purchase'
  timestamp: string
  metadata: Record<string, any>
  score: number
  newsletterId?: string
  campaignId?: string
}

export interface ContactPreferences {
  emailFrequency: 'daily' | 'weekly' | 'monthly'
  contentTypes: string[]
  communicationChannels: string[]
  timezone: string
  language: string
}

export interface Segment {
  id: string
  name: string
  description: string
  conditions: SegmentCondition[]
  contactCount: number
  isAutoUpdating: boolean
  createdAt: string
  updatedAt: string
}

export interface SegmentCondition {
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in'
  value: any
  logicalOperator?: 'AND' | 'OR'
}

export interface LeadScoringRule {
  id: string
  name: string
  trigger: ScoringTrigger
  points: number
  isActive: boolean
}

export interface ScoringTrigger {
  type: 'email_open' | 'email_click' | 'website_visit' | 'form_submit' | 'tag_added'
  conditions: Record<string, any>
}

export interface ContactFilters {
  search?: string
  lifecycle?: string[]
  tags?: string[]
  segments?: string[]
  leadScoreMin?: number
  leadScoreMax?: number
  source?: string[]
  dateFrom?: string
  dateTo?: string
  hasEngagement?: boolean
}

export interface ContactImport {
  id: string
  filename: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  totalRows: number
  processedRows: number
  successfulRows: number
  failedRows: number
  errors: ImportError[]
  mapping: FieldMapping
  createdAt: string
  updatedAt: string
}

export interface ImportError {
  row: number
  field: string
  value: string
  error: string
}

export interface FieldMapping {
  [csvColumn: string]: string // maps to Contact field
}

export interface ContactExport {
  id: string
  filename: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  filters: ContactFilters
  fields: string[]
  totalContacts: number
  downloadUrl?: string
  createdAt: string
  expiresAt: string
}

export interface DataSource {
  id: string
  name: string
  type: 'api' | 'webhook' | 'csv' | 'integration'
  status: 'active' | 'inactive' | 'error'
  config: Record<string, any>
  lastSync?: string
  syncFrequency?: string
  enrichmentFields: string[]
}

export interface ContactEnrichment {
  id: string
  contactId: string
  source: string
  data: Record<string, any>
  confidence: number
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
}

export interface SalesPipeline {
  id: string
  name: string
  stages: PipelineStage[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface PipelineStage {
  id: string
  name: string
  order: number
  probability: number
  color: string
  isClosedWon: boolean
  isClosedLost: boolean
}

export interface Opportunity {
  id: string
  name: string
  contactId: string
  pipelineId: string
  stageId: string
  value: number
  currency: string
  probability: number
  expectedCloseDate?: string
  actualCloseDate?: string
  source: string
  description?: string
  customFields: Record<string, any>
  activities: Activity[]
  createdAt: string
  updatedAt: string
}

export interface Activity {
  id: string
  type: 'call' | 'email' | 'meeting' | 'task' | 'note'
  subject: string
  description?: string
  dueDate?: string
  completedAt?: string
  contactId?: string
  opportunityId?: string
  assignedTo?: string
  createdBy: string
  createdAt: string
}

export interface ContactStats {
  totalContacts: number
  newContactsThisMonth: number
  activeContacts: number
  averageLeadScore: number
  topSources: Array<{ source: string; count: number }>
  lifecycleDistribution: Array<{ lifecycle: string; count: number }>
  engagementTrends: Array<{ date: string; opens: number; clicks: number }>
}

export interface BulkOperation {
  id: string
  type: 'update' | 'delete' | 'tag' | 'segment' | 'export'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  totalItems: number
  processedItems: number
  successfulItems: number
  failedItems: number
  errors: string[]
  createdAt: string
  completedAt?: string
}
