import dns from 'dns';
import { config } from '../config';
import {
  BlacklistStatus,
  BounceEvent,
  DeliverabilityAlert,
  DeliverabilityInsight,
  DeliverabilityMetrics,
  DeliverabilityReport,
  DKIMRecord,
  DMARCRecord,
  ReputationTrend,
  SenderReputation,
  SPFRecord,
  SuppressionList,
} from '../types';
import { database } from '../utils/database';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';

export class DeliverabilityService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private blacklistCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startMonitoring();
  }

  // Sender Reputation Tracking
  async trackSenderReputation(
    domain: string,
    ipAddress: string
  ): Promise<SenderReputation> {
    try {
      logger.info('Tracking sender reputation', { domain, ipAddress });

      // Check cache first
      const cacheKey = `reputation:${domain}:${ipAddress}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        const reputation = JSON.parse(cached);
        // Return cached if less than 30 minutes old
        if (
          Date.now() - new Date(reputation.lastChecked).getTime() <
          30 * 60 * 1000
        ) {
          return reputation;
        }
      }

      // Perform comprehensive reputation check
      const [blacklistStatus, spfRecord, dkimRecord, dmarcRecord, trends] =
        await Promise.all([
          this.checkBlacklistStatus(domain, ipAddress),
          this.validateSPFRecord(domain),
          this.validateDKIMRecord(domain),
          this.validateDMARCRecord(domain),
          this.getReputationTrends(domain, ipAddress),
        ]);

      // Calculate overall reputation score
      const reputationScore = this.calculateReputationScore({
        blacklistStatus,
        spfRecord,
        dkimRecord,
        dmarcRecord,
        trends,
      });

      const reputation: SenderReputation = {
        id: `${domain}-${ipAddress}-${Date.now()}`,
        domain,
        ipAddress,
        reputationScore,
        blacklistStatus,
        spfRecord,
        dkimRecord,
        dmarcRecord,
        lastChecked: new Date(),
        trends,
      };

      // Store in database
      await this.storeSenderReputation(reputation);

      // Cache for 30 minutes
      await redis.set(cacheKey, JSON.stringify(reputation), 1800);

      // Check for alerts
      await this.checkReputationAlerts(reputation);

      return reputation;
    } catch (error) {
      logger.error('Error tracking sender reputation', {
        domain,
        ipAddress,
        error,
      });
      throw error;
    }
  }

  // Blacklist Status Checking
  async checkBlacklistStatus(
    domain: string,
    ipAddress: string
  ): Promise<BlacklistStatus[]> {
    const blacklistChecks = config.deliverability.blacklistProviders.map(
      async provider => {
        try {
          const isListed = await this.checkSingleBlacklist(ipAddress, provider);
          return {
            provider,
            isListed,
            checkedAt: new Date(),
            ...(isListed && { listedAt: new Date() }),
          };
        } catch (error) {
          logger.warn(`Failed to check blacklist ${provider}`, { error });
          return {
            provider,
            isListed: false,
            checkedAt: new Date(),
          };
        }
      }
    );

    return Promise.all(blacklistChecks);
  }

  private async checkSingleBlacklist(
    ipAddress: string,
    provider: string
  ): Promise<boolean> {
    return new Promise(resolve => {
      // Reverse IP for DNS lookup
      const reversedIp = ipAddress.split('.').reverse().join('.');
      const hostname = `${reversedIp}.${provider}`;

      dns.resolve4(hostname, (err, addresses) => {
        if (err) {
          resolve(false); // Not listed if DNS resolution fails
        } else {
          resolve(addresses.length > 0); // Listed if addresses returned
        }
      });
    });
  }

  // SPF Record Validation
  async validateSPFRecord(domain: string): Promise<SPFRecord> {
    return new Promise(resolve => {
      dns.resolveTxt(domain, (err, records) => {
        if (err) {
          resolve({
            isValid: false,
            record: '',
            mechanisms: [],
            issues: ['DNS resolution failed'],
            lastChecked: new Date(),
          });
          return;
        }

        const spfRecord = records.find(record =>
          record.some(txt => txt.startsWith('v=spf1'))
        );

        if (!spfRecord) {
          resolve({
            isValid: false,
            record: '',
            mechanisms: [],
            issues: ['No SPF record found'],
            lastChecked: new Date(),
          });
          return;
        }

        const recordString = spfRecord.join('');
        const mechanisms = recordString.split(' ').filter(m => m.length > 0);
        const issues = this.validateSPFMechanisms(mechanisms);

        resolve({
          isValid: issues.length === 0,
          record: recordString,
          mechanisms,
          issues,
          lastChecked: new Date(),
        });
      });
    });
  }

  private validateSPFMechanisms(mechanisms: string[]): string[] {
    const issues: string[] = [];

    if (!mechanisms.includes('v=spf1')) {
      issues.push('Missing SPF version declaration');
    }

    const hasAll = mechanisms.some(
      m => m.startsWith('~all') || m.startsWith('-all')
    );
    if (!hasAll) {
      issues.push('Missing "all" mechanism');
    }

    const lookupCount = mechanisms.filter(
      m => m.startsWith('include:') || m.startsWith('a:') || m.startsWith('mx:')
    ).length;

    if (lookupCount > 10) {
      issues.push('Too many DNS lookups (>10)');
    }

    return issues;
  }

  // DKIM Record Validation
  async validateDKIMRecord(
    domain: string,
    selector: string = 'default'
  ): Promise<DKIMRecord> {
    return new Promise(resolve => {
      const dkimDomain = `${selector}._domainkey.${domain}`;

      dns.resolveTxt(dkimDomain, (err, records) => {
        if (err) {
          resolve({
            isValid: false,
            selector,
            publicKey: '',
            issues: ['DKIM record not found'],
            lastChecked: new Date(),
          });
          return;
        }

        const dkimRecord = records.find(record =>
          record.some(txt => txt.includes('k=rsa') || txt.includes('p='))
        );

        if (!dkimRecord) {
          resolve({
            isValid: false,
            selector,
            publicKey: '',
            issues: ['Invalid DKIM record format'],
            lastChecked: new Date(),
          });
          return;
        }

        const recordString = dkimRecord.join('');
        const publicKeyMatch = recordString.match(/p=([^;]+)/);
        const publicKey =
          publicKeyMatch && publicKeyMatch[1] ? publicKeyMatch[1] : '';
        const issues = this.validateDKIMRecordFormat(recordString);

        resolve({
          isValid: issues.length === 0,
          selector,
          publicKey,
          issues,
          lastChecked: new Date(),
        });
      });
    });
  }

  private validateDKIMRecordFormat(record: string): string[] {
    const issues: string[] = [];

    if (!record.includes('k=rsa')) {
      issues.push('Missing or invalid key type');
    }

    if (!record.includes('p=') || record.includes('p=;')) {
      issues.push('Missing or empty public key');
    }

    return issues;
  }

  // DMARC Record Validation
  async validateDMARCRecord(domain: string): Promise<DMARCRecord> {
    return new Promise(resolve => {
      const dmarcDomain = `_dmarc.${domain}`;

      dns.resolveTxt(dmarcDomain, (err, records) => {
        if (err) {
          resolve({
            isValid: false,
            policy: 'none',
            percentage: 100,
            alignment: { spf: 'relaxed', dkim: 'relaxed' },
            reportingEmails: [],
            issues: ['DMARC record not found'],
            lastChecked: new Date(),
          });
          return;
        }

        const dmarcRecord = records.find(record =>
          record.some(txt => txt.startsWith('v=DMARC1'))
        );

        if (!dmarcRecord) {
          resolve({
            isValid: false,
            policy: 'none',
            percentage: 100,
            alignment: { spf: 'relaxed', dkim: 'relaxed' },
            reportingEmails: [],
            issues: ['Invalid DMARC record format'],
            lastChecked: new Date(),
          });
          return;
        }

        const recordString = dmarcRecord.join('');
        const parsed = this.parseDMARCRecordData(recordString);

        resolve({
          ...parsed,
          lastChecked: new Date(),
        });
      });
    });
  }

  private parseDMARCRecordData(
    record: string
  ): Omit<DMARCRecord, 'lastChecked'> {
    const issues: string[] = [];

    // Extract policy
    const policyMatch = record.match(/p=([^;]+)/);
    const policy =
      (policyMatch?.[1] as 'none' | 'quarantine' | 'reject') || 'none';

    // Extract percentage
    const percentageMatch = record.match(/pct=(\d+)/);
    const percentage =
      percentageMatch && percentageMatch[1]
        ? parseInt(percentageMatch[1], 10)
        : 100;

    // Extract alignment
    const spfAlignMatch = record.match(/aspf=([^;]+)/);
    const dkimAlignMatch = record.match(/adkim=([^;]+)/);

    const alignment = {
      spf: (spfAlignMatch?.[1] as 'strict' | 'relaxed') || 'relaxed',
      dkim: (dkimAlignMatch?.[1] as 'strict' | 'relaxed') || 'relaxed',
    };

    // Extract reporting emails
    const ruaMatch = record.match(/rua=([^;]+)/);
    const reportingEmails =
      ruaMatch && ruaMatch[1]
        ? ruaMatch[1].split(',').map(email => email.trim())
        : [];

    // Validate record
    if (!record.startsWith('v=DMARC1')) {
      issues.push('Invalid DMARC version');
    }

    if (!['none', 'quarantine', 'reject'].includes(policy)) {
      issues.push('Invalid policy value');
    }

    return {
      isValid: issues.length === 0,
      policy,
      percentage,
      alignment,
      reportingEmails,
      issues,
    };
  }

  // Bounce Handling
  async handleBounce(
    bounceData: Omit<BounceEvent, 'id'>
  ): Promise<BounceEvent> {
    try {
      const bounceEvent: BounceEvent = {
        id: `bounce-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        ...bounceData,
      };

      // Store bounce event
      await this.storeBounceEvent(bounceEvent);

      // Update suppression list if hard bounce
      if (bounceEvent.bounceType === 'hard') {
        await this.addToSuppressionList({
          emailAddress: bounceEvent.emailAddress,
          reason: 'bounce',
          source: 'automatic',
        });
      }

      // Check for bounce rate alerts
      await this.checkBounceRateAlerts(bounceEvent.emailAddress);

      logger.info('Bounce event processed', { bounceId: bounceEvent.id });
      return bounceEvent;
    } catch (error) {
      logger.error('Error handling bounce', { bounceData, error });
      throw error;
    }
  }

  // Suppression List Management
  async addToSuppressionList(data: {
    emailAddress: string;
    reason: 'bounce' | 'complaint' | 'unsubscribe' | 'manual';
    source: string;
  }): Promise<SuppressionList> {
    try {
      const suppressionEntry: SuppressionList = {
        id: `suppression-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        emailAddress: data.emailAddress.toLowerCase(),
        reason: data.reason,
        addedAt: new Date(),
        source: data.source,
        isActive: true,
      };

      await this.storeSuppressionEntry(suppressionEntry);

      // Add to Redis for fast lookup
      await redis.sadd('suppression_list', suppressionEntry.emailAddress);

      logger.info('Email added to suppression list', {
        email: suppressionEntry.emailAddress,
        reason: suppressionEntry.reason,
      });

      return suppressionEntry;
    } catch (error) {
      logger.error('Error adding to suppression list', { data, error });
      throw error;
    }
  }

  async isEmailSuppressed(emailAddress: string): Promise<boolean> {
    try {
      // Check Redis first for fast lookup
      const isSuppressed = await redis.sismember(
        'suppression_list',
        emailAddress.toLowerCase()
      );
      return isSuppressed;
    } catch (error) {
      logger.error('Error checking suppression status', {
        emailAddress,
        error,
      });
      // Fallback to database check
      return this.isEmailSuppressedInDatabase(emailAddress);
    }
  }

  // Deliverability Reporting
  async generateDeliverabilityReport(
    newsletterId: string
  ): Promise<DeliverabilityReport> {
    try {
      logger.info('Generating deliverability report', { newsletterId });

      const [metrics, reputation] = await Promise.all([
        this.getNewsletterMetrics(newsletterId),
        this.getCurrentReputation(),
      ]);

      const report: DeliverabilityReport = {
        id: `report-${newsletterId}-${Date.now()}`,
        newsletterId,
        deliveryRate: (metrics.delivered / metrics.totalSent) * 100,
        bounceRate: (metrics.bounced / metrics.totalSent) * 100,
        spamRate: (metrics.spamComplaints / metrics.totalSent) * 100,
        reputationScore: reputation.reputationScore,
        domainReputation: await this.getDomainReputationScores(),
        recommendations: this.generateRecommendations(metrics, reputation),
        detailedMetrics: metrics,
        createdAt: new Date(),
      };

      await this.storeDeliverabilityReport(report);

      logger.info('Deliverability report generated', { reportId: report.id });
      return report;
    } catch (error) {
      logger.error('Error generating deliverability report', {
        newsletterId,
        error,
      });
      throw error;
    }
  }

  // Real-time Monitoring
  private startMonitoring(): void {
    // Reputation monitoring
    this.monitoringInterval = setInterval(
      async () => {
        try {
          await this.performRoutineReputationCheck();
        } catch (error) {
          logger.error('Error in routine reputation check', error);
        }
      },
      config.deliverability.reputationCheckInterval * 60 * 1000
    );

    // Blacklist monitoring
    this.blacklistCheckInterval = setInterval(
      async () => {
        try {
          await this.performRoutineBlacklistCheck();
        } catch (error) {
          logger.error('Error in routine blacklist check', error);
        }
      },
      config.deliverability.blacklistCheckInterval * 60 * 1000
    );

    logger.info('Deliverability monitoring started');
  }

  private async performRoutineReputationCheck(): Promise<void> {
    // Get all domains to monitor
    const domains = await this.getMonitoredDomains();

    for (const domain of domains) {
      try {
        await this.trackSenderReputation(domain.domain, domain.ipAddress);
      } catch (error) {
        logger.error('Error in routine reputation check for domain', {
          domain,
          error,
        });
      }
    }
  }

  private async performRoutineBlacklistCheck(): Promise<void> {
    const domains = await this.getMonitoredDomains();

    for (const domain of domains) {
      try {
        const blacklistStatus = await this.checkBlacklistStatus(
          domain.domain,
          domain.ipAddress
        );
        const listedProviders = blacklistStatus.filter(
          status => status.isListed
        );

        if (listedProviders.length > 0) {
          await this.createAlert({
            type: 'blacklist_detected',
            severity: 'high',
            message: `Domain ${domain.domain} is blacklisted`,
            details: { domain: domain.domain, providers: listedProviders },
          });
        }
      } catch (error) {
        logger.error('Error in routine blacklist check for domain', {
          domain,
          error,
        });
      }
    }
  }

  // Helper Methods
  private calculateReputationScore(data: {
    blacklistStatus: BlacklistStatus[];
    spfRecord: SPFRecord;
    dkimRecord: DKIMRecord;
    dmarcRecord: DMARCRecord;
    trends: ReputationTrend[];
  }): number {
    let score = 100;

    // Blacklist penalties
    const blacklistedCount = data.blacklistStatus.filter(
      status => status.isListed
    ).length;
    score -= blacklistedCount * 20;

    // Authentication penalties
    if (!data.spfRecord.isValid) score -= 10;
    if (!data.dkimRecord.isValid) score -= 10;
    if (!data.dmarcRecord.isValid) score -= 5;

    // Trend analysis
    if (data.trends.length > 0) {
      const recentTrend = data.trends.slice(-7); // Last 7 days
      const avgDeliveryRate =
        recentTrend.reduce((sum, trend) => sum + trend.deliveryRate, 0) /
        recentTrend.length;
      const avgBounceRate =
        recentTrend.reduce((sum, trend) => sum + trend.bounceRate, 0) /
        recentTrend.length;

      if (avgDeliveryRate < 95) score -= 10;
      if (avgBounceRate > 5) score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(
    metrics: DeliverabilityMetrics,
    reputation: SenderReputation
  ): string[] {
    const recommendations: string[] = [];

    const bounceRate = (metrics.bounced / metrics.totalSent) * 100;
    if (bounceRate > 5) {
      recommendations.push(
        'High bounce rate detected. Review and clean your email list.'
      );
    }

    if (metrics.spamComplaints > metrics.totalSent * 0.001) {
      recommendations.push(
        'Spam complaint rate is high. Review email content and targeting.'
      );
    }

    if (!reputation.spfRecord.isValid) {
      recommendations.push(
        'SPF record is invalid or missing. Configure proper SPF authentication.'
      );
    }

    if (!reputation.dkimRecord.isValid) {
      recommendations.push(
        'DKIM record is invalid or missing. Set up DKIM signing.'
      );
    }

    if (!reputation.dmarcRecord.isValid) {
      recommendations.push(
        'DMARC record is invalid or missing. Implement DMARC policy.'
      );
    }

    const blacklistedCount = reputation.blacklistStatus.filter(
      status => status.isListed
    ).length;
    if (blacklistedCount > 0) {
      recommendations.push(
        `Your domain/IP is blacklisted by ${blacklistedCount} provider(s). Contact them for delisting.`
      );
    }

    if (metrics.inboxPlacement < 90) {
      recommendations.push(
        'Low inbox placement rate. Focus on engagement and list hygiene.'
      );
    }

    return recommendations;
  }

  // Database Operations
  private async storeSenderReputation(
    reputation: SenderReputation
  ): Promise<void> {
    const query = `
      INSERT INTO sender_reputation (
        id, domain, ip_address, reputation_score, blacklist_status,
        spf_record, dkim_record, dmarc_record, last_checked, trends
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (domain, ip_address)
      DO UPDATE SET
        reputation_score = $4,
        blacklist_status = $5,
        spf_record = $6,
        dkim_record = $7,
        dmarc_record = $8,
        last_checked = $9,
        trends = $10
    `;

    await database.query(query, [
      reputation.id,
      reputation.domain,
      reputation.ipAddress,
      reputation.reputationScore,
      JSON.stringify(reputation.blacklistStatus),
      JSON.stringify(reputation.spfRecord),
      JSON.stringify(reputation.dkimRecord),
      JSON.stringify(reputation.dmarcRecord),
      reputation.lastChecked,
      JSON.stringify(reputation.trends),
    ]);
  }

  private async storeBounceEvent(bounce: BounceEvent): Promise<void> {
    const query = `
      INSERT INTO bounce_events (
        id, email_address, bounce_type, bounce_sub_type, reason,
        timestamp, newsletter_id, campaign_id, diagnostic_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await database.query(query, [
      bounce.id,
      bounce.emailAddress,
      bounce.bounceType,
      bounce.bounceSubType,
      bounce.reason,
      bounce.timestamp,
      bounce.newsletterId,
      bounce.campaignId,
      bounce.diagnosticCode,
    ]);
  }

  private async storeSuppressionEntry(entry: SuppressionList): Promise<void> {
    const query = `
      INSERT INTO suppression_list (
        id, email_address, reason, added_at, source, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email_address)
      DO UPDATE SET
        reason = $3,
        added_at = $4,
        source = $5,
        is_active = $6
    `;

    await database.query(query, [
      entry.id,
      entry.emailAddress,
      entry.reason,
      entry.addedAt,
      entry.source,
      entry.isActive,
    ]);
  }

  private async storeDeliverabilityReport(
    report: DeliverabilityReport
  ): Promise<void> {
    const query = `
      INSERT INTO deliverability_reports (
        id, newsletter_id, delivery_rate, bounce_rate, spam_rate,
        reputation_score, domain_reputation, recommendations,
        detailed_metrics, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    await database.query(query, [
      report.id,
      report.newsletterId,
      report.deliveryRate,
      report.bounceRate,
      report.spamRate,
      report.reputationScore,
      JSON.stringify(report.domainReputation),
      JSON.stringify(report.recommendations),
      JSON.stringify(report.detailedMetrics),
      report.createdAt,
    ]);
  }

  private async createAlert(
    alertData: Omit<DeliverabilityAlert, 'id' | 'triggeredAt' | 'isResolved'>
  ): Promise<void> {
    const alert: DeliverabilityAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      triggeredAt: new Date(),
      isResolved: false,
      ...alertData,
    };

    const query = `
      INSERT INTO deliverability_alerts (
        id, type, severity, message, details, triggered_at, is_resolved
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await database.query(query, [
      alert.id,
      alert.type,
      alert.severity,
      alert.message,
      JSON.stringify(alert.details),
      alert.triggeredAt,
      alert.isResolved,
    ]);

    logger.warn('Deliverability alert created', alert);
  }

  // Placeholder methods for database queries
  private async getReputationTrends(
    domain: string,
    ipAddress: string
  ): Promise<ReputationTrend[]> {
    const query = `
      SELECT date, score, delivery_rate, bounce_rate, spam_rate
      FROM reputation_trends
      WHERE domain = $1 AND ip_address = $2
      ORDER BY date DESC
      LIMIT 30
    `;

    const result = await database.query(query, [domain, ipAddress]);
    return result.rows.map((row: any) => ({
      date: row.date,
      score: row.score,
      deliveryRate: row.delivery_rate,
      bounceRate: row.bounce_rate,
      spamRate: row.spam_rate,
    }));
  }

  private async getCurrentReputation(): Promise<SenderReputation> {
    // This would get the current reputation for the primary sending domain
    // For now, return a default structure
    return {
      id: 'current',
      domain: 'example.com',
      ipAddress: '127.0.0.1',
      reputationScore: 85,
      blacklistStatus: [],
      spfRecord: {
        isValid: true,
        record: '',
        mechanisms: [],
        issues: [],
        lastChecked: new Date(),
      },
      dkimRecord: {
        isValid: true,
        selector: 'default',
        publicKey: '',
        issues: [],
        lastChecked: new Date(),
      },
      dmarcRecord: {
        isValid: true,
        policy: 'quarantine',
        percentage: 100,
        alignment: { spf: 'relaxed', dkim: 'relaxed' },
        reportingEmails: [],
        issues: [],
        lastChecked: new Date(),
      },
      lastChecked: new Date(),
      trends: [],
    };
  }

  private async getNewsletterMetrics(
    newsletterId: string
  ): Promise<DeliverabilityMetrics> {
    // This would query actual newsletter metrics
    return {
      totalSent: 1000,
      delivered: 950,
      bounced: 50,
      softBounces: 30,
      hardBounces: 20,
      spamComplaints: 1,
      unsubscribes: 5,
      opens: 400,
      clicks: 100,
      deliveryTime: 120,
      inboxPlacement: 92,
      spamFolderPlacement: 8,
    };
  }

  private async getDomainReputationScores(): Promise<Record<string, number>> {
    return {
      'gmail.com': 85,
      'yahoo.com': 78,
      'outlook.com': 82,
      'aol.com': 75,
    };
  }

  private async getMonitoredDomains(): Promise<
    Array<{ domain: string; ipAddress: string }>
  > {
    return [{ domain: 'example.com', ipAddress: '127.0.0.1' }];
  }

  private async isEmailSuppressedInDatabase(
    emailAddress: string
  ): Promise<boolean> {
    const query = `
      SELECT 1 FROM suppression_list
      WHERE email_address = $1 AND is_active = true
    `;

    const result = await database.query(query, [emailAddress.toLowerCase()]);
    return result.rows.length > 0;
  }

  private async checkReputationAlerts(
    reputation: SenderReputation
  ): Promise<void> {
    if (
      reputation.reputationScore <
      config.deliverability.thresholds.reputationScore
    ) {
      await this.createAlert({
        type: 'reputation_drop',
        severity: 'medium',
        message: `Reputation score dropped to ${reputation.reputationScore}`,
        details: {
          domain: reputation.domain,
          score: reputation.reputationScore,
        },
      });
    }
  }

  private async checkBounceRateAlerts(emailAddress: string): Promise<void> {
    // Implementation for bounce rate monitoring
    // This would check recent bounce rates and create alerts if thresholds are exceeded
    logger.debug('Checking bounce rate alerts for email', { emailAddress });
  }

  private async generateDeliverabilityInsights(
    newsletterId: string
  ): Promise<DeliverabilityInsight[]> {
    // Generate actionable insights based on deliverability data
    logger.debug('Generating deliverability insights', { newsletterId });
    return [
      {
        type: 'recommendation',
        title: 'Improve Authentication',
        description: 'Set up DMARC policy to improve deliverability',
        impact: 'high',
        actionRequired: true,
        suggestedActions: [
          'Configure DMARC record',
          'Set policy to quarantine',
        ],
      },
    ];
  }

  async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.blacklistCheckInterval) {
      clearInterval(this.blacklistCheckInterval);
      this.blacklistCheckInterval = null;
    }

    logger.info('Deliverability monitoring stopped');
  }
}
