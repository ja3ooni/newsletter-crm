import { EventEmitter } from 'events';
import webpush from 'web-push';
import { Contact, Deal, Meeting, Task } from '../types';

interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: Date;
  isActive: boolean;
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
}

interface CRMNotification {
  id: string;
  userId: string;
  type:
    | 'lead_assignment'
    | 'follow_up_reminder'
    | 'deal_update'
    | 'task_overdue'
    | 'meeting_reminder'
    | 'system';
  title: string;
  message: string;
  payload?: NotificationPayload;
  metadata?: {
    contactId?: string;
    dealId?: string;
    taskId?: string;
    meetingId?: string;
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledFor?: Date;
  sentAt?: Date;
  readAt?: Date;
  isRead: boolean;
  createdAt: Date;
}

export class NotificationService extends EventEmitter {
  private db: typeof import('../utils/database').default;

  constructor(db: typeof import('../utils/database').default) {
    super();
    this.db = db;
    this.setupWebPush();
    this.startScheduledNotificationProcessor();
  }

  private setupWebPush(): void {
    const vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY || '',
      privateKey: process.env.VAPID_PRIVATE_KEY || '',
    };

    if (vapidKeys.publicKey && vapidKeys.privateKey) {
      webpush.setVapidDetails(
        'mailto:support@ailert.com',
        vapidKeys.publicKey,
        vapidKeys.privateKey
      );
    } else {
      console.warn(
        'VAPID keys not configured. Push notifications will not work.'
      );
    }
  }

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  async subscribeToPush(userId: string, subscription: any): Promise<string> {
    const subscriptionData: Omit<PushSubscription, 'id' | 'createdAt'> = {
      userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent: subscription.userAgent,
      isActive: true,
    };

    const result = await this.db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys, user_agent, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, endpoint)
       DO UPDATE SET keys = $3, user_agent = $4, is_active = $5, updated_at = NOW()
       RETURNING id`,
      [
        subscriptionData.userId,
        subscriptionData.endpoint,
        JSON.stringify(subscriptionData.keys),
        subscriptionData.userAgent,
        subscriptionData.isActive,
      ]
    );

    return result.rows[0].id;
  }

  async unsubscribeFromPush(userId: string, endpoint?: string): Promise<void> {
    let query =
      'UPDATE push_subscriptions SET is_active = false WHERE user_id = $1';
    const params = [userId];

    if (endpoint) {
      query += ' AND endpoint = $2';
      params.push(endpoint);
    }

    await this.db.query(query, params);
  }

  async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    const result = await this.db.query(
      `SELECT id, user_id, endpoint, keys, user_agent, created_at, is_active
       FROM push_subscriptions
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      endpoint: row.endpoint,
      keys: JSON.parse(row.keys),
      userAgent: row.user_agent,
      createdAt: row.created_at,
      isActive: row.is_active,
    }));
  }

  // ============================================================================
  // NOTIFICATION CREATION
  // ============================================================================

  async createNotification(
    notification: Omit<
      CRMNotification,
      'id' | 'createdAt' | 'isRead' | 'sentAt' | 'readAt'
    >
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO crm_notifications (
        user_id, type, title, message, payload, metadata, priority, scheduled_for, is_read, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW())
      RETURNING id`,
      [
        notification.userId,
        notification.type,
        notification.title,
        notification.message,
        notification.payload ? JSON.stringify(notification.payload) : null,
        notification.metadata ? JSON.stringify(notification.metadata) : null,
        notification.priority,
        notification.scheduledFor,
      ]
    );

    const notificationId = result.rows[0].id;

    // Send immediately if not scheduled
    if (!notification.scheduledFor) {
      await this.sendNotification(notificationId);
    }

    return notificationId;
  }

  async sendNotification(notificationId: string): Promise<void> {
    const notification = await this.getNotification(notificationId);
    if (!notification || notification.sentAt) {
      return;
    }

    const subscriptions = await this.getUserSubscriptions(notification.userId);

    if (subscriptions.length === 0) {
      console.log(
        `No push subscriptions found for user ${notification.userId}`
      );
      return;
    }

    const payload = notification.payload || {
      title: notification.title,
      body: notification.message,
      icon: '/icons/crm-icon-192.png',
      badge: '/icons/crm-badge-72.png',
      data: {
        notificationId: notification.id,
        type: notification.type,
        metadata: notification.metadata,
      },
      tag: notification.type,
      requireInteraction: notification.priority === 'urgent',
    };

    const sendPromises = subscriptions.map(async subscription => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          },
          JSON.stringify(payload)
        );
        console.log(`Push notification sent to ${subscription.endpoint}`);
      } catch (error: any) {
        console.error(
          `Failed to send push notification to ${subscription.endpoint}:`,
          error
        );

        // Handle expired subscriptions
        if (error.statusCode === 410) {
          await this.unsubscribeFromPush(
            notification.userId,
            subscription.endpoint
          );
        }
      }
    });

    await Promise.allSettled(sendPromises);

    // Mark as sent
    await this.db.query(
      'UPDATE crm_notifications SET sent_at = NOW() WHERE id = $1',
      [notificationId]
    );

    this.emit('notificationSent', notification);
  }

  // ============================================================================
  // CRM-SPECIFIC NOTIFICATIONS
  // ============================================================================

  async notifyLeadAssignment(
    userId: string,
    contact: Contact,
    assignedBy?: string
  ): Promise<string> {
    const contactName =
      contact.firstName && contact.lastName
        ? `${contact.firstName} ${contact.lastName}`
        : contact.email;

    return this.createNotification({
      userId,
      type: 'lead_assignment',
      title: 'New Lead Assigned',
      message: `${contactName}${contact.company ? ` from ${contact.company}` : ''} has been assigned to you`,
      metadata: { contactId: contact.id },
      priority: contact.leadScore >= 80 ? 'high' : 'medium',
      payload: {
        title: 'New Lead Assigned',
        body: `${contactName}${contact.company ? ` from ${contact.company}` : ''} has been assigned to you`,
        icon: '/icons/lead-icon.png',
        data: {
          type: 'lead_assignment',
          contactId: contact.id,
          url: `/crm/contacts/${contact.id}`,
        },
        actions: [
          {
            action: 'view',
            title: 'View Contact',
          },
          {
            action: 'call',
            title: 'Call Now',
          },
        ],
        tag: `lead_assignment_${contact.id}`,
        requireInteraction: contact.leadScore >= 80,
      },
    });
  }

  async notifyFollowUpReminder(
    userId: string,
    task: Task,
    contact?: Contact
  ): Promise<string> {
    const contactName = contact
      ? contact.firstName && contact.lastName
        ? `${contact.firstName} ${contact.lastName}`
        : contact.email
      : 'Unknown Contact';

    return this.createNotification({
      userId,
      type: 'follow_up_reminder',
      title: 'Follow-up Reminder',
      message: `Follow up with ${contactName}: ${task.title}`,
      metadata: contact?.id
        ? {
            taskId: task.id,
            contactId: contact.id,
          }
        : {
            taskId: task.id,
          },
      priority: task.priority === 'urgent' ? 'urgent' : 'medium',
      payload: {
        title: 'Follow-up Reminder',
        body: `Follow up with ${contactName}: ${task.title}`,
        icon: '/icons/reminder-icon.png',
        data: {
          type: 'follow_up_reminder',
          taskId: task.id,
          contactId: contact?.id,
          url: `/crm/tasks/${task.id}`,
        },
        actions: [
          {
            action: 'complete',
            title: 'Mark Complete',
          },
          {
            action: 'snooze',
            title: 'Snooze 1h',
          },
        ],
        tag: `follow_up_${task.id}`,
        requireInteraction: task.priority === 'urgent',
      },
    });
  }

  async notifyDealUpdate(
    userId: string,
    deal: Deal,
    updateType: 'stage_change' | 'value_change' | 'won' | 'lost'
  ): Promise<string> {
    let title = 'Deal Updated';
    let message = `${deal.name} has been updated`;

    switch (updateType) {
      case 'stage_change':
        title = 'Deal Stage Changed';
        message = `${deal.name} moved to a new stage`;
        break;
      case 'value_change':
        title = 'Deal Value Updated';
        message = `${deal.name} value has been updated`;
        break;
      case 'won':
        title = 'Deal Won! 🎉';
        message = `Congratulations! ${deal.name} has been won`;
        break;
      case 'lost':
        title = 'Deal Lost';
        message = `${deal.name} has been marked as lost`;
        break;
    }

    return this.createNotification({
      userId,
      type: 'deal_update',
      title,
      message,
      metadata: { dealId: deal.id },
      priority: updateType === 'won' ? 'high' : 'medium',
      payload: {
        title,
        body: message,
        icon:
          updateType === 'won'
            ? '/icons/celebration-icon.png'
            : '/icons/deal-icon.png',
        data: {
          type: 'deal_update',
          dealId: deal.id,
          updateType,
          url: `/crm/deals/${deal.id}`,
        },
        actions: [
          {
            action: 'view',
            title: 'View Deal',
          },
        ],
        tag: `deal_update_${deal.id}`,
        requireInteraction: updateType === 'won',
      },
    });
  }

  async notifyTaskOverdue(
    userId: string,
    task: Task,
    contact?: Contact
  ): Promise<string> {
    const contactName = contact
      ? contact.firstName && contact.lastName
        ? `${contact.firstName} ${contact.lastName}`
        : contact.email
      : null;

    return this.createNotification({
      userId,
      type: 'task_overdue',
      title: 'Task Overdue',
      message: `${task.title}${contactName ? ` for ${contactName}` : ''} is overdue`,
      metadata: contact?.id
        ? {
            taskId: task.id,
            contactId: contact.id,
          }
        : {
            taskId: task.id,
          },
      priority: 'urgent',
      payload: {
        title: 'Task Overdue',
        body: `${task.title}${contactName ? ` for ${contactName}` : ''} is overdue`,
        icon: '/icons/overdue-icon.png',
        data: {
          type: 'task_overdue',
          taskId: task.id,
          contactId: contact?.id,
          url: `/crm/tasks/${task.id}`,
        },
        actions: [
          {
            action: 'complete',
            title: 'Mark Complete',
          },
          {
            action: 'reschedule',
            title: 'Reschedule',
          },
        ],
        tag: `task_overdue_${task.id}`,
        requireInteraction: true,
      },
    });
  }

  async notifyMeetingReminder(
    userId: string,
    meeting: Meeting,
    minutesBefore: number = 15
  ): Promise<string> {
    const scheduledFor = new Date(
      meeting.startTime.getTime() - minutesBefore * 60 * 1000
    );

    return this.createNotification({
      userId,
      type: 'meeting_reminder',
      title: 'Meeting Reminder',
      message: `${meeting.title} starts in ${minutesBefore} minutes`,
      metadata: { meetingId: meeting.id },
      priority: 'high',
      scheduledFor,
      payload: {
        title: 'Meeting Reminder',
        body: `${meeting.title} starts in ${minutesBefore} minutes`,
        icon: '/icons/meeting-icon.png',
        data: {
          type: 'meeting_reminder',
          meetingId: meeting.id,
          url: `/crm/meetings/${meeting.id}`,
        },
        actions: [
          {
            action: 'join',
            title: 'Join Meeting',
          },
          {
            action: 'snooze',
            title: 'Remind in 5min',
          },
        ],
        tag: `meeting_reminder_${meeting.id}`,
        requireInteraction: true,
      },
    });
  }

  // ============================================================================
  // NOTIFICATION RETRIEVAL
  // ============================================================================

  async getNotification(
    notificationId: string
  ): Promise<CRMNotification | null> {
    const result = await this.db.query(
      `SELECT id, user_id, type, title, message, payload, metadata, priority,
              scheduled_for, sent_at, read_at, is_read, created_at
       FROM crm_notifications
       WHERE id = $1`,
      [notificationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      priority: row.priority,
      scheduledFor: row.scheduled_for,
      sentAt: row.sent_at,
      readAt: row.read_at,
      isRead: row.is_read,
      createdAt: row.created_at,
    };
  }

  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: string[];
    } = {}
  ): Promise<{ notifications: CRMNotification[]; total: number }> {
    const { limit = 50, offset = 0, unreadOnly = false, type } = options;

    let whereClause = 'WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (unreadOnly) {
      whereClause += ` AND is_read = false`;
    }

    if (type && type.length > 0) {
      whereClause += ` AND type = ANY($${paramIndex++})`;
      params.push(type);
    }

    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) as total FROM crm_notifications ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get notifications
    const result = await this.db.query(
      `SELECT id, user_id, type, title, message, payload, metadata, priority,
              scheduled_for, sent_at, read_at, is_read, created_at
       FROM crm_notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const notifications = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      priority: row.priority,
      scheduledFor: row.scheduled_for,
      sentAt: row.sent_at,
      readAt: row.read_at,
      isRead: row.is_read,
      createdAt: row.created_at,
    }));

    return { notifications, total };
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.db.query(
      'UPDATE crm_notifications SET is_read = true, read_at = NOW() WHERE id = $1',
      [notificationId]
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE crm_notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false',
      [userId]
    );
  }

  // ============================================================================
  // SCHEDULED NOTIFICATIONS
  // ============================================================================

  private startScheduledNotificationProcessor(): void {
    // Process scheduled notifications every minute
    setInterval(async () => {
      try {
        await this.processScheduledNotifications();
      } catch (error) {
        console.error('Error processing scheduled notifications:', error);
      }
    }, 60000); // 1 minute
  }

  private async processScheduledNotifications(): Promise<void> {
    const result = await this.db.query(
      `SELECT id FROM crm_notifications
       WHERE scheduled_for <= NOW() AND sent_at IS NULL
       ORDER BY scheduled_for ASC
       LIMIT 100`
    );

    const sendPromises = result.rows.map(row => this.sendNotification(row.id));

    await Promise.allSettled(sendPromises);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async cleanupOldNotifications(daysToKeep: number = 30): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM crm_notifications WHERE created_at < NOW() - INTERVAL $1 DAY',
      [daysToKeep]
    );

    return result.rowCount || 0;
  }
}
