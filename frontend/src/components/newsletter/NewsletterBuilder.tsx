'use client'

import { useNewsletterStore } from '@/store/newsletterStore'
import { useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { BuilderCanvas } from './BuilderCanvas'
import { BuilderPreview } from './BuilderPreview'
import { BuilderSidebar } from './BuilderSidebar'
import { SchedulingPanel } from './SchedulingPanel'
import { SectionPropertiesPanel } from './SectionPropertiesPanel'
import { TemplateSelector } from './TemplateSelector'

type BuilderView = 'design' | 'preview' | 'schedule'

export function NewsletterBuilder(): JSX.Element {
  const { builderState } = useNewsletterStore()
  const [activeView, setActiveView] = useState<BuilderView>('design')
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [showScheduling, setShowScheduling] = useState(false)

  if (!builderState) {
    return <div>Loading...</div>
  }

  const renderMainContent = () => {
    switch (activeView) {
      case 'preview':
        return <BuilderPreview />
      case 'schedule':
        return <SchedulingPanel onClose={() => setActiveView('design')} />
      default:
        return <BuilderCanvas />
    }
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Content Library & Sections */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <BuilderSidebar />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* View Tabs */}
          <div className="bg-white border-b border-gray-200 px-6 py-3">
            <div className="flex space-x-6">
              <button
                onClick={() => setActiveView('design')}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeView === 'design'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Design
              </button>
              <button
                onClick={() => setActiveView('preview')}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeView === 'preview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setShowTemplateSelector(true)}
                className="pb-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
              >
                Templates
              </button>
              <button
                onClick={() => setShowScheduling(true)}
                className="pb-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
              >
                Schedule
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            {renderMainContent()}
          </div>
        </div>

        {/* Right Sidebar - Properties Panel */}
        {activeView === 'design' && builderState.selectedSection && (
          <div className="w-80 bg-white border-l border-gray-200">
            <SectionPropertiesPanel />
          </div>
        )}
      </div>

      {/* Modals */}
      {showTemplateSelector && (
        <TemplateSelector onClose={() => setShowTemplateSelector(false)} />
      )}

      {showScheduling && (
        <SchedulingPanel onClose={() => setShowScheduling(false)} />
      )}
    </DndProvider>
  )
}
