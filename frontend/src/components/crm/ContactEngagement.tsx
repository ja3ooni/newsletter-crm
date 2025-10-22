'use client'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { Activity, Contact } from '@/types/crm'
import React from 'react'

interface ContactEngagementProps {
  contact: Contact
  activities: Activity[]
}

export const ContactEngagement: React.FC<ContactEngagementProps> = ({
  contact,
  activities
}) => {
  const getEngagementLevel = (score: number): { label: string; color: 'success' | 'warning' | 'error' | 'default' } => {
    if (score >= 80) return { label: 'High', color: 'success' }
    if (score >= 50) return { label: 'Medium', color: 'warning' }
    if (score >= 20) return { label: 'Low', color: 'error' }
    return { label: 'None', color: 'default' }
  }

  const getRecentEngagement = () => {
    const recentEvents = contact.engagementHistory
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)

    return recentEvents
  }

  const getEngagementStats = () => {
    const events = contact.engagementHistory
    const stats = {
      totalEvents: events.length,
      emailOpens: events.filter(e => e.type === 'email_open').length,
      emailClicks: events.filter(e => e.type === 'email_click').length,
      websiteVisits: events.filter(e => e.type === 'website_visit').length,
      formSubmits: events.filter(e => e.type === 'form_submit').length
    }

    return stats
  }

  const getActivityStats = () => {
    const completedActivities = activities.filter(a => a.completedAt).length
    const pendingActivities = activities.filter(a => !a.completedAt && a.dueDate).length
    const overdueTasks = activities.filter(a =>
      !a.completedAt &&
      a.dueDate &&
      new Date(a.dueDate) < new Date()
    ).length

    return {
      total: activities.length,
      completed: completedActivities,
      pending: pendingActivities,
      overdue: overdueTasks
    }
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const engagement = getEngagementLevel(contact.leadScore)
  const engagementStats = getEngagementStats()
  const activityStats = getActivityStats()
  const recentEvents = getRecentEngagement()

  return (
    <div className="space-y-6">
      {/* Lead Score */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Lead Score
          </h3>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {contact.leadScore}
            </div>
            <Badge variant={engagement.color}>
              {engagement.label} Engagement
            </Badge>
            <div className="mt-4 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(contact.leadScore, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Engagement Stats */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Engagement Overview
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Events</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {engagementStats.totalEvents}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Email Opens</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {engagementStats.emailOpens}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Email Clicks</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {engagementStats.emailClicks}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Website Visits</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {engagementStats.websiteVisits}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Form Submits</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {engagementStats.formSubmits}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Activity Summary */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Activities
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Activities</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {activityStats.total}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {activityStats.completed}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Pending</span>
              <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                {activityStats.pending}
              </span>
            </div>
            {activityStats.overdue > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Overdue</span>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {activityStats.overdue}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Recent Engagement */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Recent Engagement
          </h3>
          {recentEvents.length > 0 ? (
            <div className="space-y-3">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="flex-shrink-0">
                      {event.type === 'email_open' && (
                        <div className="h-2 w-2 bg-blue-500 rounded-full" />
                      )}
                      {event.type === 'email_click' && (
                        <div className="h-2 w-2 bg-green-500 rounded-full" />
                      )}
                      {event.type === 'website_visit' && (
                        <div className="h-2 w-2 bg-purple-500 rounded-full" />
                      )}
                      {event.type === 'form_submit' && (
                        <div className="h-2 w-2 bg-orange-500 rounded-full" />
                      )}
                      {event.type === 'purchase' && (
                        <div className="h-2 w-2 bg-yellow-500 rounded-full" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {event.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        +{event.score} points
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(event.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No recent engagement activity
            </p>
          )}
        </div>
      </Card>

      {/* Contact Preferences */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Preferences
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Email Frequency</label>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {contact.preferences.emailFrequency}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Content Types</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {contact.preferences.contentTypes.map((type) => (
                  <Badge key={type} variant="secondary" size="sm">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Timezone</label>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {contact.preferences.timezone}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Language</label>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {contact.preferences.language}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
