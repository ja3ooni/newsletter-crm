import axios from 'axios';
import * as cron from 'node-cron';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  register,
} from 'prom-client';
import { logger } from '../utils/logger';

export class MetricsCollector {
  private httpRequestsTotal: Counter<string>;
  private httpRequestDuration: Histogram<string>;
  private activeConnections: Gauge<string>;
  private systemMemoryUsage: Gauge<string>;
  private systemCpuUsage: Gauge<string>;
  private databaseConnections: Gauge<string>;
  private queueSize: Gauge<string>;
  private emailsSent: Counter<string>;
  private newslettersGenerated: Counter<string>;
  private userRegistrations: Counter<string>;
  private subscriptionChanges: Counter<string>;
  private apiErrors: Counter<string>;

  constructor() {
    // Enable default metrics collection (CPU, memory, etc.)
    collectDefaultMetrics({ register });

    // HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'],
      registers: [register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [register],
    });

    // System metrics
    this.activeConnections = new Gauge({
      name: 'active_connections_total',
      help: 'Number of active connections',
      labelNames: ['service'],
      registers: [register],
    });

    this.systemMemoryUsage = new Gauge({
      name: 'system_memory_usage_bytes',
      help: 'System memory usage in bytes',
      labelNames: ['type'],
      registers: [register],
    });

    this.systemCpuUsage = new Gauge({
      name: 'system_cpu_usage_percent',
      help: 'System CPU usage percentage',
      registers: [register],
    });

    // Database metrics
    this.databaseConnections = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      labelNames: ['database', 'service'],
      registers: [register],
    });

    // Queue metrics
    this.queueSize = new Gauge({
      name: 'queue_size_total',
      help: 'Number of items in queue',
      labelNames: ['queue_name', 'service'],
      registers: [register],
    });

    // Business metrics
    this.emailsSent = new Counter({
      name: 'emails_sent_total',
      help: 'Total number of emails sent',
      labelNames: ['type', 'status'],
      registers: [register],
    });

    this.newslettersGenerated = new Counter({
      name: 'newsletters_generated_total',
      help: 'Total number of newsletters generated',
      labelNames: ['type', 'status'],
      registers: [register],
    });

    this.userRegistrations = new Counter({
      name: 'user_registrations_total',
      help: 'Total number of user registrations',
      labelNames: ['source', 'plan'],
      registers: [register],
    });

    this.subscriptionChanges = new Counter({
      name: 'subscription_changes_total',
      help: 'Total number of subscription changes',
      labelNames: ['from_plan', 'to_plan', 'action'],
      registers: [register],
    });

    this.apiErrors = new Counter({
      name: 'api_errors_total',
      help: 'Total number of API errors',
      labelNames: ['service', 'endpoint', 'error_type'],
      registers: [register],
    });
  }

  public startCollection(): void {
    logger.info('Starting metrics collection');

    // Collect system metrics every 30 seconds
    cron.schedule('*/30 * * * * *', () => {
      this.collectSystemMetrics();
    });

    // Collect service metrics every minute
    cron.schedule('0 * * * * *', () => {
      this.collectServiceMetrics();
    });

    // Collect business metrics every 5 minutes
    cron.schedule('0 */5 * * * *', () => {
      this.collectBusinessMetrics();
    });

    logger.info('Metrics collection scheduled');
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      this.systemMemoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.systemMemoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
      this.systemMemoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
      this.systemMemoryUsage.set({ type: 'external' }, memUsage.external);

      // CPU usage calculation (simplified)
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
      this.systemCpuUsage.set(cpuPercent);
    } catch (error) {
      logger.error('Error collecting system metrics:', error);
    }
  }

  private async collectServiceMetrics(): Promise<void> {
    const services = [
      { name: 'user-service', port: 3001 },
      { name: 'newsletter-service', port: 3002 },
      { name: 'content-service', port: 3003 },
      { name: 'crm-service', port: 3004 },
      { name: 'analytics-service', port: 3005 },
    ];

    for (const service of services) {
      try {
        const response = await axios.get(
          `http://${service.name}:${service.port}/health`,
          {
            timeout: 5000,
          }
        );

        if (response.data.connections) {
          this.activeConnections.set(
            { service: service.name },
            response.data.connections
          );
        }

        if (response.data.database?.connections) {
          this.databaseConnections.set(
            { database: 'postgresql', service: service.name },
            response.data.database.connections
          );
        }

        if (response.data.queues) {
          Object.entries(response.data.queues).forEach(([queueName, size]) => {
            this.queueSize.set(
              { queue_name: queueName, service: service.name },
              size as number
            );
          });
        }
      } catch (error) {
        logger.warn(`Failed to collect metrics from ${service.name}:`, error);
        // Set service as unavailable
        this.activeConnections.set({ service: service.name }, 0);
      }
    }
  }

  private async collectBusinessMetrics(): Promise<void> {
    try {
      // These would typically come from your database or other services
      // For now, we'll simulate some basic collection

      // Collect from analytics service
      const analyticsResponse = await axios.get(
        'http://analytics-service:3005/api/v1/metrics/business',
        {
          timeout: 10000,
        }
      );

      if (analyticsResponse.data) {
        const metrics = analyticsResponse.data;

        if (metrics.emails) {
          Object.entries(metrics.emails).forEach(
            ([type, data]: [string, any]) => {
              this.emailsSent.inc({ type, status: 'sent' }, data.sent || 0);
              this.emailsSent.inc({ type, status: 'failed' }, data.failed || 0);
            }
          );
        }

        if (metrics.newsletters) {
          Object.entries(metrics.newsletters).forEach(
            ([type, data]: [string, any]) => {
              this.newslettersGenerated.inc(
                { type, status: 'success' },
                data.success || 0
              );
              this.newslettersGenerated.inc(
                { type, status: 'failed' },
                data.failed || 0
              );
            }
          );
        }

        if (metrics.users) {
          Object.entries(metrics.users).forEach(
            ([source, data]: [string, any]) => {
              Object.entries(data).forEach(([plan, count]: [string, any]) => {
                this.userRegistrations.inc({ source, plan }, count || 0);
              });
            }
          );
        }
      }
    } catch (error) {
      logger.warn('Failed to collect business metrics:', error);
    }
  }

  // Methods to be called by other services
  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    service: string
  ): void {
    this.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
      service,
    });
    this.httpRequestDuration.observe(
      { method, route, status_code: statusCode.toString(), service },
      duration
    );
  }

  public recordEmailSent(type: string, status: string): void {
    this.emailsSent.inc({ type, status });
  }

  public recordNewsletterGenerated(type: string, status: string): void {
    this.newslettersGenerated.inc({ type, status });
  }

  public recordUserRegistration(source: string, plan: string): void {
    this.userRegistrations.inc({ source, plan });
  }

  public recordSubscriptionChange(
    fromPlan: string,
    toPlan: string,
    action: string
  ): void {
    this.subscriptionChanges.inc({
      from_plan: fromPlan,
      to_plan: toPlan,
      action,
    });
  }

  public recordApiError(
    service: string,
    endpoint: string,
    errorType: string
  ): void {
    this.apiErrors.inc({ service, endpoint, error_type: errorType });
  }

  public getMetrics(): Promise<string> {
    return register.metrics();
  }
}
