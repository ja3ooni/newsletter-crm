'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { segmentsApi } from '@/lib/api/crm'
import { useCrmStore } from '@/store/crmStore'
import type { Segment } from '@/types/crm'
import React from 'react'

interface SegmentsListProps {
  segments: Segment[]
  isLoading: boolean
  onEdit: (segment: Segment) => void
  onRefresh: () => void
}

export const SegmentsList: React.FC<SegmentsListProps> = ({
  segments,
  isLoading,
  onEdit,
  onRefresh
}) => {
  const { removeSegment, updateSegment } = useCrmStore()

  const handleDelete = async (segmentId: string) => {
    if (confirm('Are you sure you want to delete this segment?')) {
      try {
        await segmentsApi.deleteSegment(segmentId)
        removeSegment(segmentId)
      } catch (err) {
        console.error('Error deleting segment:', err)
      }
    }
  }

  const handleRefresh = async (segmentId: string) => {
    try {
      const response = await segmentsApi.refreshSegment(segmentId)
      updateSegment(segmentId, response.data)
    } catch (err) {
      console.error('Error refreshing segment:', err)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  if (isLoading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading segments...</p>
        </div>
      </Card>
    )
  }

  if (segments.length === 0) {
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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No segments</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating your first contact segment.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {segments.map((segment) => (
        <Card key={segment.id} className="hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {segment.name}
                </h3>
                {segment.isAutoUpdating && (
                  <Badge variant="success" size="sm">
                    Auto
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRefresh(segment.id)}
                  title="Refresh segment"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
              {segment.description}
            </p>

            <div className="flex items-center justify-between mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(segment.contactCount)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Contacts
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {segment.conditions.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Rules
                </div>
              </div>
            </div>

            {/* Conditions Preview */}
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Conditions:
              </div>
              <div className="space-y-1">
                {segment.conditions.slice(0, 2).map((condition, index) => (
                  <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                    {condition.field} {condition.operator} {String(condition.value)}
                  </div>
                ))}
                {segment.conditions.length > 2 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    +{segment.conditions.length - 2} more...
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Created: {formatDate(segment.createdAt)}
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(segment)}
                className="flex-1"
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                href={`/dashboard/crm/segments/${segment.id}/contacts`}
                className="flex-1"
              >
                View Contacts
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(segment.id)}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
