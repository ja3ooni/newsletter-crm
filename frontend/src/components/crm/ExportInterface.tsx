'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Select } from '@/components/ui/Select'
import { importExportApi, segmentsApi } from '@/lib/api/crm'
import { useCrmStore } from '@/store/crmStore'
import type { ContactExport, ContactFilters } from '@/types/crm'
import React, { useEffect, useState } from 'react'

interface ExportInterfaceProps {
  onComplete: () => void
}

export const ExportInterface: React.FC<ExportInterfaceProps> = ({
  onComplete
}) => {
  const { addExport, segments, setSegments } = useCrmStore()
  const [filters, setFilters] = useState<ContactFilters>({})
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'email', 'firstName', 'lastName', 'company', 'jobTitle'
  ])
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<ContactExport | null>(null)

  const availableFields = [
    { id: 'email', label: 'Email', required: true },
    { id: 'firstName', label: 'First Name' },
    { id: 'lastName', label: 'Last Name' },
    { id: 'company', label: 'Company' },
    { id: 'jobTitle', label: 'Job Title' },
    { id: 'phone', label: 'Phone' },
    { id: 'lifecycle', label: 'Lifecycle Stage' },
    { id: 'leadScore', label: 'Lead Score' },
    { id: 'source', label: 'Source' },
    { id: 'tags', label: 'Tags' },
    { id: 'createdAt', label: 'Created Date' },
    { id: 'updatedAt', label: 'Updated Date' }
  ]

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

  useEffect(() => {
    loadSegments()
  }, [])

  const loadSegments = async () => {
    try {
      const response = await segmentsApi.getSegments()
      setSegments(response.data)
    } catch (err) {
      console.error('Error loading segments:', err)
    }
  }

  const handleFieldToggle = (fieldId: string) => {
    const field = availableFields.find(f => f.id === fieldId)
    if (field?.required) return // Can't uncheck required fields

    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    )
  }

  const handleFilterChange = (key: keyof ContactFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }))
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const response = await importExportApi.exportContacts(filters, selectedFields)
      addExport(response.data)
      setExportProgress(response.data)

      // Poll for progress updates
      const pollProgress = setInterval(async () => {
        try {
          const statusResponse = await importExportApi.getExportStatus(response.data.id)
          setExportProgress(statusResponse.data)

          if (statusResponse.data.status === 'completed' || statusResponse.data.status === 'failed') {
            clearInterval(pollProgress)
            setIsExporting(false)
            onComplete()
          }
        } catch (err) {
          console.error('Error polling export status:', err)
          clearInterval(pollProgress)
          setIsExporting(false)
        }
      }, 2000)

    } catch (err) {
      console.error('Error exporting contacts:', err)
      alert('Failed to export contacts')
      setIsExporting(false)
    }
  }

  const handleDownload = async () => {
    if (!exportProgress?.downloadUrl) return

    try {
      const blob = await importExportApi.downloadExport(exportProgress.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportProgress.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error downloading export:', err)
      alert('Failed to download export')
    }
  }

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value =>
      value !== undefined && value !== '' &&
      (Array.isArray(value) ? value.length > 0 : true)
    ).length
  }

  return (
    <div className="space-y-6">
      {/* Export Filters */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Export Filters
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFiltersCount()} active
              </Badge>
            )}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              label="Lifecycle Stage"
              options={lifecycleOptions}
              value={filters.lifecycle?.[0] || ''}
              onChange={(e) => handleFilterChange('lifecycle', e.target.value ? [e.target.value] : undefined)}
            />

            <Select
              label="Source"
              options={sourceOptions}
              value={filters.source?.[0] || ''}
              onChange={(e) => handleFilterChange('source', e.target.value ? [e.target.value] : undefined)}
            />

            {segments.length > 0 && (
              <Select
                label="Segment"
                options={[
                  { value: '', label: 'All Contacts' },
                  ...segments.map(segment => ({
                    value: segment.id,
                    label: segment.name
                  }))
                ]}
                value={filters.segments?.[0] || ''}
                onChange={(e) => handleFilterChange('segments', e.target.value ? [e.target.value] : undefined)}
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Lead Score
              </label>
              <input
                type="number"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                value={filters.leadScoreMin || ''}
                onChange={(e) => handleFilterChange('leadScoreMin', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Lead Score
              </label>
              <input
                type="number"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                value={filters.leadScoreMax || ''}
                onChange={(e) => handleFilterChange('leadScoreMax', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Created After
              </label>
              <input
                type="date"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Created Before
              </label>
              <input
                type="date"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Field Selection */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Select Fields to Export
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Choose which contact fields to include in your export. Required fields cannot be deselected.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableFields.map((field) => (
              <Checkbox
                key={field.id}
                label={field.label}
                description={field.required ? 'Required field' : undefined}
                checked={selectedFields.includes(field.id)}
                onChange={() => handleFieldToggle(field.id)}
                disabled={field.required}
              />
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Selected Fields ({selectedFields.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {selectedFields.map((fieldId) => {
                const field = availableFields.find(f => f.id === fieldId)
                return field ? (
                  <Badge key={fieldId} variant="secondary">
                    {field.label}
                    {field.required && ' *'}
                  </Badge>
                ) : null
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Export Progress */}
      {exportProgress && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Export Progress
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                <Badge variant={
                  exportProgress.status === 'completed' ? 'success' :
                  exportProgress.status === 'failed' ? 'error' :
                  exportProgress.status === 'processing' ? 'warning' : 'default'
                }>
                  {exportProgress.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Contacts</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {exportProgress.totalContacts.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">File Name</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {exportProgress.filename}
                </span>
              </div>

              {exportProgress.status === 'completed' && exportProgress.downloadUrl && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button onClick={handleDownload}>
                    Download Export
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      {!exportProgress && (
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={() => {
              setFilters({})
              setSelectedFields(['email', 'firstName', 'lastName', 'company', 'jobTitle'])
            }}
          >
            Reset
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedFields.length === 0}
          >
            {isExporting ? 'Exporting...' : 'Export Contacts'}
          </Button>
        </div>
      )}
    </div>
  )
}
