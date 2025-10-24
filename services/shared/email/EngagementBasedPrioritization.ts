import { logger } from '../utils/logger';

export interface SubscriberEngagement {
  subscriberId: string;
  email: string;
  engagementScore: number;
  lastOpenDate?: Date;
  lastClickDate?: Date;
  openRate: number;
  clickRate: number;
  unsubscribeRisk: number;
  preferredSendTime?: string; // HH:MM format
  timezone?: string;
  segmentTags: string[];
  lifetimeValue?: number;
  subscriptionDate: Date;
  lastEngagementDate?: Date;
}

export interface PrioritizationRule {
  id: string;
  name: string;
  condition: (engagement: SubscriberEngagement) => boolean;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  weight: number;
  enabled: boolean;
}

export interface PrioritizationConfig {
  enableEngagementScoring: boolean;
  enableTimeBasedPrioritization: boolean;
  enableSegmentPrioritization: boolean;
  highEngagementThreshold: number;
  lowEngagementThreshold: number;
  highValueThreshold: number;
  recentEngagementDays: number;
  maxBatchSize: number;
  priorityWeights: {
    engagement: number;
    recency: number;
    value: number;
    segment: number;
  };
}

export interface BatchOptimizationResult {
  batches: PrioritizedBatch[];
  totalEmails: number;
  estimatedSendTime: number;
  priorityDistribution: Record<string, number>;
}

export interface PrioritizedBatch {
  id: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  emails: PrioritizedEmail[];
  estimatedSendTime: number;
  avgEngagementScore: number;
  sendWindow?: {
    start: Date;
    end: Date;
  };
}

export interface PrioritizedEmail {
  subscriberId: string;
  email: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  engagementScore: number;
  finalScore: number;
  reasons: string[];
  optimalSendTime?: Date;
}

export class EngagementBasedPrioritization {
  private config: PrioritizationConfig;
  private rules: Map<string, PrioritizationRule> = new Map();
  private engagementCache: Map<string, SubscriberEngagement> = new Map();

  constructor(config: PrioritizationConfig) {
    this.config = config;
    this.setupDefaultRules();
  }

  /**
   * Prioritize emails based on subscriber engagement
   */
  async prioritizeEmails(
    subscriberIds: string[],
    campaignType: 'newsletter' | 'promotional' | 'transactional' | 'drip',
    sendTime?: Date
  ): Promise<PrioritizedEmail[]> {
    try {
      const engagementData = await this.getEngagementData(subscriberIds);
      const prioritizedEmails: PrioritizedEmail[] = [];

      for (const engagement of engagementData) {
        const prioritizedEmail = await this.calculateEmailPriority(
          engagement,
          campaignType,
          sendTime
        );

        prioritizedEmails.push(prioritizedEmail);
      }

      // Sort by final score (highest first)
      prioritizedEmails.sort((a, b) => b.finalScore - a.finalScore);

      logger.info('Emails prioritized', {
        totalEmails: prioritizedEmails.length,
        campaignType,
        priorityDistribution: this.getPriorityDistribution(prioritizedEmails),
      });

      return prioritizedEmails;
    } catch (error) {
      logger.error('Failed to prioritize emails', { error });
      throw error;
    }
  }

  /**
   * Create optimized batches based on priority and send time preferences
   */
  async createOptimizedBatches(
    prioritizedEmails: PrioritizedEmail[],
    maxBatchSize?: number
  ): Promise<BatchOptimizationResult> {
    const batchSize = maxBatchSize || this.config.maxBatchSize;
    const batches: PrioritizedBatch[] = [];

    // Group emails by priority and optimal send time
    const groupedEmails = this.groupEmailsForBatching(prioritizedEmails);

    let batchId = 1;
    let totalEstimatedTime = 0;

    for (const [groupKey, emails] of groupedEmails.entries()) {
      // Split large groups into smaller batches
      for (let i = 0; i < emails.length; i += batchSize) {
        const batchEmails = emails.slice(i, i + batchSize);
        const avgEngagementScore =
          batchEmails.reduce((sum, e) => sum + e.engagementScore, 0) /
          batchEmails.length;
        const estimatedSendTime = this.calculateBatchSendTime(
          batchEmails.length
        );

        const batch: PrioritizedBatch = {
          id: `batch_${batchId++}`,
          priority: batchEmails[0].priority,
          emails: batchEmails,
          estimatedSendTime,
          avgEngagementScore,
          sendWindow: this.calculateOptimalSendWindow(batchEmails),
        };

        batches.push(batch);
        totalEstimatedTime += estimatedSendTime;
      }
    }

    // Sort batches by priority and optimal send time
    batches.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Secondary sort by average engagement score
      return b.avgEngagementScore - a.avgEngagementScore;
    });

    const result: BatchOptimizationResult = {
      batches,
      totalEmails: prioritizedEmails.length,
      estimatedSendTime: totalEstimatedTime,
      priorityDistribution: this.getPriorityDistribution(prioritizedEmails),
    };

    logger.info('Optimized batches created', {
      batchCount: batches.length,
      totalEmails: result.totalEmails,
      estimatedSendTime: result.estimatedSendTime,
      priorityDistribution: result.priorityDistribution,
    });

    return result;
  }

  /**
   * Update subscriber engagement data
   */
  async updateEngagementData(
    subscriberId: string,
    engagementEvent: {
      type: 'open' | 'click' | 'unsubscribe' | 'bounce' | 'complaint';
      timestamp: Date;
      campaignId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      let engagement = this.engagementCache.get(subscriberId);

      if (!engagement) {
        // Load from database or create new
        engagement = await this.loadEngagementData(subscriberId);
      }

      // Update engagement based on event type
      switch (engagementEvent.type) {
        case 'open':
          engagement.lastOpenDate = engagementEvent.timestamp;
          engagement.lastEngagementDate = engagementEvent.timestamp;
          break;
        case 'click':
          engagement.lastClickDate = engagementEvent.timestamp;
          engagement.lastEngagementDate = engagementEvent.timestamp;
          break;
        case 'unsubscribe':
          engagement.unsubscribeRisk = 1.0;
          break;
      }

      // Recalculate engagement score
      engagement.engagementScore = this.calculateEngagementScore(engagement);

      // Update cache
      this.engagementCache.set(subscriberId, engagement);

      logger.debug('Engagement data updated', {
        subscriberId,
        eventType: engagementEvent.type,
        newScore: engagement.engagementScore,
      });
    } catch (error) {
      logger.error('Failed to update engagement data', { subscriberId, error });
      throw error;
    }
  }

  /**
   * Get optimal send time for subscriber
   */
  getOptimalSendTime(subscriberId: string, defaultTime?: Date): Date {
    const engagement = this.engagementCache.get(subscriberId);
    const now = new Date();

    if (engagement?.preferredSendTime && engagement.timezone) {
      try {
        const [hours, minutes] = engagement.preferredSendTime
          .split(':')
          .map(Number);
        const optimalTime = new Date(now);

        optimalTime.setHours(hours, minutes, 0, 0);

        // If the time has passed today, schedule for tomorrow
        if (optimalTime <= now) {
          optimalTime.setDate(optimalTime.getDate() + 1);
        }

        return optimalTime;
      } catch (error) {
        logger.warn('Failed to parse preferred send time', {
          subscriberId,
          preferredSendTime: engagement.preferredSendTime,
        });
      }
    }

    return defaultTime || new Date(now.getTime() + 5 * 60 * 1000); // Default: 5 minutes from now
  }

  /**
   * Add custom prioritization rule
   */
  addRule(rule: PrioritizationRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Prioritization rule added', {
      ruleId: rule.id,
      name: rule.name,
    });
  }

  /**
   * Remove prioritization rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info('Prioritization rule removed', { ruleId });
  }

  /**
   * Get prioritization statistics
   */
  getStats(): {
    totalSubscribers: number;
    avgEngagementScore: number;
    highEngagementCount: number;
    lowEngagementCount: number;
    riskOfUnsubscribe: number;
    rulesCount: number;
  } {
    const engagements = Array.from(this.engagementCache.values());
    const totalSubscribers = engagements.length;

    if (totalSubscribers === 0) {
      return {
        totalSubscribers: 0,
        avgEngagementScore: 0,
        highEngagementCount: 0,
        lowEngagementCount: 0,
        riskOfUnsubscribe: 0,
        rulesCount: this.rules.size,
      };
    }

    const avgEngagementScore =
      engagements.reduce((sum, e) => sum + e.engagementScore, 0) /
      totalSubscribers;
    const highEngagementCount = engagements.filter(
      e => e.engagementScore >= this.config.highEngagementThreshold
    ).length;
    const lowEngagementCount = engagements.filter(
      e => e.engagementScore <= this.config.lowEngagementThreshold
    ).length;
    const riskOfUnsubscribe =
      engagements.reduce((sum, e) => sum + e.unsubscribeRisk, 0) /
      totalSubscribers;

    return {
      totalSubscribers,
      avgEngagementScore,
      highEngagementCount,
      lowEngagementCount,
      riskOfUnsubscribe,
      rulesCount: this.rules.size,
    };
  }

  private async calculateEmailPriority(
    engagement: SubscriberEngagement,
    campaignType: string,
    sendTime?: Date
  ): Promise<PrioritizedEmail> {
    const reasons: string[] = [];
    let finalScore = engagement.engagementScore;

    // Apply prioritization rules
    for (const rule of this.rules.values()) {
      if (rule.enabled && rule.condition(engagement)) {
        finalScore += rule.weight;
        reasons.push(rule.name);
      }
    }

    // Apply campaign type modifiers
    if (campaignType === 'transactional') {
      finalScore += 50; // Transactional emails get highest priority
      reasons.push('Transactional email');
    } else if (campaignType === 'drip') {
      finalScore += 20; // Drip campaigns get medium priority
      reasons.push('Drip campaign');
    }

    // Apply time-based modifiers
    if (this.config.enableTimeBasedPrioritization && sendTime) {
      const optimalTime = this.getOptimalSendTime(
        engagement.subscriberId,
        sendTime
      );
      const timeDiff = Math.abs(sendTime.getTime() - optimalTime.getTime());
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff <= 1) {
        finalScore += 10;
        reasons.push('Optimal send time');
      } else if (hoursDiff > 6) {
        finalScore -= 5;
        reasons.push('Suboptimal send time');
      }
    }

    // Determine priority level
    let priority: 'urgent' | 'high' | 'normal' | 'low' = 'normal';

    if (finalScore >= 80) {
      priority = 'urgent';
    } else if (finalScore >= 60) {
      priority = 'high';
    } else if (finalScore <= 20) {
      priority = 'low';
    }

    return {
      subscriberId: engagement.subscriberId,
      email: engagement.email,
      priority,
      engagementScore: engagement.engagementScore,
      finalScore,
      reasons,
      optimalSendTime: sendTime
        ? this.getOptimalSendTime(engagement.subscriberId, sendTime)
        : undefined,
    };
  }

  private async getEngagementData(
    subscriberIds: string[]
  ): Promise<SubscriberEngagement[]> {
    const engagementData: SubscriberEngagement[] = [];

    for (const subscriberId of subscriberIds) {
      let engagement = this.engagementCache.get(subscriberId);

      if (!engagement) {
        engagement = await this.loadEngagementData(subscriberId);
        this.engagementCache.set(subscriberId, engagement);
      }

      engagementData.push(engagement);
    }

    return engagementData;
  }

  private async loadEngagementData(
    subscriberId: string
  ): Promise<SubscriberEngagement> {
    // In a real implementation, this would load from database
    // For now, return default engagement data
    return {
      subscriberId,
      email: `subscriber${subscriberId}@example.com`,
      engagementScore: 50,
      openRate: 0.25,
      clickRate: 0.05,
      unsubscribeRisk: 0.1,
      segmentTags: [],
      subscriptionDate: new Date(),
    };
  }

  private calculateEngagementScore(engagement: SubscriberEngagement): number {
    let score = 0;

    // Base score from open and click rates
    score += engagement.openRate * 40;
    score += engagement.clickRate * 60;

    // Recency bonus
    if (engagement.lastEngagementDate) {
      const daysSinceEngagement =
        (Date.now() - engagement.lastEngagementDate.getTime()) /
        (1000 * 60 * 60 * 24);

      if (daysSinceEngagement <= this.config.recentEngagementDays) {
        score +=
          20 * (1 - daysSinceEngagement / this.config.recentEngagementDays);
      }
    }

    // Lifetime value bonus
    if (
      engagement.lifetimeValue &&
      engagement.lifetimeValue >= this.config.highValueThreshold
    ) {
      score += 15;
    }

    // Unsubscribe risk penalty
    score -= engagement.unsubscribeRisk * 30;

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  private groupEmailsForBatching(
    emails: PrioritizedEmail[]
  ): Map<string, PrioritizedEmail[]> {
    const groups = new Map<string, PrioritizedEmail[]>();

    for (const email of emails) {
      const sendTimeKey = email.optimalSendTime
        ? Math.floor(email.optimalSendTime.getTime() / (1000 * 60 * 30)) // 30-minute windows
        : 'immediate';

      const groupKey = `${email.priority}_${sendTimeKey}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }

      groups.get(groupKey)!.push(email);
    }

    return groups;
  }

  private calculateOptimalSendWindow(
    emails: PrioritizedEmail[]
  ): { start: Date; end: Date } | undefined {
    const sendTimes = emails
      .map(e => e.optimalSendTime)
      .filter(t => t !== undefined) as Date[];

    if (sendTimes.length === 0) {
      return undefined;
    }

    const minTime = new Date(Math.min(...sendTimes.map(t => t.getTime())));
    const maxTime = new Date(Math.max(...sendTimes.map(t => t.getTime())));

    return { start: minTime, end: maxTime };
  }

  private calculateBatchSendTime(emailCount: number): number {
    // Estimate 100ms per email plus rate limiting delays
    const baseTime = emailCount * 100;
    const rateLimitDelay = emailCount * 50; // Assuming 20 emails per second max

    return baseTime + rateLimitDelay;
  }

  private getPriorityDistribution(
    emails: PrioritizedEmail[]
  ): Record<string, number> {
    const distribution: Record<string, number> = {
      urgent: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    for (const email of emails) {
      distribution[email.priority]++;
    }

    return distribution;
  }

  private setupDefaultRules(): void {
    // High engagement rule
    this.addRule({
      id: 'high_engagement',
      name: 'High Engagement Subscriber',
      condition: e => e.engagementScore >= this.config.highEngagementThreshold,
      priority: 'high',
      weight: 20,
      enabled: true,
    });

    // Recent engagement rule
    this.addRule({
      id: 'recent_engagement',
      name: 'Recently Engaged',
      condition: e => {
        if (!e.lastEngagementDate) return false;
        const daysSince =
          (Date.now() - e.lastEngagementDate.getTime()) / (1000 * 60 * 60 * 24);

        return daysSince <= 7;
      },
      priority: 'high',
      weight: 15,
      enabled: true,
    });

    // High value subscriber rule
    this.addRule({
      id: 'high_value',
      name: 'High Value Subscriber',
      condition: e => (e.lifetimeValue || 0) >= this.config.highValueThreshold,
      priority: 'high',
      weight: 25,
      enabled: true,
    });

    // Low engagement rule
    this.addRule({
      id: 'low_engagement',
      name: 'Low Engagement Subscriber',
      condition: e => e.engagementScore <= this.config.lowEngagementThreshold,
      priority: 'low',
      weight: -10,
      enabled: true,
    });

    // Unsubscribe risk rule
    this.addRule({
      id: 'unsubscribe_risk',
      name: 'High Unsubscribe Risk',
      condition: e => e.unsubscribeRisk >= 0.7,
      priority: 'low',
      weight: -20,
      enabled: true,
    });

    // VIP segment rule
    this.addRule({
      id: 'vip_segment',
      name: 'VIP Segment',
      condition: e =>
        e.segmentTags.includes('vip') || e.segmentTags.includes('premium'),
      priority: 'urgent',
      weight: 30,
      enabled: true,
    });
  }
}
