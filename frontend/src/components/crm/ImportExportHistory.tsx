'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { importExportApi } from '@/lib/api/crm'
import type { ContactExport, ContactImport } from '@/types/crm'
import React from 'react'

interface ImportExportHistoryProps {
  imports: ContactImport[]
  exports: ContactExport[]
  isLoading: boolean
  onRefresh: () => void
}

export const ImportExportHistory: React.FC<ImportExportHistoryProps> = ({
  imports,
  exports,
  isLoading,
  onRefresh
}) => {
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'processing':
        return 'warning'
      case 'failed':
        return 'error'
      default:
        return 'default'
    }
  }

  const handleDownloadExport = async (exportItem: ContactExport) => {
    if (!exportItem.downloadUrl) return

    try {
      const blob = await importExportApi.downloadExport(exportItem.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportItem.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error downloading export:', err)
      alert('Failed to download export')
    }
  }

  const getProgressPercentage = (processed: number, total: number): number => {
    if (total === 0) return 0
    return Math.round((processed / total) * 100)
  }

  if (isLoading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading history...</p>
        </div>
      </Card>
    )
  }

  const allOperations = [
    ...imports.map(imp => ({ ...imp, type: 'import' as const })),
    ...exports.map(exp => ({ ...exp, type: 'export' as const }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  if (allOperations.length === 0) {
    return (
      <Card>
        <div className="p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No import/export history
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Your import and export operations will appear here.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          Import & Export History
        </h2>
        <Button variant="outline" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      {allOperations.map((operation) => (
        <Card key={`${operation.type}-${operation.id}`}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {operation.type === 'import' ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500">
                      <svg
                        className="h-5 w-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500">
                      <svg
                        className="h-5 w-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {operation.type === 'import' ? 'Import' : 'Export'}: {operation.filename}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(operation.createdAt)}
                  </p>
                </div>
              </div>
              <Badge variant={getStatusColor(operation.status)}>
                {operation.status}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {operation.type === 'import' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Total Rows
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {(operation as ContactImport).totalRows.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Successful
                    </label>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {(operation as ContactImport).successfulRows.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Failed
                    </label>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {(operation as ContactImport).failedRows.toLocaleString()}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Total Contacts
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {(operation as ContactExport).totalContacts.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Fields
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {(operation as ContactExport).fields.length} fields
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Expires
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {formatDate((operation as ContactExport).expiresAt)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Progress Bar */}
            {operation.status === 'processing' && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Progress</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {operation.type === 'import'
                      ? `${(operation as ContactImport).processedRows} / ${(operation as ContactImport).totalRows}`
                      : `${getProgressPercentage(1, 1)}%`
                    }
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${operation.type === 'import'
                        ? getProgressPercentage((operation as ContactImport).processedRows, (operation as ContactImport).totalRows)
                        : 100
                      }%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Errors */}
            {operation.type === 'import' && (operation as ContactImport).errors.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Errors ({(operation as ContactImport).errors.length})
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {(operation as ContactImport).errors.slice(0, 5).map((error, index) => (
                    <div key={index} className="text-xs text-red-600 dark:text-red-400">
                      Row {error.row}: {error.field} - {error.error}
                    </div>
                  ))}
                  {(operation as ContactImport).errors.length > 5 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      ... and {(operation as ContactImport).errors.length - 5} more errors
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-2">
              {operation.type === 'export' &&
               operation.status === 'completed' &&
               (operation as ContactExport).downloadUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadExport(operation as ContactExport)}
                >
                  Download
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
