'use client'

import { MobileCRMDashboard } from '@/components/crm/mobile/MobileCRMDashboard'
import { OfflineBanner } from '@/components/crm/mobile/OfflineIndicator'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useUIStore } from '@/store/uiStore'
import { useEffect } from 'react'

export default function MobileCRMPage() {
  const { isOnline, pendingChanges } = useOfflineSync()
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    subscribe: subscribeToPush
  } = usePushNotifications()
  const { addNotification } = useUIStore()

  // Auto-enable push notifications on first visit
  useEffect(() => {
    const hasPromptedForNotifications = localStorage.getItem('crm_notifications_prompted')

    if (pushSupported && !pushSubscribed && !hasPromptedForNotifications) {
      // Show notification prompt after a short delay
      const timer = setTimeout(() => {
        addNotification({
          type: 'info',
          title: 'Enable Notifications',
          message: 'Get notified about new leads, tasks, and important updates',
          duration: 0, // Don't auto-dismiss
          actions: [
            {
              label: 'Enable',
              action: async () => {
                const success = await subscribeToPush()
                if (success) {
                  localStorage.setItem('crm_notifications_prompted', 'true')
                }
              }
            },
            {
              label: 'Later',
              action: () => {
                localStorage.setItem('crm_notifications_prompted', 'true')
              }
            }
          ]
        })
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [pushSupported, pushSubscribed, subscribeToPush, addNotification])

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration)
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline Banner */}
      <OfflineBanner
        isOnline={isOnline}
        pendingChanges={pendingChanges}
        onRetrySync={() => {
          // Trigger sync retry
          window.location.reload()
        }}
      />

      {/* Main CRM Dashboard */}
      <MobileCRMDashboard />
    </div>
  )
}
