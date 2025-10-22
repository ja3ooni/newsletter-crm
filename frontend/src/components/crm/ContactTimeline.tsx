'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { activitiesApi } from '@/lib/api/crm'
import type { Activity, Contact, EngagementEvent } from '@/types/crm'
import React, { useState } from 'react'

interface ContactTimelineProps {
  contact: Contact
  activities: Activity[]
  onActivityAdd: (activity: Activity) => void
}

export const ContactTimeline: React.FC<ContactTimelineProps> = ({
  contact,
  activities,
  onActivityAdd
}) => {
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [newActivity, setNewActivity] = useState<Partial<Activity>>({
    type: 'note',
    subject: '',
    description: '',
    contactId: contact.id
  })
  const [isLoading, setIsLoading] = useState(false)

  const activityTypeOptions = [
    { value: 'call', label: 'Call' },
    { value: 'email', label: 'Email' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'task', label: 'Task' },
    { value: 'note', label: 'Note' }
  ]

  const handleAddActivity = async () => {
    try {
      setIsLoading(true)
      const response = await activitiesApi.createActivity({
        ...newActivity,
        createdBy: 'current-user' // This would come from auth context
      } as Omit<Activity, 'id' | 'createdAt'>)

      onActivityAdd(response.data)
      setNewActivity({
        type: 'note',
        subject: '',
        description: '',
        contactId: contact.id
      })
      setShowAddActivity(false)
    } catch (err) {
      console.error('Error adding activity:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        )
      case 'email':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
      case 'meeting':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        )
      case 'task':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        )
      default:
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )
    }
  }

  const getEngagementIcon = (type: string) => {
    switch (type) {
      case 'email_open':
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )
      case 'email_click':
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        )
      case 'website_visit':
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        )
      default:
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  // Combine activities and engagement events for timeline
  const timelineItems = [
    ...activities.map(activity => ({
      ...activity,
      itemType: 'activity' as const,
      timestamp: activity.createdAt
    })),
    ...contact.engagementHistory.map(event => ({
      ...event,
      itemType: 'engagement' as const,
      timestamp: event.timestamp
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Timeline
          </h2>
          <Button onClick={() => setShowAddActivity(true)}>
            Add Activity
          </Button>
        </div>

        <div className="flow-root">
          <ul className="-mb-8">
            {timelineItems.map((item, itemIdx) => (
              <li key={`${item.itemType}-${item.id}`}>
                <div className="relative pb-8">
                  {itemIdx !== timelineItems.length - 1 ? (
                    <span
                      className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700"
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-900 ${
                        item.itemType === 'activity'
                          ? 'bg-blue-500 text-white'
                          : 'bg-green-500 text-white'
                      }`}>
                        {item.itemType === 'activity'
                          ? getActivityIcon((item as Activity).type)
                          : getEngagementIcon((item as EngagementEvent).type)
                        }
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Card>
                        <div className="p-4">
                          {item.itemType === 'activity' ? (
                            <div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="secondary">
                                    {(item as Activity).type}
                                  </Badge>
                                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                                    {(item as Activity).subject}
                                  </h3>
                                </div>
                                <time className="text-sm text-gray-500 dark:text-gray-400">
                                  {formatDateTime(item.timestamp)}
                                </time>
                              </div>
                              {(item as Activity).description && (
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                  {(item as Activity).description}
                                </p>
                              )}
                              {(item as Activity).dueDate && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  Due: {formatDateTime((item as Activity).dueDate)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="success" size="sm">
                                    {(item as EngagementEvent).type.replace('_', ' ')}
                                  </Badge>
                                  <span className="text-sm text-gray-900 dark:text-white">
                                    +{(item as EngagementEvent).score} points
                                  </span>
                                </div>
                                <time className="text-sm text-gray-500 dark:text-gray-400">
                                  {formatDateTime(item.timestamp)}
                                </time>
                              </div>
                              {(item as EngagementEvent).metadata && Object.keys((item as EngagementEvent).metadata).length > 0 && (
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  {Object.entries((item as EngagementEvent).metadata).map(([key, value]) => (
                                    <div key={key}>
                                      {key}: {String(value)}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {timelineItems.length === 0 && (
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No timeline activity
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by adding an activity or wait for engagement events.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Add Activity Modal */}
      <Modal
        isOpen={showAddActivity}
        onClose={() => setShowAddActivity(false)}
        title="Add Activity"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Activity Type"
            options={activityTypeOptions}
            value={newActivity.type || ''}
            onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value as any })}
          />

          <Input
            label="Subject"
            value={newActivity.subject || ''}
            onChange={(e) => setNewActivity({ ...newActivity, subject: e.target.value })}
            placeholder="Enter activity subject"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              rows={3}
              value={newActivity.description || ''}
              onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
              placeholder="Enter activity description"
            />
          </div>

          {newActivity.type === 'task' && (
            <Input
              label="Due Date"
              type="datetime-local"
              value={newActivity.dueDate || ''}
              onChange={(e) => setNewActivity({ ...newActivity, dueDate: e.target.value })}
            />
          )}

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowAddActivity(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddActivity}
              disabled={isLoading || !newActivity.subject}
            >
              {isLoading ? 'Adding...' : 'Add Activity'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
