'use client'

import { useUIStore } from '@/store/uiStore'
import { useCallback, useEffect, useState } from 'react'

interface UsePushNotificationsReturn {
  isSupported: boolean
  isSubscribed: boolean
  isLoading: boolean
  permission: NotificationPermission
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  requestPermission: () => Promise<NotificationPermission>
}

const VAPID_PUBLIC_KEY_ENDPOINT = '/api/v1/notifications/push/vapid-key'
const SUBSCRIBE_ENDPOINT = '/api/v1/notifications/push/subscribe'
const UNSUBSCRIBE_ENDPOINT = '/api/v1/notifications/push/unsubscribe'

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  const { addNotification } = useUIStore()

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = () => {
      const supported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window

      setIsSupported(supported)

      if (supported) {
        setPermission(Notification.permission)
        checkSubscriptionStatus()
      }
    }

    checkSupport()
  }, [])

  // Check current subscription status
  const checkSubscriptionStatus = useCallback(async () => {
    try {
      if (!('serviceWorker' in navigator)) return

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      setIsSubscribed(!!subscription)
    } catch (error) {
      console.error('Error checking subscription status:', error)
      setIsSubscribed(false)
    }
  }, [])

  // Get VAPID public key from server
  const getVapidPublicKey = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch(VAPID_PUBLIC_KEY_ENDPOINT, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to get VAPID public key')
      }

      const data = await response.json()
      return data.publicKey
    } catch (error) {
      console.error('Error getting VAPID public key:', error)
      return null
    }
  }, [])

  // Convert VAPID key to Uint8Array
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      return 'denied'
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      setPermission('denied')
      return 'denied'
    }
  }, [isSupported])

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      addNotification({
        type: 'error',
        title: 'Not Supported',
        message: 'Push notifications are not supported in this browser',
      })
      return false
    }

    setIsLoading(true)

    try {
      // Request permission if not granted
      let currentPermission = permission
      if (currentPermission !== 'granted') {
        currentPermission = await requestPermission()
      }

      if (currentPermission !== 'granted') {
        addNotification({
          type: 'error',
          title: 'Permission Denied',
          message: 'Please enable notifications to receive CRM alerts',
        })
        return false
      }

      // Get VAPID public key
      const vapidPublicKey = await getVapidPublicKey()
      if (!vapidPublicKey) {
        addNotification({
          type: 'error',
          title: 'Configuration Error',
          message: 'Failed to get push notification configuration',
        })
        return false
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        // Create new subscription
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        })
      }

      // Send subscription to server
      const response = await fetch(SUBSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
          },
          userAgent: navigator.userAgent
        })
      })

      if (!response.ok) {
        throw new Error('Failed to register subscription with server')
      }

      setIsSubscribed(true)

      addNotification({
        type: 'success',
        title: 'Notifications Enabled',
        message: 'You will now receive CRM notifications on this device',
      })

      return true

    } catch (error: any) {
      console.error('Error subscribing to push notifications:', error)

      addNotification({
        type: 'error',
        title: 'Subscription Failed',
        message: error.message || 'Failed to enable push notifications',
      })

      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, permission, requestPermission, getVapidPublicKey, addNotification])

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false
    }

    setIsLoading(true)

    try {
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe()

        // Notify server
        await fetch(UNSUBSCRIBE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint
          })
        })
      }

      setIsSubscribed(false)

      addNotification({
        type: 'info',
        title: 'Notifications Disabled',
        message: 'You will no longer receive push notifications on this device',
      })

      return true

    } catch (error: any) {
      console.error('Error unsubscribing from push notifications:', error)

      addNotification({
        type: 'error',
        title: 'Unsubscribe Failed',
        message: error.message || 'Failed to disable push notifications',
      })

      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, addNotification])

  // Listen for permission changes
  useEffect(() => {
    const handlePermissionChange = () => {
      setPermission(Notification.permission)
      checkSubscriptionStatus()
    }

    // Some browsers support permission change events
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' as PermissionName })
        .then((permissionStatus) => {
          permissionStatus.addEventListener('change', handlePermissionChange)

          return () => {
            permissionStatus.removeEventListener('change', handlePermissionChange)
          }
        })
        .catch(() => {
          // Fallback: check periodically
          const interval = setInterval(handlePermissionChange, 5000)
          return () => clearInterval(interval)
        })
    }
  }, [checkSubscriptionStatus])

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    requestPermission
  }
}
