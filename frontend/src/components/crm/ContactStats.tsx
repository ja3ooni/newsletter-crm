'use client'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { ContactStats as ContactStatsType } from '@/types/crm'
import React from 'react'

interface ContactStatsProps {
  stats: ContactStatsType
}

export const ContactStats: React.FC<ContactStatsProps> = ({ stats }) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
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

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Contacts */}
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Contacts
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {formatNumber(stats.totalContacts)}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </Card>

      {/* New Contacts This Month */}
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
                  {formatNumber(stats.newContactsThisMonth)}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </Card>

      {/* Active Contacts */}
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
                  {formatNumber(stats.activeContacts)}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </Card>

      {/* Average Lead Score */}
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Avg Lead Score
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {stats.averageLeadScore.toFixed(1)}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </Card>

      {/* Top Sources */}
      <Card className="sm:col-span-2">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Top Sources
          </h3>
          <div className="space-y-3">
            {stats.topSources.slice(0, 5).map((source, index) => (
              <div key={source.source} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {source.source}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatNumber(source.count)}
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${(source.count / stats.topSources[0].count) * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Lifecycle Distribution */}
      <Card className="sm:col-span-2">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Lifecycle Distribution
          </h3>
          <div className="flex flex-wrap gap-3">
            {stats.lifecycleDistribution.map((item) => (
              <div key={item.lifecycle} className="flex items-center space-x-2">
                <Badge variant={getLifecycleColor(item.lifecycle)}>
                  {item.lifecycle}
                </Badge>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {formatNumber(item.count)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
