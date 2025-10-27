'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
    AlertCircle,
    CheckCircle,
    Clock,
    RefreshCw,
    Upload,
    Wifi,
    WifiOff
} from 'lucide-react'
import React from 'react'

interface OfflineIndicatorProps {
  isOnline: boolean
  syncStatus: 'idle' | 'syncing' | 'success' | 'error'
  pendingChanges?: number
  lastSyncTime?: Date
  className?: string
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline,
  syncStatus,
  pendingChanges = 0,
  lastSyncTime,
  className = ''
}) => {
  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return RefreshCw
      case 'success':
        return CheckCircle
      case 'error':
        return AlertCircle
      default:
        return isOnline ? Wifi : WifiOff
    }
  }

  const getSyncColor = () => {
    if (!isOnline) return 'text-red-500'

    switch (syncStatus) {
      case 'syncing':
        return 'text-blue-500'
      case 'success':
        return 'text-green-500'
      case 'error':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusText = () => {
    if (!isOnline) return 'Offline'

    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...'
      case 'success':
        return 'Synced'
      case 'error':
        return 'Sync failed'
      default:
        return 'Online'
    }
  }

  const formatLastSync = (date?: Date) => {
    if (!date) return null

    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`

    return date.toLocaleDateString()
  }

  const SyncIcon = getSyncIcon()

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {/* Connection Status Icon */}
      <div className="relative">
        <SyncIcon
          className={`h-4 w-4 ${getSyncColor()} ${
            syncStatus === 'syncing' ? 'animate-spin' : ''
          }`}
        />

        {/* Pending Changes Badge */}
        <AnimatePresence>
          {pendingChanges > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 h-3 w-3 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center"
            >
              {pendingChanges > 9 ? '9+' : pendingChanges}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Status Text (Hidden on very small screens) */}
      <span className={`text-xs font-medium hidden sm:inline ${getSyncColor()}`}>
        {getStatusText()}
      </span>

      {/* Detailed Status Tooltip */}
      <div className="group relative">
        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 transition-opacity">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <Wifi className="h-3 w-3 text-green-400" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-400" />
              )}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {syncStatus === 'syncing' && (
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-3 w-3 text-blue-400 animate-spin" />
                <span>Syncing changes...</span>
              </div>
            )}

            {pendingChanges > 0 && (
              <div className="flex items-center space-x-2">
                <Upload className="h-3 w-3 text-yellow-400" />
                <span>{pendingChanges} changes pending</span>
              </div>
            )}

            {lastSyncTime && (
              <div className="flex items-center space-x-2">
                <Clock className="h-3 w-3 text-gray-400" />
                <span>Last sync: {formatLastSync(lastSyncTime)}</span>
              </div>
            )}

            {syncStatus === 'error' && (
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-3 w-3 text-red-400" />
                <span>Sync failed - will retry</span>
              </div>
            )}
          </div>

          {/* Tooltip Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      </div>
    </div>
  )
}

// Offline Status Banner Component
interface OfflineBannerProps {
  isOnline: boolean
  pendingChanges: number
  onRetrySync?: () => void
  className?: string
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  pendingChanges,
  onRetrySync,
  className = ''
}) => {
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className={`bg-yellow-50 border-b border-yellow-200 px-4 py-3 ${className}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <WifiOff className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  You're currently offline
                </p>
                {pendingChanges > 0 && (
                  <p className="text-xs text-yellow-700">
                    {pendingChanges} changes will sync when connection is restored
                  </p>
                )}
              </div>
            </div>

            {onRetrySync && (
              <button
                onClick={onRetrySync}
                className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                <span className="text-xs font-medium">Retry</span>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
