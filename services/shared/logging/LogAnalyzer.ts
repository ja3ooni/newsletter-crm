// @ts-nocheck
import axios from 'axios';
import { StructuredLogger } from './StructuredLogger';

export interface LogPattern {
  id: string;
  pattern: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  threshold: number;
  timeWindow: number; // in minutes
  enabled: boolean;
}

export interface Anomaly {
  id: string;
  timestamp: Date;
  pattern: LogPattern;
  count: number;
  threshold: number;
  timeWindow: number;
  samples: LogEntry[];
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  service: string;
  metadata: Record<string, any>;
}

export interface LogMetrics {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  logsByService: Record<string, number>;
  errorRate: number;
  averageResponseTime: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastSeen: Date;
  }>;
}

export class LogAnalyzer {
  private logger: StructuredLogger;
  private patterns: Map<string, LogPattern> = new Map();
  private logBuffer: LogEntry[] = [];
  private anomalies: Anomaly[] = [];
  private elasticsearchUrl?: string;
  private maxBufferSize: number = 10000;

  constructor(logger: StructuredLogger, elasticsearchUrl?: string) {
    this.logger = logger;
    this.elasticsearchUrl = elasticsearchUrl;

    this.initializeDefaultPatterns();
    this.startAnalysis();
  }

  private initializeDefaultPatterns(): void {
    const defaultPatterns: LogPattern[] = [
      {
        id: 'high-error-rate',
        pattern: 'level:error',
        description: 'High error rate detected',
        severity: 'critical',
        threshold: 10, // 10 errors
        timeWindow: 5, // in 5 minutes
        enabled: true,
      },
      {
        id: 'authentication-failures',
        pattern: 'message:*authentication*failed* OR message:*login*failed*',
        description: 'Multiple authentication failures',
        severity: 'warning',
        threshold: 5,
        timeWindow: 10,
        enabled: true,
      },
      {
        id: 'database-errors',
        pattern: 'component:database AND level:error',
        description: 'Database connection issues',
        severity: 'critical',
        threshold: 3,
        timeWindow: 5,
        enabled: true,
      },
      {
        id: 'slow-responses',
        pattern: 'duration:>2000',
        description: 'Slow response times detected',
        severity: 'warning',
        threshold: 20,
        timeWindow: 10,
        enabled: true,
      },
      {
        id: 'memory-warnings',
        pattern: 'message:*memory* AND level:warning',
        description: 'Memory usage warnings',
        severity: 'warning',
        threshold: 5,
        timeWindow: 15,
        enabled: true,
      },
      {
        id: 'security-events',
        pattern: 'component:security',
        description: 'Security events detected',
        severity: 'error',
        threshold: 1,
        timeWindow: 1,
        enabled: true,
      },
    ];

    defaultPatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });

    this.logger.info(
      `Initialized ${defaultPatterns.length} log analysis patterns`
    );
  }

  private startAnalysis(): void {
    // Analyze logs every minute
    setInterval(() => {
      this.analyzeLogBuffer();
    }, 60000);

    // Clean up old anomalies every hour
    setInterval(() => {
      this.cleanupOldAnomalies();
    }, 3600000);

    this.logger.info('Log analysis started');
  }

  public addLogEntry(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  public addPattern(pattern: LogPattern): void {
    this.patterns.set(pattern.id, pattern);
    this.logger.info(`Log pattern added: ${pattern.description}`);
  }

  public removePattern(patternId: string): void {
    this.patterns.delete(patternId);
    this.logger.info(`Log pattern removed: ${patternId}`);
  }

  public getPatterns(): LogPattern[] {
    return Array.from(this.patterns.values());
  }

  public getAnomalies(limit: number = 50): Anomaly[] {
    return this.anomalies
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  public async getLogMetrics(timeRange: {
    start: Date;
    end: Date;
  }): Promise<LogMetrics> {
    if (this.elasticsearchUrl) {
      return this.getMetricsFromElasticsearch(timeRange);
    } else {
      return this.getMetricsFromBuffer(timeRange);
    }
  }

  private analyzeLogBuffer(): void {
    const now = new Date();

    for (const [patternId, pattern] of this.patterns) {
      if (!pattern.enabled) continue;

      const windowStart = new Date(now.getTime() - pattern.timeWindow * 60000);
      const matchingLogs = this.findMatchingLogs(pattern, windowStart, now);

      if (matchingLogs.length >= pattern.threshold) {
        this.createAnomaly(pattern, matchingLogs, now);
      }
    }
  }

  private findMatchingLogs(
    pattern: LogPattern,
    start: Date,
    end: Date
  ): LogEntry[] {
    return this.logBuffer.filter(entry => {
      if (entry.timestamp < start || entry.timestamp > end) {
        return false;
      }

      return this.matchesPattern(entry, pattern.pattern);
    });
  }

  private matchesPattern(entry: LogEntry, pattern: string): boolean {
    // Simple pattern matching implementation
    // In a real implementation, you'd use a proper query parser

    const conditions = pattern.split(' AND ').map(c => c.trim());

    return conditions.every(condition => {
      if (condition.includes(' OR ')) {
        const orConditions = condition.split(' OR ').map(c => c.trim());

        return orConditions.some(orCondition =>
          this.evaluateCondition(entry, orCondition)
        );
      } else {
        return this.evaluateCondition(entry, condition);
      }
    });
  }

  private evaluateCondition(entry: LogEntry, condition: string): boolean {
    // Parse condition like "level:error" or "duration:>2000"
    const [field, operator, value] = this.parseCondition(condition);

    const entryValue = this.getFieldValue(entry, field);

    switch (operator) {
      case ':':
        if (value.includes('*')) {
          const regex = new RegExp(value.replace(/\*/g, '.*'), 'i');

          return regex.test(String(entryValue));
        }

        return String(entryValue).toLowerCase() === value.toLowerCase();
      case ':>':
        return Number(entryValue) > Number(value);
      case ':<':
        return Number(entryValue) < Number(value);
      case ':>=':
        return Number(entryValue) >= Number(value);
      case ':<=':
        return Number(entryValue) <= Number(value);
      default:
        return false;
    }
  }

  private parseCondition(condition: string): [string, string, string] {
    if (condition.includes(':>=')) {
      const [field, value] = condition.split(':>=');

      return [field, ':>=', value];
    } else if (condition.includes(':<=')) {
      const [field, value] = condition.split(':<=');

      return [field, ':<=', value];
    } else if (condition.includes(':>')) {
      const [field, value] = condition.split(':>');

      return [field, ':>', value];
    } else if (condition.includes(':<')) {
      const [field, value] = condition.split(':<');

      return [field, ':<', value];
    } else {
      const [field, value] = condition.split(':');

      return [field, ':', value];
    }
  }

  private getFieldValue(entry: LogEntry, field: string): any {
    switch (field) {
      case 'level':
        return entry.level;
      case 'message':
        return entry.message;
      case 'service':
        return entry.service;
      case 'component':
        return entry.metadata.component;
      case 'duration':
        return entry.metadata.duration;
      case 'statusCode':
        return entry.metadata.statusCode;
      default:
        return entry.metadata[field];
    }
  }

  private createAnomaly(
    pattern: LogPattern,
    matchingLogs: LogEntry[],
    timestamp: Date
  ): void {
    const anomalyId = `${pattern.id}-${timestamp.getTime()}`;

    // Check if we already have a recent anomaly for this pattern
    const recentAnomaly = this.anomalies.find(
      a =>
        a.pattern.id === pattern.id &&
        timestamp.getTime() - a.timestamp.getTime() < 300000 // 5 minutes
    );

    if (recentAnomaly) {
      // Update existing anomaly
      recentAnomaly.count = matchingLogs.length;
      recentAnomaly.samples = matchingLogs.slice(0, 10); // Keep only first 10 samples

      return;
    }

    const anomaly: Anomaly = {
      id: anomalyId,
      timestamp,
      pattern,
      count: matchingLogs.length,
      threshold: pattern.threshold,
      timeWindow: pattern.timeWindow,
      samples: matchingLogs.slice(0, 10), // Keep only first 10 samples
      severity: pattern.severity,
    };

    this.anomalies.push(anomaly);

    this.logger.warn(`Log anomaly detected: ${pattern.description}`, {
      anomalyId,
      patternId: pattern.id,
      count: matchingLogs.length,
      threshold: pattern.threshold,
      severity: pattern.severity,
    });

    // Send alert if severity is high enough
    if (pattern.severity === 'critical' || pattern.severity === 'error') {
      this.sendAnomalyAlert(anomaly);
    }
  }

  private async sendAnomalyAlert(anomaly: Anomaly): Promise<void> {
    try {
      // Send to monitoring service
      const monitoringServiceUrl = process.env.MONITORING_SERVICE_URL;

      if (monitoringServiceUrl) {
        await axios.post(
          `${monitoringServiceUrl}/alerts/anomaly`,
          {
            anomaly,
            timestamp: new Date().toISOString(),
          },
          {
            timeout: 5000,
          }
        );
      }
    } catch (error) {
      this.logger.warn('Failed to send anomaly alert', error);
    }
  }

  private cleanupOldAnomalies(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const initialCount = this.anomalies.length;

    this.anomalies = this.anomalies.filter(
      anomaly => anomaly.timestamp > cutoff
    );

    const removedCount = initialCount - this.anomalies.length;

    if (removedCount > 0) {
      this.logger.info(`Cleaned up ${removedCount} old anomalies`);
    }
  }

  private async getMetricsFromElasticsearch(timeRange: {
    start: Date;
    end: Date;
  }): Promise<LogMetrics> {
    try {
      const query = {
        query: {
          range: {
            '@timestamp': {
              gte: timeRange.start.toISOString(),
              lte: timeRange.end.toISOString(),
            },
          },
        },
        aggs: {
          levels: {
            terms: { field: 'level' },
          },
          services: {
            terms: { field: 'service' },
          },
          errors: {
            filter: { term: { level: 'error' } },
            aggs: {
              top_errors: {
                terms: {
                  field: 'message.keyword',
                  size: 10,
                },
              },
            },
          },
          response_times: {
            filter: { exists: { field: 'duration' } },
            aggs: {
              avg_duration: {
                avg: { field: 'duration' },
              },
            },
          },
        },
      };

      const response = await axios.post(
        `${this.elasticsearchUrl}/datatechtoncrm-logs-*/_search`,
        query,
        { timeout: 10000 }
      );

      const data = response.data;
      const aggregations = data.aggregations;

      const logsByLevel: Record<string, number> = {};

      aggregations.levels.buckets.forEach((bucket: any) => {
        logsByLevel[bucket.key] = bucket.doc_count;
      });

      const logsByService: Record<string, number> = {};

      aggregations.services.buckets.forEach((bucket: any) => {
        logsByService[bucket.key] = bucket.doc_count;
      });

      const topErrors = aggregations.errors.top_errors.buckets.map(
        (bucket: any) => ({
          message: bucket.key,
          count: bucket.doc_count,
          lastSeen: new Date(), // Would need to get actual last seen from another query
        })
      );

      const totalLogs = data.hits.total.value || data.hits.total;
      const errorCount = logsByLevel.error || 0;
      const errorRate = totalLogs > 0 ? (errorCount / totalLogs) * 100 : 0;
      const averageResponseTime =
        aggregations.response_times.avg_duration?.value || 0;

      return {
        totalLogs,
        logsByLevel,
        logsByService,
        errorRate,
        averageResponseTime,
        topErrors,
      };
    } catch (error) {
      this.logger.error('Failed to get metrics from Elasticsearch', error);

      return this.getMetricsFromBuffer(timeRange);
    }
  }

  private getMetricsFromBuffer(timeRange: {
    start: Date;
    end: Date;
  }): LogMetrics {
    const filteredLogs = this.logBuffer.filter(
      log => log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
    );

    const logsByLevel: Record<string, number> = {};
    const logsByService: Record<string, number> = {};
    const errorMessages: Record<string, { count: number; lastSeen: Date }> = {};
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    filteredLogs.forEach(log => {
      // Count by level
      logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;

      // Count by service
      logsByService[log.service] = (logsByService[log.service] || 0) + 1;

      // Track error messages
      if (log.level === 'error') {
        if (errorMessages[log.message]) {
          errorMessages[log.message].count++;
          errorMessages[log.message].lastSeen = log.timestamp;
        } else {
          errorMessages[log.message] = { count: 1, lastSeen: log.timestamp };
        }
      }

      // Calculate average response time
      if (log.metadata.duration) {
        totalResponseTime += log.metadata.duration;
        responseTimeCount++;
      }
    });

    const topErrors = Object.entries(errorMessages)
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalLogs = filteredLogs.length;
    const errorCount = logsByLevel.error || 0;
    const errorRate = totalLogs > 0 ? (errorCount / totalLogs) * 100 : 0;
    const averageResponseTime =
      responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    return {
      totalLogs,
      logsByLevel,
      logsByService,
      errorRate,
      averageResponseTime,
      topErrors,
    };
  }
}

// Factory function
export const createLogAnalyzer = (
  logger: StructuredLogger,
  elasticsearchUrl?: string
): LogAnalyzer => {
  return new LogAnalyzer(logger, elasticsearchUrl);
};
