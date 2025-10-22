'use client'

import { ExportInterface } from '@/components/crm/ExportInterface'
import { ImportExportHistory } from '@/components/crm/ImportExportHistory'
import { ImportInterface } from '@/components/crm/ImportInterface'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { useCrmStore } from '@/store/crmStore'
import React, { useEffect } from 'react'

const ImportExportPage: React.FC = () => {
  const {
    imports,
    exports,
    isLoading,
    error,
    setImports,
    setExports,
    setLoading,
    setError,
    clearError
  } = useCrmStore()

  useEffect(() => {
    loadImportExportHistory()
  }, [])

  const loadImportExportHistory = async () => {
    try {
      setLoading(true)
      clearError()
      // Note: These endpoints would need to be implemented in the API
      // For now, we'll use empty arrays
      setImports([])
      setExports([])
    } catch (err) {
      setError('Failed to load import/export history')
      console.error('Error loading import/export history:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    loadImportExportHistory()
  }

  const tabs = [
    {
      id: 'import',
      label: 'Import Contacts',
      content: <ImportInterface onComplete={handleRefresh} />
    },
    {
      id: 'export',
      label: 'Export Contacts',
      content: <ExportInterface onComplete={handleRefresh} />
    },
    {
      id: 'history',
      label: 'History',
      content: (
        <ImportExportHistory
          imports={imports}
          exports={exports}
          isLoading={isLoading}
          onRefresh={handleRefresh}
        />
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Import & Export
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Import contacts from CSV files or export your contact data
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleRefresh}>
            Refresh
          </Button>
          <Button href="/dashboard/crm">
            Back to CRM
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={clearError}
                  className="text-red-400 hover:text-red-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} defaultTab="import" />
    </div>
  )
}

export default ImportExportPage
