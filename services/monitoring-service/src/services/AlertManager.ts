import axios from 'axios';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';

export interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'firing' | 'resolved';
  message: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: Date;
  endsAt?: Date;
  generatorURL?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  query: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'ne';
  duration: string;
  severity: 'critical' | 'warning' | 'info';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  enabled: boolean;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
}

export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private prometheusUrl: string;

  constructor() {
    this.prometheusUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
    this.initializeDefaultRules();
    this.initializeDefaultChannels();
    this.startAlertEvaluation();
  }

  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        query:
          'rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])',
        threshold: 0.05,
        operator: 'gt',
        duration: '5m',
        severity: 'critical',
        labels: { team: 'platform' },
        annotations: {
          summary: 'High error rate detected',
          description: 'Error rate is above 5% for more than 5 minutes',
        },
        enabled: true,
      },
      {
        id: 'high-response-time',
        name: 'High Response Time',
        query:
          'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
        threshold: 1.0,
        operator: 'gt',
        duration: '5m',
        severity: 'warning',
        labels: { team: 'platform' },
        annotations: {
          summary: 'High response time detected',
          description: '95th percentile response time is above 1 second',
        },
        enabled: true,
      },
      {
        id: 'service-down',
        name: 'Service Down',
        query: 'up',
        threshold: 1,
        operator: 'lt',
        duration: '1m',
        severity: 'critical',
        labels: { team: 'platform' },
        annotations: {
          summary: 'Service is down',
          description:
            'Service {{ $labels.job }} has been down for more than 1 minute',
        },
        enabled: true,
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        query:
          '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
        threshold: 85,
        operator: 'gt',
        duration: '5m',
        severity: 'warning',
        labels: { team: 'infrastructure' },
        annotations: {
          summary: 'High memory usage',
          description: 'Memory usage is above 85% for more than 5 minutes',
        },
        enabled: true,
      },
      {
        id: 'database-connections-high',
        name: 'Database Connections High',
        query: 'database_connections_active',
        threshold: 80,
        operator: 'gt',
        duration: '2m',
        severity: 'warning',
        labels: { team: 'database' },
        annotations: {
          summary: 'High number of database connections',
          description: 'Database has more than 80 active connections',
        },
        enabled: true,
      },
      {
        id: 'queue-size-high',
        name: 'Queue Size High',
        query: 'queue_size_total',
        threshold: 1000,
        operator: 'gt',
        duration: '5m',
        severity: 'warning',
        labels: { team: 'platform' },
        annotations: {
          summary: 'High queue size',
          description:
            'Queue {{ $labels.queue_name }} has more than 1000 items',
        },
        enabled: true,
      },
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    logger.info(`Initialized ${defaultRules.length} default alert rules`);
  }

  private initializeDefaultChannels(): void {
    const defaultChannels: NotificationChannel[] = [
      {
        id: 'email-alerts',
        name: 'Email Alerts',
        type: 'email',
        config: {
          to: process.env.ALERT_EMAIL || 'alerts@datatechtoncrm.com',
          smtp: {
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          },
        },
        enabled: true,
      },
      {
        id: 'slack-alerts',
        name: 'Slack Alerts',
        type: 'slack',
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: process.env.SLACK_CHANNEL || '#alerts',
        },
        enabled: !!process.env.SLACK_WEBHOOK_URL,
      },
    ];

    defaultChannels.forEach(channel => {
      this.notificationChannels.set(channel.id, channel);
    });

    logger.info(`Initialized ${defaultChannels.length} notification channels`);
  }

  private startAlertEvaluation(): void {
    // Evaluate alerts every 30 seconds
    cron.schedule('*/30 * * * * *', () => {
      this.evaluateAlerts();
    });

    logger.info('Alert evaluation started');
  }

  private async evaluateAlerts(): Promise<void> {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const result = await this.queryPrometheus(rule.query);
        const shouldAlert = this.evaluateCondition(result, rule);

        const existingAlert = this.alerts.get(ruleId);

        if (shouldAlert && !existingAlert) {
          // Fire new alert
          const alert: Alert = {
            id: ruleId,
            name: rule.name,
            severity: rule.severity,
            status: 'firing',
            message:
              rule.annotations.description ||
              rule.annotations.summary ||
              'Alert triggered',
            labels: { ...rule.labels, alertname: rule.name },
            annotations: rule.annotations,
            startsAt: new Date(),
          };

          this.alerts.set(ruleId, alert);
          await this.sendNotification(alert);
          logger.warn(`Alert fired: ${rule.name}`, { alert });
        } else if (
          !shouldAlert &&
          existingAlert &&
          existingAlert.status === 'firing'
        ) {
          // Resolve existing alert
          existingAlert.status = 'resolved';
          existingAlert.endsAt = new Date();

          await this.sendNotification(existingAlert);
          logger.info(`Alert resolved: ${rule.name}`, { alert: existingAlert });
        }
      } catch (error) {
        logger.error(`Error evaluating alert rule ${rule.name}:`, error);
      }
    }
  }

  private async queryPrometheus(query: string): Promise<any> {
    try {
      const response = await axios.get(`${this.prometheusUrl}/api/v1/query`, {
        params: { query },
        timeout: 10000,
      });

      return response.data.data.result;
    } catch (error) {
      logger.error('Error querying Prometheus:', error);
      throw error;
    }
  }

  private evaluateCondition(result: any[], rule: AlertRule): boolean {
    if (!result || result.length === 0) return false;

    // For simplicity, we'll evaluate the first result
    const value = parseFloat(result[0]?.value?.[1]);

    if (isNaN(value)) return false;

    switch (rule.operator) {
      case 'gt':
        return value > rule.threshold;
      case 'lt':
        return value < rule.threshold;
      case 'eq':
        return value === rule.threshold;
      case 'ne':
        return value !== rule.threshold;
      default:
        return false;
    }
  }

  private async sendNotification(alert: Alert): Promise<void> {
    for (const [channelId, channel] of this.notificationChannels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'email':
            await this.sendEmailNotification(alert, channel);
            break;
          case 'slack':
            await this.sendSlackNotification(alert, channel);
            break;
          case 'webhook':
            await this.sendWebhookNotification(alert, channel);
            break;
          default:
            logger.warn(`Unknown notification channel type: ${channel.type}`);
        }
      } catch (error) {
        logger.error(`Error sending notification via ${channel.name}:`, error);
      }
    }
  }

  private async sendEmailNotification(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<void> {
    // Email notification implementation would go here
    // For now, just log the notification
    logger.info('Email notification sent', {
      alert: alert.name,
      severity: alert.severity,
      status: alert.status,
      to: channel.config.to,
    });
  }

  private async sendSlackNotification(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<void> {
    if (!channel.config.webhookUrl) return;

    const color =
      alert.severity === 'critical'
        ? 'danger'
        : alert.severity === 'warning'
          ? 'warning'
          : 'good';

    const payload = {
      channel: channel.config.channel,
      username: 'DatatechtonCRM Monitoring',
      icon_emoji: ':warning:',
      attachments: [
        {
          color,
          title: `${alert.status === 'firing' ? '🔥' : '✅'} ${alert.name}`,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Status',
              value: alert.status.toUpperCase(),
              short: true,
            },
            {
              title: 'Started At',
              value: alert.startsAt.toISOString(),
              short: true,
            },
          ],
          footer: 'DatatechtonCRM Monitoring',
          ts: Math.floor(alert.startsAt.getTime() / 1000),
        },
      ],
    };

    await axios.post(channel.config.webhookUrl, payload);
    logger.info('Slack notification sent', {
      alert: alert.name,
      severity: alert.severity,
      status: alert.status,
    });
  }

  private async sendWebhookNotification(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<void> {
    if (!channel.config.url) return;

    await axios.post(channel.config.url, {
      alert,
      timestamp: new Date().toISOString(),
    });

    logger.info('Webhook notification sent', {
      alert: alert.name,
      severity: alert.severity,
      status: alert.status,
      url: channel.config.url,
    });
  }

  // Public methods for managing alerts
  public getAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  public getAlert(id: string): Alert | undefined {
    return this.alerts.get(id);
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info(`Alert rule added: ${rule.name}`);
  }

  public updateAlertRule(id: string, rule: Partial<AlertRule>): void {
    const existingRule = this.alertRules.get(id);

    if (existingRule) {
      this.alertRules.set(id, { ...existingRule, ...rule });
      logger.info(`Alert rule updated: ${id}`);
    }
  }

  public deleteAlertRule(id: string): void {
    this.alertRules.delete(id);
    this.alerts.delete(id); // Also remove any active alerts
    logger.info(`Alert rule deleted: ${id}`);
  }

  public getNotificationChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values());
  }

  public addNotificationChannel(channel: NotificationChannel): void {
    this.notificationChannels.set(channel.id, channel);
    logger.info(`Notification channel added: ${channel.name}`);
  }

  public updateNotificationChannel(
    id: string,
    channel: Partial<NotificationChannel>
  ): void {
    const existingChannel = this.notificationChannels.get(id);

    if (existingChannel) {
      this.notificationChannels.set(id, { ...existingChannel, ...channel });
      logger.info(`Notification channel updated: ${id}`);
    }
  }

  public deleteNotificationChannel(id: string): void {
    this.notificationChannels.delete(id);
    logger.info(`Notification channel deleted: ${id}`);
  }
}
