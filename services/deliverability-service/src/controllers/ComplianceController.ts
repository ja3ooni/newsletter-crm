import { Request, Response } from 'express';
import { ComplianceService } from '../services/ComplianceService';
import {
  ComplianceReportRequest,
  ConsentRequest,
  DataRequestSubmission,
  EmailComplianceCheck,
} from '../types/compliance';
import { database } from '../utils/database';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';
import {
  complianceReportSchema,
  consentSchema,
  consentWithdrawalSchema,
  dataRequestSchema,
  emailComplianceSchema,
  validateRequest,
} from '../utils/validation';

// Helper function to get client IP address
const getClientIP = (req: Request): string => {
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
};

export class ComplianceController {
  private complianceService: ComplianceService;

  constructor() {
    this.complianceService = new ComplianceService();
  }

  // GDPR Consent Management
  async recordConsent(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateRequest(consentSchema, req.body);
      if (!validation.isValid) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid consent data',
          errors: validation.errors,
        });
        return;
      }

      const consentData: ConsentRequest = req.body;
      const ipAddress = getClientIP(req);
      const userAgent = req.get('User-Agent') || 'unknown';

      const consentRecord = await this.complianceService.recordConsent({
        ...consentData,
        ipAddress,
        userAgent,
      });

      res.status(201).json({
        status: 'success',
        data: consentRecord,
        message: 'Consent recorded successfully',
      });
    } catch (error) {
      logger.error('Error recording consent', { error, body: req.body });
      res.status(500).json({
        status: 'error',
        message: 'Failed to record consent',
      });
    }
  }

  async withdrawConsent(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateRequest(consentWithdrawalSchema, req.body);
      if (!validation.isValid) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid consent withdrawal data',
          errors: validation.errors,
        });
        return;
      }

      const { contactId, consentType, reason } = req.body;
      const ipAddress = getClientIP(req);
      const userAgent = req.get('User-Agent') || 'unknown';

      await this.complianceService.withdrawConsent(contactId, consentType, {
        ipAddress,
        userAgent,
        reason,
      });

      res.json({
        status: 'success',
        message: 'Consent withdrawn successfully',
      });
    } catch (error) {
      logger.error('Error withdrawing consent', { error, body: req.body });
      res.status(500).json({
        status: 'error',
        message: 'Failed to withdraw consent',
      });
    }
  }

  async getConsentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;

      if (!contactId) {
        res.status(400).json({
          status: 'error',
          message: 'Contact ID is required',
        });
        return;
      }

      const consentStatus =
        await this.complianceService.getConsentStatus(contactId);

      res.json({
        status: 'success',
        data: consentStatus,
      });
    } catch (error) {
      logger.error('Error getting consent status', {
        error,
        contactId: req.params.contactId,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get consent status',
      });
    }
  }

  // GDPR Data Requests
  async submitDataRequest(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateRequest(dataRequestSchema, req.body);
      if (!validation.isValid) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid data request',
          errors: validation.errors,
        });
        return;
      }

      const requestData: DataRequestSubmission = req.body;
      const requesterIp = getClientIP(req);
      const requesterUserAgent = req.get('User-Agent') || 'unknown';

      const dataRequest = await this.complianceService.processDataRequest({
        ...requestData,
        requesterIp,
        requesterUserAgent,
      });

      res.status(201).json({
        status: 'success',
        data: dataRequest,
        message: 'Data request submitted successfully',
      });
    } catch (error) {
      logger.error('Error submitting data request', { error, body: req.body });
      res.status(500).json({
        status: 'error',
        message: 'Failed to submit data request',
      });
    }
  }

  async getDataRequest(req: Request, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;

      if (!requestId) {
        res.status(400).json({
          status: 'error',
          message: 'Request ID is required',
        });
        return;
      }

      // This would be implemented in the service
      const dataRequest = await this.getDataRequestFromService(requestId);

      res.json({
        status: 'success',
        data: dataRequest,
      });
    } catch (error) {
      logger.error('Error getting data request', {
        error,
        requestId: req.params.requestId,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get data request',
      });
    }
  }

  async processRightToBeForgotten(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      const { requestId } = req.body;

      if (!contactId || !requestId) {
        res.status(400).json({
          status: 'error',
          message: 'Contact ID and request ID are required',
        });
        return;
      }

      const deletionRequest =
        await this.complianceService.processRightToBeForgotten(
          contactId,
          requestId
        );

      res.status(201).json({
        status: 'success',
        data: deletionRequest,
        message: 'Right to be forgotten request processed successfully',
      });
    } catch (error) {
      logger.error('Error processing right to be forgotten', {
        error,
        params: req.params,
        body: req.body,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to process right to be forgotten request',
      });
    }
  }

  async executeDeletion(req: Request, res: Response): Promise<void> {
    try {
      const { deletionRequestId } = req.params;

      if (!deletionRequestId) {
        res.status(400).json({
          status: 'error',
          message: 'Deletion request ID is required',
        });
        return;
      }

      await this.complianceService.executeDataDeletion(deletionRequestId);

      res.json({
        status: 'success',
        message: 'Data deletion executed successfully',
      });
    } catch (error) {
      logger.error('Error executing deletion', {
        error,
        deletionRequestId: req.params.deletionRequestId,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to execute data deletion',
      });
    }
  }

  async exportUserData(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      const { requestId } = req.body;

      if (!contactId || !requestId) {
        res.status(400).json({
          status: 'error',
          message: 'Contact ID and request ID are required',
        });
        return;
      }

      const exportRequest = await this.complianceService.exportUserData(
        contactId,
        requestId
      );

      res.json({
        status: 'success',
        data: exportRequest,
        message: 'User data export completed successfully',
      });
    } catch (error) {
      logger.error('Error exporting user data', {
        error,
        params: req.params,
        body: req.body,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to export user data',
      });
    }
  }

  // CAN-SPAM Compliance
  async validateEmailCompliance(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateRequest(emailComplianceSchema, req.body);
      if (!validation.isValid) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid email compliance data',
          errors: validation.errors,
        });
        return;
      }

      const emailContent: EmailComplianceCheck = req.body;
      const complianceCheck =
        await this.complianceService.validateCANSPAMCompliance(emailContent);

      res.json({
        status: 'success',
        data: complianceCheck,
      });
    } catch (error) {
      logger.error('Error validating email compliance', {
        error,
        body: req.body,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to validate email compliance',
      });
    }
  }

  async enforceCompliance(req: Request, res: Response): Promise<void> {
    try {
      const { emailId } = req.params;
      const { complianceCheck } = req.body;

      if (!emailId || !complianceCheck) {
        res.status(400).json({
          status: 'error',
          message: 'Email ID and compliance check data are required',
        });
        return;
      }

      await this.complianceService.enforceCANSPAMCompliance(
        emailId,
        complianceCheck
      );

      res.json({
        status: 'success',
        message: 'Compliance enforcement completed',
      });
    } catch (error) {
      logger.error('Error enforcing compliance', {
        error,
        params: req.params,
        body: req.body,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to enforce compliance',
      });
    }
  }

  // Audit Logging
  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        entityType,
        entityId,
        userId,
        action,
        startDate,
        endDate,
        limit = '50',
        offset = '0',
      } = req.query;

      const filters: {
        entityType?: string;
        entityId?: string;
        userId?: string;
        action?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
      } = {};

      if (entityType) filters.entityType = entityType as string;
      if (entityId) filters.entityId = entityId as string;
      if (userId) filters.userId = userId as string;
      if (action) filters.action = action as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const auditLogs = await this.complianceService.getAuditLogs(filters);

      res.json({
        status: 'success',
        data: auditLogs,
      });
    } catch (error) {
      logger.error('Error getting audit logs', { error, query: req.query });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get audit logs',
      });
    }
  }

  async createAuditLog(req: Request, res: Response): Promise<void> {
    try {
      const { action, entityType, entityId, userId, details } = req.body;

      if (!action || !entityType || !entityId) {
        res.status(400).json({
          status: 'error',
          message: 'Action, entity type, and entity ID are required',
        });
        return;
      }

      const ipAddress = getClientIP(req);
      const userAgent = req.get('User-Agent') || 'unknown';

      const auditEntry = await this.complianceService.createAuditLog({
        action,
        entityType,
        entityId,
        userId,
        details,
        ipAddress,
        userAgent,
      });

      res.status(201).json({
        status: 'success',
        data: auditEntry,
        message: 'Audit log created successfully',
      });
    } catch (error) {
      logger.error('Error creating audit log', { error, body: req.body });
      res.status(500).json({
        status: 'error',
        message: 'Failed to create audit log',
      });
    }
  }

  // Compliance Reporting
  async generateComplianceReport(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateRequest(complianceReportSchema, req.body);
      if (!validation.isValid) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid compliance report request',
          errors: validation.errors,
        });
        return;
      }

      const reportRequest: ComplianceReportRequest = req.body;
      const filters: {
        startDate?: Date;
        endDate?: Date;
        contactId?: string;
      } = {};

      if (reportRequest.startDate) filters.startDate = reportRequest.startDate;
      if (reportRequest.endDate) filters.endDate = reportRequest.endDate;
      if (reportRequest.contactId) filters.contactId = reportRequest.contactId;

      const report = await this.complianceService.generateComplianceReport(
        reportRequest.reportType,
        filters
      );

      res.status(201).json({
        status: 'success',
        data: report,
        message: 'Compliance report generated successfully',
      });
    } catch (error) {
      logger.error('Error generating compliance report', {
        error,
        body: req.body,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate compliance report',
      });
    }
  }

  async getComplianceReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;

      if (!reportId) {
        res.status(400).json({
          status: 'error',
          message: 'Report ID is required',
        });
        return;
      }

      // This would be implemented in the service
      const report = await this.getComplianceReportFromService(reportId);

      res.json({
        status: 'success',
        data: report,
      });
    } catch (error) {
      logger.error('Error getting compliance report', {
        error,
        reportId: req.params.reportId,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get compliance report',
      });
    }
  }

  async getComplianceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const period = {
        startDate: startDate
          ? new Date(startDate as string)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
      };

      // Generate metrics for all compliance types
      const [gdprReport, canSpamReport, auditReport] = await Promise.all([
        this.complianceService.generateComplianceReport('gdpr', period),
        this.complianceService.generateComplianceReport('can_spam', period),
        this.complianceService.generateComplianceReport('audit', period),
      ]);

      const metrics = {
        gdpr: gdprReport.summary,
        canSpam: canSpamReport.summary,
        audit: auditReport.summary,
        period,
      };

      res.json({
        status: 'success',
        data: metrics,
      });
    } catch (error) {
      logger.error('Error getting compliance metrics', {
        error,
        query: req.query,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get compliance metrics',
      });
    }
  }

  // Webhook Handlers for Compliance Events
  async handleConsentWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Verify webhook signature here if needed
      const consentData = this.parseConsentWebhook(req.body);

      const ipAddress = getClientIP(req);
      const userAgent = req.get('User-Agent') || 'webhook';

      await this.complianceService.recordConsent({
        ...consentData,
        ipAddress,
        userAgent,
      });

      res.status(200).json({
        status: 'success',
        message: 'Consent webhook processed',
      });
    } catch (error) {
      logger.error('Error handling consent webhook', { error, body: req.body });
      res.status(500).json({
        status: 'error',
        message: 'Failed to process consent webhook',
      });
    }
  }

  async handleUnsubscribeWebhook(req: Request, res: Response): Promise<void> {
    try {
      const unsubscribeData = this.parseUnsubscribeWebhook(req.body);

      const ipAddress = getClientIP(req);
      const userAgent = req.get('User-Agent') || 'webhook';

      await this.complianceService.withdrawConsent(
        unsubscribeData.contactId,
        'marketing',
        {
          ipAddress,
          userAgent,
          reason: 'unsubscribe_webhook',
        }
      );

      res.status(200).json({
        status: 'success',
        message: 'Unsubscribe webhook processed',
      });
    } catch (error) {
      logger.error('Error handling unsubscribe webhook', {
        error,
        body: req.body,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to process unsubscribe webhook',
      });
    }
  }

  // Helper methods
  private async getDataRequestFromService(requestId: string): Promise<any> {
    // Implementation would query the database for data request
    return {
      id: requestId,
      status: 'pending',
      requestType: 'access',
      requestedAt: new Date(),
      // ... other fields
    };
  }

  private async getComplianceReportFromService(reportId: string): Promise<any> {
    // Implementation would query the database for compliance report
    return {
      id: reportId,
      reportType: 'gdpr',
      generatedAt: new Date(),
      // ... other fields
    };
  }

  private parseConsentWebhook(body: any): any {
    // Parse consent webhook data based on provider format
    return {
      contactId: body.contactId || body.contact_id,
      email: body.email,
      consentType: body.consentType || 'marketing',
      consentGiven: body.consentGiven !== false,
      consentMethod: body.consentMethod || 'opt-in',
      legalBasis: body.legalBasis || 'consent',
      source: body.source || 'webhook',
    };
  }

  private parseUnsubscribeWebhook(body: any): any {
    // Parse unsubscribe webhook data
    return {
      contactId: body.contactId || body.contact_id,
      email: body.email,
      timestamp: new Date(body.timestamp || Date.now()),
      reason: body.reason || 'user_request',
    };
  }

  // Enhanced Compliance Management Methods
  async resolveViolation(req: Request, res: Response): Promise<void> {
    try {
      const { violationId } = req.params;
      const { resolutionNotes } = req.body;
      const userId = req.user?.id; // Assuming auth middleware sets req.user

      if (!violationId || !resolutionNotes) {
        res.status(400).json({
          status: 'error',
          message: 'Violation ID and resolution notes are required',
        });
        return;
      }

      await this.complianceService.resolveViolation(
        violationId,
        resolutionNotes,
        userId
      );

      res.json({
        status: 'success',
        message: 'Violation resolved successfully',
      });
    } catch (error) {
      logger.error('Error resolving violation', {
        error,
        violationId: req.params.violationId,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to resolve violation',
      });
    }
  }

  async getViolations(req: Request, res: Response): Promise<void> {
    try {
      const { emailId, resolved, limit = '50' } = req.query;

      let violations;
      if (emailId) {
        violations = await this.complianceService.getViolationsByEmail(
          emailId as string
        );
      } else if (resolved === 'false') {
        violations = await this.complianceService.getUnresolvedViolations(
          parseInt(limit as string)
        );
      } else {
        // Get all violations with pagination
        violations = await this.complianceService.getUnresolvedViolations(
          parseInt(limit as string)
        );
      }

      res.json({
        status: 'success',
        data: violations,
      });
    } catch (error) {
      logger.error('Error getting violations', { error, query: req.query });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get violations',
      });
    }
  }

  async performDataCleanup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || null;

      // Log the cleanup initiation
      await this.complianceService.createAuditLog({
        action: 'data_cleanup_initiated',
        entityType: 'system',
        entityId: 'cleanup_job',
        userId,
        details: {
          initiatedBy: userId,
          timestamp: new Date(),
        },
      });

      const results = await this.complianceService.cleanupExpiredData();

      res.json({
        status: 'success',
        data: results,
        message: 'Data cleanup completed successfully',
      });
    } catch (error) {
      logger.error('Error performing data cleanup', { error });
      res.status(500).json({
        status: 'error',
        message: 'Failed to perform data cleanup',
      });
    }
  }

  async getComplianceHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthCheck =
        await this.complianceService.performComplianceHealthCheck();

      res.json({
        status: 'success',
        data: healthCheck,
      });
    } catch (error) {
      logger.error('Error getting compliance health check', { error });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get compliance health check',
      });
    }
  }

  async getDataExport(req: Request, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;

      if (!exportId) {
        res.status(400).json({
          status: 'error',
          message: 'Export ID is required',
        });
        return;
      }

      // Get export data from Redis
      const exportData = await redis.get(`data_export:${exportId}`);
      const exportMetadata = await redis.get(`export_metadata:${exportId}`);

      if (!exportData) {
        res.status(404).json({
          status: 'error',
          message: 'Export not found or expired',
        });
        return;
      }

      const data = JSON.parse(exportData);
      const metadata = exportMetadata ? JSON.parse(exportMetadata) : null;

      // Log access to export
      await this.complianceService.createAuditLog({
        action: 'data_export_accessed',
        entityType: 'data_export',
        entityId: exportId,
        userId: req.user?.id || null,
        details: {
          exportId,
          accessedAt: new Date(),
          userAgent: req.get('User-Agent'),
        },
        ipAddress: getClientIP(req),
        userAgent: req.get('User-Agent') || 'unknown',
      });

      res.json({
        status: 'success',
        data,
        metadata,
      });
    } catch (error) {
      logger.error('Error getting data export', {
        error,
        exportId: req.params.exportId,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get data export',
      });
    }
  }

  async cancelDataRequest(req: Request, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id || null;

      if (!requestId) {
        res.status(400).json({
          status: 'error',
          message: 'Request ID is required',
        });
        return;
      }

      // Update request status to cancelled
      await database.query(
        'UPDATE gdpr_data_requests SET status = $1, processing_notes = $2, updated_at = $3 WHERE id = $4 AND status IN ($5, $6)',
        [
          'rejected',
          reason || 'Cancelled by user',
          new Date(),
          requestId,
          'pending',
          'processing',
        ]
      );

      // Cancel scheduled task if exists
      await redis.del(`scheduled_task:${requestId}`);

      // Log audit entry
      await this.complianceService.createAuditLog({
        action: 'data_request_cancelled',
        entityType: 'data_request',
        entityId: requestId,
        userId,
        details: {
          reason: reason || 'Cancelled by user',
          cancelledBy: userId,
        },
        ipAddress: getClientIP(req),
        userAgent: req.get('User-Agent') || 'unknown',
      });

      res.json({
        status: 'success',
        message: 'Data request cancelled successfully',
      });
    } catch (error) {
      logger.error('Error cancelling data request', {
        error,
        requestId: req.params.requestId,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to cancel data request',
      });
    }
  }
}
