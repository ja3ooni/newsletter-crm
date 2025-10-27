'use client'

import { useUIStore } from '@/store/uiStore'
import { AnimatePresence, motion } from 'framer-motion'
import {
    AlertTriangle,
    Bell,
    Calendar,
    Clock,
    Settings,
    Trash2,
    TrendingUp,
    User,
    X
} from 'lucide-react'
import React from 'react'

interface MobileNotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  className?: string
}

interface CRMNotification {
  id: string
  type: 'lead_assignment' | 'follow_up_reminder' | 'deal_update' | 'task_overdue' | 'meeting_reminder' | 'system'
  title: string
  message: string
  timestamp: Date
  read: boolean
  priority: 'low' | 'medium' | 'high' | 'urgent'
  actionUrl?: string
  metadata?: {
    contactId?: string
    dealId?: string
    taskId?: string
    meetingId?: string
  }
}

export const MobileNotificationCenter: React.FC<MobileNotificationCenterProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  const { notifications, removeNotification, clearNotifications } = useUIStore()

  // Mock CRM-specific notifications for demo
  const crmNotifications: CRMNotification[] = [
    {
      id: '1',
      type: 'lead_assignment',
      title: 'New Lead Assigned',
      message: 'John Smith from TechCorp has been assigned to you',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      read: false,
      priority: 'high',
      metadata: { contactId: 'contact-123' }
    },
    {
      id: '2',
      type: 'follow_up_reminder',
      title: 'Follow-up Reminder',
      message: 'Follow up with Sarah Johnson about the proposal',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      read: false,
      priority: 'medium',
      metadata: { contactId: 'contact-456', taskId: 'task-789' }
    },
    {
      id: '3',
      type: 'deal_update',
      title: 'Deal Stage Changed',
      message: 'Enterprise Software Deal moved to Negotiation stage',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      read: true,
      priority: 'medium',
      metadata: { dealId: 'deal-101' }
    },
    {
      id: '4',
      type: 'task_overdue',
      title: 'Task Overdue',
      message: 'Call with Mike Davis is overdue by 2 hours',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      read: false,
      priority: 'urgent',
      metadata: { taskId: 'task-202' }
    },
    {
      id: '5',
      type: 'meeting_reminder',
      title: 'Meeting in 15 minutes',
      message: 'Demo call with ABC Company starts soon',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      read: false,
      priority: 'high',
      metadata: { meetingId: 'meeting-303' }
    }
  ]

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'lead_assignment':
        return User
      case 'follow_up_reminder':
        return Clock
      case 'deal_update':
        return TrendingUp
      case 'task_overdue':
        return AlertTriangle
      case 'meeting_reminder':
        return Calendar
      case 'system':
        return Settings
      default:
        return Bell
    }
  }

  const getNotificationColor = (type: string, priority: string) => {
    if (priority === 'urgent') return 'border-red-500 bg-red-50'
    if (priority === 'high') return 'border-orange-500 bg-orange-50'

    switch (type) {
      case 'lead_assignment':
        return 'border-blue-500 bg-blue-50'
      case 'follow_up_reminder':
        return 'border-yellow-500 bg-yellow-50'
      case 'deal_update':
        return 'border-purple-500 bg-purple-50'
      case 'task_overdue':
        return 'border-red-500 bg-red-50'
      case 'meeting_reminder':
        return 'border-green-500 bg-green-50'
      default:
        return 'border-gray-300 bg-white'
    }
  }

  const getIconColor = (type: string, priority: string) => {
    if (priority === 'urgent') return 'text-red-600'
    if (priority === 'high') return 'text-orange-600'

    switch (type) {
      case 'lead_assignment':
        return 'text-blue-600'
      case 'follow_up_reminder':
        return 'text-yellow-600'
      case 'deal_update':
        return 'text-purple-600'
      case 'task_overdue':
        return 'text-red-600'
      case 'meeting_reminder':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`

    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}d ago`
  }

  const handleNotificationClick = (notification: CRMNotification) => {
    // Handle navigation based on notification type and metadata
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl
    } else if (notification.metadata) {
      // Navigate to relevant CRM section
      if (notification.metadata.contactId) {
        // Navigate to contact profile
      } else if (notification.metadata.dealId) {
        // Navigate to deal details
      } else if (notification.metadata.taskId) {
        // Navigate to task details
      } else if (notification.metadata.meetingId) {
        // Navigate to meeting details
      }
    }
    onClose()
  }

  const unreadCount = crmNotifications.filter(n => !n.read).length

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={onClose}
          />

          {/* Notification Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-xl z-50 overflow-hidden ${className}`}
          >
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bell className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {unreadCount}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {crmNotifications.length > 0 && (
                    <button
                      onClick={() => {
                        // Clear all notifications
                        clearNotifications()
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {crmNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Bell className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm">No notifications</p>
                  <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {crmNotifications.map((notification, index) => {
                    const NotificationIcon = getNotificationIcon(notification.type)

                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                          !notification.read ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start space-x-3">
                          {/* Icon */}
                          <div className={`flex-shrink-0 p-2 rounded-lg ${
                            notification.priority === 'urgent' ? 'bg-red-100' :
                            notification.priority === 'high' ? 'bg-orange-100' :
                            notification.type === 'lead_assignment' ? 'bg-blue-100' :
                            notification.type === 'follow_up_reminder' ? 'bg-yellow-100' :
                            notification.type === 'deal_update' ? 'bg-purple-100' :
                            notification.type === 'meeting_reminder' ? 'bg-green-100' :
                            'bg-gray-100'
                          }`}>
                            <NotificationIcon className={`h-4 w-4 ${getIconColor(notification.type, notification.priority)}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className={`text-sm font-medium ${
                                  !notification.read ? 'text-gray-900' : 'text-gray-700'
                                }`}>
                                  {notification.title}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {notification.message}
                                </p>
                              </div>

                              {!notification.read && (
                                <span className="flex-shrink-0 h-2 w-2 bg-blue-500 rounded-full ml-2" />
                              )}
                            </div>

                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-500">
                                {formatTimeAgo(notification.timestamp)}
                              </span>

                              {notification.priority === 'urgent' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Urgent
                                </span>
                              )}

                              {notification.priority === 'high' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  High
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4">
              <button
                onClick={() => {
                  // Navigate to notification settings
                  onClose()
                }}
                className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Settings className="h-4 w-4 mr-2" />
                Notification Settings
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
