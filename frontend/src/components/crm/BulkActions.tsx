'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { contactsApi } from '@/lib/api/crm'
import { useCrmStore } from '@/store/crmStore'
import React, { useState } from 'react'

interface BulkActionsProps {
  selectedContacts: string[]
  onComplete: () => void
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedContacts,
  onComplete
}) => {
  const { clearContactSelection, setLoading, setError } = useCrmStore()
  const [showModal, setShowModal] = useState(false)
  const [actionType, setActionType] = useState<'update' | 'delete' | 'tag' | 'export'>('update')
  const [updateData, setUpdateData] = useState<any>({})
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  const lifecycleOptions = [
    { value: '', label: 'No change' },
    { value: 'subscriber', label: 'Subscriber' },
    { value: 'lead', label: 'Lead' },
    { value: 'customer', label: 'Customer' },
    { value: 'evangelist', label: 'Evangelist' }
  ]

  const handleBulkAction = async () => {
    try {
      setLoading(true)

      switch (actionType) {
        case 'update':
          await contactsApi.bulkUpdateContacts(selectedContacts, updateData)
          break
        case 'delete':
          await contactsApi.bulkDeleteContacts(selectedContacts)
          break
        case 'tag':
          await contactsApi.addTagsToContacts(selectedContacts, tags)
          break
        case 'export':
          // Export functionality would be handled differently
          break
      }

      clearContactSelection()
      setShowModal(false)
      onComplete()
    } catch (err) {
      setError(`Failed to perform bulk ${actionType}`)
      console.error(`Error performing bulk ${actionType}:`, err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const renderActionForm = () => {
    switch (actionType) {
      case 'update':
        return (
          <div className="space-y-4">
            <Select
              label="Lifecycle Stage"
              options={lifecycleOptions}
              value={updateData.lifecycle || ''}
              onChange={(e) => setUpdateData({ ...updateData, lifecycle: e.target.value || undefined })}
            />
            <Input
              label="Company"
              placeholder="Company name"
              value={updateData.company || ''}
              onChange={(e) => setUpdateData({ ...updateData, company: e.target.value || undefined })}
            />
            <Input
              label="Job Title"
              placeholder="Job title"
              value={updateData.jobTitle || ''}
              onChange={(e) => setUpdateData({ ...updateData, jobTitle: e.target.value || undefined })}
            />
          </div>
        )

      case 'tag':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add Tags
              </label>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter tag name"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                />
                <Button type="button" onClick={handleAddTag}>
                  Add
                </Button>
              </div>
            </div>
            {tags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags to Add
                </label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-xs"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      case 'delete':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20">
              <svg
                className="h-6 w-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Delete Contacts
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete {selectedContacts.length} contact(s)?
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const getActionTitle = () => {
    switch (actionType) {
      case 'update':
        return 'Update Contacts'
      case 'delete':
        return 'Delete Contacts'
      case 'tag':
        return 'Add Tags'
      case 'export':
        return 'Export Contacts'
      default:
        return 'Bulk Action'
    }
  }

  const isActionValid = () => {
    switch (actionType) {
      case 'update':
        return Object.values(updateData).some(value => value !== undefined && value !== '')
      case 'tag':
        return tags.length > 0
      case 'delete':
        return true
      case 'export':
        return true
      default:
        return false
    }
  }

  return (
    <>
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-600 dark:text-blue-400"
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
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {selectedContacts.length} contact(s) selected
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionType('update')
                  setShowModal(true)
                }}
              >
                Update
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionType('tag')
                  setShowModal(true)
                }}
              >
                Add Tags
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionType('delete')
                  setShowModal(true)
                }}
              >
                Delete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearContactSelection}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={getActionTitle()}
        size="md"
      >
        <div className="space-y-6">
          {renderActionForm()}

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAction}
              disabled={!isActionValid()}
              variant={actionType === 'delete' ? 'destructive' : 'primary'}
            >
              {actionType === 'delete' ? 'Delete' : 'Apply'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
