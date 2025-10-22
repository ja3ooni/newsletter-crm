'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { contactsApi } from '@/lib/api/crm'
import type { Contact, ContactStats } from '@/types/crm'
import React, { useEffect, useState } from 'react'

export const LeadScoringDashboard: React.FC = () => {
  const [topContacts, setTopContacts] = useState<Contact[]>([])
  const [stats, setStats] = useState<ContactStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      const [contactsResponse, statsResponse] = await Promise.all([
        contactsApi.getContacts({
          sort: 'leadScore',
          order: 'desc',
          limit: 10
        }),
        contactsApi.getContactStats()
      ])

      setTopContacts(contactsResponse.data)
      setStats(statsResponse.data)
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-blue-600 dark:text-blue-400'
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
    if (score >= 20) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getScoreLevel = (score: number): { label: string; variant: 'success' | 'secondary' | 'warning' | 'error' } => {
    if (score >= 80) return { label: 'Hot', variant: 'success' }
    if (score >= 60) return { label: 'Warm', variant: 'secondary' }
    if (score >= 40) return { label: 'Lukewarm', variant: 'warning' }
    return { label: 'Cold', variant: 'error' }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString()
  }

  const getScoreDistribution = () => {
    if (!topContacts.length) return []

    const ranges = [
      { label: '80-100', min: 80, max: 100, count: 0, color: 'bg-green-500' },
      { label: '60-79', min: 60, max: 79, count: 0, color: 'bg-blue-500' },
      { label: '40-59', min: 40, max: 59, count: 0, color: 'bg-yellow-500' },
      { label: '20-39', min: 20, max: 39, count: 0, color: 'bg-orange-500' },
      { label: '0-19', min: 0, max: 19, count: 0, color: 'bg-red-500' }
    ]

    topContacts.forEach(contact => {
      const range = ranges.find(r => contact.leadScore >= r.min && contact.leadScore <= r.max)
      if (range) range.count++
    })

    return ranges
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const scoreDistribution = getScoreDistribution()

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
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
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Average Score
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">
                      {stats.averageLeadScore.toFixed(1)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
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
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      High Scores (80+)
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">
                      {scoreDistribution.find(r => r.label === '80-100')?.count || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-yellow-500">
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
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Active Contacts
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">
                      {stats.activeContacts}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500">
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
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      New This Month
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">
                      {stats.newContactsThisMonth}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Score Distribution */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Score Distribution
          </h3>
          <div className="space-y-4">
            {scoreDistribution.map((range) => (
              <div key={range.label} className="flex items-center">
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`w-4 h-4 rounded ${range.color}`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {range.label}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {range.count} contacts
                  </span>
                  <div className="w-32 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div
                      className={`h-2 rounded-full ${range.color}`}
                      style={{
                        width: `${topContacts.length > 0 ? (range.count / topContacts.length) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Top Scoring Contacts */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Top Scoring Contacts
            </h3>
            <Button
              variant="outline"
              href="/dashboard/crm?sort=leadScore&order=desc"
            >
              View All
            </Button>
          </div>

          {topContacts.length > 0 ? (
            <div className="space-y-4">
              {topContacts.map((contact, index) => {
                const scoreLevel = getScoreLevel(contact.leadScore)
                return (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            #{index + 1}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {contact.firstName && contact.lastName
                            ? `${contact.firstName} ${contact.lastName}`
                            : contact.email}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {contact.company && contact.jobTitle
                            ? `${contact.jobTitle} at ${contact.company}`
                            : contact.company || contact.jobTitle || contact.email}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Last updated: {formatDate(contact.updatedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge variant={scoreLevel.variant}>
                        {scoreLevel.label}
                      </Badge>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${getScoreColor(contact.leadScore)}`}>
                          {contact.leadScore}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          points
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        href={`/dashboard/crm/contacts/${contact.id}`}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No contacts found
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
