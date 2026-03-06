// @ts-nocheck
import { Job, Queue } from 'bull';
import nodemailer, { SendMailOptions, Transporter } from 'nodemailer';
import { logger } from '../utils/logger';

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  rateLimiting: {
    maxEmailsPerSecond: number;
    maxEmailsPerMinute: number;
    maxEmailsPerHour: number;
    burstLimit: number;
  };
  retry: {
    maxAttempts: number;
    backoffMultiplier: number;
    maxBackoffDelay: number;
  };
  batching: {
    batchSize: number;
    batchDelay: number;
    maxBatchWaitTime: number;
  };
  prioritization: {
    enableEngagementScoring: boolean;
    highEngagementThreshold: number;
    lowEngagementThreshold: number;
  };
}

export interface EmailJob {
  id: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  engagementScore?: number;
  subscriberId?: string;
  campaignId?: string;
  metadata?: Record<string, any>;
  scheduledAt?: Date;
  retryCount?: number;
}

export interface EmailBatch {
  id: string;
  emails: EmailJob[];
  priority: 'urgent' | 'high' | 'normal' | 'low';
  createdAt: Date;
  estimatedSendTime: number;
}

export interface SendingStats {
  sent: number;
  failed: number;
  queued: number;
  processing: number;
  ratePerSecond: number;
  ratePerMinute: number;
  ratePerHour: number;
  avgResponseTime: number;
  lastSentAt?: Date;
}

export class OptimizedEmailSender {
  private transporter: Transporter;
  private config: EmailConfig;
  private emailQueue: Queue;
  private batchQueue: Queue;
  private stats: SendingStats;
  private rateLimiters: Map<string, { count: number; resetTime: number }> =
    new Map();
  private pendingBatches: Map<string, EmailBatch> = new Map();
  private batchTimer?: NodeJS.Timeout;

  constructor(config: EmailConfig, emailQueue: Queue, batchQueue: Queue) {
    this.config = config;
    this.emailQueue = emailQueue;
    this.batchQueue = batchQueue;

    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.auth,
      pool: true,
      maxConnections: 10,
      maxMessages: 100,
      rateLimit: config.rateLimiting.maxEmailsPerSecond,
    });

    this.stats = {
      sent: 0,
      failed: 0,
      queued: 0,
      processing: 0,
      ratePerSecond: 0,
      ratePerMinute: 0,
      ratePerHour: 0,
      avgResponseTime: 0,
    };

    this.setupQueueProcessors();
    this.startBatchProcessor();
    this.startStatsUpdater();
  }

  /**
   * Queue single email with intelligent batching
   */
  async queueEmail(email: EmailJob): Promise<string> {
    try {
      // Calculate priority based on engagement score
      const priority = this.calculatePriority(email);

      email.priority = priority;

      // Add to appropriate batch or create new one
      await this.addToBatch(email);

      this.stats.queued++;
      logger.info('Email queued for batching', {
        emailId: email.id,
        priority,
        engagementScore: email.engagementScore,
      });

      return email.id;
    } catch (error) {
      logger.error('Failed to queue email', {
        emailId: email.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Queue multiple emails with intelligent batching
   */
  async queueBulkEmails(emails: EmailJob[]): Promise<string[]> {
    try {
      const queuedIds: string[] = [];

      // Sort emails by priority and engagement score
      const sortedEmails = this.sortEmailsByPriority(emails);

      // Process in chunks to avoid overwhelming the system
      const chunkSize = 100;

      for (let i = 0; i < sortedEmails.length; i += chunkSize) {
        const chunk = sortedEmails.slice(i, i + chunkSize);

        for (const email of chunk) {
          const id = await this.queueEmail(email);

          queuedIds.push(id);
        }

        // Small delay between chunks to prevent overwhelming
        if (i + chunkSize < sortedEmails.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      logger.info('Bulk emails queued', { count: emails.length });

      return queuedIds;
    } catch (error) {
      logger.error('Failed to queue bulk emails', {
        count: emails.length,
        error,
      });
      throw error;
    }
  }

  /**
   * Send email immediately (bypass batching)
   */
  async sendEmailImmediate(email: EmailJob): Promise<void> {
    const startTime = Date.now();

    try {
      // Check rate limits
      await this.checkRateLimit();

      const mailOptions: SendMailOptions = {
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        messageId: email.id,
        headers: {
          'X-Campaign-ID': email.campaignId || '',
          'X-Subscriber-ID': email.subscriberId || '',
          'X-Priority': email.priority,
        },
      };

      await this.transporter.sendMail(mailOptions);

      const responseTime = Date.now() - startTime;

      this.updateStats('sent', responseTime);

      logger.info('Email sent immediately', {
        emailId: email.id,
        to: email.to,
        responseTime,
      });
    } catch (error) {
      this.updateStats('failed');
      logger.error('Failed to send email immediately', {
        emailId: email.id,
        to: email.to,
        error,
      });
      throw error;
    }
  }

  /**
   * Get current sending statistics
   */
  getStats(): SendingStats {
    return { ...this.stats };
  }

  /**
   * Get queue health information
   */
  async getQueueHealth(): Promise<{
    emailQueue: any;
    batchQueue: any;
    pendingBatches: number;
    rateLimitStatus: any;
  }> {
    const [emailQueueStats, batchQueueStats] = await Promise.all([
      this.getQueueStats(this.emailQueue),
      this.getQueueStats(this.batchQueue),
    ]);

    return {
      emailQueue: emailQueueStats,
      batchQueue: batchQueueStats,
      pendingBatches: this.pendingBatches.size,
      rateLimitStatus: this.getRateLimitStatus(),
    };
  }

  /**
   * Pause email sending
   */
  async pauseSending(): Promise<void> {
    await Promise.all([this.emailQueue.pause(), this.batchQueue.pause()]);

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    logger.info('Email sending paused');
  }

  /**
   * Resume email sending
   */
  async resumeSending(): Promise<void> {
    await Promise.all([this.emailQueue.resume(), this.batchQueue.resume()]);

    this.startBatchProcessor();
    logger.info('Email sending resumed');
  }

  private setupQueueProcessors(): void {
    // Process individual emails
    this.emailQueue.process('send-email', 5, async (job: Job<EmailJob>) => {
      const email = job.data;

      try {
        await this.sendEmailWithRetry(email);

        return { success: true, emailId: email.id };
      } catch (error) {
        logger.error('Email job failed', { emailId: email.id, error });
        throw error;
      }
    });

    // Process email batches
    this.batchQueue.process('send-batch', 3, async (job: Job<EmailBatch>) => {
      const batch = job.data;

      try {
        await this.processBatch(batch);

        return {
          success: true,
          batchId: batch.id,
          emailCount: batch.emails.length,
        };
      } catch (error) {
        logger.error('Batch job failed', { batchId: batch.id, error });
        throw error;
      }
    });
  }

  private async sendEmailWithRetry(email: EmailJob): Promise<void> {
    const maxAttempts = this.config.retry.maxAttempts;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        await this.sendEmailImmediate(email);

        return;
      } catch (error) {
        attempt++;

        if (attempt >= maxAttempts) {
          throw error;
        }

        // Exponential backoff with jitter
        const baseDelay = Math.min(
          1000 * Math.pow(this.config.retry.backoffMultiplier, attempt - 1),
          this.config.retry.maxBackoffDelay
        );
        const jitter = Math.random() * 0.1 * baseDelay;
        const delay = baseDelay + jitter;

        logger.warn('Email send failed, retrying', {
          emailId: email.id,
          attempt,
          delay,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async addToBatch(email: EmailJob): Promise<void> {
    const batchKey = `${email.priority}_${Math.floor(Date.now() / (this.config.batching.batchDelay * 1000))}`;

    let batch = this.pendingBatches.get(batchKey);

    if (!batch) {
      batch = {
        id: batchKey,
        emails: [],
        priority: email.priority,
        createdAt: new Date(),
        estimatedSendTime: 0,
      };
      this.pendingBatches.set(batchKey, batch);
    }

    batch.emails.push(email);

    // If batch is full, process it immediately
    if (batch.emails.length >= this.config.batching.batchSize) {
      await this.processPendingBatch(batchKey);
    }
  }

  private async processPendingBatch(batchKey: string): Promise<void> {
    const batch = this.pendingBatches.get(batchKey);

    if (!batch) return;

    this.pendingBatches.delete(batchKey);

    // Calculate estimated send time
    batch.estimatedSendTime = this.calculateBatchSendTime(batch.emails.length);

    // Add batch to queue
    await this.batchQueue.add('send-batch', batch, {
      priority: this.getPriorityValue(batch.priority),
      delay: 0,
    });

    logger.info('Batch queued for processing', {
      batchId: batch.id,
      emailCount: batch.emails.length,
      priority: batch.priority,
    });
  }

  private async processBatch(batch: EmailBatch): Promise<void> {
    const startTime = Date.now();

    this.stats.processing += batch.emails.length;

    try {
      // Sort emails within batch by engagement score
      const sortedEmails = batch.emails.sort(
        (a, b) => (b.engagementScore || 0) - (a.engagementScore || 0)
      );

      // Send emails with rate limiting
      for (const email of sortedEmails) {
        await this.checkRateLimit();

        try {
          await this.sendEmailImmediate(email);
        } catch (error) {
          // Log error but continue with batch
          logger.error('Email in batch failed', {
            batchId: batch.id,
            emailId: email.id,
            error,
          });
        }

        // Small delay between emails to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const processingTime = Date.now() - startTime;

      logger.info('Batch processed successfully', {
        batchId: batch.id,
        emailCount: batch.emails.length,
        processingTime,
      });
    } finally {
      this.stats.processing -= batch.emails.length;
    }
  }

  private startBatchProcessor(): void {
    this.batchTimer = setInterval(async () => {
      const now = Date.now();
      const maxWaitTime = this.config.batching.maxBatchWaitTime * 1000;

      for (const [batchKey, batch] of this.pendingBatches.entries()) {
        const waitTime = now - batch.createdAt.getTime();

        if (waitTime >= maxWaitTime) {
          await this.processPendingBatch(batchKey);
        }
      }
    }, this.config.batching.batchDelay * 1000);
  }

  private calculatePriority(
    email: EmailJob
  ): 'urgent' | 'high' | 'normal' | 'low' {
    if (
      !this.config.prioritization.enableEngagementScoring ||
      !email.engagementScore
    ) {
      return email.priority || 'normal';
    }

    const score = email.engagementScore;

    if (score >= this.config.prioritization.highEngagementThreshold) {
      return 'high';
    } else if (score <= this.config.prioritization.lowEngagementThreshold) {
      return 'low';
    }

    return 'normal';
  }

  private sortEmailsByPriority(emails: EmailJob[]): EmailJob[] {
    const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };

    return emails.sort((a, b) => {
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Secondary sort by engagement score
      return (b.engagementScore || 0) - (a.engagementScore || 0);
    });
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const secondKey = `second_${Math.floor(now / 1000)}`;
    const minuteKey = `minute_${Math.floor(now / 60000)}`;
    const hourKey = `hour_${Math.floor(now / 3600000)}`;

    // Check and update rate limiters
    this.updateRateLimiter(
      secondKey,
      this.config.rateLimiting.maxEmailsPerSecond,
      1000
    );
    this.updateRateLimiter(
      minuteKey,
      this.config.rateLimiting.maxEmailsPerMinute,
      60000
    );
    this.updateRateLimiter(
      hourKey,
      this.config.rateLimiting.maxEmailsPerHour,
      3600000
    );

    // Check if we need to wait
    const secondLimiter = this.rateLimiters.get(secondKey);
    const minuteLimiter = this.rateLimiters.get(minuteKey);
    const hourLimiter = this.rateLimiters.get(hourKey);

    if (
      secondLimiter &&
      secondLimiter.count >= this.config.rateLimiting.maxEmailsPerSecond
    ) {
      const waitTime = secondLimiter.resetTime - now;

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (
      minuteLimiter &&
      minuteLimiter.count >= this.config.rateLimiting.maxEmailsPerMinute
    ) {
      const waitTime = minuteLimiter.resetTime - now;

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (
      hourLimiter &&
      hourLimiter.count >= this.config.rateLimiting.maxEmailsPerHour
    ) {
      const waitTime = hourLimiter.resetTime - now;

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  private updateRateLimiter(
    key: string,
    limit: number,
    windowMs: number
  ): void {
    const now = Date.now();
    let limiter = this.rateLimiters.get(key);

    if (!limiter || now >= limiter.resetTime) {
      limiter = {
        count: 1,
        resetTime: now + windowMs,
      };
    } else {
      limiter.count++;
    }

    this.rateLimiters.set(key, limiter);

    // Cleanup old limiters
    for (const [k, v] of this.rateLimiters.entries()) {
      if (now >= v.resetTime) {
        this.rateLimiters.delete(k);
      }
    }
  }

  private updateStats(type: 'sent' | 'failed', responseTime?: number): void {
    if (type === 'sent') {
      this.stats.sent++;
      this.stats.lastSentAt = new Date();

      if (responseTime) {
        this.stats.avgResponseTime =
          (this.stats.avgResponseTime * (this.stats.sent - 1) + responseTime) /
          this.stats.sent;
      }
    } else if (type === 'failed') {
      this.stats.failed++;
    }
  }

  private startStatsUpdater(): void {
    setInterval(() => {
      const now = Date.now();
      const oneSecondAgo = now - 1000;
      const oneMinuteAgo = now - 60000;
      const oneHourAgo = now - 3600000;

      // Calculate rates (simplified - in production, you'd want more accurate tracking)
      this.stats.ratePerSecond = this.calculateRate(oneSecondAgo);
      this.stats.ratePerMinute = this.calculateRate(oneMinuteAgo);
      this.stats.ratePerHour = this.calculateRate(oneHourAgo);
    }, 1000);
  }

  private calculateRate(since: number): number {
    // Simplified rate calculation
    // In production, you'd maintain a sliding window of send times
    return 0;
  }

  private calculateBatchSendTime(emailCount: number): number {
    const baseTimePerEmail = 100; // ms
    const rateLimitDelay = 1000 / this.config.rateLimiting.maxEmailsPerSecond;

    return emailCount * Math.max(baseTimePerEmail, rateLimitDelay);
  }

  private getPriorityValue(
    priority: 'urgent' | 'high' | 'normal' | 'low'
  ): number {
    const priorities = { urgent: 20, high: 10, normal: 5, low: 1 };

    return priorities[priority];
  }

  private getRateLimitStatus(): any {
    const now = Date.now();
    const status: any = {};

    for (const [key, limiter] of this.rateLimiters.entries()) {
      if (now < limiter.resetTime) {
        status[key] = {
          count: limiter.count,
          resetIn: limiter.resetTime - now,
        };
      }
    }

    return status;
  }

  private async getQueueStats(queue: Queue): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }
}
