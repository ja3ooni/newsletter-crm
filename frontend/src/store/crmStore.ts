import type {
    Activity,
    BulkOperation,
    Contact,
    ContactExport,
    ContactFilters,
    ContactImport,
    ContactStats,
    DataSource,
    LeadScoringRule,
    Opportunity,
    SalesPipeline,
    Segment
} from '@/types/crm'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface CrmState {
  // Contacts
  contacts: Contact[]
  selectedContacts: string[]
  contactFilters: ContactFilters
  contactStats: ContactStats | null

  // Segments
  segments: Segment[]
  selectedSegment: Segment | null

  // Lead Scoring
  leadScoringRules: LeadScoringRule[]

  // Import/Export
  imports: ContactImport[]
  exports: ContactExport[]

  // Data Sources
  dataSources: DataSource[]

  // Sales Pipeline
  pipelines: SalesPipeline[]
  opportunities: Opportunity[]
  activities: Activity[]

  // UI State
  isLoading: boolean
  error: string | null
  bulkOperations: BulkOperation[]

  // Actions
  setContacts: (contacts: Contact[]) => void
  addContact: (contact: Contact) => void
  updateContact: (id: string, updates: Partial<Contact>) => void
  removeContact: (id: string) => void
  setSelectedContacts: (contactIds: string[]) => void
  toggleContactSelection: (contactId: string) => void
  clearContactSelection: () => void
  setContactFilters: (filters: ContactFilters) => void
  setContactStats: (stats: ContactStats) => void

  setSegments: (segments: Segment[]) => void
  addSegment: (segment: Segment) => void
  updateSegment: (id: string, updates: Partial<Segment>) => void
  removeSegment: (id: string) => void
  setSelectedSegment: (segment: Segment | null) => void

  setLeadScoringRules: (rules: LeadScoringRule[]) => void
  addLeadScoringRule: (rule: LeadScoringRule) => void
  updateLeadScoringRule: (id: string, updates: Partial<LeadScoringRule>) => void
  removeLeadScoringRule: (id: string) => void

  setImports: (imports: ContactImport[]) => void
  addImport: (importData: ContactImport) => void
  updateImport: (id: string, updates: Partial<ContactImport>) => void

  setExports: (exports: ContactExport[]) => void
  addExport: (exportData: ContactExport) => void
  updateExport: (id: string, updates: Partial<ContactExport>) => void

  setDataSources: (sources: DataSource[]) => void
  addDataSource: (source: DataSource) => void
  updateDataSource: (id: string, updates: Partial<DataSource>) => void
  removeDataSource: (id: string) => void

  setPipelines: (pipelines: SalesPipeline[]) => void
  addPipeline: (pipeline: SalesPipeline) => void
  updatePipeline: (id: string, updates: Partial<SalesPipeline>) => void
  removePipeline: (id: string) => void

  setOpportunities: (opportunities: Opportunity[]) => void
  addOpportunity: (opportunity: Opportunity) => void
  updateOpportunity: (id: string, updates: Partial<Opportunity>) => void
  removeOpportunity: (id: string) => void

  setActivities: (activities: Activity[]) => void
  addActivity: (activity: Activity) => void
  updateActivity: (id: string, updates: Partial<Activity>) => void
  removeActivity: (id: string) => void

  setBulkOperations: (operations: BulkOperation[]) => void
  addBulkOperation: (operation: BulkOperation) => void
  updateBulkOperation: (id: string, updates: Partial<BulkOperation>) => void

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export const useCrmStore = create<CrmState>()(
  devtools(
    (set, get) => ({
      // Initial state
      contacts: [],
      selectedContacts: [],
      contactFilters: {},
      contactStats: null,
      segments: [],
      selectedSegment: null,
      leadScoringRules: [],
      imports: [],
      exports: [],
      dataSources: [],
      pipelines: [],
      opportunities: [],
      activities: [],
      isLoading: false,
      error: null,
      bulkOperations: [],

      // Contact actions
      setContacts: (contacts) => set({ contacts }),
      addContact: (contact) => set((state) => ({ contacts: [...state.contacts, contact] })),
      updateContact: (id, updates) =>
        set((state) => ({
          contacts: state.contacts.map((contact) =>
            contact.id === id ? { ...contact, ...updates } : contact
          )
        })),
      removeContact: (id) =>
        set((state) => ({
          contacts: state.contacts.filter((contact) => contact.id !== id),
          selectedContacts: state.selectedContacts.filter((contactId) => contactId !== id)
        })),
      setSelectedContacts: (contactIds) => set({ selectedContacts: contactIds }),
      toggleContactSelection: (contactId) =>
        set((state) => ({
          selectedContacts: state.selectedContacts.includes(contactId)
            ? state.selectedContacts.filter((id) => id !== contactId)
            : [...state.selectedContacts, contactId]
        })),
      clearContactSelection: () => set({ selectedContacts: [] }),
      setContactFilters: (filters) => set({ contactFilters: filters }),
      setContactStats: (stats) => set({ contactStats: stats }),

      // Segment actions
      setSegments: (segments) => set({ segments }),
      addSegment: (segment) => set((state) => ({ segments: [...state.segments, segment] })),
      updateSegment: (id, updates) =>
        set((state) => ({
          segments: state.segments.map((segment) =>
            segment.id === id ? { ...segment, ...updates } : segment
          )
        })),
      removeSegment: (id) =>
        set((state) => ({
          segments: state.segments.filter((segment) => segment.id !== id)
        })),
      setSelectedSegment: (segment) => set({ selectedSegment: segment }),

      // Lead scoring actions
      setLeadScoringRules: (rules) => set({ leadScoringRules: rules }),
      addLeadScoringRule: (rule) =>
        set((state) => ({ leadScoringRules: [...state.leadScoringRules, rule] })),
      updateLeadScoringRule: (id, updates) =>
        set((state) => ({
          leadScoringRules: state.leadScoringRules.map((rule) =>
            rule.id === id ? { ...rule, ...updates } : rule
          )
        })),
      removeLeadScoringRule: (id) =>
        set((state) => ({
          leadScoringRules: state.leadScoringRules.filter((rule) => rule.id !== id)
        })),

      // Import actions
      setImports: (imports) => set({ imports }),
      addImport: (importData) => set((state) => ({ imports: [...state.imports, importData] })),
      updateImport: (id, updates) =>
        set((state) => ({
          imports: state.imports.map((imp) =>
            imp.id === id ? { ...imp, ...updates } : imp
          )
        })),

      // Export actions
      setExports: (exports) => set({ exports }),
      addExport: (exportData) => set((state) => ({ exports: [...state.exports, exportData] })),
      updateExport: (id, updates) =>
        set((state) => ({
          exports: state.exports.map((exp) =>
            exp.id === id ? { ...exp, ...updates } : exp
          )
        })),

      // Data source actions
      setDataSources: (sources) => set({ dataSources: sources }),
      addDataSource: (source) => set((state) => ({ dataSources: [...state.dataSources, source] })),
      updateDataSource: (id, updates) =>
        set((state) => ({
          dataSources: state.dataSources.map((source) =>
            source.id === id ? { ...source, ...updates } : source
          )
        })),
      removeDataSource: (id) =>
        set((state) => ({
          dataSources: state.dataSources.filter((source) => source.id !== id)
        })),

      // Pipeline actions
      setPipelines: (pipelines) => set({ pipelines }),
      addPipeline: (pipeline) => set((state) => ({ pipelines: [...state.pipelines, pipeline] })),
      updatePipeline: (id, updates) =>
        set((state) => ({
          pipelines: state.pipelines.map((pipeline) =>
            pipeline.id === id ? { ...pipeline, ...updates } : pipeline
          )
        })),
      removePipeline: (id) =>
        set((state) => ({
          pipelines: state.pipelines.filter((pipeline) => pipeline.id !== id)
        })),

      // Opportunity actions
      setOpportunities: (opportunities) => set({ opportunities }),
      addOpportunity: (opportunity) =>
        set((state) => ({ opportunities: [...state.opportunities, opportunity] })),
      updateOpportunity: (id, updates) =>
        set((state) => ({
          opportunities: state.opportunities.map((opportunity) =>
            opportunity.id === id ? { ...opportunity, ...updates } : opportunity
          )
        })),
      removeOpportunity: (id) =>
        set((state) => ({
          opportunities: state.opportunities.filter((opportunity) => opportunity.id !== id)
        })),

      // Activity actions
      setActivities: (activities) => set({ activities }),
      addActivity: (activity) => set((state) => ({ activities: [...state.activities, activity] })),
      updateActivity: (id, updates) =>
        set((state) => ({
          activities: state.activities.map((activity) =>
            activity.id === id ? { ...activity, ...updates } : activity
          )
        })),
      removeActivity: (id) =>
        set((state) => ({
          activities: state.activities.filter((activity) => activity.id !== id)
        })),

      // Bulk operation actions
      setBulkOperations: (operations) => set({ bulkOperations: operations }),
      addBulkOperation: (operation) =>
        set((state) => ({ bulkOperations: [...state.bulkOperations, operation] })),
      updateBulkOperation: (id, updates) =>
        set((state) => ({
          bulkOperations: state.bulkOperations.map((operation) =>
            operation.id === id ? { ...operation, ...updates } : operation
          )
        })),

      // UI actions
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null })
    }),
    {
      name: 'crm-store'
    }
  )
)
