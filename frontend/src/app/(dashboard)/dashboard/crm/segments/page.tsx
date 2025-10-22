'use client'

import { SegmentBuilder } from '@/components/crm/SegmentBuilder'
import { SegmentsList } from '@/components/crm/SegmentsList'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { segmentsApi } from '@/lib/api/crm'
import { useCrmStore } from '@/store/crmStore'
import type { Segment } from '@/types/crm'
import React, { useEffect, useState } from 'react'

const SegmentsPage: React.FC = () => {
  const {
    segments,
    isLoading,
    error,
    setSegments,
    addSegment,
    setLoading,
    setError,
    clearError
  } = useCrmStore()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)

  useEffect(() => {
    loadSegments()
  }, [])

  const loadSegments = async () => {
    try {
      setLoading(true)
      clearError()
      const response = await segmentsApi.getSegments()
      setSegments(response.data)
    } catch (err) {
      setError('Failed to load segments')
      console.error('Error loading segments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSegmentCreated = (segment: Segment) => {
    addSegment(segment)
    setShowCreateModal(false)
  }

  const handleSegmentUpdated = (segment: Segment) => {
    setSegments(segments.map(s => s.id === segment.id ? segment : s))
    setEditingSegment(null)
  }

  const handleRefresh = () => {
    loadSegments()
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Segments
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create and manage contact segments with dynamic rules
            </p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={handleRefresh}>
              Refresh
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              Create Segment
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

        {/* Segments List */}
        <SegmentsList
          segments={segments}
          isLoading={isLoading}
          onEdit={setEditingSegment}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Create Segment Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Segment"
        size="xl"
      >
        <SegmentBuilder
          onSave={handleSegmentCreated}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Segment Modal */}
      <Modal
        isOpen={!!editingSegment}
        onClose={() => setEditingSegment(null)}
        title="Edit Segment"
        size="xl"
      >
        {editingSegment && (
          <SegmentBuilder
            segment={editingSegment}
            onSave={handleSegmentUpdated}
            onCancel={() => setEditingSegment(null)}
          />
        )}
      </Modal>
    </>
  )
}

export default SegmentsPage
