'use client'

import { useNewsletterStore } from '@/store/newsletterStore'
import type { ContentSection } from '@/types/newsletter'
import { useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'

interface SectionRendererProps {
  section: ContentSection
  index: number
  isSelected: boolean
  onClick: () => void
  onMove: (dragIndex: number, hoverIndex: number) => void
}

export function SectionRenderer({
  section,
  index,
  isSelected,
  onClick,
  onMove
}: SectionRendererProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const { removeSection } = useNewsletterStore()

  const [{ handlerId }, drop] = useDrop({
    accept: 'section',
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId()
      }
    },
    hover(item: { index: number }, monitor) {
      if (!ref.current) {
        return
      }
      const dragIndex = item.index
      const hoverIndex = index

      if (dragIndex === hoverIndex) {
        return
      }

      const hoverBoundingRect = ref.current?.getBoundingClientRect()
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
      const clientOffset = monitor.getClientOffset()
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return
      }

      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return
      }

      onMove(dragIndex, hoverIndex)
      item.index = hoverIndex
    }
  })

  const [{ isDragging }, drag] = useDrag({
    type: 'section',
    item: () => {
      return { id: section.id, index }
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  })

  drag(drop(ref))

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this section?')) {
      removeSection(section.id)
    }
  }

  const renderSectionContent = () => {
    switch (section.type) {
      case 'text':
        return (
          <div
            className="prose max-w-none"
            style={{
              textAlign: section.styles?.textAlign || 'left',
              fontSize: section.styles?.fontSize || '16px',
              color: section.styles?.textColor || '#000000'
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: section.content || 'Enter your text content...' }} />
          </div>
        )

      case 'image':
        return (
          <div style={{ textAlign: section.styles?.textAlign || 'center' }}>
            <img
              src={section.imageUrl || 'https://via.placeholder.com/600x300'}
              alt={section.title}
              className="max-w-full h-auto rounded-lg"
            />
            {section.content && (
              <p className="mt-2 text-sm text-gray-600">{section.content}</p>
            )}
          </div>
        )

      case 'button':
        return (
          <div style={{ textAlign: section.styles?.textAlign || 'center' }}>
            <a
              href={section.buttonUrl || '#'}
              className="inline-block px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: section.styles?.backgroundColor || '#3B82F6'
              }}
            >
              {section.buttonText || 'Click Here'}
            </a>
          </div>
        )

      case 'divider':
        return (
          <div style={{ textAlign: section.styles?.textAlign || 'center' }}>
            <hr className="border-gray-300" />
          </div>
        )

      case 'news':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
            {section.items.length === 0 ? (
              <div className="text-gray-500 text-sm">
                No news items yet. Content will be automatically populated based on your settings.
              </div>
            ) : (
              <div className="space-y-4">
                {section.items.slice(0, 5).map((item) => (
                  <div key={item.id} className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium text-gray-900">
                      <a href={item.url} className="hover:text-blue-600">
                        {item.title}
                      </a>
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">{item.summary}</p>
                    <div className="text-xs text-gray-500 mt-2">
                      {item.source} • {new Date(item.publishedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'custom':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
            <div dangerouslySetInnerHTML={{ __html: section.content || '<div>Custom HTML content...</div>' }} />
          </div>
        )

      default:
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
            <p className="text-gray-600">Section type: {section.type}</p>
          </div>
        )
    }
  }

  return (
    <div
      ref={ref}
      data-handler-id={handlerId}
      className={`bg-white rounded-lg shadow-sm border-2 transition-all cursor-pointer ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300'
      } ${isDragging ? 'opacity-50' : ''}`}
      onClick={onClick}
      style={{
        padding: section.styles?.padding || '20px',
        margin: section.styles?.margin || '0',
        backgroundColor: section.styles?.backgroundColor || '#ffffff',
        borderRadius: section.styles?.borderRadius || '8px'
      }}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 opacity-0 hover:opacity-100 transition-opacity">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-gray-400 rounded-full cursor-move"></div>
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            {section.type}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {section.isPersonalized && (
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
              Personalized
            </span>
          )}
          <button
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Section Content */}
      <div className="min-h-[60px]">
        {renderSectionContent()}
      </div>
    </div>
  )
}
