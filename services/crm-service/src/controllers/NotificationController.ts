import { Request, Response } from 'express';
import { z } from 'zod';
import { NotificationService } from '../services/NotificationService';
import { DatabaseService } from '../utils/database';

const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
});

const NotificationPreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  leadAssignments: z.boolean().optional(),
  followUpReminders: z.boolean().optional(),
  dealUpdates: z.boolean().optional(),
  taskOverdue: z.boolean().optional(),
  meetingReminders: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  timezone: z.string().optional(),
});

const GetNotificationsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  unreadOnly: z.coerce.boolean().default(false),
  type: z.array(z.string()).optional(),
});

export class NotificationController {
  private notificationService: NotificationService;
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
    this.notificationService = new NotificationService(db);
  }

  // ============================================================================
  // PUSH SUBSCRIPTION MANAGEMENT
  // ============================================================================

  subscribeToPush = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const subscriptionData = PushSubscriptionSchema.parse(req.body);

      const subscriptionId = await this.notificationService.subscribeToPush(
        userId,
        subscriptionData
      );

      res.status(201).json({
        success: true,
        subscriptionId,
        message: 'Successfully subscribed to push notifications',
      });
    } catch (error: any) {
      console.error('Error subscribing to push notifications:', error);

      if (error.name === 'ZodError') {
        res.status(400).json({
          error: 'Invalid subscription data',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to subscribe to push notifications',
      });
    }
  };

  unsubscribeFromPush = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { endpoint } = req.body;

      await this.notificationService.unsubscribeFromPush(userId, endpoint);

      res.json({
        success: true,
        message: 'Successfully unsubscribed from push notifications',
      });
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      res.status(500).json({
        error: 'Failed to unsubscribe from push notifications',
      });
    }
  };

  getSubscriptions = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const subscriptions =
        await this.notificationService.getUserSubscriptions(userId);

      res.json({
        success: true,
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          endpoint: sub.endpoint,
          userAgent: sub.userAgent,
          createdAt: sub.createdAt,
          isActive: sub.isActive,
        })),
      });
    } catch (error) {
      console.error('Error getting push subscriptions:', error);
      res.status(500).json({
        error: 'Failed to get push subscriptions',
      });
    }
  };

  // ============================================================================
  // NOTIFICATION MANAGEMENT
  // ============================================================================

  getNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const options = GetNotificationsSchema.parse(req.query);

      const result = await this.notificationService.getUserNotifications(
        userId,
        options
      );

      res.json({
        success: true,
        notifications: result.notifications,
        total: result.total,
        limit: options.limit,
        offset: options.offset,
        hasMore: result.total > options.offset + options.limit,
      });
    } catch (error: any) {
      console.error('Error getting notifications:', error);

      if (error.name === 'ZodError') {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get notifications',
      });
    }
  };

  markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { notificationId } = req.params;

      // Verify notification belongs to user
      const notification =
        await this.notificationService.getNotification(notificationId);
      if (!notification || notification.userId !== userId) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }

      await this.notificationService.markAsRead(notificationId);

      res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        error: 'Failed to mark notification as read',
      });
    }
  };

  markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await this.notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        error: 'Failed to mark all notifications as read',
      });
    }
  };

  // ============================================================================
  // NOTIFICATION PREFERENCES
  // ============================================================================

  getPreferences = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await this.db.query(
        `SELECT email_notifications, push_notifications, sms_notifications,
                lead_assignments, follow_up_reminders, deal_updates, task_overdue, meeting_reminders,
                quiet_hours_start, quiet_hours_end, timezone
         FROM notification_preferences
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Create default preferences
        await this.db.query(
          `INSERT INTO notification_preferences (user_id) VALUES ($1)`,
          [userId]
        );

        res.json({
          success: true,
          preferences: {
            emailNotifications: true,
            pushNotifications: true,
            smsNotifications: false,
            leadAssignments: true,
            followUpReminders: true,
            dealUpdates: true,
            taskOverdue: true,
            meetingReminders: true,
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00',
            timezone: 'UTC',
          },
        });
        return;
      }

      const prefs = result.rows[0];
      res.json({
        success: true,
        preferences: {
          emailNotifications: prefs.email_notifications,
          pushNotifications: prefs.push_notifications,
          smsNotifications: prefs.sms_notifications,
          leadAssignments: prefs.lead_assignments,
          followUpReminders: prefs.follow_up_reminders,
          dealUpdates: prefs.deal_updates,
          taskOverdue: prefs.task_overdue,
          meetingReminders: prefs.meeting_reminders,
          quietHoursStart: prefs.quiet_hours_start,
          quietHoursEnd: prefs.quiet_hours_end,
          timezone: prefs.timezone,
        },
      });
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      res.status(500).json({
        error: 'Failed to get notification preferences',
      });
    }
  };

  updatePreferences = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const preferences = NotificationPreferencesSchema.parse(req.body);

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.entries(preferences).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          updateFields.push(`${dbField} = $${paramIndex++}`);
          values.push(value);
        }
      });

      if (updateFields.length === 0) {
        res.status(400).json({ error: 'No preferences to update' });
        return;
      }

      updateFields.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      values.push(userId);

      await this.db.query(
        `UPDATE notification_preferences
         SET ${updateFields.join(', ')}
         WHERE user_id = $${paramIndex}`,
        values
      );

      res.json({
        success: true,
        message: 'Notification preferences updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating notification preferences:', error);

      if (error.name === 'ZodError') {
        res.status(400).json({
          error: 'Invalid preferences data',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to update notification preferences',
      });
    }
  };

  // ============================================================================
  // TEST NOTIFICATIONS
  // ============================================================================

  sendTestNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const notificationId = await this.notificationService.createNotification({
        userId,
        type: 'system',
        title: 'Test Notification',
        message:
          'This is a test notification to verify your push notification setup is working correctly.',
        priority: 'medium',
        payload: {
          title: 'Test Notification',
          body: 'This is a test notification to verify your push notification setup is working correctly.',
          icon: '/icons/test-icon.png',
          data: {
            type: 'test',
            url: '/crm/notifications',
          },
          tag: 'test_notification',
          requireInteraction: false,
        },
      });

      res.json({
        success: true,
        notificationId,
        message: 'Test notification sent successfully',
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({
        error: 'Failed to send test notification',
      });
    }
  };

  // ============================================================================
  // VAPID PUBLIC KEY
  // ============================================================================

  getVapidPublicKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const publicKey = process.env.VAPID_PUBLIC_KEY;

      if (!publicKey) {
        res.status(500).json({
          error: 'VAPID public key not configured',
        });
        return;
      }

      res.json({
        success: true,
        publicKey,
      });
    } catch (error) {
      console.error('Error getting VAPID public key:', error);
      res.status(500).json({
        error: 'Failed to get VAPID public key',
      });
    }
  };
}
