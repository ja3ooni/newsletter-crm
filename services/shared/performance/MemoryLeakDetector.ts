import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface MemoryLeakPattern {
  type:
    | 'event_listener'
    | 'timer'
    | 'connection'
    | 'cache'
    | 'stream'
    | 'buffer';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectionMethod: string;
  recommendations: string[];
}

export interface LeakDetectionResult {
  detected: boolean;
  patterns: MemoryLeakPattern[];
  memoryTrend: 'stable' | 'increasing' | 'decreasing';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface ProcessMetrics {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  eventListeners: number;
  timers: number;
  handles: number;
}

export class MemoryLeakDetector extends EventEmitter {
  private metricsHistory: ProcessMetrics[] = [];
  private detectionInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private readonly maxHistorySize = 100;
  private readonly detectionIntervalMs = 30000; // 30 seconds

  constructor() {
    super();
  }

  /**
   * Start memory leak detection monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Memory leak detection already running');
      return;
    }

    this.isMonitoring = true;
    this.detectionInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeLeaks();
    }, this.detectionIntervalMs);

    logger.info('Memory leak detection started');
  }

  /**
   * Stop memory leak detection monitoring
   */
  stopMonitoring(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    this.isMonitoring = false;
    logger.info('Memory leak detection stopped');
  }

  /**
   * Perform immediate leak detection analysis
   */
  detectLeaks(): LeakDetectionResult {
    this.collectMetrics();
    return this.analyzeLeaks();
  }

  /**
   * Get current process metrics
   */
  getCurrentMetrics(): ProcessMetrics {
    const memUsage = process.memoryUsage();

    return {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed / (1024 * 1024), // MB
      heapTotal: memUsage.heapTotal / (1024 * 1024), // MB
      external: memUsage.external / (1024 * 1024), // MB
      rss: memUsage.rss / (1024 * 1024), // MB
      eventListeners: this.countEventListeners(),
      timers: this.countTimers(),
      handles: this.countHandles(),
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): ProcessMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.metricsHistory = [];
    logger.info('Memory leak detector history cleared');
  }

  /**
   * Collect current metrics and add to history
   */
  private collectMetrics(): void {
    const metrics = this.getCurrentMetrics();
    this.metricsHistory.push(metrics);

    // Keep only recent history
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Analyze collected metrics for memory leaks
   */
  private analyzeLeaks(): LeakDetectionResult {
    const patterns: MemoryLeakPattern[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (this.metricsHistory.length < 5) {
      return {
        detected: false,
        patterns: [],
        memoryTrend: 'stable',
        riskLevel: 'low',
        recommendations: [
          'Insufficient data for analysis. Continue monitoring.',
        ],
      };
    }

    // Analyze memory trends
    const memoryTrend = this.analyzeMemoryTrend();

    // Check for various leak patterns
    patterns.push(...this.detectHeapLeaks());
    patterns.push(...this.detectEventListenerLeaks());
    patterns.push(...this.detectTimerLeaks());
    patterns.push(...this.detectHandleLeaks());
    patterns.push(...this.detectExternalMemoryLeaks());

    // Determine overall risk level
    if (patterns.some(p => p.severity === 'critical')) {
      riskLevel = 'critical';
    } else if (patterns.some(p => p.severity === 'high')) {
      riskLevel = 'high';
    } else if (patterns.some(p => p.severity === 'medium')) {
      riskLevel = 'medium';
    }

    const recommendations = this.generateRecommendations(patterns, memoryTrend);

    const result: LeakDetectionResult = {
      detected: patterns.length > 0,
      patterns,
      memoryTrend,
      riskLevel,
      recommendations,
    };

    // Emit events for significant findings
    if (result.detected && riskLevel !== 'low') {
      this.emit('leakDetected', result);
    }

    return result;
  }

  /**
   * Analyze memory usage trend
   */
  private analyzeMemoryTrend(): 'stable' | 'increasing' | 'decreasing' {
    if (this.metricsHistory.length < 10) {
      return 'stable';
    }

    const recent = this.metricsHistory.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];

    if (!first || !last) {
      return 'stable';
    }

    const memoryChange = last.heapUsed - first.heapUsed;
    const changePercentage = (memoryChange / first.heapUsed) * 100;

    if (changePercentage > 10) {
      return 'increasing';
    } else if (changePercentage < -10) {
      return 'decreasing';
    }

    return 'stable';
  }

  /**
   * Detect heap memory leaks
   */
  private detectHeapLeaks(): MemoryLeakPattern[] {
    const patterns: MemoryLeakPattern[] = [];

    if (this.metricsHistory.length < 10) {
      return patterns;
    }

    const recent = this.metricsHistory.slice(-10);
    const heapGrowth = this.calculateGrowthRate(recent.map(m => m.heapUsed));

    if (heapGrowth > 5) {
      // 5MB per measurement period
      patterns.push({
        type: 'buffer',
        description: `Heap memory growing at ${heapGrowth.toFixed(2)} MB per measurement`,
        severity:
          heapGrowth > 20 ? 'critical' : heapGrowth > 10 ? 'high' : 'medium',
        detectionMethod: 'Heap usage trend analysis',
        recommendations: [
          'Review object creation patterns',
          'Check for unreleased references',
          'Implement object pooling',
          'Use WeakMap/WeakSet for caches',
        ],
      });
    }

    return patterns;
  }

  /**
   * Detect event listener leaks
   */
  private detectEventListenerLeaks(): MemoryLeakPattern[] {
    const patterns: MemoryLeakPattern[] = [];

    if (this.metricsHistory.length < 5) {
      return patterns;
    }

    const recent = this.metricsHistory.slice(-5);
    const listenerGrowth = this.calculateGrowthRate(
      recent.map(m => m.eventListeners)
    );

    if (listenerGrowth > 10) {
      // More than 10 listeners per measurement
      patterns.push({
        type: 'event_listener',
        description: `Event listeners growing at ${listenerGrowth.toFixed(0)} per measurement`,
        severity:
          listenerGrowth > 50
            ? 'critical'
            : listenerGrowth > 25
              ? 'high'
              : 'medium',
        detectionMethod: 'Event listener count tracking',
        recommendations: [
          'Remove event listeners when no longer needed',
          'Use removeAllListeners() for cleanup',
          'Implement proper component unmounting',
          'Use weak references for event handlers',
        ],
      });
    }

    return patterns;
  }

  /**
   * Detect timer leaks
   */
  private detectTimerLeaks(): MemoryLeakPattern[] {
    const patterns: MemoryLeakPattern[] = [];

    if (this.metricsHistory.length < 5) {
      return patterns;
    }

    const recent = this.metricsHistory.slice(-5);
    const timerGrowth = this.calculateGrowthRate(recent.map(m => m.timers));

    if (timerGrowth > 5) {
      // More than 5 timers per measurement
      patterns.push({
        type: 'timer',
        description: `Timers growing at ${timerGrowth.toFixed(0)} per measurement`,
        severity:
          timerGrowth > 20 ? 'critical' : timerGrowth > 10 ? 'high' : 'medium',
        detectionMethod: 'Timer handle count tracking',
        recommendations: [
          'Clear intervals and timeouts when done',
          'Use clearInterval() and clearTimeout()',
          'Implement proper cleanup in component lifecycle',
          'Consider using AbortController for cancellation',
        ],
      });
    }

    return patterns;
  }

  /**
   * Detect handle leaks (file descriptors, sockets, etc.)
   */
  private detectHandleLeaks(): MemoryLeakPattern[] {
    const patterns: MemoryLeakPattern[] = [];

    if (this.metricsHistory.length < 5) {
      return patterns;
    }

    const recent = this.metricsHistory.slice(-5);
    const handleGrowth = this.calculateGrowthRate(recent.map(m => m.handles));

    if (handleGrowth > 2) {
      // More than 2 handles per measurement
      patterns.push({
        type: 'connection',
        description: `Handles growing at ${handleGrowth.toFixed(0)} per measurement`,
        severity:
          handleGrowth > 10 ? 'critical' : handleGrowth > 5 ? 'high' : 'medium',
        detectionMethod: 'Handle count tracking',
        recommendations: [
          'Close database connections when done',
          'End HTTP requests and responses',
          'Close file streams and sockets',
          'Implement connection pooling',
        ],
      });
    }

    return patterns;
  }

  /**
   * Detect external memory leaks
   */
  private detectExternalMemoryLeaks(): MemoryLeakPattern[] {
    const patterns: MemoryLeakPattern[] = [];

    if (this.metricsHistory.length < 10) {
      return patterns;
    }

    const recent = this.metricsHistory.slice(-10);
    const externalGrowth = this.calculateGrowthRate(
      recent.map(m => m.external)
    );

    if (externalGrowth > 2) {
      // 2MB per measurement period
      patterns.push({
        type: 'buffer',
        description: `External memory growing at ${externalGrowth.toFixed(2)} MB per measurement`,
        severity:
          externalGrowth > 10
            ? 'critical'
            : externalGrowth > 5
              ? 'high'
              : 'medium',
        detectionMethod: 'External memory usage tracking',
        recommendations: [
          'Review Buffer usage patterns',
          'Check for large string operations',
          'Implement buffer pooling',
          'Use streaming for large data',
        ],
      });
    }

    return patterns;
  }

  /**
   * Calculate growth rate from a series of values
   */
  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    const first = values[0];
    const last = values[values.length - 1];
    const periods = values.length - 1;

    return (last - first) / periods;
  }

  /**
   * Generate recommendations based on detected patterns
   */
  private generateRecommendations(
    patterns: MemoryLeakPattern[],
    memoryTrend: 'stable' | 'increasing' | 'decreasing'
  ): string[] {
    const recommendations = new Set<string>();

    // Add pattern-specific recommendations
    patterns.forEach(pattern => {
      pattern.recommendations.forEach(rec => recommendations.add(rec));
    });

    // Add trend-based recommendations
    if (memoryTrend === 'increasing') {
      recommendations.add('Monitor memory usage more frequently');
      recommendations.add('Consider implementing memory limits');
      recommendations.add('Review recent code changes for memory issues');
    }

    // Add general recommendations if critical issues found
    if (patterns.some(p => p.severity === 'critical')) {
      recommendations.add('Consider restarting the service to free memory');
      recommendations.add(
        'Implement circuit breakers to prevent cascading failures'
      );
      recommendations.add('Set up automated alerts for memory issues');
    }

    return Array.from(recommendations);
  }

  /**
   * Count active event listeners (approximation)
   */
  private countEventListeners(): number {
    // This is a simplified count - in production you might want more sophisticated tracking
    let count = 0;

    // Count listeners on process
    count += process.listenerCount('exit');
    count += process.listenerCount('SIGTERM');
    count += process.listenerCount('SIGINT');
    count += process.listenerCount('uncaughtException');
    count += process.listenerCount('unhandledRejection');

    return count;
  }

  /**
   * Count active timers (approximation)
   */
  private countTimers(): number {
    // This is a simplified implementation
    // In production, you might track timers more explicitly
    return (
      (process as any)
        ._getActiveHandles?.()
        ?.filter(
          (handle: any) =>
            handle.constructor.name === 'Timeout' ||
            handle.constructor.name === 'Immediate'
        )?.length || 0
    );
  }

  /**
   * Count active handles
   */
  private countHandles(): number {
    return (process as any)._getActiveHandles?.()?.length || 0;
  }
}

// Export singleton instance
export const memoryLeakDetector = new MemoryLeakDetector();
