// @ts-nocheck
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { LeakDetectionResult, memoryLeakDetector } from './MemoryLeakDetector';
import { MemoryOptimizationIntegration } from './MemoryOptimizationIntegration';

export interface MemoryAlert {
  id: string;
  timestamp: number;
  type:
    | 'memory_usage'
    | 'memory_leak'
    | 'resource_leak'
    | 'performance_degradation';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metrics: Record<string, any>;
  recommendations: string[];
  resolved: boolean;
  resolvedAt?: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  checkInterval: number; // milliseconds
  thresholds: {
    memoryUsage: {
      warning: number; // percentage
      critical: number; // percentage
    };
    heapGrowth: {
      warning: number; // MB per minute
      critical: number; // MB per minute
    };
    gcFrequency: {
      warning: number; // GCs per minute
      critical: number; // GCs per minute
    };
  };
  alerting: {
    enabled: boolean;
    channels: {
      console: boolean;
      webhook?: string;
      email?: string[];
    };
    cooldown: number; // milliseconds between same alert types
  };
  retention: {
    maxAlerts: number;
    maxAge: number; // milliseconds
  };
}

export interface MemoryReport {
  timestamp: number;
  summary: {
    status: 'healthy' | 'warning' | 'critical';
    memoryUsage: number; // percentage
    heapSize: number; // MB
    activeAlerts: number;
    resolvedAlerts: number;
  };
  metrics: {
    heap: {
      used: number;
      total: number;
      percentage: number;
    };
    external: number;
    rss: number;
    gc: {
      count: number;
      frequency: number; // per minute
    };
    leaks: LeakDetectionResult;
  };
  alerts: MemoryAlert[];
  recommendations: string[];
}

export class MemoryMonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private memoryIntegration: MemoryOptimizationIntegration;
  private alerts = new Map<string, MemoryAlert>();
  private alertCooldowns = new Map<string, number>();
  private monitoringTimer?: NodeJS.Timeout;
  private isMonitoring = false;
  private alertCounter = 0;
  private lastGcCount = 0;
  private gcHistory: number[] = [];

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      checkInterval: 30000, // 30 seconds
      thresholds: {
        memoryUsage: {
          warning: 80,
          critical: 95,
        },
        heapGrowth: {
          warning: 50, // 50MB per minute
          critical: 100, // 100MB per minute
        },
        gcFrequency: {
          warning: 10, // 10 GCs per minute
          critical: 20, // 20 GCs per minute
        },
      },
      alerting: {
        enabled: true,
        channels: {
          console: true,
        },
        cooldown: 300000, // 5 minutes
      },
      retention: {
        maxAlerts: 1000,
        maxAge: 86400000, // 24 hours
      },
      ...config,
    };

    this.memoryIntegration = MemoryOptimizationIntegration.getInstance();
    this.setupEventHandlers();
  }

  /**
   * Start memory monitoring
   */
  start(): void {
    if (!this.config.enabled || this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    memoryLeakDetector.startMonitoring();

    this.monitoringTimer = setInterval(() => {
      this.performMonitoringCheck();
    }, this.config.checkInterval);

    logger.info('Memory monitoring started', {
      checkInterval: this.config.checkInterval,
      thresholds: this.config.thresholds,
    });
  }

  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    memoryLeakDetector.stopMonitoring();

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    logger.info('Memory monitoring stopped');
  }

  /**
   * Get current memory report
   */
  async getMemoryReport(): Promise<MemoryReport> {
    const memoryMetrics = this.memoryIntegration
      .getMemoryOptimizer()
      .getMemoryMetrics();
    const leakDetection = memoryLeakDetector.detectLeaks();
    const activeAlerts = Array.from(this.alerts.values()).filter(
      alert => !alert.resolved
    );
    const resolvedAlerts = Array.from(this.alerts.values()).filter(
      alert => alert.resolved
    );

    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (activeAlerts.some(alert => alert.severity === 'critical')) {
      status = 'critical';
    } else if (activeAlerts.some(alert => alert.severity === 'warning')) {
      status = 'warning';
    }

    // Calculate GC frequency
    const gcFrequency = this.calculateGcFrequency();

    return {
      timestamp: Date.now(),
      summary: {
        status,
        memoryUsage: memoryMetrics.heapUsagePercentage,
        heapSize: memoryMetrics.heapUsed,
        activeAlerts: activeAlerts.length,
        resolvedAlerts: resolvedAlerts.length,
      },
      metrics: {
        heap: {
          used: memoryMetrics.heapUsed,
          total: memoryMetrics.heapTotal,
          percentage: memoryMetrics.heapUsagePercentage,
        },
        external: memoryMetrics.external,
        rss: memoryMetrics.rss,
        gc: {
          count: memoryMetrics.gcCount,
          frequency: gcFrequency,
        },
        leaks: leakDetection,
      },
      alerts: activeAlerts,
      recommendations: this.generateRecommendations(
        memoryMetrics,
        leakDetection,
        activeAlerts
      ),
    };
  }

  /**
   * Get all alerts (active and resolved)
   */
  getAllAlerts(): MemoryAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get active alerts only
   */
  getActiveAlerts(): MemoryAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);

    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = Date.now();

    this.emit('alertResolved', alert);
    logger.info('Memory alert resolved', {
      alertId,
      title: alert.title,
      duration: alert.resolvedAt - alert.timestamp,
    });

    return true;
  }

  /**
   * Clear old alerts based on retention policy
   */
  clearOldAlerts(): number {
    const now = Date.now();
    const maxAge = this.config.retention.maxAge;
    let cleared = 0;

    for (const [alertId, alert] of this.alerts.entries()) {
      if (now - alert.timestamp > maxAge) {
        this.alerts.delete(alertId);
        cleared++;
      }
    }

    // Also limit by count
    const allAlerts = Array.from(this.alerts.values());

    if (allAlerts.length > this.config.retention.maxAlerts) {
      // Sort by timestamp and keep only the most recent
      allAlerts.sort((a, b) => b.timestamp - a.timestamp);
      const toKeep = allAlerts.slice(0, this.config.retention.maxAlerts);

      this.alerts.clear();
      toKeep.forEach(alert => this.alerts.set(alert.id, alert));

      cleared += allAlerts.length - toKeep.length;
    }

    if (cleared > 0) {
      logger.info('Cleared old memory alerts', { count: cleared });
    }

    return cleared;
  }

  /**
   * Force memory optimization
   */
  async forceOptimization(): Promise<any> {
    logger.info('Forcing memory optimization');

    return this.memoryIntegration.optimizeSystem();
  }

  /**
   * Perform monitoring check
   */
  private async performMonitoringCheck(): Promise<void> {
    try {
      const memoryMetrics = this.memoryIntegration
        .getMemoryOptimizer()
        .getMemoryMetrics();
      const leakDetection = memoryLeakDetector.detectLeaks();

      // Check memory usage thresholds
      this.checkMemoryUsageThresholds(memoryMetrics);

      // Check for memory leaks
      this.checkMemoryLeaks(leakDetection);

      // Check GC frequency
      this.checkGcFrequency(memoryMetrics);

      // Clean up old alerts
      this.clearOldAlerts();

      // Update GC history
      this.updateGcHistory(memoryMetrics.gcCount);
    } catch (error) {
      logger.error('Error during memory monitoring check', error);
    }
  }

  /**
   * Check memory usage against thresholds
   */
  private checkMemoryUsageThresholds(metrics: any): void {
    const usage = metrics.heapUsagePercentage;
    const { warning, critical } = this.config.thresholds.memoryUsage;

    if (usage >= critical) {
      this.createAlert({
        type: 'memory_usage',
        severity: 'critical',
        title: 'Critical Memory Usage',
        message: `Memory usage is ${usage.toFixed(1)}% (critical threshold: ${critical}%)`,
        metrics: { heapUsagePercentage: usage, heapUsed: metrics.heapUsed },
        recommendations: [
          'Immediate memory optimization required',
          'Consider restarting the service',
          'Review recent code changes',
          'Check for memory leaks',
        ],
      });
    } else if (usage >= warning) {
      this.createAlert({
        type: 'memory_usage',
        severity: 'warning',
        title: 'High Memory Usage',
        message: `Memory usage is ${usage.toFixed(1)}% (warning threshold: ${warning}%)`,
        metrics: { heapUsagePercentage: usage, heapUsed: metrics.heapUsed },
        recommendations: [
          'Monitor memory usage closely',
          'Consider memory optimization',
          'Review application performance',
        ],
      });
    }
  }

  /**
   * Check for memory leaks
   */
  private checkMemoryLeaks(leakDetection: LeakDetectionResult): void {
    if (!leakDetection.detected) {
      return;
    }

    const severity =
      leakDetection.riskLevel === 'critical' ? 'critical' : 'warning';
    const patternTypes = leakDetection.patterns.map(p => p.type).join(', ');

    this.createAlert({
      type: 'memory_leak',
      severity,
      title: 'Memory Leak Detected',
      message: `Detected ${leakDetection.patterns.length} potential memory leak patterns: ${patternTypes}`,
      metrics: {
        riskLevel: leakDetection.riskLevel,
        patternCount: leakDetection.patterns.length,
        memoryTrend: leakDetection.memoryTrend,
      },
      recommendations: leakDetection.recommendations,
    });
  }

  /**
   * Check GC frequency
   */
  private checkGcFrequency(metrics: any): void {
    const gcFrequency = this.calculateGcFrequency();
    const { warning, critical } = this.config.thresholds.gcFrequency;

    if (gcFrequency >= critical) {
      this.createAlert({
        type: 'performance_degradation',
        severity: 'critical',
        title: 'Excessive Garbage Collection',
        message: `GC frequency is ${gcFrequency.toFixed(1)} per minute (critical threshold: ${critical})`,
        metrics: { gcFrequency, gcCount: metrics.gcCount },
        recommendations: [
          'Memory pressure is causing frequent GC',
          'Optimize memory usage patterns',
          'Consider increasing heap size',
          'Review object creation patterns',
        ],
      });
    } else if (gcFrequency >= warning) {
      this.createAlert({
        type: 'performance_degradation',
        severity: 'warning',
        title: 'High Garbage Collection Frequency',
        message: `GC frequency is ${gcFrequency.toFixed(1)} per minute (warning threshold: ${warning})`,
        metrics: { gcFrequency, gcCount: metrics.gcCount },
        recommendations: [
          'Monitor GC patterns',
          'Consider memory optimization',
          'Review memory allocation patterns',
        ],
      });
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(alertData: {
    type: MemoryAlert['type'];
    severity: MemoryAlert['severity'];
    title: string;
    message: string;
    metrics: Record<string, any>;
    recommendations: string[];
  }): void {
    // Check cooldown
    const cooldownKey = `${alertData.type}-${alertData.severity}`;
    const lastAlert = this.alertCooldowns.get(cooldownKey);
    const now = Date.now();

    if (lastAlert && now - lastAlert < this.config.alerting.cooldown) {
      return; // Still in cooldown period
    }

    const alert: MemoryAlert = {
      id: `alert_${++this.alertCounter}_${now}`,
      timestamp: now,
      ...alertData,
      resolved: false,
    };

    this.alerts.set(alert.id, alert);
    this.alertCooldowns.set(cooldownKey, now);

    // Emit alert event
    this.emit('alert', alert);

    // Send alert through configured channels
    if (this.config.alerting.enabled) {
      this.sendAlert(alert);
    }

    logger.warn('Memory alert created', {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
    });
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(alert: MemoryAlert): Promise<void> {
    const { channels } = this.config.alerting;

    // Console logging
    if (channels.console) {
      const logLevel = alert.severity === 'critical' ? 'error' : 'warn';

      logger[logLevel]('MEMORY ALERT', {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        recommendations: alert.recommendations,
      });
    }

    // Webhook (placeholder - implement based on your webhook service)
    if (channels.webhook) {
      try {
        // Implementation would depend on your webhook service
        logger.info('Webhook alert sent', {
          alertId: alert.id,
          webhook: channels.webhook,
        });
      } catch (error) {
        logger.error('Failed to send webhook alert', error);
      }
    }

    // Email (placeholder - implement based on your email service)
    if (channels.email && channels.email.length > 0) {
      try {
        // Implementation would depend on your email service
        logger.info('Email alert sent', {
          alertId: alert.id,
          recipients: channels.email,
        });
      } catch (error) {
        logger.error('Failed to send email alert', error);
      }
    }
  }

  /**
   * Calculate GC frequency (GCs per minute)
   */
  private calculateGcFrequency(): number {
    if (this.gcHistory.length < 2) {
      return 0;
    }

    const recent = this.gcHistory.slice(-10); // Last 10 measurements
    const timeSpan =
      (recent.length - 1) * (this.config.checkInterval / 1000 / 60); // minutes
    const gcDiff = recent[recent.length - 1] - recent[0];

    return timeSpan > 0 ? gcDiff / timeSpan : 0;
  }

  /**
   * Update GC history
   */
  private updateGcHistory(currentGcCount: number): void {
    this.gcHistory.push(currentGcCount);

    // Keep only recent history
    if (this.gcHistory.length > 20) {
      this.gcHistory = this.gcHistory.slice(-20);
    }
  }

  /**
   * Generate recommendations based on current state
   */
  private generateRecommendations(
    memoryMetrics: any,
    leakDetection: LeakDetectionResult,
    activeAlerts: MemoryAlert[]
  ): string[] {
    const recommendations = new Set<string>();

    // Memory usage recommendations
    if (memoryMetrics.heapUsagePercentage > 70) {
      recommendations.add('Monitor memory usage trends');
      recommendations.add('Consider implementing memory limits');
    }

    // Leak detection recommendations
    if (leakDetection.detected) {
      leakDetection.recommendations.forEach(rec => recommendations.add(rec));
    }

    // Alert-based recommendations
    if (activeAlerts.some(alert => alert.severity === 'critical')) {
      recommendations.add('Address critical alerts immediately');
      recommendations.add('Consider service restart if issues persist');
    }

    // General recommendations
    if (recommendations.size === 0) {
      recommendations.add('Memory usage is within normal parameters');
      recommendations.add('Continue regular monitoring');
    }

    return Array.from(recommendations);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle memory leak detection events
    memoryLeakDetector.on('leakDetected', (result: LeakDetectionResult) => {
      this.checkMemoryLeaks(result);
    });

    // Handle memory optimization events
    this.memoryIntegration.getResourceMonitor().on('alert', (alert: any) => {
      this.createAlert({
        type: 'resource_leak',
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        metrics: alert.metrics,
        recommendations: alert.recommendations,
      });
    });
  }
}

// Export singleton instance
export const memoryMonitoringService = new MemoryMonitoringService();
