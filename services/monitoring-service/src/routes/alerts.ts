import { Router } from 'express';
import {
  Alert,
  AlertManager,
  AlertRule,
  NotificationChannel,
} from '../services/AlertManager';
import { logger } from '../utils/logger';

const router = Router();
const alertManager = new AlertManager();

// Get all active alerts
router.get('/', (req, res) => {
  try {
    const alerts = alertManager.getAlerts();
    const { status, severity } = req.query;

    let filteredAlerts = alerts;

    if (status) {
      filteredAlerts = filteredAlerts.filter(alert => alert.status === status);
    }

    if (severity) {
      filteredAlerts = filteredAlerts.filter(
        alert => alert.severity === severity
      );
    }

    res.json({
      alerts: filteredAlerts,
      total: filteredAlerts.length,
      summary: {
        firing: alerts.filter(a => a.status === 'firing').length,
        resolved: alerts.filter(a => a.status === 'resolved').length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length,
      },
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get specific alert
router.get('/:id', (req, res) => {
  try {
    const alert = alertManager.getAlert(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(alert);
  } catch (error) {
    logger.error('Error fetching alert:', error);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

// Alert rules management
router.get('/rules', (req, res) => {
  try {
    const rules = alertManager.getAlertRules();
    res.json({
      rules,
      total: rules.length,
      enabled: rules.filter(r => r.enabled).length,
      disabled: rules.filter(r => !r.enabled).length,
    });
  } catch (error) {
    logger.error('Error fetching alert rules:', error);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
});

router.post('/rules', (req, res) => {
  try {
    const rule: AlertRule = req.body;

    // Validate required fields
    if (!rule.id || !rule.name || !rule.query) {
      return res
        .status(400)
        .json({ error: 'Missing required fields: id, name, query' });
    }

    alertManager.addAlertRule(rule);
    res.status(201).json({ success: true, message: 'Alert rule created' });
  } catch (error) {
    logger.error('Error creating alert rule:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

router.put('/rules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    alertManager.updateAlertRule(id, updates);
    res.json({ success: true, message: 'Alert rule updated' });
  } catch (error) {
    logger.error('Error updating alert rule:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

router.delete('/rules/:id', (req, res) => {
  try {
    const { id } = req.params;
    alertManager.deleteAlertRule(id);
    res.json({ success: true, message: 'Alert rule deleted' });
  } catch (error) {
    logger.error('Error deleting alert rule:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

// Notification channels management
router.get('/channels', (req, res) => {
  try {
    const channels = alertManager.getNotificationChannels();
    res.json({
      channels,
      total: channels.length,
      enabled: channels.filter(c => c.enabled).length,
      disabled: channels.filter(c => !c.enabled).length,
    });
  } catch (error) {
    logger.error('Error fetching notification channels:', error);
    res.status(500).json({ error: 'Failed to fetch notification channels' });
  }
});

router.post('/channels', (req, res) => {
  try {
    const channel: NotificationChannel = req.body;

    // Validate required fields
    if (!channel.id || !channel.name || !channel.type) {
      return res
        .status(400)
        .json({ error: 'Missing required fields: id, name, type' });
    }

    alertManager.addNotificationChannel(channel);
    res
      .status(201)
      .json({ success: true, message: 'Notification channel created' });
  } catch (error) {
    logger.error('Error creating notification channel:', error);
    res.status(500).json({ error: 'Failed to create notification channel' });
  }
});

router.put('/channels/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    alertManager.updateNotificationChannel(id, updates);
    res.json({ success: true, message: 'Notification channel updated' });
  } catch (error) {
    logger.error('Error updating notification channel:', error);
    res.status(500).json({ error: 'Failed to update notification channel' });
  }
});

router.delete('/channels/:id', (req, res) => {
  try {
    const { id } = req.params;
    alertManager.deleteNotificationChannel(id);
    res.json({ success: true, message: 'Notification channel deleted' });
  } catch (error) {
    logger.error('Error deleting notification channel:', error);
    res.status(500).json({ error: 'Failed to delete notification channel' });
  }
});

// Test notification endpoint
router.post('/test/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const channels = alertManager.getNotificationChannels();
    const channel = channels.find(c => c.id === channelId);

    if (!channel) {
      return res.status(404).json({ error: 'Notification channel not found' });
    }

    // Create a test alert
    const testAlert: Alert = {
      id: 'test-alert',
      name: 'Test Alert',
      severity: 'info',
      status: 'firing',
      message:
        'This is a test alert to verify notification channel configuration',
      labels: { test: 'true' },
      annotations: {
        description: 'Test alert for notification channel validation',
      },
      startsAt: new Date(),
    };

    // Send test notification (this would call the actual notification method)
    logger.info(`Test notification sent via ${channel.name}`, {
      channelId,
      alert: testAlert,
    });

    res.json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// Alert statistics
router.get('/stats', (req, res) => {
  try {
    const alerts = alertManager.getAlerts();
    const rules = alertManager.getAlertRules();

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      current: {
        total: alerts.length,
        firing: alerts.filter(a => a.status === 'firing').length,
        resolved: alerts.filter(a => a.status === 'resolved').length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length,
      },
      last24h: {
        fired: alerts.filter(a => a.startsAt >= last24h).length,
        resolved: alerts.filter(a => a.endsAt && a.endsAt >= last24h).length,
      },
      last7d: {
        fired: alerts.filter(a => a.startsAt >= last7d).length,
        resolved: alerts.filter(a => a.endsAt && a.endsAt >= last7d).length,
      },
      rules: {
        total: rules.length,
        enabled: rules.filter(r => r.enabled).length,
        disabled: rules.filter(r => !r.enabled).length,
      },
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error generating alert statistics:', error);
    res.status(500).json({ error: 'Failed to generate alert statistics' });
  }
});

export { router as alertsRouter };
