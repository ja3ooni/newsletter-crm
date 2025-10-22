'use client'

import ChartWidget from '@/components/dashboard/widgets/ChartWidget'
import RecentActivityWidget from '@/components/dashboard/widgets/RecentActivityWidget'
import StatsWidget from '@/components/dashboard/widgets/StatsWidget'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import Link from 'next/link'

// Mock data - in real app, this would come from API
const mockStats = {
  totalSubscribers: 12543,
  subscriberGrowth: 12.5,
  newslettersSent: 45,
  newsletterGrowth: 8.2,
  openRate: 24.8,
  openRateChange: -2.1,
  clickRate: 3.2,
  clickRateChange: 5.4,
}

const mockChartData = [
  { name: 'Tech News', value: 45 },
  { name: 'AI Updates', value: 38 },
  { name: 'Startup News', value: 32 },
  { name: 'Product Launches', value: 28 },
  { name: 'Industry Reports', value: 22 },
]

const mockActivities = [
  {
    id: '1',
    type: 'newsletter' as const,
    title: 'Weekly AI Newsletter Sent',
    description: 'Sent to 12,543 subscribers',
    timestamp: '2 hours ago',
    user: 'System',
  },
  {
    id: '2',
    type: 'contact' as const,
    title: 'New Contact Added',
    description: 'john.doe@example.com joined via signup form',
    timestamp: '4 hours ago',
  },
  {
    id: '3',
    type: 'automation' as const,
    title: 'Welcome Series Triggered',
    description: 'Started for 5 new subscribers',
    timestamp: '6 hours ago',
    user: 'Marketing Automation',
  },
  {
    id: '4',
    type: 'newsletter' as const,
    title: 'Newsletter Draft Created',
    description: 'Tech Weekly #45 ready for review',
    timestamp: '1 day ago',
    user: 'Content Team',
  },
]

export default function DashboardPage(): JSX.Element {
  const { user } = useAuthStore()

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Welcome back, {user?.profile.firstName}!
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Here's what's happening with your newsletter platform today.
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Link href="/dashboard/newsletters/create">
              <Button>Create Newsletter</Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatsWidget
            title="Total Subscribers"
            value={mockStats.totalSubscribers.toLocaleString()}
            change={{
              value: mockStats.subscriberGrowth,
              type: 'increase',
            }}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />

          <StatsWidget
            title="Newsletters Sent"
            value={mockStats.newslettersSent}
            change={{
              value: mockStats.newsletterGrowth,
              type: 'increase',
            }}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />

          <StatsWidget
            title="Open Rate"
            value={`${mockStats.openRate}%`}
            change={{
              value: mockStats.openRateChange,
              type: 'decrease',
            }}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
          />

          <StatsWidget
            title="Click Rate"
            value={`${mockStats.clickRate}%`}
            change={{
              value: mockStats.clickRateChange,
              type: 'increase',
            }}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            }
          />
        </div>

        {/* Charts and Activity */}
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ChartWidget
            title="Top Content Categories"
            data={mockChartData}
          />

          <RecentActivityWidget
            activities={mockActivities}
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Quick Actions</h3>
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Link href="/dashboard/newsletters/create">
                  <div className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer">
                    <div>
                      <span className="rounded-lg inline-flex p-3 bg-blue-50 text-blue-700 ring-4 ring-white">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </span>
                    </div>
                    <div className="mt-8">
                      <h3 className="text-lg font-medium">
                        <span className="absolute inset-0" aria-hidden="true" />
                        Create Newsletter
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        Start a new newsletter with our drag-and-drop editor
                      </p>
                    </div>
                  </div>
                </Link>

                <Link href="/dashboard/contacts">
                  <div className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer">
                    <div>
                      <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-700 ring-4 ring-white">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </span>
                    </div>
                    <div className="mt-8">
                      <h3 className="text-lg font-medium">
                        <span className="absolute inset-0" aria-hidden="true" />
                        Manage Contacts
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        View and organize your subscriber database
                      </p>
                    </div>
                  </div>
                </Link>

                <Link href="/dashboard/automation">
                  <div className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer">
                    <div>
                      <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 ring-4 ring-white">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </span>
                    </div>
                    <div className="mt-8">
                      <h3 className="text-lg font-medium">
                        <span className="absolute inset-0" aria-hidden="true" />
                        Setup Automation
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        Create automated email sequences and workflows
                      </p>
                    </div>
                  </div>
                </Link>

                <Link href="/dashboard/analytics">
                  <div className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer">
                    <div>
                      <span className="rounded-lg inline-flex p-3 bg-yellow-50 text-yellow-700 ring-4 ring-white">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </span>
                    </div>
                    <div className="mt-8">
                      <h3 className="text-lg font-medium">
                        <span className="absolute inset-0" aria-hidden="true" />
                        View Analytics
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        Track performance and engagement metrics
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
