'use client'

import { useOfflineSync } from '@/hooks/useOfflineSync'
import { useCRMStore } from '@/store/crmStore'
import { useUIStore } from '@/store/uiStore'
import { AnimatePresence, motion } from 'framer-motion'
import {
    AlertCircle,
    Bell,
    CheckCircle,
    Clock,
    Filter,
    Menu,
    Plus,
    Search,
    TrendingUp,
    Users,
    X
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { MobileContactCard } from './MobileContactCard'
import { MobileDealPipeline } from './MobileDealPipeline'
import { MobileNotificationCenter } from './MobileNotificationCenter'
import { MobileTaskList } from './MobileTaskList'
import { OfflineIndicator } from './OfflineIndicator'

interface MobileCRMDashboardProps {
  className?: string
}

export const MobileCRMDashboard: React.FC<MobileCRMDashboardProps> = ({
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'contacts' | 'tasks' | 'deals' | 'notifications'>('contacts')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const {
    contacts,
    tasks,
    deals,
    opportunities,
    isLoading,
    fetchContacts,
    fetchTasks,
    fetchDeals
  } = useCRMStore()

  const {
    notifications,
    mobileMenuOpen,
    setMobileMenuOpen,
    addNotification
  } = useUIStore()

  const { isOnline, syncStatus, pendingChanges } = useOfflineSync()

  useEffect(() => {
    // Load initial data
    fetchContacts({ page: 1, limit: 20 })
    fetchTasks({ page: 1, limit: 10, status: ['pending', 'in_progress'] })
    fetchDeals({ page: 1, limit: 10 })
  }, [fetchContacts, fetchTasks, fetchDeals])

  const filteredContacts = contacts.filter(contact =>
    contact.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const urgentTasks = tasks.filter(task =>
    task.priority === 'urgent' ||
    (task.dueDate && new Date(task.dueDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000))
  )

  const activeDeals = deals.filter(deal => deal.status === 'open')

  const unreadNotifications = notifications.filter(n => !n.read).length

  const tabConfig = [
    {
      id: 'contacts' as const,
      label: 'Contacts',
      icon: Users,
      count: filteredContacts.length,
      color: 'text-blue-600'
    },
    {
      id: 'tasks' as const,
      label: 'Tasks',
      icon: CheckCircle,
      count: urgentTasks.length,
      color: 'text-green-600'
    },
    {
      id: 'deals' as const,
      label: 'Deals',
      icon: TrendingUp,
      count: activeDeals.length,
      color: 'text-purple-600'
    },
    {
      id: 'notifications' as const,
      label: 'Alerts',
      icon: Bell,
      count: unreadNotifications,
      color: 'text-red-600'
    }
  ]

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-gray-600" />
              ) : (
                <Menu className="h-5 w-5 text-gray-600" />
              )}
            </button>
            <h1 className="text-lg font-semibold text-gray-900">CRM</h1>
          </div>

          <div className="flex items-center space-x-2">
            <OfflineIndicator isOnline={isOnline} syncStatus={syncStatus} />

            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Bell className="h-5 w-5 text-gray-600" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Filter className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts, deals, tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-gray-200">
          {tabConfig.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center py-3 px-2 relative transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {tab.count > 0 && (
                    <span className="absolute -top-2 -right-2 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {tab.count > 9 ? '9+' : tab.count}
                    </span>
                  )}
                </div>
                <span className="text-xs mt-1 font-medium">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Notification Center Overlay */}
      <AnimatePresence>
        {showNotifications && (
          <MobileNotificationCenter
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            {activeTab === 'contacts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Contacts ({filteredContacts.length})
                  </h2>
                  <button className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-gray-200 rounded-full" />
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredContacts.map((contact) => (
                      <MobileContactCard
                        key={contact.id}
                        contact={contact}
                        onCall={() => {
                          if (contact.phone) {
                            window.location.href = `tel:${contact.phone}`
                          }
                        }}
                        onEmail={() => {
                          window.location.href = `mailto:${contact.email}`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Tasks ({urgentTasks.length})
                  </h2>
                  <button className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <MobileTaskList tasks={urgentTasks} />
              </div>
            )}

            {activeTab === 'deals' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Active Deals ({activeDeals.length})
                  </h2>
                  <button className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <MobileDealPipeline deals={activeDeals} />
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Notifications ({notifications.length})
                </h2>

                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white rounded-lg p-4 border-l-4 ${
                        notification.type === 'error' ? 'border-red-500' :
                        notification.type === 'warning' ? 'border-yellow-500' :
                        notification.type === 'success' ? 'border-green-500' :
                        'border-blue-500'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-1 rounded-full ${
                          notification.type === 'error' ? 'bg-red-100' :
                          notification.type === 'warning' ? 'bg-yellow-100' :
                          notification.type === 'success' ? 'bg-green-100' :
                          'bg-blue-100'
                        }`}>
                          {notification.type === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          ) : notification.type === 'warning' ? (
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                          ) : notification.type === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Bell className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{notification.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400">
                              {new Date(notification.timestamp).toLocaleTimeString()}
                            </span>
                            {!notification.read && (
                              <span className="h-2 w-2 bg-blue-500 rounded-full" />
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="h-14 w-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          onClick={() => {
            // Quick action based on active tab
            if (activeTab === 'contacts') {
              // Navigate to add contact
            } else if (activeTab === 'tasks') {
              // Navigate to add task
            } else if (activeTab === 'deals') {
              // Navigate to add deal
            }
          }}
        >
          <Plus className="h-6 w-6" />
        </motion.button>
      </div>

      {/* Sync Status Indicator */}
      {pendingChanges > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-30">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 flex items-center space-x-2"
          >
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              {pendingChanges} changes pending sync
            </span>
          </motion.div>
        </div>
      )}
    </div>
  )
}
