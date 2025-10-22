'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { contactsApi } from '@/lib/api/crm'
import type { Contact } from '@/types/crm'
import React, { useState } from 'react'

interface ContactProfileProps {
  contact: Contact
  onUpdate: (updatedContact: Contact) => void
}

export const ContactProfile: React.FC<ContactProfileProps> = ({
  contact,
  onUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<Contact>>(contact)
  const [isLoading, setIsLoading] = useState(false)
  const [newTag, setNewTag] = useState('')

  const lifecycleOptions = [
    { value: 'subscriber', label: 'Subscriber' },
    { value: 'lead', label: 'Lead' },
    { value: 'customer', label: 'Customer' },
    { value: 'evangelist', label: 'Evangelist' }
  ]

  const handleSave = async () => {
    try {
      setIsLoading(true)
      const response = await contactsApi.updateContact(contact.id, editData)
      onUpdate(response.data)
      setIsEditing(false)
    } catch (err) {
      console.error('Error updating contact:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setEditData(contact)
    setIsEditing(false)
  }

  const handleAddTag = () => {
    if (newTag.trim() && !editData.tags?.includes(newTag.trim())) {
      setEditData({
        ...editData,
        tags: [...(editData.tags || []), newTag.trim()]
      })
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setEditData({
      ...editData,
      tags: editData.tags?.filter(tag => tag !== tagToRemove) || []
    })
  }

  const getLifecycleColor = (lifecycle: string): 'default' | 'secondary' | 'success' | 'warning' => {
    switch (lifecycle) {
      case 'customer':
        return 'success'
      case 'lead':
        return 'warning'
      case 'evangelist':
        return 'secondary'
      default:
        return 'default'
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <>
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Contact Information
            </h2>
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          </div>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {contact.firstName || '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {contact.lastName || '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {contact.email}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {contact.phone || '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {contact.company || '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Job Title
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {contact.jobTitle || '-'}
                </p>
              </div>
            </div>

            {/* Lifecycle and Scoring */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lifecycle Stage
                </label>
                <Badge variant={getLifecycleColor(contact.lifecycle)}>
                  {contact.lifecycle}
                </Badge>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lead Score
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {contact.leadScore}
                  </span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min(contact.leadScore, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Source
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {contact.source}
                </p>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {contact.tags.length > 0 ? (
                  contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No tags</p>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Created
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {formatDate(contact.createdAt)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Updated
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {formatDate(contact.updatedAt)}
                </p>
              </div>
            </div>

            {/* Custom Fields */}
            {Object.keys(contact.customFields).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Fields
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(contact.customFields).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {key}
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditing}
        onClose={handleCancel}
        title="Edit Contact"
        size="lg"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={editData.firstName || ''}
              onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
            />
            <Input
              label="Last Name"
              value={editData.lastName || ''}
              onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={editData.email || ''}
              onChange={(e) => setEditData({ ...editData, email: e.target.value })}
            />
            <Input
              label="Phone"
              value={editData.phone || ''}
              onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
            />
            <Input
              label="Company"
              value={editData.company || ''}
              onChange={(e) => setEditData({ ...editData, company: e.target.value })}
            />
            <Input
              label="Job Title"
              value={editData.jobTitle || ''}
              onChange={(e) => setEditData({ ...editData, jobTitle: e.target.value })}
            />
          </div>

          <Select
            label="Lifecycle Stage"
            options={lifecycleOptions}
            value={editData.lifecycle || ''}
            onChange={(e) => setEditData({ ...editData, lifecycle: e.target.value as any })}
          />

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex space-x-2 mb-2">
              <Input
                placeholder="Add tag"
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
            {editData.tags && editData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {editData.tags.map((tag) => (
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
            )}
          </div>

          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
