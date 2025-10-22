'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { importExportApi } from '@/lib/api/crm'
import { useCrmStore } from '@/store/crmStore'
import type { ContactImport, FieldMapping } from '@/types/crm'
import React, { useState } from 'react'

interface ImportInterfaceProps {
  onComplete: () => void
}

export const ImportInterface: React.FC<ImportInterfaceProps> = ({
  onComplete
}) => {
  const { addImport } = useCrmStore()
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<FieldMapping>({})
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<ContactImport | null>(null)

  const contactFields = [
    { value: '', label: 'Skip this column' },
    { value: 'email', label: 'Email *' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'company', label: 'Company' },
    { value: 'jobTitle', label: 'Job Title' },
    { value: 'phone', label: 'Phone' },
    { value: 'source', label: 'Source' },
    { value: 'tags', label: 'Tags (comma-separated)' }
  ]

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile)
      parseCSVHeaders(selectedFile)
    } else {
      alert('Please select a valid CSV file')
    }
  }

  const parseCSVHeaders = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n')
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''))
        setCsvHeaders(headers)

        // Auto-map common fields
        const autoMapping: FieldMapping = {}
        headers.forEach(header => {
          const lowerHeader = header.toLowerCase()
          if (lowerHeader.includes('email')) autoMapping[header] = 'email'
          else if (lowerHeader.includes('first') && lowerHeader.includes('name')) autoMapping[header] = 'firstName'
          else if (lowerHeader.includes('last') && lowerHeader.includes('name')) autoMapping[header] = 'lastName'
          else if (lowerHeader.includes('company')) autoMapping[header] = 'company'
          else if (lowerHeader.includes('job') || lowerHeader.includes('title')) autoMapping[header] = 'jobTitle'
          else if (lowerHeader.includes('phone')) autoMapping[header] = 'phone'
          else if (lowerHeader.includes('source')) autoMapping[header] = 'source'
          else if (lowerHeader.includes('tag')) autoMapping[header] = 'tags'
        })
        setMapping(autoMapping)
      }
    }
    reader.readAsText(file)
  }

  const handleMappingChange = (csvColumn: string, contactField: string) => {
    setMapping(prev => ({
      ...prev,
      [csvColumn]: contactField
    }))
  }

  const handleImport = async () => {
    if (!file) {
      alert('Please select a file')
      return
    }

    const hasEmailMapping = Object.values(mapping).includes('email')
    if (!hasEmailMapping) {
      alert('Email field mapping is required')
      return
    }

    try {
      setIsUploading(true)
      const response = await importExportApi.importContacts(file, mapping)
      addImport(response.data)
      setUploadProgress(response.data)

      // Poll for progress updates
      const pollProgress = setInterval(async () => {
        try {
          const statusResponse = await importExportApi.getImportStatus(response.data.id)
          setUploadProgress(statusResponse.data)

          if (statusResponse.data.status === 'completed' || statusResponse.data.status === 'failed') {
            clearInterval(pollProgress)
            setIsUploading(false)
            onComplete()
          }
        } catch (err) {
          console.error('Error polling import status:', err)
          clearInterval(pollProgress)
          setIsUploading(false)
        }
      }, 2000)

    } catch (err) {
      console.error('Error importing contacts:', err)
      alert('Failed to import contacts')
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setCsvHeaders([])
    setMapping({})
    setUploadProgress(null)
    setIsUploading(false)
  }

  const getProgressPercentage = () => {
    if (!uploadProgress || uploadProgress.totalRows === 0) return 0
    return Math.round((uploadProgress.processedRows / uploadProgress.totalRows) * 100)
  }

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Upload CSV File
          </h3>

          {!file ? (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Click to upload CSV file
                  </span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleFileSelect}
                  />
                </label>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  CSV files only. Maximum file size: 10MB
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg
                  className="h-8 w-8 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(file.size / 1024).toFixed(1)} KB • {csvHeaders.length} columns detected
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleReset}>
                Change File
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Field Mapping */}
      {csvHeaders.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Map CSV Columns to Contact Fields
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Map each CSV column to the corresponding contact field. Email field is required.
            </p>

            <div className="space-y-4">
              {csvHeaders.map((header, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      CSV Column
                    </label>
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded border">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {header}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contact Field
                    </label>
                    <Select
                      options={contactFields}
                      value={mapping[header] || ''}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Mapping Summary */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Mapping Summary
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(mapping).map(([csvColumn, contactField]) => {
                  if (!contactField) return null
                  return (
                    <Badge key={csvColumn} variant="secondary">
                      {csvColumn} → {contactField}
                    </Badge>
                  )
                })}
              </div>
              {!Object.values(mapping).includes('email') && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  ⚠️ Email field mapping is required
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Import Progress */}
      {uploadProgress && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Import Progress
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                <Badge variant={
                  uploadProgress.status === 'completed' ? 'success' :
                  uploadProgress.status === 'failed' ? 'error' :
                  uploadProgress.status === 'processing' ? 'warning' : 'default'
                }>
                  {uploadProgress.status}
                </Badge>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Progress</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {uploadProgress.processedRows} / {uploadProgress.totalRows} rows
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Successful:</span>
                  <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                    {uploadProgress.successfulRows}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Failed:</span>
                  <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                    {uploadProgress.failedRows}
                  </span>
                </div>
              </div>

              {uploadProgress.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Errors ({uploadProgress.errors.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {uploadProgress.errors.slice(0, 10).map((error, index) => (
                      <div key={index} className="text-xs text-red-600 dark:text-red-400">
                        Row {error.row}: {error.field} - {error.error}
                      </div>
                    ))}
                    {uploadProgress.errors.length > 10 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        ... and {uploadProgress.errors.length - 10} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      {csvHeaders.length > 0 && !uploadProgress && (
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button
            onClick={handleImport}
            disabled={isUploading || !Object.values(mapping).includes('email')}
          >
            {isUploading ? 'Importing...' : 'Import Contacts'}
          </Button>
        </div>
      )}
    </div>
  )
}
