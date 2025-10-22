'use client'

import type { SectionTemplate } from '@/types/newsletter'
import { useDrop } from 'react-dnd'

interface DropZoneProps {
  index: number
  onDrop: (item: { template?: SectionTemplate }) => void
}

export function DropZone({ index, onDrop }: DropZoneProps): JSX.Element {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'section-template',
    drop: (item: { template: SectionTemplate }) => {
      onDrop(item)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  }))

  const isActive = isOver && canDrop

  return (
    <div
      ref={drop}
      className={`h-2 transition-all duration-200 ${
        isActive
          ? 'h-16 bg-blue-100 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center'
          : 'bg-transparent'
      }`}
    >
      {isActive && (
        <div className="text-blue-600 text-sm font-medium">
          Drop section here
        </div>
      )}
    </div>
  )
}
