'use client'

import { useUIStore } from '@/store/uiStore'
import { useCallback, useEffect, useRef, useState } from 'react'

interface OfflineChange {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'contact' | 'task' | 'deal' | 'opportunity' | 'meeting'
  entityId: string
  data: any
  timestamp: Date
  retryCount: number
}

interface UseOfflineSyncReturn {
  isOnline: boolean
  syncStatus: 'idle' | 'syncing' | 'success' | 'error'
  pendingChanges: number
  lastSyncTime?: Date
  addOfflineChange: (change: Omit<OfflineChange, 'id' | 'timestamp' | 'retryCount'>) => void
  syncNow: () => Promise<void>
  clearPendingChanges: () => void
}

const STORAGE_KEY = 'crm_offline_changes'
const MAX_RETRY_COUNT = 3
const SYNC_INTERVAL = 30000 // 30 seconds

export const useOfflineSync = (): UseOfflineSyncReturn => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [pendingChanges, setPendingChanges] = useState<OfflineChange[]>([])
  const [lastSyncTime, setLastSyncTime] = useState<Date>()

  const { addNotification } = useUIStore()
  const syncIntervalRef = useRef<NodeJS.Timeout>()
  const retryTimeoutRef = useRef<NodeJS.Timeout>()

  // Load pending changes from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const changes = JSON.parse(stored).map((change: any) => ({
          ...change,
          timestamp: new Date(change.timestamp)
        }))
        setPendingChanges(changes)
      } catch (error) {
        console.error('Failed to load offline changes:', error)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Save pending changes to localStorage whenever they change
  useEffect(() => {
    if (pendingChanges.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingChanges))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [pendingChanges])

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      addNotification({
        type: 'success',
        title: 'Back Online',
        message: 'Connection restored. Syncing pending changes...',
        duration: 3000
      })

      // Sync pending changes when coming back online
      if (pendingChanges.length > 0) {
        syncNow()
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      addNotification({
        type: 'warning',
        title: 'Connection Lost',
        message: 'Working offline. Changes will sync when connection is restored.',
        duration: 5000
      })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [pendingChanges.length, addNotification])

  // Set up periodic sync when online
  useEffect(() => {
    if (isOnline && pendingChanges.length > 0) {
      syncIntervalRef.current = setInterval(() => {
        syncNow()
      }, SYNC_INTERVAL)
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [isOnline, pendingChanges.length])

  const addOfflineChange = useCallback((change: Omit<OfflineChange, 'id' | 'timestamp' | 'retryCount'>) => {
    const newChange: OfflineChange = {
      ...change,
      id: `${change.entity}_${change.entityId}_${Date.now()}`,
      timestamp: new Date(),
      retryCount: 0
    }

    setPendingChanges(prev => [...prev, newChange])

    // If online, try to sync immediately
    if (isOnline) {
      setTimeout(() => syncNow(), 100)
    }
  }, [isOnline])

  const syncChange = async (change: OfflineChange): Promise<boolean> => {
    try {
      const endpoint = `/api/v1/${change.entity}s`
      let url = endpoint
      let method = 'POST'
      let body = change.data

      switch (change.type) {
        case 'create':
          method = 'POST'
          break
        case 'update':
          method = 'PUT'
          url = `${endpoint}/${change.entityId}`
          break
        case 'delete':
          method = 'DELETE'
          url = `${endpoint}/${change.entityId}`
          body = undefined
          break
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers here
        },
        body: body ? JSON.stringify(body) : undefined
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return true
    } catch (error) {
      console.error(`Failed to sync change ${change.id}:`, error)
      return false
    }
  }

  const syncNow = useCallback(async () => {
    if (!isOnline || pendingChanges.length === 0 || syncStatus === 'syncing') {
      return
    }

    setSyncStatus('syncing')

    try {
      const results = await Promise.allSettled(
        pendingChanges.map(change => syncChange(change))
      )

      const successfulChanges: string[] = []
      const failedChanges: OfflineChange[] = []

      results.forEach((result, index) => {
        const change = pendingChanges[index]

        if (result.status === 'fulfilled' && result.value) {
          successfulChanges.push(change.id)
        } else {
          // Increment retry count
          const updatedChange = {
            ...change,
            retryCount: change.retryCount + 1
          }

          // Only keep changes that haven't exceeded max retries
          if (updatedChange.retryCount < MAX_RETRY_COUNT) {
            failedChanges.push(updatedChange)
          } else {
            console.warn(`Dropping change ${change.id} after ${MAX_RETRY_COUNT} failed attempts`)
            addNotification({
              type: 'error',
              title: 'Sync Failed',
              message: `Failed to sync ${change.entity} changes after multiple attempts`,
              duration: 5000
            })
          }
        }
      })

      // Update pending changes (remove successful ones, keep failed ones for retry)
      setPendingChanges(failedChanges)
      setLastSyncTime(new Date())

      if (successfulChanges.length > 0) {
        setSyncStatus('success')

        if (failedChanges.length === 0) {
          addNotification({
            type: 'success',
            title: 'Sync Complete',
            message: `Successfully synced ${successfulChanges.length} changes`,
            duration: 3000
          })
        }
      } else if (failedChanges.length > 0) {
        setSyncStatus('error')

        // Schedule retry for failed changes
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
        }

        retryTimeoutRef.current = setTimeout(() => {
          syncNow()
        }, 5000) // Retry after 5 seconds
      }

      // Reset status after a delay
      setTimeout(() => {
        setSyncStatus('idle')
      }, 2000)

    } catch (error) {
      console.error('Sync failed:', error)
      setSyncStatus('error')

      addNotification({
        type: 'error',
        title: 'Sync Error',
        message: 'Failed to sync changes. Will retry automatically.',
        duration: 5000
      })

      // Reset status after a delay
      setTimeout(() => {
        setSyncStatus('idle')
      }, 2000)
    }
  }, [isOnline, pendingChanges, syncStatus, addNotification])

  const clearPendingChanges = useCallback(() => {
    setPendingChanges([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  return {
    isOnline,
    syncStatus,
    pendingChanges: pendingChanges.length,
    lastSyncTime,
    addOfflineChange,
    syncNow,
    clearPendingChanges
  }
}
