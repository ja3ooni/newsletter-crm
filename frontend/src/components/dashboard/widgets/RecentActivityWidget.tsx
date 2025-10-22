'use client'

import { Card } from '@/components/ui/Card'

interface ActivityItem {
  id: string
  type: 'newsletter' | 'contact' | 'automation' | 'login'
  title: string
  description: string
  timestamp: string
  user?: string
}

interface RecentActivityWidgetProps {
  activities: ActivityItem[]
  className?: string
}

const activityIcons = {
  newsletter: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  contact: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  automation: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  login: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
  ),
}

const activityColors = {
  newsletter: 'text-blue-600 bg-blue-100',
  contact: 'text-green-600 bg-green-100',
  automation: 'text-purple-600 bg-purple-100',
  login: 'text-gray-600 bg-gray-100',
}

export function RecentActivityWidget({ activities, className = '' }: RecentActivityWidgetProps): JSX.Element {
  return (
    <Card className={`p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
      <div className="flow-root">
        <ul className="-mb-8">
          {activities.map((activity, index) => (
            <li key={activity.id}>
              <div className="relative pb-8">
                {index !== activities.length - 1 && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span
                      className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                        activityColors[activity.type]
                      }`}
                    >
                      {activityIcons[activity.type]}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <p className="text-sm text-gray-900 font-medium">{activity.title}</p>
                      <p className="text-sm text-gray-500">{activity.description}</p>
                      {activity.user && (
                        <p className="text-xs text-gray-400">by {activity.user}</p>
                      )}
                    </div>
                    <div className="text-right text-sm whitespace-nowrap text-gray-500">
                      {activity.timestamp}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {activities.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">No recent activity</p>
        </div>
      )}
    </Card>
  )
}

export default RecentActivityWidget
