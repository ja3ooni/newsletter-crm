import { cn } from '@/lib/utils'
import React, { useState } from 'react'

interface Tab {
  id: string
  label: string
  content: React.ReactNode
  disabled?: boolean
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  onChange?: (tabId: string) => void
  className?: string
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  onChange,
  className
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    onChange?.(tabId)
  }

  const handleKeyDown = (event: React.KeyboardEvent, tabId: string) => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab)
    let nextIndex = currentIndex

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
        break
      case 'ArrowRight':
        event.preventDefault()
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
        break
      case 'Home':
        event.preventDefault()
        nextIndex = 0
        break
      case 'End':
        event.preventDefault()
        nextIndex = tabs.length - 1
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!tabs[currentIndex]?.disabled) {
          handleTabChange(tabId)
        }
        return
      default:
        return
    }

    // Skip disabled tabs
    while (tabs[nextIndex]?.disabled && nextIndex !== currentIndex) {
      if (event.key === 'ArrowLeft' || event.key === 'End') {
        nextIndex = nextIndex > 0 ? nextIndex - 1 : tabs.length - 1
      } else {
        nextIndex = nextIndex < tabs.length - 1 ? nextIndex + 1 : 0
      }
    }

    if (!tabs[nextIndex]?.disabled) {
      handleTabChange(tabs[nextIndex].id)
    }
  }

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content

  return (
    <div className={cn('w-full', className)}>
      <div className="border-b border-gray-200 dark:border-gray-700" role="tablist" aria-label="Billing sections">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => !tab.disabled && handleTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              disabled={tab.disabled}
              className={cn(
                'whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                tab.disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div
        className="mt-4"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTabContent}
      </div>
    </div>
  )
}

export { Tabs }
