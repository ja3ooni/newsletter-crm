import { logger } from '../utils/logger';
import { CacheManager } from './CacheManager';
import { CDNManager } from './CDNManager';
import { QueryCache } from './QueryCache';

export interface InvalidationRule {
  id: string;
  name: string;
  trigger: InvalidationTrigger;
  actions: InvalidationAction[];
  priority: number;
  enabled: boolean;
}

export interface InvalidationTrigger {
  type: 'table_change' | 'time_based' | 'manual' | 'event' | 'memory_pressure';
  conditions: Record<string, any>;
}

export interface InvalidationAction {
  type: 'cache_pattern' | 'cache_tags' | 'cdn_paths' | 'query_cache_table';
  target: string | string[];
  delay?: number; // milliseconds
}

export interface InvalidationEvent {
  id: string;
  timestamp: Date;
  trigger: InvalidationTrigger;
  actionsExecuted: InvalidationAction[];
  success: boolean;
  error?: string;
  executionTime: number;
}

export class CacheInvalidationStrategy {
  private cacheManager: CacheManager;
  private queryCache: QueryCache;
  private cdnManager?: CDNManager;
  private rules: Map<string, InvalidationRule> = new Map();
  private eventHistory: InvalidationEvent[] = [];
  private maxHistorySize = 1000;

  constructor(
    cacheManager: CacheManager,
    queryCache: QueryCache,
    cdnManager?: CDNManager
  ) {
    this.cacheManager = cacheManager;
    this.queryCache = queryCache;
    this.cdnManager = cdnManager ?? undefined;

    this.setupDefaultRules();
    this.startPeriodicCleanup();
  }

  /**
   * Add custom invalidation rule
   */
  addRule(rule: InvalidationRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Cache invalidation rule added', {
      ruleId: rule.id,
      name: rule.name,
    });
  }

  /**
   * Remove invalidation rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info('Cache invalidation rule removed', { ruleId });
  }

  /**
   * Execute invalidation based on table changes
   */
  async invalidateForTableChange(
    tableName: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    affectedRows?: any[]
  ): Promise<void> {
    const trigger: InvalidationTrigger = {
      type: 'table_change',
      conditions: { tableName, operation, affectedRows },
    };

    await this.executeInvalidation(trigger);
  }

  /**
   * Execute invalidation based on custom event
   */
  async invalidateForEvent(eventType: string, eventData: any): Promise<void> {
    const trigger: InvalidationTrigger = {
      type: 'event',
      conditions: { eventType, eventData },
    };

    await this.executeInvalidation(trigger);
  }

  /**
   * Manual invalidation with specific targets
   */
  async manualInvalidate(targets: {
    cachePatterns?: string[];
    cacheTags?: string[];
    cdnPaths?: string[];
    queryTables?: string[];
  }): Promise<void> {
    const actions: InvalidationAction[] = [];

    if (targets.cachePatterns) {
      actions.push({
        type: 'cache_pattern',
        target: targets.cachePatterns,
      });
    }

    if (targets.cacheTags) {
      actions.push({
        type: 'cache_tags',
        target: targets.cacheTags,
      });
    }

    if (targets.cdnPaths) {
      actions.push({
        type: 'cdn_paths',
        target: targets.cdnPaths,
      });
    }

    if (targets.queryTables) {
      actions.push({
        type: 'query_cache_table',
        target: targets.queryTables,
      });
    }

    const trigger: InvalidationTrigger = {
      type: 'manual',
      conditions: { targets },
    };

    await this.executeActions(actions, trigger);
  }

  /**
   * Smart invalidation based on memory pressure
   */
  async handleMemoryPressure(memoryUsagePercent: number): Promise<void> {
    if (memoryUsagePercent > 90) {
      // Aggressive cleanup
      await this.cacheManager.clear();
      logger.warn('Aggressive cache clear due to memory pressure', {
        memoryUsagePercent,
      });
    } else if (memoryUsagePercent > 80) {
      // Selective cleanup - remove least recently used items
      const trigger: InvalidationTrigger = {
        type: 'memory_pressure',
        conditions: { memoryUsagePercent, strategy: 'selective' },
      };

      await this.executeInvalidation(trigger);
    }
  }

  /**
   * Get invalidation statistics
   */
  getInvalidationStats(): {
    totalEvents: number;
    successRate: number;
    avgExecutionTime: number;
    recentEvents: InvalidationEvent[];
    ruleCount: number;
  } {
    const totalEvents = this.eventHistory.length;
    const successfulEvents = this.eventHistory.filter(e => e.success).length;
    const successRate =
      totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;

    const avgExecutionTime =
      totalEvents > 0
        ? this.eventHistory.reduce((sum, e) => sum + e.executionTime, 0) /
          totalEvents
        : 0;

    const recentEvents = this.eventHistory
      .slice(-10)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      totalEvents,
      successRate,
      avgExecutionTime,
      recentEvents,
      ruleCount: this.rules.size,
    };
  }

  /**
   * Optimize invalidation rules based on usage patterns
   */
  async optimizeRules(): Promise<void> {
    const stats = this.getInvalidationStats();
    const optimizations: string[] = [];

    // Analyze rule effectiveness
    for (const [ruleId, rule] of this.rules.entries()) {
      const ruleEvents = this.eventHistory.filter(
        e => e.trigger.type === rule.trigger.type
      );

      if (ruleEvents.length > 0) {
        const ruleSuccessRate =
          (ruleEvents.filter(e => e.success).length / ruleEvents.length) * 100;

        if (ruleSuccessRate < 50) {
          optimizations.push(
            `Rule ${rule.name} has low success rate (${ruleSuccessRate.toFixed(1)}%)`
          );
        }

        const avgExecutionTime =
          ruleEvents.reduce((sum, e) => sum + e.executionTime, 0) /
          ruleEvents.length;

        if (avgExecutionTime > 5000) {
          // 5 seconds
          optimizations.push(
            `Rule ${rule.name} has high execution time (${avgExecutionTime.toFixed(0)}ms)`
          );
        }
      }
    }

    if (optimizations.length > 0) {
      logger.info('Cache invalidation optimization suggestions', {
        optimizations,
      });
    }
  }

  private async executeInvalidation(
    trigger: InvalidationTrigger
  ): Promise<void> {
    const matchingRules = this.getMatchingRules(trigger);

    if (matchingRules.length === 0) {
      return;
    }

    // Sort by priority (higher priority first)
    matchingRules.sort((a, b) => b.priority - a.priority);

    for (const rule of matchingRules) {
      if (rule.enabled) {
        await this.executeActions(rule.actions, trigger);
      }
    }
  }

  private async executeActions(
    actions: InvalidationAction[],
    trigger: InvalidationTrigger
  ): Promise<void> {
    const startTime = Date.now();
    const eventId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      for (const action of actions) {
        if (action.delay) {
          await new Promise(resolve => setTimeout(resolve, action.delay));
        }

        await this.executeAction(action);
      }

      const event: InvalidationEvent = {
        id: eventId,
        timestamp: new Date(),
        trigger,
        actionsExecuted: actions,
        success: true,
        executionTime: Date.now() - startTime,
      };

      this.addEventToHistory(event);
      logger.info('Cache invalidation completed', {
        eventId,
        executionTime: event.executionTime,
      });
    } catch (error) {
      const event: InvalidationEvent = {
        id: eventId,
        timestamp: new Date(),
        trigger,
        actionsExecuted: actions,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      };

      this.addEventToHistory(event);
      logger.error('Cache invalidation failed', {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async executeAction(action: InvalidationAction): Promise<void> {
    switch (action.type) {
      case 'cache_pattern':
        const patterns = Array.isArray(action.target)
          ? action.target
          : [action.target];

        for (const pattern of patterns) {
          await this.cacheManager.invalidatePattern(pattern);
        }
        break;

      case 'cache_tags':
        const tags = Array.isArray(action.target)
          ? action.target
          : [action.target];

        await this.cacheManager.invalidateByTags(tags);
        break;

      case 'cdn_paths':
        if (this.cdnManager) {
          const paths = Array.isArray(action.target)
            ? action.target
            : [action.target];

          await this.cdnManager.invalidateCache(paths);
        }
        break;

      case 'query_cache_table':
        const tables = Array.isArray(action.target)
          ? action.target
          : [action.target];

        for (const table of tables) {
          await this.queryCache.invalidateTable(table);
        }
        break;

      default:
        logger.warn('Unknown invalidation action type', {
          actionType: action.type,
        });
    }
  }

  private getMatchingRules(trigger: InvalidationTrigger): InvalidationRule[] {
    const matchingRules: InvalidationRule[] = [];

    for (const rule of this.rules.values()) {
      if (this.doesTriggerMatch(rule.trigger, trigger)) {
        matchingRules.push(rule);
      }
    }

    return matchingRules;
  }

  private doesTriggerMatch(
    ruleTrigger: InvalidationTrigger,
    eventTrigger: InvalidationTrigger
  ): boolean {
    if (ruleTrigger.type !== eventTrigger.type) {
      return false;
    }

    // Check specific conditions based on trigger type
    switch (ruleTrigger.type) {
      case 'table_change':
        return this.matchTableChange(
          ruleTrigger.conditions,
          eventTrigger.conditions
        );
      case 'event':
        return this.matchEvent(ruleTrigger.conditions, eventTrigger.conditions);
      case 'memory_pressure':
        return this.matchMemoryPressure(
          ruleTrigger.conditions,
          eventTrigger.conditions
        );
      default:
        return true;
    }
  }

  private matchTableChange(ruleConditions: any, eventConditions: any): boolean {
    if (
      ruleConditions.tableName &&
      ruleConditions.tableName !== eventConditions.tableName
    ) {
      return false;
    }

    if (
      ruleConditions.operation &&
      ruleConditions.operation !== eventConditions.operation
    ) {
      return false;
    }

    return true;
  }

  private matchEvent(ruleConditions: any, eventConditions: any): boolean {
    return ruleConditions.eventType === eventConditions.eventType;
  }

  private matchMemoryPressure(
    ruleConditions: any,
    eventConditions: any
  ): boolean {
    const threshold = ruleConditions.threshold || 80;

    return eventConditions.memoryUsagePercent >= threshold;
  }

  private setupDefaultRules(): void {
    // User-related invalidations
    this.addRule({
      id: 'user_changes',
      name: 'User Data Changes',
      trigger: {
        type: 'table_change',
        conditions: { tableName: 'users' },
      },
      actions: [
        { type: 'cache_tags', target: ['user'] },
        { type: 'query_cache_table', target: ['users'] },
      ],
      priority: 100,
      enabled: true,
    });

    // Newsletter-related invalidations
    this.addRule({
      id: 'newsletter_changes',
      name: 'Newsletter Data Changes',
      trigger: {
        type: 'table_change',
        conditions: { tableName: 'newsletters' },
      },
      actions: [
        { type: 'cache_tags', target: ['newsletter'] },
        { type: 'query_cache_table', target: ['newsletters'] },
        { type: 'cdn_paths', target: ['/newsletters/*'] },
      ],
      priority: 90,
      enabled: true,
    });

    // Contact-related invalidations
    this.addRule({
      id: 'contact_changes',
      name: 'Contact Data Changes',
      trigger: {
        type: 'table_change',
        conditions: { tableName: 'contacts' },
      },
      actions: [
        { type: 'cache_tags', target: ['contact', 'crm'] },
        { type: 'query_cache_table', target: ['contacts', 'segments'] },
      ],
      priority: 85,
      enabled: true,
    });

    // Memory pressure handling
    this.addRule({
      id: 'memory_pressure_cleanup',
      name: 'Memory Pressure Cleanup',
      trigger: {
        type: 'memory_pressure',
        conditions: { threshold: 80 },
      },
      actions: [{ type: 'cache_pattern', target: ['temp:*', 'session:*'] }],
      priority: 200,
      enabled: true,
    });
  }

  private addEventToHistory(event: InvalidationEvent): void {
    this.eventHistory.push(event);

    // Keep history size manageable
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  private startPeriodicCleanup(): void {
    // Run optimization every hour
    setInterval(
      async () => {
        try {
          await this.optimizeRules();
        } catch (error) {
          logger.error('Failed to optimize invalidation rules', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      60 * 60 * 1000
    );

    // Clean old events every 6 hours
    setInterval(
      () => {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

        this.eventHistory = this.eventHistory.filter(
          e => e.timestamp > sixHoursAgo
        );
      },
      6 * 60 * 60 * 1000
    );
  }
}
