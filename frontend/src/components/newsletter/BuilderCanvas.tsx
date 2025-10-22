'use client'

import { generateId } from '@/lib/utils'
import { useNewsletterStore } from '@/store/newsletterStore'
import type { ContentSection, SectionTemplate } from '@/types/newsletter'
import { useCallback } from 'react'
import { useDrop } from 'react-dnd'
import { DropZone } from './DropZone'
import { SectionRenderer } from './SectionRenderer'

export function BuilderCanvas(): JSX.Element {
  const {
    builderState,
    addSection,
    reorderSections,
    selectSection,
    setDragging
  } = useNewsletterStore()

  const [{ isOver }, drop] = useDrop(() => ({
    accept: ['section-template', 'section'],
    drop: (item: { template?: SectionTemplate; section?: ContentSection; index?: number }, monitor) => {
      if (!monitor.didDrop()) {
        if (item.template) {
          // Adding new section from template
          const newSection: ContentSection = {
            id: generateId(),
            type: item.template.type,
            title: item.template.defaultContent.title || 'New Section',
            items: [],
            order: builderState?.newsletter.content.sections.length || 0,
            isPersonalized: false,
            ...item.template.defaultContent
          }
          addSection(newSection)
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true })
    })
  }))

  const handleSectionMove = useCallback((dragIndex: number, hoverIndex: number) => {
    reorderSections(dragIndex, hoverIndex)
  }, [reorderSections])

  const handleSectionClick = useCallback((sectionId: string) => {
    selectSection(sectionId)
  }, [selectSection])

  if (!builderState) {
    return <div>Loading...</div>
  }

  const sections = builderState.newsletter.content.sections.sort((a, b) => a.order - b.order)

  return (
    <div
      ref={drop}
      className={`flex-1 overflow-y-auto bg-gray-50 p-6 ${isOver ? 'bg-blue-50' : ''}`}
    >
      <div className="max-w-2xl mx-auto">
        {/* Newsletter Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-6">
          <input
            type="text"
            value={builderState.newsletter.title}
            onChange={(e) => {
              const { updateBuilderNewsletter } = useNewsletterStore.getState()
              updateBuilderNewsletter({ title: e.target.value })
            }}
            className="text-2xl font-bold text-gray-900 bg-transparent border-none outline-none w-full focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
            placeholder="Newsletter Title"
          />
          <div className="mt-2 text-sm text-gray-500">
            Status: <span className="capitalize">{builderState.newsletter.status}</span>
            {builderState.newsletter.scheduledAt && (
              <span className="ml-4">
                Scheduled: {new Date(builderState.newsletter.scheduledAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Start building your newsletter</h3>
              <p className="text-gray-500 mb-4">
                Drag sections from the sidebar to create your newsletter content
              </p>
              <div className="text-sm text-gray-400">
                Try adding a text block, image, or news section to get started
              </div>
            </div>
          ) : (
            <>
              {sections.map((section, index) => (
                <div key={section.id}>
                  <DropZone
                    index={index}
                    onDrop={(item) => {
                      if (item.template) {
                        const newSection: ContentSection = {
                          id: generateId(),
                          type: item.template.type,
                          title: item.template.defaultContent.title || 'New Section',
                          items: [],
                          order: index,
                          isPersonalized: false,
                          ...item.template.defaultContent
                        }
                        addSection(newSection)
                        // Reorder sections to place the new one at the correct position
                        setTimeout(() => {
                          reorderSections(sections.length, index)
                        }, 0)
                      }
                    }}
                  />
                  <SectionRenderer
                    section={section}
                    index={index}
                    isSelected={builderState.selectedSection === section.id}
                    onClick={() => handleSectionClick(section.id)}
                    onMove={handleSectionMove}
                  />
                </div>
              ))}
              <DropZone
                index={sections.length}
                onDrop={(item) => {
                  if (item.template) {
                    const newSection: ContentSection = {
                      id: generateId(),
                      type: item.template.type,
                      title: item.template.defaultContent.title || 'New Section',
                      items: [],
                      order: sections.length,
                      isPersonalized: false,
                      ...item.template.defaultContent
                    }
                    addSection(newSection)
                  }
                }}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 text-center text-sm text-gray-500 border-t border-gray-200">
          <p>Newsletter powered by AiLert</p>
        </div>
      </div>
    </div>
  )
}
