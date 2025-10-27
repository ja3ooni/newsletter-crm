import {
  AuditLogEntry,
  CANSPAMCompliance,
  ComplianceReport,
  ConsentStatus,
  DataDeletionRequest,
  DataPortabilityRequest,
  GDPRConsentRecord,
  GDPRDataRequest,
} from '../types/compliance';
import { database } from '../utils/database';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';

export class ComplianceService {
  // GDPR Compliance Methods
  async recordConsent(consentData: {
    contactId: string;
    email: string;
    consentType: 'marketing' | 'analytics' | 'functional';
    consentGiven: boolean;
    consentMethod: 'opt-in' | 'pre-checked' | 'implied' | 'explicit';
    ipAddress: string;
    userAgent: string;
    timestamp?: Date;
    legalBasis:
      | 'consent'
      | 'legitimate_interest'
      | 'contract'
      | 'legal_obligation';
    source: string;
  }): Promise<GDPRConsentRecord> {
    try {
      const consentRecord: GDPRConsentRecord = {
        id: this.generateId(),
        contactId: consentData.contactId,
        email: consentData.email,
        consentType: consentData.consentType,
        consentGiven: consentData.consentGiven,
        consentMethod: consentData.consentMethod,
        ipAddress: consentData.ipAddress,
        userAgent: consentData.userAgent,
        timestamp: consentData.timestamp || new Date(),
        legalBasis: consentData.legalBasis,
        source: consentData.source,
        isActive: true,
        withdrawnAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store consent record in database
      const query = `
        INSERT INTO gdpr_consent_records
        (id, contact_id, email, consent_type, consent_given, consent_method,
         ip_address, user_agent, timestamp, legal_basis, source, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;

      const values = [
        consentRecord.id,
        consentRecord.contactId,
        consentRecord.email,
        consentRecord.consentType,
        consentRecord.consentGiven,
        consentRecord.consentMethod,
        consentRecord.ipAddress,
        consentRecord.userAgent,
        consentRecord.timestamp,
        consentRecord.legalBasis,
        consentRecord.source,
        consentRecord.isActive,
        consentRecord.createdAt,
        consentRecord.updatedAt,
      ];

      const result = await database.query(query, values);

      // Log audit entry
      await this.createAuditLog({
        action: 'consent_recorded',
        entityType: 'consent',
        entityId: consentRecord.id,
        userId: null,
        details: {
          email: consentData.email,
          consentType: consentData.consentType,
          consentGiven: consentData.consentGiven,
          legalBasis: consentData.legalBasis,
        },
        ipAddress: consentData.ipAddress,
        userAgent: consentData.userAgent,
      });

      logger.info('GDPR consent recorded', {
        consentId: consentRecord.id,
        email: consentData.email,
        consentType: consentData.consentType,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error recording GDPR consent', { error, consentData });
      throw new Error('Failed to record consent');
    }
  }

  async withdrawConsent(
    contactId: string,
    consentType: string,
    withdrawalData: {
      ipAddress: string;
      userAgent: string;
      reason?: string;
    }
  ): Promise<void> {
    try {
      const query = `
        UPDATE gdpr_consent_records
        SET is_active = false, withdrawn_at = $1, updated_at = $2
        WHERE contact_id = $3 AND consent_type = $4 AND is_active = true
        RETURNING *
      `;

      const values = [new Date(), new Date(), contactId, consentType];
      const result = await database.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('No active consent found to withdraw');
      }

      // Log audit entry
      await this.createAuditLog({
        action: 'consent_withdrawn',
        entityType: 'consent',
        entityId: result.rows[0].id,
        userId: null,
        details: {
          contactId,
          consentType,
          reason: withdrawalData.reason,
        },
        ipAddress: withdrawalData.ipAddress,
        userAgent: withdrawalData.userAgent,
      });

      logger.info('GDPR consent withdrawn', { contactId, consentType });
    } catch (error) {
      logger.error('Error withdrawing consent', {
        error,
        contactId,
        consentType,
      });
      throw new Error('Failed to withdraw consent');
    }
  }

  async getConsentStatus(contactId: string): Promise<ConsentStatus[]> {
    try {
      const query = `
        SELECT consent_type, consent_given, is_active, timestamp, withdrawn_at, legal_basis
        FROM gdpr_consent_records
        WHERE contact_id = $1
        ORDER BY timestamp DESC
      `;

      const result = await database.query(query, [contactId]);

      return result.rows.map((row: any) => ({
        consentType: row.consent_type,
        consentGiven: row.consent_given,
        isActive: row.is_active,
        timestamp: row.timestamp,
        withdrawnAt: row.withdrawn_at,
        legalBasis: row.legal_basis,
      }));
    } catch (error) {
      logger.error('Error getting consent status', { error, contactId });
      throw new Error('Failed to get consent status');
    }
  }

  async processDataRequest(requestData: {
    contactId: string;
    email: string;
    requestType: 'access' | 'portability' | 'rectification' | 'erasure';
    requestDetails?: string;
    requesterIp: string;
    requesterUserAgent: string;
  }): Promise<GDPRDataRequest> {
    try {
      const dataRequest: GDPRDataRequest = {
        id: this.generateId(),
        contactId: requestData.contactId,
        email: requestData.email,
        requestType: requestData.requestType,
        status: 'pending',
        requestDetails: requestData.requestDetails || null,
        requestedAt: new Date(),
        processedAt: null,
        completedAt: null,
        requesterIp: requestData.requesterIp,
        requesterUserAgent: requestData.requesterUserAgent,
        processingNotes: null,
        dataExportUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const query = `
        INSERT INTO gdpr_data_requests
        (id, contact_id, email, request_type, status, request_details,
         requested_at, requester_ip, requester_user_agent, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        dataRequest.id,
        dataRequest.contactId,
        dataRequest.email,
        dataRequest.requestType,
        dataRequest.status,
        dataRequest.requestDetails,
        dataRequest.requestedAt,
        dataRequest.requesterIp,
        dataRequest.requesterUserAgent,
        dataRequest.createdAt,
        dataRequest.updatedAt,
      ];

      const result = await database.query(query, values);

      // Log audit entry
      await this.createAuditLog({
        action: 'data_request_created',
        entityType: 'data_request',
        entityId: dataRequest.id,
        userId: null,
        details: {
          email: requestData.email,
          requestType: requestData.requestType,
        },
        ipAddress: requestData.requesterIp,
        userAgent: requestData.requesterUserAgent,
      });

      // Schedule processing based on request type
      await this.scheduleDataRequestProcessing(dataRequest);

      logger.info('GDPR data request created', {
        requestId: dataRequest.id,
        email: requestData.email,
        requestType: requestData.requestType,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error processing data request', { error, requestData });
      throw new Error('Failed to process data request');
    }
  }

  async processRightToBeForgotten(
    contactId: string,
    requestId: string
  ): Promise<DataDeletionRequest> {
    try {
      // Create deletion request
      const deletionRequest: DataDeletionRequest = {
        id: this.generateId(),
        contactId,
        requestId,
        status: 'pending',
        requestedAt: new Date(),
        scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        completedAt: null,
        dataTypes: [
          'personal_data',
          'engagement_history',
          'preferences',
          'consent_records',
        ],
        retentionExceptions: [],
        deletionMethod: 'hard_delete',
        verificationRequired: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const query = `
        INSERT INTO data_deletion_requests
        (id, contact_id, request_id, status, requested_at, scheduled_for,
         data_types, retention_exceptions, deletion_method, verification_required, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const values = [
        deletionRequest.id,
        deletionRequest.contactId,
        deletionRequest.requestId,
        deletionRequest.status,
        deletionRequest.requestedAt,
        deletionRequest.scheduledFor,
        JSON.stringify(deletionRequest.dataTypes),
        JSON.stringify(deletionRequest.retentionExceptions),
        deletionRequest.deletionMethod,
        deletionRequest.verificationRequired,
        deletionRequest.createdAt,
        deletionRequest.updatedAt,
      ];

      const result = await database.query(query, values);

      // Log audit entry
      await this.createAuditLog({
        action: 'deletion_request_created',
        entityType: 'deletion_request',
        entityId: deletionRequest.id,
        userId: null,
        details: {
          contactId,
          requestId,
          scheduledFor: deletionRequest.scheduledFor,
        },
      });

      logger.info('Data deletion request created', {
        deletionId: deletionRequest.id,
        contactId,
        scheduledFor: deletionRequest.scheduledFor,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error processing right to be forgotten', {
        error,
        contactId,
        requestId,
      });
      throw new Error('Failed to process right to be forgotten request');
    }
  }

  async executeDataDeletion(deletionRequestId: string): Promise<void> {
    try {
      // Get deletion request
      const deletionQuery = `
        SELECT * FROM data_deletion_requests
        WHERE id = $1 AND status = 'approved'
      `;
      const deletionResult = await database.query(deletionQuery, [
        deletionRequestId,
      ]);

      if (deletionResult.rows.length === 0) {
        throw new Error('Deletion request not found or not approved');
      }

      const deletionRequest = deletionResult.rows[0];
      const contactId = deletionRequest.contact_id;

      // Begin transaction for data deletion
      await database.query('BEGIN');

      try {
        // Delete from various tables based on data types
        const dataTypes = JSON.parse(deletionRequest.data_types);

        if (dataTypes.includes('personal_data')) {
          await database.query('DELETE FROM contacts WHERE id = $1', [
            contactId,
          ]);
        }

        if (dataTypes.includes('engagement_history')) {
          await database.query(
            'DELETE FROM engagement_events WHERE contact_id = $1',
            [contactId]
          );
        }

        if (dataTypes.includes('preferences')) {
          await database.query(
            'DELETE FROM contact_preferences WHERE contact_id = $1',
            [contactId]
          );
        }

        if (dataTypes.includes('consent_records')) {
          await database.query(
            'DELETE FROM gdpr_consent_records WHERE contact_id = $1',
            [contactId]
          );
        }

        // Update deletion request status
        await database.query(
          'UPDATE data_deletion_requests SET status = $1, completed_at = $2, updated_at = $3 WHERE id = $4',
          ['completed', new Date(), new Date(), deletionRequestId]
        );

        await database.query('COMMIT');

        // Log audit entry
        await this.createAuditLog({
          action: 'data_deleted',
          entityType: 'contact',
          entityId: contactId,
          userId: null,
          details: {
            deletionRequestId,
            dataTypes,
            deletionMethod: deletionRequest.deletion_method,
          },
        });

        logger.info('Data deletion completed', {
          deletionRequestId,
          contactId,
        });
      } catch (error) {
        await database.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('Error executing data deletion', {
        error,
        deletionRequestId,
      });
      throw new Error('Failed to execute data deletion');
    }
  }

  // CAN-SPAM Compliance Methods
  async validateCANSPAMCompliance(emailContent: {
    subject: string;
    htmlContent: string;
    textContent: string;
    fromAddress: string;
    fromName: string;
    replyToAddress?: string;
  }): Promise<CANSPAMCompliance> {
    try {
      const compliance: CANSPAMCompliance = {
        isCompliant: true,
        violations: [],
        warnings: [],
        checkedAt: new Date(),
        requirements: {
          hasUnsubscribeLink: false,
          hasPhysicalAddress: false,
          hasAccurateFromInfo: true,
          hasNonDeceptiveSubject: true,
          hasProperIdentification: false,
          hasValidReplyTo: false,
        },
      };

      // Check for unsubscribe link
      const unsubscribeRegex = /unsubscribe|opt[\s-]?out|remove[\s-]?me/i;
      const hasUnsubscribeInHtml = unsubscribeRegex.test(
        emailContent.htmlContent
      );
      const hasUnsubscribeInText = unsubscribeRegex.test(
        emailContent.textContent
      );

      if (!hasUnsubscribeInHtml && !hasUnsubscribeInText) {
        compliance.violations.push('Missing unsubscribe link');
        compliance.requirements.hasUnsubscribeLink = false;
        compliance.isCompliant = false;
      } else {
        compliance.requirements.hasUnsubscribeLink = true;
      }

      // Check for physical address
      const addressRegex = /\d+\s+[\w\s]+,\s*[\w\s]+,\s*[A-Z]{2}\s+\d{5}/;
      if (
        !addressRegex.test(emailContent.htmlContent) &&
        !addressRegex.test(emailContent.textContent)
      ) {
        compliance.violations.push('Missing physical mailing address');
        compliance.requirements.hasPhysicalAddress = false;
        compliance.isCompliant = false;
      } else {
        compliance.requirements.hasPhysicalAddress = true;
      }

      // Check for proper identification
      const identificationRegex =
        /this\s+email\s+was\s+sent\s+by|you\s+are\s+receiving\s+this/i;
      if (
        !identificationRegex.test(emailContent.htmlContent) &&
        !identificationRegex.test(emailContent.textContent)
      ) {
        compliance.warnings.push('Consider adding clear sender identification');
        compliance.requirements.hasProperIdentification = false;
      } else {
        compliance.requirements.hasProperIdentification = true;
      }

      // Check reply-to address
      if (
        emailContent.replyToAddress &&
        this.isValidEmail(emailContent.replyToAddress)
      ) {
        compliance.requirements.hasValidReplyTo = true;
      } else {
        compliance.warnings.push('Consider adding a valid reply-to address');
      }

      // Check subject line for deceptive content
      const deceptiveKeywords = [
        'free',
        'urgent',
        'act now',
        'limited time',
        'winner',
      ];
      const hasDeceptiveKeywords = deceptiveKeywords.some(keyword =>
        emailContent.subject.toLowerCase().includes(keyword)
      );

      if (hasDeceptiveKeywords) {
        compliance.warnings.push(
          'Subject line may contain promotional language that could be flagged'
        );
      }

      return compliance;
    } catch (error) {
      logger.error('Error validating CAN-SPAM compliance', {
        error,
        emailContent,
      });
      throw new Error('Failed to validate CAN-SPAM compliance');
    }
  }

  async enforceCANSPAMCompliance(
    emailId: string,
    complianceCheck: CANSPAMCompliance
  ): Promise<void> {
    try {
      if (!complianceCheck.isCompliant) {
        // Block email sending
        await database.query(
          'UPDATE newsletters SET status = $1, compliance_notes = $2, updated_at = $3 WHERE id = $4',
          [
            'blocked',
            JSON.stringify(complianceCheck.violations),
            new Date(),
            emailId,
          ]
        );

        // Record violations in the violations table
        for (const violation of complianceCheck.violations) {
          const violationType = this.mapViolationToType(violation);
          const severity = this.getViolationSeverity(violationType);

          await database.query(
            `INSERT INTO can_spam_violations
             (id, email_id, violation_type, description, severity, detected_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              this.generateId(),
              emailId,
              violationType,
              violation,
              severity,
              new Date(),
              new Date(),
            ]
          );
        }

        // Log audit entry
        await this.createAuditLog({
          action: 'email_blocked_compliance',
          entityType: 'newsletter',
          entityId: emailId,
          userId: null,
          details: {
            violations: complianceCheck.violations,
            warnings: complianceCheck.warnings,
            reason: 'CAN-SPAM compliance failure',
            complianceCheck: complianceCheck.requirements,
          },
        });

        logger.warn('Email blocked for CAN-SPAM compliance violations', {
          emailId,
          violations: complianceCheck.violations,
          warnings: complianceCheck.warnings,
        });
      } else if (complianceCheck.warnings.length > 0) {
        // Log warnings for compliant but potentially problematic emails
        await this.createAuditLog({
          action: 'email_compliance_warnings',
          entityType: 'newsletter',
          entityId: emailId,
          userId: null,
          details: {
            warnings: complianceCheck.warnings,
            complianceCheck: complianceCheck.requirements,
          },
        });

        logger.info('Email passed compliance but has warnings', {
          emailId,
          warnings: complianceCheck.warnings,
        });
      }
    } catch (error) {
      logger.error('Error enforcing CAN-SPAM compliance', { error, emailId });
      throw new Error('Failed to enforce CAN-SPAM compliance');
    }
  }

  private mapViolationToType(violation: string): string {
    const violationMap: Record<string, string> = {
      'Missing unsubscribe link': 'missing_unsubscribe',
      'Missing physical mailing address': 'missing_address',
      'Deceptive subject line': 'deceptive_subject',
      'False or misleading header information': 'false_header',
    };

    return violationMap[violation] || 'other';
  }

  private getViolationSeverity(violationType: string): string {
    const severityMap: Record<string, string> = {
      missing_unsubscribe: 'critical',
      missing_address: 'high',
      deceptive_subject: 'medium',
      false_header: 'high',
      other: 'medium',
    };

    return severityMap[violationType] || 'medium';
  }

  // Audit Logging Methods
  async createAuditLog(logData: {
    action: string;
    entityType: string;
    entityId: string;
    userId?: string | null;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLogEntry> {
    try {
      const auditEntry: AuditLogEntry = {
        id: this.generateId(),
        action: logData.action,
        entityType: logData.entityType,
        entityId: logData.entityId,
        userId: logData.userId || null,
        timestamp: new Date(),
        ipAddress: logData.ipAddress || null,
        userAgent: logData.userAgent || null,
        details: logData.details || {},
        createdAt: new Date(),
      };

      const query = `
        INSERT INTO audit_logs
        (id, action, entity_type, entity_id, user_id, timestamp,
         ip_address, user_agent, details, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const values = [
        auditEntry.id,
        auditEntry.action,
        auditEntry.entityType,
        auditEntry.entityId,
        auditEntry.userId,
        auditEntry.timestamp,
        auditEntry.ipAddress,
        auditEntry.userAgent,
        JSON.stringify(auditEntry.details),
        auditEntry.createdAt,
      ];

      const result = await database.query(query, values);

      // Also store in Redis for quick access to recent logs
      await redis.lpush(
        `audit_logs:${logData.entityType}:${logData.entityId}`,
        JSON.stringify(auditEntry)
      );
      await redis.ltrim(
        `audit_logs:${logData.entityType}:${logData.entityId}`,
        0,
        99
      ); // Keep last 100 entries

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating audit log', { error, logData });
      throw new Error('Failed to create audit log');
    }
  }

  async getAuditLogs(filters: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLogEntry[]; total: number }> {
    try {
      let whereConditions = [];
      let values = [];
      let paramCount = 0;

      if (filters.entityType) {
        whereConditions.push(`entity_type = $${++paramCount}`);
        values.push(filters.entityType);
      }

      if (filters.entityId) {
        whereConditions.push(`entity_id = $${++paramCount}`);
        values.push(filters.entityId);
      }

      if (filters.userId) {
        whereConditions.push(`user_id = $${++paramCount}`);
        values.push(filters.userId);
      }

      if (filters.action) {
        whereConditions.push(`action = $${++paramCount}`);
        values.push(filters.action);
      }

      if (filters.startDate) {
        whereConditions.push(`timestamp >= $${++paramCount}`);
        values.push(filters.startDate);
      }

      if (filters.endDate) {
        whereConditions.push(`timestamp <= $${++paramCount}`);
        values.push(filters.endDate);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause}`;
      const countResult = await database.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get logs with pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const logsQuery = `
        SELECT * FROM audit_logs
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;
      values.push(limit, offset);

      const logsResult = await database.query(logsQuery, values);

      return {
        logs: logsResult.rows,
        total,
      };
    } catch (error) {
      logger.error('Error getting audit logs', { error, filters });
      throw new Error('Failed to get audit logs');
    }
  }

  // Compliance Reporting Methods
  async generateComplianceReport(
    reportType: 'gdpr' | 'can_spam' | 'audit',
    filters?: {
      startDate?: Date;
      endDate?: Date;
      contactId?: string;
    }
  ): Promise<ComplianceReport> {
    try {
      const report: ComplianceReport = {
        id: this.generateId(),
        reportType,
        generatedAt: new Date(),
        period: {
          startDate:
            filters?.startDate ||
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: filters?.endDate || new Date(),
        },
        summary: {},
        details: {},
        recommendations: [],
      };

      switch (reportType) {
        case 'gdpr':
          report.summary = await this.generateGDPRSummary(report.period);
          report.details = await this.generateGDPRDetails(
            report.period,
            filters?.contactId
          );
          report.recommendations = this.generateGDPRRecommendations(
            report.summary
          );
          break;

        case 'can_spam':
          report.summary = await this.generateCANSPAMSummary(report.period);
          report.details = await this.generateCANSPAMDetails(report.period);
          report.recommendations = this.generateCANSPAMRecommendations(
            report.summary
          );
          break;

        case 'audit':
          report.summary = await this.generateAuditSummary(report.period);
          report.details = await this.generateAuditDetails(report.period);
          report.recommendations = this.generateAuditRecommendations(
            report.summary
          );
          break;
      }

      // Store report
      const query = `
        INSERT INTO compliance_reports
        (id, report_type, generated_at, period_start, period_end, summary, details, recommendations)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        report.id,
        report.reportType,
        report.generatedAt,
        report.period.startDate,
        report.period.endDate,
        JSON.stringify(report.summary),
        JSON.stringify(report.details),
        JSON.stringify(report.recommendations),
      ];

      await database.query(query, values);

      logger.info('Compliance report generated', {
        reportId: report.id,
        reportType,
        period: report.period,
      });

      return report;
    } catch (error) {
      logger.error('Error generating compliance report', {
        error,
        reportType,
        filters,
      });
      throw new Error('Failed to generate compliance report');
    }
  }

  // Data Portability Methods
  async exportUserData(
    contactId: string,
    requestId: string
  ): Promise<DataPortabilityRequest> {
    try {
      // Collect all user data
      const userData = await this.collectUserData(contactId);

      // Create export file
      const exportData = {
        exportedAt: new Date(),
        contactId,
        requestId,
        data: userData,
      };

      const exportUrl = await this.createDataExport(exportData);

      // Update data request
      await database.query(
        'UPDATE gdpr_data_requests SET status = $1, data_export_url = $2, completed_at = $3 WHERE id = $4',
        ['completed', exportUrl, new Date(), requestId]
      );

      // Log audit entry
      await this.createAuditLog({
        action: 'data_exported',
        entityType: 'data_request',
        entityId: requestId,
        userId: null,
        details: {
          contactId,
          exportUrl,
          dataTypes: Object.keys(userData),
        },
      });

      return {
        requestId,
        contactId,
        exportUrl,
        exportedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        format: 'json',
        status: 'completed',
      };
    } catch (error) {
      logger.error('Error exporting user data', {
        error,
        contactId,
        requestId,
      });
      throw new Error('Failed to export user data');
    }
  }

  // Helper Methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async scheduleDataRequestProcessing(
    request: GDPRDataRequest
  ): Promise<void> {
    // Schedule processing based on request type
    const processingDelay =
      request.requestType === 'erasure'
        ? 30 * 24 * 60 * 60 * 1000 // 30 days for erasure requests
        : 24 * 60 * 60 * 1000; // 24 hours for other requests

    // Store scheduled task in Redis for persistence
    const taskData = {
      requestId: request.id,
      contactId: request.contactId,
      requestType: request.requestType,
      scheduledFor: new Date(Date.now() + processingDelay),
      status: 'scheduled',
    };

    await redis.set(
      `scheduled_task:${request.id}`,
      JSON.stringify(taskData),
      Math.ceil(processingDelay / 1000)
    );

    // In a real implementation, this would use a job queue like Bull/BullMQ
    setTimeout(async () => {
      try {
        // Check if task is still valid
        const taskExists = await redis.exists(`scheduled_task:${request.id}`);
        if (!taskExists) {
          logger.info('Scheduled task was cancelled or already processed', {
            requestId: request.id,
          });
          return;
        }

        if (request.requestType === 'erasure') {
          await this.processRightToBeForgotten(request.contactId, request.id);
        } else if (request.requestType === 'portability') {
          await this.exportUserData(request.contactId, request.id);
        } else if (request.requestType === 'access') {
          await this.processDataAccessRequest(request.contactId, request.id);
        }

        // Remove scheduled task
        await redis.del(`scheduled_task:${request.id}`);
      } catch (error) {
        logger.error('Error processing scheduled data request', {
          error,
          requestId: request.id,
        });

        // Log audit entry for failed processing
        await this.createAuditLog({
          action: 'data_request_processing_failed',
          entityType: 'data_request',
          entityId: request.id,
          userId: null,
          details: {
            error: error instanceof Error ? error.message : String(error),
            requestType: request.requestType,
          },
        });
      }
    }, processingDelay);
  }

  private async collectUserData(contactId: string): Promise<any> {
    // Collect data from various tables with comprehensive coverage
    const queries = {
      contact: 'SELECT * FROM contacts WHERE id = $1',
      preferences: 'SELECT * FROM contact_preferences WHERE contact_id = $1',
      engagements:
        'SELECT * FROM engagement_events WHERE contact_id = $1 ORDER BY timestamp DESC',
      consents:
        'SELECT * FROM gdpr_consent_records WHERE contact_id = $1 ORDER BY timestamp DESC',
      segments: `
        SELECT s.*, cs.added_at
        FROM segments s
        JOIN contact_segments cs ON s.id = cs.segment_id
        WHERE cs.contact_id = $1
      `,
      newsletters: `
        SELECT n.id, n.title, n.sent_at, ne.opened_at, ne.clicked_at
        FROM newsletters n
        LEFT JOIN newsletter_engagements ne ON n.id = ne.newsletter_id AND ne.contact_id = $1
        WHERE n.status = 'sent'
        ORDER BY n.sent_at DESC
      `,
      campaigns: `
        SELECT c.id, c.name, c.type, ce.enrolled_at, ce.completed_at, ce.status
        FROM email_campaigns c
        LEFT JOIN campaign_enrollments ce ON c.id = ce.campaign_id AND ce.contact_id = $1
        ORDER BY ce.enrolled_at DESC
      `,
      dataRequests:
        'SELECT * FROM gdpr_data_requests WHERE contact_id = $1 ORDER BY requested_at DESC',
      auditLogs:
        "SELECT * FROM audit_logs WHERE entity_id = $1 AND entity_type = 'contact' ORDER BY timestamp DESC LIMIT 100",
    };

    const userData: any = {
      exportMetadata: {
        contactId,
        exportedAt: new Date(),
        dataRetentionPolicy:
          'Data will be retained according to our privacy policy',
        contactRights: [
          'Right to access your personal data',
          'Right to rectify inaccurate data',
          'Right to erase your data (right to be forgotten)',
          'Right to restrict processing',
          'Right to data portability',
          'Right to object to processing',
        ],
      },
    };

    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await database.query(query, [contactId]);
        userData[key] = result.rows;

        // Add metadata about the data collected
        userData[`${key}_metadata`] = {
          recordCount: result.rows.length,
          lastUpdated:
            result.rows.length > 0 && result.rows[0].updated_at
              ? result.rows[0].updated_at
              : null,
          dataSource: 'primary_database',
        };
      } catch (error) {
        logger.error(`Error collecting ${key} data`, { error, contactId });
        userData[key] = [];
        userData[`${key}_metadata`] = {
          recordCount: 0,
          error: 'Failed to retrieve data',
          dataSource: 'primary_database',
        };
      }
    }

    // Add summary statistics
    userData.summary = {
      totalEngagements: userData.engagements?.length || 0,
      totalConsents: userData.consents?.length || 0,
      activeConsents:
        userData.consents?.filter((c: any) => c.is_active)?.length || 0,
      totalSegments: userData.segments?.length || 0,
      totalNewslettersReceived: userData.newsletters?.length || 0,
      totalCampaignEnrollments: userData.campaigns?.length || 0,
      totalDataRequests: userData.dataRequests?.length || 0,
      accountCreatedAt: userData.contact?.[0]?.created_at || null,
      lastEngagement: userData.engagements?.[0]?.timestamp || null,
    };

    return userData;
  }

  async processDataAccessRequest(
    contactId: string,
    requestId: string
  ): Promise<void> {
    try {
      // Update request status to processing
      await database.query(
        'UPDATE gdpr_data_requests SET status = $1, processed_at = $2, updated_at = $3 WHERE id = $4',
        ['processing', new Date(), new Date(), requestId]
      );

      // Collect user data
      const userData = await this.collectUserData(contactId);

      // Create access report
      const accessReport = {
        requestId,
        contactId,
        generatedAt: new Date(),
        dataCollected: userData,
        summary: {
          totalRecords: Object.values(userData).reduce(
            (sum: number, records: any) =>
              sum + (Array.isArray(records) ? records.length : 1),
            0
          ),
          dataTypes: Object.keys(userData),
        },
      };

      // Store access report
      const reportUrl = await this.createDataExport(accessReport);

      // Update request with completion
      await database.query(
        'UPDATE gdpr_data_requests SET status = $1, data_export_url = $2, completed_at = $3, updated_at = $4 WHERE id = $5',
        ['completed', reportUrl, new Date(), new Date(), requestId]
      );

      // Log audit entry
      await this.createAuditLog({
        action: 'data_access_completed',
        entityType: 'data_request',
        entityId: requestId,
        userId: null,
        details: {
          contactId,
          reportUrl,
          totalRecords: accessReport.summary.totalRecords,
        },
      });

      logger.info('Data access request completed', {
        requestId,
        contactId,
        reportUrl,
      });
    } catch (error) {
      // Update request status to failed
      await database.query(
        'UPDATE gdpr_data_requests SET status = $1, processing_notes = $2, updated_at = $3 WHERE id = $4',
        [
          'rejected',
          error instanceof Error ? error.message : String(error),
          new Date(),
          requestId,
        ]
      );

      logger.error('Error processing data access request', {
        error,
        contactId,
        requestId,
      });
      throw error;
    }
  }

  private async createDataExport(exportData: any): Promise<string> {
    const exportId = this.generateId();

    // In production, this would upload to S3, Google Cloud Storage, or similar
    // For now, we'll store in Redis with expiration
    const exportUrl = `${process.env.BASE_URL || 'https://api.ailert.com'}/compliance/exports/${exportId}`;

    // Store export data with 7-day expiration
    await redis.setex(
      `data_export:${exportId}`,
      7 * 24 * 60 * 60, // 7 days in seconds
      JSON.stringify(exportData)
    );

    // Track active exports for cleanup
    await redis.sadd('active_exports', exportId);

    // Also store metadata for tracking
    await redis.setex(
      `export_metadata:${exportId}`,
      7 * 24 * 60 * 60,
      JSON.stringify({
        id: exportId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        size: JSON.stringify(exportData).length,
        type: exportData.requestId ? 'data_request' : 'manual_export',
      })
    );

    return exportUrl;
  }

  private async generateGDPRSummary(period: {
    startDate: Date;
    endDate: Date;
  }): Promise<any> {
    const queries = {
      totalConsents:
        'SELECT COUNT(*) FROM gdpr_consent_records WHERE timestamp BETWEEN $1 AND $2',
      activeConsents:
        'SELECT COUNT(*) FROM gdpr_consent_records WHERE timestamp BETWEEN $1 AND $2 AND is_active = true',
      withdrawnConsents:
        'SELECT COUNT(*) FROM gdpr_consent_records WHERE withdrawn_at BETWEEN $1 AND $2',
      dataRequests:
        'SELECT COUNT(*) FROM gdpr_data_requests WHERE requested_at BETWEEN $1 AND $2',
      deletionRequests:
        'SELECT COUNT(*) FROM data_deletion_requests WHERE requested_at BETWEEN $1 AND $2',
    };

    const summary: any = {};
    for (const [key, query] of Object.entries(queries)) {
      const result = await database.query(query, [
        period.startDate,
        period.endDate,
      ]);
      summary[key] = parseInt(result.rows[0].count);
    }

    return summary;
  }

  private async generateGDPRDetails(
    period: { startDate: Date; endDate: Date },
    contactId?: string
  ): Promise<any> {
    const details: any = {
      consentsByType: {},
      dataRequestsByType: {},
      processingTimes: {},
      complianceIssues: [],
    };

    // Get consent breakdown by type
    const consentQuery = `
      SELECT consent_type, consent_given, COUNT(*) as count
      FROM gdpr_consent_records
      WHERE timestamp BETWEEN $1 AND $2
      ${contactId ? 'AND contact_id = $3' : ''}
      GROUP BY consent_type, consent_given
    `;
    const consentParams = contactId
      ? [period.startDate, period.endDate, contactId]
      : [period.startDate, period.endDate];

    const consentResult = await database.query(consentQuery, consentParams);
    details.consentsByType = consentResult.rows.reduce((acc: any, row: any) => {
      if (!acc[row.consent_type]) acc[row.consent_type] = {};
      acc[row.consent_type][row.consent_given ? 'given' : 'withdrawn'] =
        parseInt(row.count);
      return acc;
    }, {});

    // Get data requests breakdown
    const requestQuery = `
      SELECT request_type, status, COUNT(*) as count
      FROM gdpr_data_requests
      WHERE requested_at BETWEEN $1 AND $2
      ${contactId ? 'AND contact_id = $3' : ''}
      GROUP BY request_type, status
    `;
    const requestResult = await database.query(requestQuery, consentParams);
    details.dataRequestsByType = requestResult.rows.reduce(
      (acc: any, row: any) => {
        if (!acc[row.request_type]) acc[row.request_type] = {};
        acc[row.request_type][row.status] = parseInt(row.count);
        return acc;
      },
      {}
    );

    // Calculate average processing times
    const processingQuery = `
      SELECT request_type,
             AVG(EXTRACT(EPOCH FROM (completed_at - requested_at))/3600) as avg_hours
      FROM gdpr_data_requests
      WHERE requested_at BETWEEN $1 AND $2
      AND completed_at IS NOT NULL
      ${contactId ? 'AND contact_id = $3' : ''}
      GROUP BY request_type
    `;
    const processingResult = await database.query(
      processingQuery,
      consentParams
    );
    details.processingTimes = processingResult.rows.reduce(
      (acc: any, row: any) => {
        acc[row.request_type] = parseFloat(row.avg_hours);
        return acc;
      },
      {}
    );

    return details;
  }

  private generateGDPRRecommendations(summary: any): string[] {
    const recommendations = [];

    if (summary.withdrawnConsents > summary.activeConsents * 0.1) {
      recommendations.push(
        'High consent withdrawal rate detected. Review consent collection practices.'
      );
    }

    if (summary.dataRequests > 0) {
      recommendations.push(
        'Ensure all data requests are processed within 30 days as required by GDPR.'
      );
    }

    return recommendations;
  }

  private async generateCANSPAMSummary(period: {
    startDate: Date;
    endDate: Date;
  }): Promise<any> {
    const queries = {
      totalViolations: `
        SELECT COUNT(*) FROM can_spam_violations
        WHERE detected_at BETWEEN $1 AND $2
      `,
      violationsBySeverity: `
        SELECT severity, COUNT(*) as count
        FROM can_spam_violations
        WHERE detected_at BETWEEN $1 AND $2
        GROUP BY severity
      `,
      violationsByType: `
        SELECT violation_type, COUNT(*) as count
        FROM can_spam_violations
        WHERE detected_at BETWEEN $1 AND $2
        GROUP BY violation_type
      `,
      resolvedViolations: `
        SELECT COUNT(*) FROM can_spam_violations
        WHERE detected_at BETWEEN $1 AND $2 AND resolved = true
      `,
      emailsScanned: `
        SELECT COUNT(DISTINCT email_id) FROM can_spam_violations
        WHERE detected_at BETWEEN $1 AND $2
      `,
    };

    const summary: any = {};
    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await database.query(query, [
          period.startDate,
          period.endDate,
        ]);
        if (key === 'violationsBySeverity' || key === 'violationsByType') {
          summary[key] = result.rows.reduce((acc: any, row: any) => {
            acc[row.severity || row.violation_type] = parseInt(row.count);
            return acc;
          }, {});
        } else {
          summary[key] = parseInt(result.rows[0].count);
        }
      } catch (error) {
        logger.error(`Error generating CAN-SPAM summary for ${key}`, { error });
        summary[key] = 0;
      }
    }

    return summary;
  }

  private async generateCANSPAMDetails(period: {
    startDate: Date;
    endDate: Date;
  }): Promise<any> {
    const details: any = {
      recentViolations: [],
      topViolationTypes: [],
      resolutionTimes: {},
      complianceScore: 0,
    };

    // Get recent violations
    const recentViolationsQuery = `
      SELECT * FROM can_spam_violations
      WHERE detected_at BETWEEN $1 AND $2
      ORDER BY detected_at DESC
      LIMIT 50
    `;
    const recentResult = await database.query(recentViolationsQuery, [
      period.startDate,
      period.endDate,
    ]);
    details.recentViolations = recentResult.rows;

    // Get top violation types
    const topTypesQuery = `
      SELECT violation_type, COUNT(*) as count, severity
      FROM can_spam_violations
      WHERE detected_at BETWEEN $1 AND $2
      GROUP BY violation_type, severity
      ORDER BY count DESC
      LIMIT 10
    `;
    const topTypesResult = await database.query(topTypesQuery, [
      period.startDate,
      period.endDate,
    ]);
    details.topViolationTypes = topTypesResult.rows;

    // Calculate average resolution times
    const resolutionQuery = `
      SELECT violation_type,
             AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at))/3600) as avg_hours
      FROM can_spam_violations
      WHERE detected_at BETWEEN $1 AND $2
      AND resolved = true AND resolved_at IS NOT NULL
      GROUP BY violation_type
    `;
    const resolutionResult = await database.query(resolutionQuery, [
      period.startDate,
      period.endDate,
    ]);
    details.resolutionTimes = resolutionResult.rows.reduce(
      (acc: any, row: any) => {
        acc[row.violation_type] = parseFloat(row.avg_hours);
        return acc;
      },
      {}
    );

    // Calculate compliance score (percentage of emails without violations)
    const totalEmailsQuery = `
      SELECT COUNT(DISTINCT email_id) as total_emails,
             COUNT(DISTINCT CASE WHEN resolved = false THEN email_id END) as violation_emails
      FROM can_spam_violations
      WHERE detected_at BETWEEN $1 AND $2
    `;
    const scoreResult = await database.query(totalEmailsQuery, [
      period.startDate,
      period.endDate,
    ]);

    if (scoreResult.rows[0].total_emails > 0) {
      const totalEmails = parseInt(scoreResult.rows[0].total_emails);
      const violationEmails = parseInt(
        scoreResult.rows[0].violation_emails || 0
      );
      details.complianceScore =
        ((totalEmails - violationEmails) / totalEmails) * 100;
    } else {
      details.complianceScore = 100;
    }

    return details;
  }

  private generateCANSPAMRecommendations(summary: any): string[] {
    return [
      'Ensure all emails include clear unsubscribe links',
      'Include physical mailing address in all commercial emails',
      'Monitor subject lines for deceptive content',
    ];
  }

  private async generateAuditSummary(period: {
    startDate: Date;
    endDate: Date;
  }): Promise<any> {
    const query = `
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY action
    `;

    const result = await database.query(query, [
      period.startDate,
      period.endDate,
    ]);

    return result.rows.reduce((acc: any, row: any) => {
      acc[row.action] = parseInt(row.count);
      return acc;
    }, {});
  }

  private async generateAuditDetails(period: {
    startDate: Date;
    endDate: Date;
  }): Promise<any> {
    const details: any = {
      recentEvents: [],
      userActivity: {},
      entityActivity: {},
      criticalEvents: [],
      complianceEvents: [],
    };

    // Get recent audit events
    const recentEventsQuery = `
      SELECT * FROM audit_logs
      WHERE timestamp BETWEEN $1 AND $2
      ORDER BY timestamp DESC
      LIMIT 100
    `;
    const recentResult = await database.query(recentEventsQuery, [
      period.startDate,
      period.endDate,
    ]);
    details.recentEvents = recentResult.rows;

    // Get user activity breakdown
    const userActivityQuery = `
      SELECT user_id, action, COUNT(*) as count
      FROM audit_logs
      WHERE timestamp BETWEEN $1 AND $2 AND user_id IS NOT NULL
      GROUP BY user_id, action
      ORDER BY count DESC
    `;
    const userResult = await database.query(userActivityQuery, [
      period.startDate,
      period.endDate,
    ]);
    details.userActivity = userResult.rows.reduce((acc: any, row: any) => {
      if (!acc[row.user_id]) acc[row.user_id] = {};
      acc[row.user_id][row.action] = parseInt(row.count);
      return acc;
    }, {});

    // Get entity activity breakdown
    const entityActivityQuery = `
      SELECT entity_type, action, COUNT(*) as count
      FROM audit_logs
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY entity_type, action
      ORDER BY count DESC
    `;
    const entityResult = await database.query(entityActivityQuery, [
      period.startDate,
      period.endDate,
    ]);
    details.entityActivity = entityResult.rows.reduce((acc: any, row: any) => {
      if (!acc[row.entity_type]) acc[row.entity_type] = {};
      acc[row.entity_type][row.action] = parseInt(row.count);
      return acc;
    }, {});

    // Get critical events (data deletions, consent withdrawals, etc.)
    const criticalEventsQuery = `
      SELECT * FROM audit_logs
      WHERE timestamp BETWEEN $1 AND $2
      AND action IN ('data_deleted', 'consent_withdrawn', 'deletion_request_created', 'email_blocked_compliance')
      ORDER BY timestamp DESC
    `;
    const criticalResult = await database.query(criticalEventsQuery, [
      period.startDate,
      period.endDate,
    ]);
    details.criticalEvents = criticalResult.rows;

    // Get compliance-related events
    const complianceEventsQuery = `
      SELECT * FROM audit_logs
      WHERE timestamp BETWEEN $1 AND $2
      AND (action LIKE '%consent%' OR action LIKE '%compliance%' OR action LIKE '%gdpr%')
      ORDER BY timestamp DESC
    `;
    const complianceResult = await database.query(complianceEventsQuery, [
      period.startDate,
      period.endDate,
    ]);
    details.complianceEvents = complianceResult.rows;

    return details;
  }

  private generateAuditRecommendations(summary: any): string[] {
    return [
      'Regularly review audit logs for suspicious activity',
      'Ensure all compliance actions are properly logged',
      'Implement automated alerts for critical compliance events',
    ];
  }

  // Compliance Violation Management
  async resolveViolation(
    violationId: string,
    resolutionNotes: string,
    resolvedBy?: string
  ): Promise<void> {
    try {
      await database.query(
        'UPDATE can_spam_violations SET resolved = $1, resolved_at = $2, updated_at = $3 WHERE id = $4',
        [true, new Date(), new Date(), violationId]
      );

      // Log audit entry
      await this.createAuditLog({
        action: 'violation_resolved',
        entityType: 'violation',
        entityId: violationId,
        userId: resolvedBy || null,
        details: {
          resolutionNotes,
          resolvedAt: new Date(),
        },
      });

      logger.info('Compliance violation resolved', {
        violationId,
        resolvedBy,
        resolutionNotes,
      });
    } catch (error) {
      logger.error('Error resolving violation', { error, violationId });
      throw new Error('Failed to resolve violation');
    }
  }

  async getViolationsByEmail(emailId: string): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM can_spam_violations
        WHERE email_id = $1
        ORDER BY detected_at DESC
      `;
      const result = await database.query(query, [emailId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting violations by email', { error, emailId });
      throw new Error('Failed to get violations');
    }
  }

  async getUnresolvedViolations(limit: number = 50): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM can_spam_violations
        WHERE resolved = false
        ORDER BY detected_at DESC
        LIMIT $1
      `;
      const result = await database.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting unresolved violations', { error });
      throw new Error('Failed to get unresolved violations');
    }
  }

  // Data Retention and Cleanup
  async cleanupExpiredData(): Promise<{
    deletedConsents: number;
    deletedRequests: number;
    deletedAuditLogs: number;
    deletedExports: number;
  }> {
    try {
      const retentionPeriods = {
        consents: 7 * 365, // 7 years for consent records
        requests: 3 * 365, // 3 years for data requests
        auditLogs: 7 * 365, // 7 years for audit logs
        exports: 7, // 7 days for data exports
      };

      const results = {
        deletedConsents: 0,
        deletedRequests: 0,
        deletedAuditLogs: 0,
        deletedExports: 0,
      };

      // Clean up old consent records (only withdrawn ones older than retention period)
      const consentCutoff = new Date(
        Date.now() - retentionPeriods.consents * 24 * 60 * 60 * 1000
      );
      const consentResult = await database.query(
        'DELETE FROM gdpr_consent_records WHERE withdrawn_at < $1 AND is_active = false',
        [consentCutoff]
      );
      results.deletedConsents = consentResult.rowCount || 0;

      // Clean up old completed data requests
      const requestCutoff = new Date(
        Date.now() - retentionPeriods.requests * 24 * 60 * 60 * 1000
      );
      const requestResult = await database.query(
        "DELETE FROM gdpr_data_requests WHERE completed_at < $1 AND status = 'completed'",
        [requestCutoff]
      );
      results.deletedRequests = requestResult.rowCount || 0;

      // Clean up old audit logs (keep critical events longer)
      const auditCutoff = new Date(
        Date.now() - retentionPeriods.auditLogs * 24 * 60 * 60 * 1000
      );
      const auditResult = await database.query(
        `DELETE FROM audit_logs
         WHERE timestamp < $1
         AND action NOT IN ('data_deleted', 'consent_withdrawn', 'deletion_request_created')`,
        [auditCutoff]
      );
      results.deletedAuditLogs = auditResult.rowCount || 0;

      // Clean up expired data exports from Redis
      // Note: In production, implement a proper Redis key scanning mechanism
      let deletedExports = 0;
      try {
        // For now, we'll track exports in a separate Redis set for easier cleanup
        const exportIds = await redis.smembers('active_exports');
        for (const exportId of exportIds) {
          const exists = await redis.exists(`data_export:${exportId}`);
          if (!exists) {
            await redis.srem('active_exports', exportId);
            deletedExports++;
          }
        }
      } catch (redisError) {
        logger.warn('Could not clean up Redis exports', { error: redisError });
      }
      results.deletedExports = deletedExports;

      // Log cleanup activity
      await this.createAuditLog({
        action: 'data_cleanup_completed',
        entityType: 'system',
        entityId: 'cleanup_job',
        userId: null,
        details: results,
      });

      logger.info('Data cleanup completed', results);
      return results;
    } catch (error) {
      logger.error('Error during data cleanup', { error });
      throw new Error('Failed to cleanup expired data');
    }
  }

  // Compliance Health Check
  async performComplianceHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
    metrics: any;
  }> {
    try {
      const issues: string[] = [];
      const recommendations: string[] = [];
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      // Check for unresolved violations
      const unresolvedViolations = await this.getUnresolvedViolations(100);
      if (unresolvedViolations.length > 10) {
        issues.push(
          `${unresolvedViolations.length} unresolved CAN-SPAM violations`
        );
        recommendations.push(
          'Review and resolve pending compliance violations'
        );
        status = 'warning';
      }

      // Check for pending data requests
      const pendingRequestsQuery = `
        SELECT COUNT(*) as count FROM gdpr_data_requests
        WHERE status = 'pending' AND requested_at < NOW() - INTERVAL '24 hours'
      `;
      const pendingResult = await database.query(pendingRequestsQuery);
      const pendingRequests = parseInt(pendingResult.rows[0].count);

      if (pendingRequests > 0) {
        issues.push(
          `${pendingRequests} data requests pending for over 24 hours`
        );
        recommendations.push(
          'Process pending GDPR data requests within required timeframes'
        );
        if (pendingRequests > 5) status = 'critical';
        else if (status === 'healthy') status = 'warning';
      }

      // Check consent withdrawal rate
      const consentMetricsQuery = `
        SELECT
          COUNT(*) FILTER (WHERE consent_given = true AND is_active = true) as active_consents,
          COUNT(*) FILTER (WHERE withdrawn_at > NOW() - INTERVAL '30 days') as recent_withdrawals
        FROM gdpr_consent_records
        WHERE consent_type = 'marketing'
      `;
      const consentResult = await database.query(consentMetricsQuery);
      const { active_consents, recent_withdrawals } = consentResult.rows[0];

      if (active_consents > 0 && recent_withdrawals / active_consents > 0.1) {
        issues.push(
          'High consent withdrawal rate detected (>10% in last 30 days)'
        );
        recommendations.push(
          'Review consent collection practices and email content quality'
        );
        if (status === 'healthy') status = 'warning';
      }

      // Check audit log integrity
      const auditGapsQuery = `
        SELECT COUNT(*) as count FROM (
          SELECT timestamp,
                 LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp
          FROM audit_logs
          WHERE timestamp > NOW() - INTERVAL '7 days'
        ) t
        WHERE EXTRACT(EPOCH FROM (timestamp - prev_timestamp)) > 3600
      `;
      const auditResult = await database.query(auditGapsQuery);
      const auditGaps = parseInt(auditResult.rows[0].count);

      if (auditGaps > 5) {
        issues.push('Potential gaps in audit logging detected');
        recommendations.push(
          'Investigate audit logging system for potential issues'
        );
        if (status === 'healthy') status = 'warning';
      }

      const metrics = {
        unresolvedViolations: unresolvedViolations.length,
        pendingDataRequests: pendingRequests,
        activeConsents: parseInt(active_consents),
        recentWithdrawals: parseInt(recent_withdrawals),
        auditLogGaps: auditGaps,
        lastHealthCheck: new Date(),
      };

      // Log health check
      await this.createAuditLog({
        action: 'compliance_health_check',
        entityType: 'system',
        entityId: 'health_check',
        userId: null,
        details: { status, issues, metrics },
      });

      return { status, issues, recommendations, metrics };
    } catch (error) {
      logger.error('Error performing compliance health check', { error });
      return {
        status: 'critical',
        issues: ['Failed to perform compliance health check'],
        recommendations: ['Investigate system health check functionality'],
        metrics: {},
      };
    }
  }
}
