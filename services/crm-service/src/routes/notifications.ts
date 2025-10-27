import { Router } from 'express';
import { Pool } from 'pg';
import { NotificationController } from '../controllers/NotificationController';
import { authMiddleware } from '../middleware/auth';
import database from '../utils/database';

export function createNotificationRoutes(db: Pool): Router {
  const router = Router();
  const notificationController = new NotificationController(database);

  // Apply authentication middleware to all routes
  router.use(authMiddleware);

  // ============================================================================
  // PUSH SUBSCRIPTION ROUTES
  // ============================================================================

  /**
   * @route POST /api/v1/notifications/push/subscribe
   * @desc Subscribe to push notifications
   * @access Private
   */
  router.post('/push/subscribe', notificationController.subscribeToPush);

  /**
   * @route POST /api/v1/notifications/push/unsubscribe
   * @desc Unsubscribe from push notifications
   * @access Private
   */
  router.post('/push/unsubscribe', notificationController.unsubscribeFromPush);

  /**
   * @route GET /api/v1/notifications/push/subscriptions
   * @desc Get user's push subscriptions
   * @access Private
   */
  router.get('/push/subscriptions', notificationController.getSubscriptions);

  /**
   * @route GET /api/v1/notifications/push/vapid-key
   * @desc Get VAPID public key for push notifications
   * @access Private
   */
  router.get('/push/vapid-key', notificationController.getVapidPublicKey);

  // ============================================================================
  // NOTIFICATION ROUTES
  // ============================================================================

  /**
   * @route GET /api/v1/notifications
   * @desc Get user notifications
   * @access Private
   * @query limit - Number of notifications to return (default: 50, max: 100)
   * @query offset - Number of notifications to skip (default: 0)
   * @query unreadOnly - Only return unread notifications (default: false)
   * @query type - Filter by notification type(s)
   */
  router.get('/', notificationController.getNotifications);

  /**
   * @route PUT /api/v1/notifications/:notificationId/read
   * @desc Mark notification as read
   * @access Private
   */
  router.put('/:notificationId/read', notificationController.markAsRead);

  /**
   * @route PUT /api/v1/notifications/read-all
   * @desc Mark all notifications as read
   * @access Private
   */
  router.put('/read-all', notificationController.markAllAsRead);

  // ============================================================================
  // NOTIFICATION PREFERENCES ROUTES
  // ============================================================================

  /**
   * @route GET /api/v1/notifications/preferences
   * @desc Get user notification preferences
   * @access Private
   */
  router.get('/preferences', notificationController.getPreferences);

  /**
   * @route PUT /api/v1/notifications/preferences
   * @desc Update user notification preferences
   * @access Private
   */
  router.put('/preferences', notificationController.updatePreferences);

  // ============================================================================
  // TEST ROUTES
  // ============================================================================

  /**
   * @route POST /api/v1/notifications/test
   * @desc Send test notification
   * @access Private
   */
  router.post('/test', notificationController.sendTestNotification);

  return router;
}

// For backward compatibility, export a default router that can be used without db
const defaultRouter = Router();
export default defaultRouter;
