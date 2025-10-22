'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useCrmStore } from '@/store/crmStore'
import type { ContactFilters as ContactFiltersType } from '@/types/crm'
import React, { useState } from 'react'

export const ContactFilters: React.FC = () => {
  const { contactFilters, segments, setContactFilters } = useCrmStore()
  const [localFilters, setLocalFilters] = useState<ContactFiltersType>(contactFilters)
  const [isExpanded, setIsExpanded] = useState(false)

  const lifecycleOptions = [
    { value: '', label: 'All Lifecycles' },
    { value: 'subscriber', label: 'Subscriber' },
    { value: 'lead', label: 'Lead' },
    { value: 'customer', label: 'Customer' },
    { value: 'evangelist', label: 'Evangelist' }
  ]

  const sourceOptions = [
    { value: '', label: 'All Sources' },
    { value: 'website', label: 'Website' },
    { value: 'newsletter', label: 'Newsletter' },
    { value: 'social_media', label: 'Social Media' },
    { value: 'referral', label: 'Referral' },
    { value: 'import', label: 'Import' },
    { value: 'api', label: 'API' }
  ]

  const handleFilterChange = (key: keyof ContactFiltersType, value: any) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleApplyFilters = () => {
    setContactFilters(localFilters)
  }

  const handleClearFilters = () => {
    const clearedFilters: ContactFiltersType = {}
    setLocalFilters(clearedFilters)
    setContactFilters(clearedFilters)
  }

  const handleTagRemove = (tag: string) => {
    const updatedTags = localFilters.tags?.filter(t => t !== tag) || []
    handleFilterChange('tags', updatedTags.length > 0 ? updatedTags : undefined)
  }

  const handleSegmentRemove = (segmentId: string) => {
    const updatedSegments = localFilters.segments?.filter(s => s !== segmentId) || []
    handleFilterChange('segments', updatedSegments.length > 0 ? updatedSegments : undefined)
  }

  const getActiveFiltersCount = () => {
    return Object.values(localFilters).filter(value =>
      value !== undefined && value !== '' &&
      (Array.isArray(value) ? value.length > 0 : true)
    ).length
  }

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Filters
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </h3>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
            {getActiveFiltersCount() > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Clear All
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Search */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search contacts..."
              value={localFilters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
            <Select
              options={lifecycleOptions}
              value={localFilters.lifecycle?.[0] || ''}
              onChange={(e) => handleFilterChange('lifecycle', e.target.value ? [e.target.value] : undefined)}
            />
            <Select
              options={sourceOptions}
              value={localFilters.source?.[0] || ''}
              onChange={(e) => handleFilterChange('source', e.target.value ? [e.target.value] : undefined)}
            />
          </div>

          {/* Expanded Filters */}
          {isExpanded && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {/* Lead Score Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="number"
                  placeholder="Min Lead Score"
                  value={localFilters.leadScoreMin || ''}
                  onChange={(e) => handleFilterChange('leadScoreMin', e.target.value ? parseInt(e.target.value) : undefined)}
                />
                <Input
                  type="number"
                  placeholder="Max Lead Score"
                  value={localFilters.leadScoreMax || ''}
                  onChange={(e) => handleFilterChange('leadScoreMax', e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="date"
                  placeholder="From Date"
                  value={localFilters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
                <Input
                  type="date"
                  placeholder="To Date"
                  value={localFilters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>

              {/* Tags Input */}
              <div>
                <Input
                  placeholder="Add tags (press Enter to add)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const input = e.target as HTMLInputElement
                      const tag = input.value.trim()
                      if (tag && !localFilters.tags?.includes(tag)) {
                        handleFilterChange('tags', [...(localFilters.tags || []), tag])
                        input.value = ''
                      }
                    }
                  }}
                />
                {localFilters.tags && localFilters.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {localFilters.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer">
                        {tag}
                        <button
                          onClick={() => handleTagRemove(tag)}
                          className="ml-1 text-xs"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Segments */}
              {segments.length > 0 && (
                <div>
                  <Select
                    options={[
                      { value: '', label: 'Select segment to add' },
                      ...segments.map(segment => ({
                        value: segment.id,
                        label: segment.name
                      }))
                    ]}
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !localFilters.segments?.includes(e.target.value)) {
                        handleFilterChange('segments', [...(localFilters.segments || []), e.target.value])
                      }
                    }}
                  />
                  {localFilters.segments && localFilters.segments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {localFilters.segments.map((segmentId) => {
                        const segment = segments.find(s => s.id === segmentId)
                        return segment ? (
                          <Badge key={segmentId} variant="info" className="cursor-pointer">
                            {segment.name}
                            <button
                              onClick={() => handleSegmentRemove(segmentId)}
                              className="ml-1 text-xs"
                            >
                              ×
                            </button>
                          </Badge>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Apply Button */}
          <div className="flex justify-end">
            <Button onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
