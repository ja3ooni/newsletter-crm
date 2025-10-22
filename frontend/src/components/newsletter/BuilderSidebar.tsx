'use client'

import { useNewsletterStore } from '@/store/newsletterStore'
import type { SectionTemplate } from '@/types/newsletter'
import { useEffect, useState } from 'react'
import { useDrag } from 'react-dnd'

const sectionTemplates: SectionTemplate[] = [
  {
    id: 'text',
    name: 'Text Block',
    type: 'text',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
    description: 'Add formatted text content',
    defaultContent: {
      title: 'Text Section',
      content: 'Enter your text content here...',
      styles: {
        textAlign: 'left',
        fontSize: '16px',
        padding: '20px'
      }
    }
  },
  {
    id: 'image',
    name: 'Image',
    type: 'image',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: 'Add an image with caption',
    defaultContent: {
      title: 'Image Section',
      imageUrl: 'https://via.placeholder.com/600x300',
      content: 'Image caption...',
      styles: {
        textAlign: 'center',
        padding: '20px'
      }
    }
  },
  {
    id: 'button',
    name: 'Button',
    type: 'button',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
    ),
    description: 'Add a call-to-action button',
    defaultContent: {
      title: 'Button Section',
      buttonText: 'Click Here',
      buttonUrl: 'https://example.com',
      styles: {
        textAlign: 'center',
        padding: '20px',
        backgroundColor: '#3B82F6'
      }
    }
  },
  {
    id: 'divider',
    name: 'Divider',
    type: 'divider',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    ),
    description: 'Add a visual separator',
    defaultContent: {
      title: 'Divider',
      styles: {
        padding: '10px',
        textAlign: 'center'
      }
    }
  },
  {
    id: 'news',
    name: 'News Section',
    type: 'news',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
    description: 'Add curated news content',
    defaultContent: {
      title: 'Latest News',
      styles: {
        padding: '20px'
      }
    }
  },
  {
    id: 'custom',
    name: 'Custom HTML',
    type: 'custom',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    description: 'Add custom HTML content',
    defaultContent: {
      title: 'Custom Section',
      content: '<div>Custom HTML content...</div>',
      styles: {
        padding: '20px'
      }
    }
  }
]

interface DraggableSectionProps {
  template: SectionTemplate
}

function DraggableSection({ template }: DraggableSectionProps): JSX.Element {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'section-template',
    item: { template },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }))

  return (
    <div
      ref={drag}
      className={`p-3 border border-gray-200 rounded-lg cursor-move hover:border-blue-300 hover:bg-blue-50 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className="text-gray-600">{template.icon}</div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900">{template.name}</h4>
          <p className="text-xs text-gray-500">{template.description}</p>
        </div>
      </div>
    </div>
  )
}

export function BuilderSidebar(): JSX.Element {
  const { contentBlocks, fetchContentBlocks } = useNewsletterStore()
  const [activeTab, setActiveTab] = useState<'sections' | 'blocks' | 'library'>('sections')

  useEffect(() => {
    if (activeTab === 'blocks') {
      fetchContentBlocks()
    }
  }, [activeTab, fetchContentBlocks])

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6 py-3">
          <button
            onClick={() => setActiveTab('sections')}
            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
              activeTab === 'sections'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sections
          </button>
          <button
            onClick={() => setActiveTab('blocks')}
            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
              activeTab === 'blocks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Blocks
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
              activeTab === 'library'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Library
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'sections' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Content Sections</h3>
              <p className="text-xs text-gray-500 mb-4">
                Drag and drop sections to build your newsletter
              </p>
            </div>
            <div className="space-y-3">
              {sectionTemplates.map((template) => (
                <DraggableSection key={template.id} template={template} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'blocks' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Content Blocks</h3>
              <p className="text-xs text-gray-500 mb-4">
                Reusable content blocks for your newsletters
              </p>
            </div>
            {contentBlocks.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No content blocks yet</p>
                <button className="mt-2 text-xs text-blue-600 hover:text-blue-700">
                  Create your first block
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {contentBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="p-3 border border-gray-200 rounded-lg cursor-move hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <h4 className="text-sm font-medium text-gray-900">{block.name}</h4>
                    <p className="text-xs text-gray-500">{block.category}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Content Library</h3>
              <p className="text-xs text-gray-500 mb-4">
                Saved content and templates
              </p>
            </div>
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">Content library coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
