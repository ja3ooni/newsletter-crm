'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNewsletterStore } from '@/store/newsletterStore'

export function SectionPropertiesPanel(): JSX.Element {
  const { builderState, updateSection, selectSection } = useNewsletterStore()

  if (!builderState?.selectedSection) {
    return <div>No section selected</div>
  }

  const section = builderState.newsletter.content.sections.find(
    s => s.id === builderState.selectedSection
  )

  if (!section) {
    return <div>Section not found</div>
  }

  const handleUpdate = (updates: any) => {
    updateSection(section.id, updates)
  }

  const handleStyleUpdate = (styleUpdates: any) => {
    handleUpdate({
      styles: {
        ...section.styles,
        ...styleUpdates
      }
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Section Properties</h3>
          <button
            onClick={() => selectSection(undefined)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {section.type.charAt(0).toUpperCase() + section.type.slice(1)} Section
        </p>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Basic Properties */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Basic Properties</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <Input
                value={section.title}
                onChange={(e) => handleUpdate({ title: e.target.value })}
                placeholder="Section title"
              />
            </div>

            {section.type === 'text' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  value={section.content || ''}
                  onChange={(e) => handleUpdate({ content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={6}
                  placeholder="Enter your text content..."
                />
              </div>
            )}

            {section.type === 'image' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image URL
                  </label>
                  <Input
                    value={section.imageUrl || ''}
                    onChange={(e) => handleUpdate({ imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Caption
                  </label>
                  <Input
                    value={section.content || ''}
                    onChange={(e) => handleUpdate({ content: e.target.value })}
                    placeholder="Image caption"
                  />
                </div>
              </>
            )}

            {section.type === 'button' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Button Text
                  </label>
                  <Input
                    value={section.buttonText || ''}
                    onChange={(e) => handleUpdate({ buttonText: e.target.value })}
                    placeholder="Click Here"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Button URL
                  </label>
                  <Input
                    value={section.buttonUrl || ''}
                    onChange={(e) => handleUpdate({ buttonUrl: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
              </>
            )}

            {section.type === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HTML Content
                </label>
                <textarea
                  value={section.content || ''}
                  onChange={(e) => handleUpdate({ content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={8}
                  placeholder="<div>Custom HTML content...</div>"
                />
              </div>
            )}
          </div>
        </div>

        {/* Styling */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Styling</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Text Alignment
              </label>
              <select
                value={section.styles?.textAlign || 'left'}
                onChange={(e) => handleStyleUpdate({ textAlign: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Font Size
              </label>
              <Input
                value={section.styles?.fontSize || '16px'}
                onChange={(e) => handleStyleUpdate({ fontSize: e.target.value })}
                placeholder="16px"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Text Color
              </label>
              <div className="flex space-x-2">
                <input
                  type="color"
                  value={section.styles?.textColor || '#000000'}
                  onChange={(e) => handleStyleUpdate({ textColor: e.target.value })}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                />
                <Input
                  value={section.styles?.textColor || '#000000'}
                  onChange={(e) => handleStyleUpdate({ textColor: e.target.value })}
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Background Color
              </label>
              <div className="flex space-x-2">
                <input
                  type="color"
                  value={section.styles?.backgroundColor || '#ffffff'}
                  onChange={(e) => handleStyleUpdate({ backgroundColor: e.target.value })}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                />
                <Input
                  value={section.styles?.backgroundColor || '#ffffff'}
                  onChange={(e) => handleStyleUpdate({ backgroundColor: e.target.value })}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Padding
              </label>
              <Input
                value={section.styles?.padding || '20px'}
                onChange={(e) => handleStyleUpdate({ padding: e.target.value })}
                placeholder="20px"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Margin
              </label>
              <Input
                value={section.styles?.margin || '0'}
                onChange={(e) => handleStyleUpdate({ margin: e.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Border Radius
              </label>
              <Input
                value={section.styles?.borderRadius || '8px'}
                onChange={(e) => handleStyleUpdate({ borderRadius: e.target.value })}
                placeholder="8px"
              />
            </div>
          </div>
        </div>

        {/* Advanced Options */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Advanced Options</h4>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="personalized"
                checked={section.isPersonalized}
                onChange={(e) => handleUpdate({ isPersonalized: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="personalized" className="ml-2 block text-sm text-gray-900">
                Enable personalization
              </label>
            </div>

            {section.isPersonalized && (
              <div className="ml-6 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  This section will be personalized based on subscriber preferences and behavior.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-gray-200">
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => {
              // Duplicate section logic
              const duplicatedSection = {
                ...section,
                id: `${section.id}-copy`,
                title: `${section.title} (Copy)`,
                order: section.order + 1
              }
              // Add the duplicated section
              const { addSection } = useNewsletterStore.getState()
              addSection(duplicatedSection)
            }}
            className="flex-1"
          >
            Duplicate
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this section?')) {
                const { removeSection } = useNewsletterStore.getState()
                removeSection(section.id)
              }
            }}
            className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
