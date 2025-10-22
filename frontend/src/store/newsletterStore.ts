import { newsletterApi } from '@/lib/api/newsletter'
import type {
    BuilderState,
    ContentBlock,
    ContentSection,
    CreateNewsletterRequest,
    Newsletter,
    NewsletterTemplate,
    UpdateNewsletterRequest
} from '@/types/newsletter'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface NewsletterStore {
  // State
  newsletters: Newsletter[]
  templates: NewsletterTemplate[]
  contentBlocks: ContentBlock[]
  currentNewsletter: Newsletter | null
  builderState: BuilderState | null
  loading: boolean
  error: string | null

  // Newsletter operations
  fetchNewsletters: () => Promise<void>
  fetchNewsletter: (id: string) => Promise<void>
  createNewsletter: (data: CreateNewsletterRequest) => Promise<Newsletter>
  updateNewsletter: (id: string, data: UpdateNewsletterRequest) => Promise<void>
  deleteNewsletter: (id: string) => Promise<void>
  duplicateNewsletter: (id: string) => Promise<Newsletter>

  // Template operations
  fetchTemplates: () => Promise<void>
  fetchTemplate: (id: string) => Promise<NewsletterTemplate>
  createTemplate: (data: Partial<NewsletterTemplate>) => Promise<NewsletterTemplate>
  updateTemplate: (id: string, data: Partial<NewsletterTemplate>) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>

  // Content block operations
  fetchContentBlocks: () => Promise<void>
  createContentBlock: (data: Partial<ContentBlock>) => Promise<ContentBlock>
  updateContentBlock: (id: string, data: Partial<ContentBlock>) => Promise<void>
  deleteContentBlock: (id: string) => Promise<void>

  // Builder operations
  initializeBuilder: (newsletter: Newsletter) => void
  updateBuilderNewsletter: (updates: Partial<Newsletter>) => void
  addSection: (section: ContentSection) => void
  updateSection: (sectionId: string, updates: Partial<ContentSection>) => void
  removeSection: (sectionId: string) => void
  reorderSections: (fromIndex: number, toIndex: number) => void
  selectSection: (sectionId: string | undefined) => void
  setPreviewMode: (enabled: boolean) => void
  setDragging: (isDragging: boolean) => void
  markUnsavedChanges: (hasChanges: boolean) => void
  saveBuilderChanges: () => Promise<void>
  resetBuilder: () => void

  // Utility functions
  clearError: () => void
  setLoading: (loading: boolean) => void
}

export const useNewsletterStore = create<NewsletterStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      newsletters: [],
      templates: [],
      contentBlocks: [],
      currentNewsletter: null,
      builderState: null,
      loading: false,
      error: null,

      // Newsletter operations
      fetchNewsletters: async () => {
        set({ loading: true, error: null })
        try {
          const newsletters = await newsletterApi.getNewsletters()
          set({ newsletters, loading: false })
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
        }
      },

      fetchNewsletter: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const newsletter = await newsletterApi.getNewsletter(id)
          set({ currentNewsletter: newsletter, loading: false })
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
        }
      },

      createNewsletter: async (data: CreateNewsletterRequest) => {
        set({ loading: true, error: null })
        try {
          const newsletter = await newsletterApi.createNewsletter(data)
          set(state => ({
            newsletters: [...state.newsletters, newsletter],
            currentNewsletter: newsletter,
            loading: false
          }))
          return newsletter
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
          throw error
        }
      },

      updateNewsletter: async (id: string, data: UpdateNewsletterRequest) => {
        set({ loading: true, error: null })
        try {
          const updatedNewsletter = await newsletterApi.updateNewsletter(id, data)
          set(state => ({
            newsletters: state.newsletters.map(n => n.id === id ? updatedNewsletter : n),
            currentNewsletter: state.currentNewsletter?.id === id ? updatedNewsletter : state.currentNewsletter,
            loading: false
          }))
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
          throw error
        }
      },

      deleteNewsletter: async (id: string) => {
        set({ loading: true, error: null })
        try {
          await newsletterApi.deleteNewsletter(id)
          set(state => ({
            newsletters: state.newsletters.filter(n => n.id !== id),
            currentNewsletter: state.currentNewsletter?.id === id ? null : state.currentNewsletter,
            loading: false
          }))
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
          throw error
        }
      },

      duplicateNewsletter: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const duplicatedNewsletter = await newsletterApi.duplicateNewsletter(id)
          set(state => ({
            newsletters: [...state.newsletters, duplicatedNewsletter],
            loading: false
          }))
          return duplicatedNewsletter
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
          throw error
        }
      },

      // Template operations
      fetchTemplates: async () => {
        set({ loading: true, error: null })
        try {
          const templates = await newsletterApi.getTemplates()
          set({ templates, loading: false })
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
        }
      },

      fetchTemplate: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const template = await newsletterApi.getTemplate(id)
          set({ loading: false })
          return template
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
          throw error
        }
      },

      createTemplate: async (data: Partial<NewsletterTemplate>) => {
        set({ loading: true, error: null })
        try {
          const template = await newsletterApi.createTemplate(data)
          set(state => ({
            templates: [...state.templates, template],
            loading: false
          }))
          return template
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
          throw error
        }
      },

      updateTemplate: async (id: string, data: Partial<NewsletterTemplate>) => {
        set({ loading: true, error: null })
        try {
          const updatedTemplate = await newsletterApi.updateTemplate(id, data)
          set(state => ({
            templates: state.templates.map(t => t.id === id ? updatedTemplate : t),
            loading: false
          }))
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
          throw error
        }
      },

      deleteTemplate: async (id: string) => {
        set({ loading: true, error: null })
        try {
          await newsletterApi.deleteTemplate(id)
          set(state => ({
            templates: state.templates.filter(t => t.id !== id),
            loading: false
          }))
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
          throw error
        }
      },

      // Content block operations
      fetchContentBlocks: async () => {
        set({ loading: true, error: null })
        try {
          const contentBlocks = await newsletterApi.getContentBlocks()
          set({ contentBlocks, loading: false })
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
        }
      },

      createContentBlock: async (data: Partial<ContentBlock>) => {
        set({ loading: true, error: null })
        try {
          const contentBlock = await newsletterApi.createContentBlock(data)
          set(state => ({
            contentBlocks: [...state.contentBlocks, contentBlock],
            loading: false
          }))
          return contentBlock
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
          throw error
        }
      },

      updateContentBlock: async (id: string, data: Partial<ContentBlock>) => {
        set({ loading: true, error: null })
        try {
          const updatedBlock = await newsletterApi.updateContentBlock(id, data)
          set(state => ({
            contentBlocks: state.contentBlocks.map(b => b.id === id ? updatedBlock : b),
            loading: false
          }))
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
          throw error
        }
      },

      deleteContentBlock: async (id: string) => {
        set({ loading: true, error: null })
        try {
          await newsletterApi.deleteContentBlock(id)
          set(state => ({
            contentBlocks: state.contentBlocks.filter(b => b.id !== id),
            loading: false
          }))
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
          throw error
        }
      },

      // Builder operations
      initializeBuilder: (newsletter: Newsletter) => {
        set({
          builderState: {
            newsletter,
            selectedSection: undefined,
            isDragging: false,
            previewMode: false,
            unsavedChanges: false
          }
        })
      },

      updateBuilderNewsletter: (updates: Partial<Newsletter>) => {
        set(state => {
          if (!state.builderState) return state
          return {
            builderState: {
              ...state.builderState,
              newsletter: { ...state.builderState.newsletter, ...updates },
              unsavedChanges: true
            }
          }
        })
      },

      addSection: (section: ContentSection) => {
        set(state => {
          if (!state.builderState) return state
          const sections = [...state.builderState.newsletter.content.sections, section]
          return {
            builderState: {
              ...state.builderState,
              newsletter: {
                ...state.builderState.newsletter,
                content: {
                  ...state.builderState.newsletter.content,
                  sections
                }
              },
              unsavedChanges: true
            }
          }
        })
      },

      updateSection: (sectionId: string, updates: Partial<ContentSection>) => {
        set(state => {
          if (!state.builderState) return state
          const sections = state.builderState.newsletter.content.sections.map(section =>
            section.id === sectionId ? { ...section, ...updates } : section
          )
          return {
            builderState: {
              ...state.builderState,
              newsletter: {
                ...state.builderState.newsletter,
                content: {
                  ...state.builderState.newsletter.content,
                  sections
                }
              },
              unsavedChanges: true
            }
          }
        })
      },

      removeSection: (sectionId: string) => {
        set(state => {
          if (!state.builderState) return state
          const sections = state.builderState.newsletter.content.sections.filter(
            section => section.id !== sectionId
          )
          return {
            builderState: {
              ...state.builderState,
              newsletter: {
                ...state.builderState.newsletter,
                content: {
                  ...state.builderState.newsletter.content,
                  sections
                }
              },
              selectedSection: state.builderState.selectedSection === sectionId
                ? undefined
                : state.builderState.selectedSection,
              unsavedChanges: true
            }
          }
        })
      },

      reorderSections: (fromIndex: number, toIndex: number) => {
        set(state => {
          if (!state.builderState) return state
          const sections = [...state.builderState.newsletter.content.sections]
          const [movedSection] = sections.splice(fromIndex, 1)
          sections.splice(toIndex, 0, movedSection)

          // Update order property
          sections.forEach((section, index) => {
            section.order = index
          })

          return {
            builderState: {
              ...state.builderState,
              newsletter: {
                ...state.builderState.newsletter,
                content: {
                  ...state.builderState.newsletter.content,
                  sections
                }
              },
              unsavedChanges: true
            }
          }
        })
      },

      selectSection: (sectionId: string | undefined) => {
        set(state => {
          if (!state.builderState) return state
          return {
            builderState: {
              ...state.builderState,
              selectedSection: sectionId
            }
          }
        })
      },

      setPreviewMode: (enabled: boolean) => {
        set(state => {
          if (!state.builderState) return state
          return {
            builderState: {
              ...state.builderState,
              previewMode: enabled
            }
          }
        })
      },

      setDragging: (isDragging: boolean) => {
        set(state => {
          if (!state.builderState) return state
          return {
            builderState: {
              ...state.builderState,
              isDragging
            }
          }
        })
      },

      markUnsavedChanges: (hasChanges: boolean) => {
        set(state => {
          if (!state.builderState) return state
          return {
            builderState: {
              ...state.builderState,
              unsavedChanges: hasChanges
            }
          }
        })
      },

      saveBuilderChanges: async () => {
        const state = get()
        if (!state.builderState || !state.builderState.unsavedChanges) return

        try {
          await state.updateNewsletter(state.builderState.newsletter.id, {
            content: state.builderState.newsletter.content,
            title: state.builderState.newsletter.title
          })

          set(state => {
            if (!state.builderState) return state
            return {
              builderState: {
                ...state.builderState,
                unsavedChanges: false
              }
            }
          })
        } catch (error) {
          throw error
        }
      },

      resetBuilder: () => {
        set({ builderState: null })
      },

      // Utility functions
      clearError: () => set({ error: null }),
      setLoading: (loading: boolean) => set({ loading })
    }),
    {
      name: 'newsletter-store'
    }
  )
)
