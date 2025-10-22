'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { newsletterApi } from '@/lib/api/newsletter'
import { useNewsletterStore } from '@/store/newsletterStore'
import { useEffect, useState } from 'react'

interface SchedulingPanelProps {
  onClose: () => void
}

export function SchedulingPanel({ onClose }: SchedulingPanelProps): JSX.Element {
  const { builderState, updateBuilderNewsletter } = useNewsletterStore()

  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('later')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [segments, setSegments] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (builderState?.newsletter.scheduledAt) {
      const scheduledAt = new Date(builderState.newsletter.scheduledAt)
      setScheduledDate(scheduledAt.toISOString().split('T')[0])
      setScheduledTime(scheduledAt.toTimeString().slice(0, 5))
      setScheduleType('later')
    }
    if (builderState?.newsletter.segments) {
      setSegments(builderState.newsletter.segments)
    }
  }, [builderState])

  const handleSchedule = async () => {
    if (!builderState?.newsletter) return

    setLoading(true)
    setError(null)

    try {
      if (scheduleType === 'now') {
        // Send immediately
        await newsletterApi.sendNewsletter(builderState.newsletter.id)
        updateBuilderNewsletter({ status: 'sent', sentAt: new Date() })
        alert('Newsletter sent successfully!')
      } else {
        // Schedule for later
        if (!scheduledDate || !scheduledTime) {
          setError('Please select a date and time')
          return
        }

        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)
        if (scheduledAt <= new Date()) {
          setError('Scheduled time must be in the future')
          return
        }

        await newsletterApi.scheduleNewsletter(builderState.newsletter.id, scheduledAt, timezone)
        updateBuilderNewsletter({
          status: 'scheduled',
          scheduledAt,
          segments
        })
        alert('Newsletter scheduled successfully!')
      }

      onClose()
    } catch (err) {
      setError('Failed to schedule newsletter')
      console.error('Scheduling error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUnschedule = async () => {
    if (!builderState?.newsletter) return

    setLoading(true)
    try {
      await newsletterApi.unscheduleNewsletter(builderState.newsletter.id)
      updateBuilderNewsletter({
        status: 'draft',
        scheduledAt: undefined
      })
      setScheduleType('later')
      setScheduledDate('')
      setScheduledTime('')
      alert('Newsletter unscheduled successfully!')
    } catch (err) {
      setError('Failed to unschedule newsletter')
      console.error('Unscheduling error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!builderState) {
    return <div>Loading...</div>
  }

  const isScheduled = builderState.newsletter.status === 'scheduled'
  const isSent = builderState.newsletter.status === 'sent'

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Schedule Newsletter</h2>
            <p className="text-sm text-gray-600 mt-1">
              {isSent ? 'Newsletter has been sent' : 'Choose when to send your newsletter'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isSent ? (
          <div className="text-center py-12">
            <div className="text-green-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Newsletter Sent</h3>
            <p className="text-gray-600 mb-4">
              Your newsletter was sent on {new Date(builderState.newsletter.sentAt!).toLocaleString()}
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Status */}
            {isScheduled && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-blue-400 mr-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-blue-800 font-medium">Newsletter Scheduled</p>
                    <p className="text-blue-600 text-sm">
                      Will be sent on {new Date(builderState.newsletter.scheduledAt!).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-red-400 mr-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Schedule Options */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">When to Send</h3>
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="now"
                    checked={scheduleType === 'now'}
                    onChange={(e) => setScheduleType(e.target.value as 'now' | 'later')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-3 text-gray-900">Send now</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="radio"
                    value="later"
                    checked={scheduleType === 'later'}
                    onChange={(e) => setScheduleType(e.target.value as 'now' | 'later')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-3 text-gray-900">Schedule for later</span>
                </label>
              </div>
            </div>

            {/* Schedule Details */}
            {scheduleType === 'later' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time
                    </label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="UTC">UTC</option>
                    <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                      Local Time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                    </option>
                  </select>
                </div>
              </div>
            )}

            {/* Audience Selection */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Audience</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">All Subscribers</p>
                    <p className="text-sm text-gray-600">Send to all active subscribers</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    ~12,543 recipients
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  <p>Advanced segmentation and A/B testing options coming soon.</p>
                </div>
              </div>
            </div>

            {/* Newsletter Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Newsletter Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Title:</span>
                  <span className="text-gray-900">{builderState.newsletter.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sections:</span>
                  <span className="text-gray-900">{builderState.newsletter.content.sections.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="text-gray-900 capitalize">{builderState.newsletter.status}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!isSent && (
        <div className="p-6 border-t border-gray-200">
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>

            {isScheduled ? (
              <Button
                onClick={handleUnschedule}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                {loading ? 'Unscheduling...' : 'Unschedule'}
              </Button>
            ) : null}

            <Button
              onClick={handleSchedule}
              disabled={loading || (scheduleType === 'later' && (!scheduledDate || !scheduledTime))}
              className="flex-1"
            >
              {loading
                ? (scheduleType === 'now' ? 'Sending...' : 'Scheduling...')
                : (scheduleType === 'now' ? 'Send Now' : 'Schedule')
              }
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
