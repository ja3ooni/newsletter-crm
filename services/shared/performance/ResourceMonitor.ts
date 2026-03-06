// @ts-nocheck
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import {
  MemoryAlert,
  MemoryConfig,
  MemoryMetrics,
  MemoryOptimizer,
} from './MemoryOptimizer';

export interface ResourceMonitorConfig {
  memory: MemoryConfig;
  monitoring: {
    enableCpuMonitoring: boolean;
    enableNetworkMonitoring: boolean;
    enableFileSystemMonitoring: boolean;
    alertingEnabled: boolean;
    reportingInterval: number; // milliseconds
  };
  alerts: {
    email?: string[];
    webhook?: string;
    slack?: {
      webhookUrl: string;
      channel: string;
    };
  };
  thresholds: {
    cpu: {
      warning: number; // percentage
      critical: number; // percentage
    };
    memory: {
      warning: number; // percentage
      critical: number; // percentage
    };
    disk: {
      warning: number; // percentage
      critical: number; // percentage
    };
    network: {
      maxConnections: number;
      maxBandwidth: number; // MB/s
    };
  };
}

export interface SystemMetrics {
  timestamp: number;
  memory: MemoryMetrics;
  cpu: {
    usage: number; // percentage
    loadAverage: number[];
    processes: number;
  };
  network: {
    connections: number;
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  disk: {
    usage: number; // percentage
    available: number; // MB
    total: number; // MB
    iops: number;
  };
  processes: {
    active: number;
    zombie: number;
    sleeping: number;
  };
}

export interface ResourceAlert {
  id: string;
  type: 'memory' | 'cpu' | 'disk' | 'network' | 'process';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metrics: Partial<SystemMetrics>;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  recommendations: string[];
}

export interface PerformanceReport {
  period: {
    start: number;
    end: number;
  };
  summary: {
    avgMemoryUsage: number;
    avgCpuUsage: number;
    peakMemoryUsage: number;
    peakCpuUsage: number;
    totalAlerts: number;
    criticalAlerts: number;
    uptime: number;
  };
  trends: {
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    cpuTrend: 'increasing' | 'decreasing' | 'stable';
    alertTrend: 'increasing' | 'decreasing' | 'stable';
  };
  recommendations: string[];
  alerts: ResourceAlert[];
}

export class ResourceMonitor extends EventEmitter {
  private config: ResourceMonitorConfig;
  private memoryOptimizer: MemoryOptimizer;
  private monitoringTimer?: NodeJS.Timeout;
  private reportingTimer?: NodeJS.Timeout;
  private metricsHistory: SystemMetrics[] = [];
  private activeAlerts = new Map<string, ResourceAlert>();
  private alertCounter = 0;
  private startTime: number;

  constructor(config: ResourceMonitorConfig) {
    super();
    this.config = config;
    this.startTime = Date.now();
    this.memoryOptimizer = new MemoryOptimizer(config.memory);

    this.setupEventHandlers();
    logger.info('ResourceMonitor initialized');
  }

  /**
   * Start resource monitoring
   */
  start(): void {
    this.memoryOptimizer.start();
    this.startSystemMonitoring();
    this.startPeriodicReporting();

    logger.info('Resource monitoring started');
  }

  /**
   * Stop resource monitoring
   */
  stop(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = undefined;
    }

    this.memoryOptimizer.stop();
    logger.info('Resource monitoring stopped');
  }

  /**
   * Get current system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryMetrics = this.memoryOptimizer.getMemoryMetrics();

    return {
      timestamp: Date.now(),
      memory: memoryMetrics,
      cpu: await this.getCpuMetrics(),
      network: await this.getNetworkMetrics(),
      disk: await this.getDiskMetrics(),
      processes: await this.getProcessMetrics(),
    };
  }

  /**
   * Get memory optimizer instance
   */
  getMemoryOptimizer(): MemoryOptimizer {
    return this.memoryOptimizer;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): ResourceAlert[] {
    return Array.from(this.activeAlerts.values()).filter(
      alert => !alert.resolved
    );
  }

  /**
   * Get performance report for a time period
   */
  getPerformanceReport(
    startTime?: number,
    endTime?: number
  ): PerformanceReport {
    const start = startTime || this.startTime;
    const end = endTime || Date.now();

    const periodMetrics = this.metricsHistory.filter(
      m => m.timestamp >= start && m.timestamp <= end
    );

    if (periodMetrics.length === 0) {
      throw new Error('No metrics available for the specified period');
    }

    const memoryUsages = periodMetrics.map(m => m.memory.heapUsagePercentage);
    const cpuUsages = periodMetrics.map(m => m.cpu.usage);

    const periodAlerts = Array.from(this.activeAlerts.values()).filter(
      alert => alert.timestamp >= start && alert.timestamp <= end
    );

    return {
      period: { start, end },
      summary: {
        avgMemoryUsage: this.calculateAverage(memoryUsages),
        avgCpuUsage: this.calculateAverage(cpuUsages),
        peakMemoryUsage: Math.max(...memoryUsages),
        peakCpuUsage: Math.max(...cpuUsages),
        totalAlerts: periodAlerts.length,
        criticalAlerts: periodAlerts.filter(a => a.severity === 'critical')
          .length,
        uptime: end - start,
      },
      trends: {
        memoryTrend: this.calculateTrend(memoryUsages),
        cpuTrend: this.calculateTrend(cpuUsages),
        alertTrend: this.calculateAlertTrend(periodAlerts),
      },
      recommendations: this.generateRecommendations(periodMetrics),
      alerts: periodAlerts,
    };
  }

  /**
   * Force system optimization
   */
  async optimizeSystem(): Promise<{
    memoryOptimization: any;
    systemActions: string[];
    alertsResolved: number;
  }> {
    const memoryOptimization = await this.memoryOptimizer.optimizeMemory();
    const systemActions: string[] = [];
    let alertsResolved = 0;

    // Resolve memory-related alerts if memory usage improved
    const memoryImprovement =
      memoryOptimization.beforeOptimization.heapUsagePercentage -
      memoryOptimization.afterOptimization.heapUsagePercentage;

    if (memoryImprovement > 5) {
      // 5% improvement
      for (const [id, alert] of this.activeAlerts.entries()) {
        if (alert.type === 'memory' && !alert.resolved) {
          this.resolveAlert(id);
          alertsResolved++;
        }
      }
      systemActions.push('Resolved memory alerts due to optimization');
    }

    // Additional system optimizations could be added here
    // e.g., clearing temporary files, optimizing database connections, etc.

    logger.info('System optimization completed', {
      memoryFreed: memoryImprovement.toFixed(2) + '%',
      alertsResolved,
      systemActions,
    });

    return {
      memoryOptimization,
      systemActions,
      alertsResolved,
    };
  }

  /**
   * Create an alert
   */
  private createAlert(
    type: ResourceAlert['type'],
    severity: ResourceAlert['severity'],
    title: string,
    message: string,
    metrics: Partial<SystemMetrics>,
    recommendations: string[]
  ): ResourceAlert {
    const alert: ResourceAlert = {
      id: `alert_${++this.alertCounter}_${Date.now()}`,
      type,
      severity,
      title,
      message,
      metrics,
      timestamp: Date.now(),
      resolved: false,
      recommendations,
    };

    this.activeAlerts.set(alert.id, alert);
    this.emit('alert', alert);

    if (this.config.monitoring.alertingEnabled) {
      this.sendAlert(alert);
    }

    logger.warn('Resource alert created', {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
    });

    return alert;
  }

  /**
   * Resolve an alert
   */
  private resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = Date.now();

    this.emit('alertResolved', alert);
    logger.info('Alert resolved', { id: alertId, title: alert.title });

    return true;
  }

  /**
   * Setup event handlers for memory optimizer
   */
  private setupEventHandlers(): void {
    this.memoryOptimizer.on('memoryAlert', (memoryAlert: MemoryAlert) => {
      this.createAlert(
        'memory',
        memoryAlert.severity,
        `Memory Alert: ${memoryAlert.type}`,
        memoryAlert.message,
        { memory: memoryAlert.metrics as MemoryMetrics },
        memoryAlert.recommendations
      );
    });

    this.memoryOptimizer.on('streamProgress', (progress: any) => {
      this.emit('streamProgress', progress);
    });
  }

  /**
   * Start system monitoring
   */
  private startSystemMonitoring(): void {
    this.monitoringTimer = setInterval(async () => {
      try {
        const metrics = await this.getSystemMetrics();
        this.metricsHistory.push(metrics);

        // Keep only recent history (last 24 hours worth of data)
        const maxHistorySize = Math.floor(
          (24 * 60 * 60 * 1000) / this.config.monitoring.reportingInterval
        );
        if (this.metricsHistory.length > maxHistorySize) {
          this.metricsHistory = this.metricsHistory.slice(-maxHistorySize);
        }

        // Check for alerts
        this.checkSystemAlerts(metrics);

        this.emit('metrics', metrics);
      } catch (error) {
        logger.error('Failed to collect system metrics', error);
      }
    }, this.config.monitoring.reportingInterval);
  }

  /**
   * Start periodic reporting
   */
  private startPeriodicReporting(): void {
    // Generate hourly reports
    this.reportingTimer = setInterval(() => {
      try {
        const report = this.getPerformanceReport(Date.now() - 3600000); // Last hour
        this.emit('performanceReport', report);

        logger.info('Hourly performance report generated', {
          avgMemory: report.summary.avgMemoryUsage.toFixed(1) + '%',
          avgCpu: report.summary.avgCpuUsage.toFixed(1) + '%',
          alerts: report.summary.totalAlerts,
        });
      } catch (error) {
        logger.error('Failed to generate performance report', error);
      }
    }, 3600000); // Every hour
  }

  /**
   * Check system metrics for alert conditions
   */
  private checkSystemAlerts(metrics: SystemMetrics): void {
    // CPU alerts
    if (this.config.monitoring.enableCpuMonitoring) {
      if (metrics.cpu.usage > this.config.thresholds.cpu.critical) {
        this.createAlert(
          'cpu',
          'critical',
          'Critical CPU Usage',
          `CPU usage is ${metrics.cpu.usage.toFixed(1)}%`,
          { cpu: metrics.cpu },
          [
            'Identify CPU-intensive processes',
            'Scale horizontally if possible',
            'Optimize algorithms and queries',
            'Consider CPU profiling',
          ]
        );
      } else if (metrics.cpu.usage > this.config.thresholds.cpu.warning) {
        this.createAlert(
          'cpu',
          'warning',
          'High CPU Usage',
          `CPU usage is ${metrics.cpu.usage.toFixed(1)}%`,
          { cpu: metrics.cpu },
          [
            'Monitor CPU trends',
            'Review recent deployments',
            'Check for background processes',
          ]
        );
      }
    }

    // Disk alerts
    if (metrics.disk.usage > this.config.thresholds.disk.critical) {
      this.createAlert(
        'disk',
        'critical',
        'Critical Disk Usage',
        `Disk usage is ${metrics.disk.usage.toFixed(1)}%`,
        { disk: metrics.disk },
        [
          'Clean up temporary files',
          'Archive old logs',
          'Increase disk capacity',
          'Implement log rotation',
        ]
      );
    } else if (metrics.disk.usage > this.config.thresholds.disk.warning) {
      this.createAlert(
        'disk',
        'warning',
        'High Disk Usage',
        `Disk usage is ${metrics.disk.usage.toFixed(1)}%`,
        { disk: metrics.disk },
        [
          'Monitor disk growth trends',
          'Review file cleanup policies',
          'Consider disk expansion',
        ]
      );
    }

    // Network alerts
    if (this.config.monitoring.enableNetworkMonitoring) {
      if (
        metrics.network.connections >
        this.config.thresholds.network.maxConnections
      ) {
        this.createAlert(
          'network',
          'warning',
          'High Network Connections',
          `Active connections: ${metrics.network.connections}`,
          { network: metrics.network },
          [
            'Review connection pooling',
            'Check for connection leaks',
            'Implement connection limits',
            'Monitor for DDoS attacks',
          ]
        );
      }
    }
  }

  /**
   * Get CPU metrics
   */
  private async getCpuMetrics(): Promise<SystemMetrics['cpu']> {
    // Simplified CPU metrics - in production, you might use more sophisticated monitoring
    const usage = process.cpuUsage();
    const loadAvg = require('os').loadavg();

    return {
      usage: (usage.user + usage.system) / 1000000, // Convert to percentage (simplified)
      loadAverage: loadAvg,
      processes: 0, // Would need system-specific implementation
    };
  }

  /**
   * Get network metrics
   */
  private async getNetworkMetrics(): Promise<SystemMetrics['network']> {
    // Simplified network metrics - in production, you might use system monitoring tools
    return {
      connections: 0, // Would need system-specific implementation
      bytesIn: 0,
      bytesOut: 0,
      packetsIn: 0,
      packetsOut: 0,
    };
  }

  /**
   * Get disk metrics
   */
  private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    // Simplified disk metrics - in production, you might use fs.statSync or system tools
    return {
      usage: 0, // Would need system-specific implementation
      available: 0,
      total: 0,
      iops: 0,
    };
  }

  /**
   * Get process metrics
   */
  private async getProcessMetrics(): Promise<SystemMetrics['processes']> {
    // Simplified process metrics
    return {
      active: 1, // Current process
      zombie: 0,
      sleeping: 0,
    };
  }

  /**
   * Send alert notification
   */
  private async sendAlert(alert: ResourceAlert): Promise<void> {
    // Implementation would depend on configured alert channels
    // This is a placeholder for actual notification logic
    logger.info('Alert notification sent', {
      alertId: alert.id,
      type: alert.type,
    });
  }

  /**
   * Calculate average of an array of numbers
   */
  private calculateAverage(values: number[]): number {
    return values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  }

  /**
   * Calculate trend from array of values
   */
  private calculateTrend(
    values: number[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';

    const first = values.slice(0, Math.floor(values.length / 2));
    const second = values.slice(Math.floor(values.length / 2));

    const firstAvg = this.calculateAverage(first);
    const secondAvg = this.calculateAverage(second);

    const diff = secondAvg - firstAvg;
    const threshold = firstAvg * 0.1; // 10% change threshold

    if (diff > threshold) return 'increasing';
    if (diff < -threshold) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate alert trend
   */
  private calculateAlertTrend(
    alerts: ResourceAlert[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (alerts.length < 2) return 'stable';

    const midpoint = Math.floor(alerts.length / 2);
    const firstHalf = alerts.slice(0, midpoint).length;
    const secondHalf = alerts.slice(midpoint).length;

    if (secondHalf > firstHalf * 1.2) return 'increasing';
    if (secondHalf < firstHalf * 0.8) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate optimization recommendations based on metrics
   */
  private generateRecommendations(metrics: SystemMetrics[]): string[] {
    const recommendations: string[] = [];

    if (metrics.length === 0) return recommendations;

    const avgMemory = this.calculateAverage(
      metrics.map(m => m.memory.heapUsagePercentage)
    );
    const avgCpu = this.calculateAverage(metrics.map(m => m.cpu.usage));

    if (avgMemory > 70) {
      recommendations.push(
        'Consider implementing more aggressive memory optimization'
      );
    }

    if (avgCpu > 70) {
      recommendations.push(
        'CPU usage is consistently high - consider performance optimization'
      );
    }

    const memoryTrend = this.calculateTrend(
      metrics.map(m => m.memory.heapUsagePercentage)
    );
    if (memoryTrend === 'increasing') {
      recommendations.push(
        'Memory usage is trending upward - investigate potential memory leaks'
      );
    }

    return recommendations;
  }
}

// Default configuration
export const defaultResourceMonitorConfig: ResourceMonitorConfig = {
  memory: {
    maxHeapSize: 1024,
    gcThreshold: 80,
    monitoringInterval: 30000,
    alertThresholds: {
      heapUsage: 85,
      memoryLeakThreshold: 10,
      largeObjectThreshold: 100,
    },
    cleanup: {
      enableAutoCleanup: true,
      cleanupInterval: 60000,
      maxCacheAge: 300000,
    },
    streaming: {
      chunkSize: 1000,
      maxConcurrentStreams: 5,
      bufferSize: 50,
    },
  },
  monitoring: {
    enableCpuMonitoring: true,
    enableNetworkMonitoring: true,
    enableFileSystemMonitoring: true,
    alertingEnabled: true,
    reportingInterval: 60000, // 1 minute
  },
  alerts: {
    // Configure based on your notification preferences
  },
  thresholds: {
    cpu: {
      warning: 70,
      critical: 90,
    },
    memory: {
      warning: 80,
      critical: 95,
    },
    disk: {
      warning: 80,
      critical: 95,
    },
    network: {
      maxConnections: 1000,
      maxBandwidth: 100, // MB/s
    },
  },
};
