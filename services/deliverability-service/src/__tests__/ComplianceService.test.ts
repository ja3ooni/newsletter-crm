import { ComplianceService } from '../services/ComplianceService';
import { database } from '../utils/database';
import { redis } from '../utils/redis';

// Mock dependencies
jest.mock('../utils/database');
jest.mock('../utils/redis');
jest.mock('../utils/logger');

const mockDatabase = database as jest.Mocked<typeof database>;
const mockRedis = redis as jest.Mocked<typeof redis>;

describe('ComplianceService', () => {
  let complianceService: ComplianceService;

  beforeEach(() => {
    complianceService = new ComplianceService();
    jest.clearAllMocks();
  });

  it('should create ComplianceService instance', () => {
    expect(complianceService).toBeInstanceOf(ComplianceService);
  });

  describe('GDPR Consent Management', () => {
    it('should record consent successfully', async () => {
      const mockConsentRecord = {
        id: 'consent-123',
        contactId: 'contact-123',
        email: 'test@example.com',
        consentType: 'marketing',
        consentGiven: true,
        consentMethod: 'opt-in',
        legalBasis: 'consent',
        source: 'website',
        isActive: true,
        createdAt: new Date(),
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [mockConsentRecord],
        rowCount: 1,
      });

      const consentData = {
        contactId: 'contact-123',
        email: 'test@example.com',
        consentType: 'marketing' as const,
        consentGiven: true,
        consentMethod: 'opt-in' as const,
        legalBasis: 'consent' as const,
        source: 'website',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const result = await complianceService.recordConsent(consentData);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gdpr_consent_records'),
        expect.arrayContaining([
          expect.any(String), // id
          'contact-123',
          'test@example.com',
          'marketing',
          true,
          'opt-in',
          '192.168.1.1',
          'Mozilla/5.0',
          expect.any(Date),
          'consent',
          'website',
          true,
          expect.any(Date),
          expect.any(Date),
        ])
      );

      expect(result).toEqual(mockConsentRecord);
    });

    it('should withdraw consent successfully', async () => {
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: 'consent-123' }],
        rowCount: 1,
      });

      await complianceService.withdrawConsent('contact-123', 'marketing', {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        reason: 'User request',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE gdpr_consent_records'),
        expect.arrayContaining([
          expect.any(Date), // withdrawn_at
          expect.any(Date), // updated_at
          'contact-123',
          'marketing',
        ])
      );
    });

    it('should get consent status', async () => {
      const mockConsentStatus = [
        {
          consent_type: 'marketing',
          consent_given: true,
          is_active: true,
          timestamp: new Date(),
          withdrawn_at: null,
          legal_basis: 'consent',
        },
      ];

      mockDatabase.query.mockResolvedValueOnce({
        rows: mockConsentStatus,
        rowCount: 1,
      });

      const result = await complianceService.getConsentStatus('contact-123');

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT consent_type, consent_given'),
        ['contact-123']
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        consentType: 'marketing',
        consentGiven: true,
        isActive: true,
      });
    });
  });

  describe('CAN-SPAM Compliance', () => {
    it('should validate email compliance', async () => {
      const emailContent = {
        subject: 'Test Newsletter',
        htmlContent:
          '<p>Test content with <a href="unsubscribe">unsubscribe</a> and address: 123 Main St, City, ST 12345</p>',
        textContent:
          'Test content with unsubscribe link and address: 123 Main St, City, ST 12345',
        fromAddress: 'test@example.com',
        fromName: 'Test Company',
        replyToAddress: 'reply@example.com',
      };

      const result =
        await complianceService.validateCANSPAMCompliance(emailContent);

      expect(result.isCompliant).toBe(true);
      expect(result.requirements.hasUnsubscribeLink).toBe(true);
      expect(result.requirements.hasPhysicalAddress).toBe(true);
      expect(result.requirements.hasValidReplyTo).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect missing unsubscribe link', async () => {
      const emailContent = {
        subject: 'Test Newsletter',
        htmlContent: '<p>Test content without any exit mechanism</p>',
        textContent: 'Test content without any exit mechanism',
        fromAddress: 'test@example.com',
        fromName: 'Test Company',
      };

      const result =
        await complianceService.validateCANSPAMCompliance(emailContent);

      expect(result.isCompliant).toBe(false);
      expect(result.requirements.hasUnsubscribeLink).toBe(false);
      expect(result.violations).toContain('Missing unsubscribe link');
    });

    it('should enforce compliance by blocking non-compliant emails', async () => {
      const complianceCheck = {
        isCompliant: false,
        violations: ['Missing unsubscribe link'],
        warnings: [],
        checkedAt: new Date(),
        requirements: {
          hasUnsubscribeLink: false,
          hasPhysicalAddress: true,
          hasAccurateFromInfo: true,
          hasNonDeceptiveSubject: true,
          hasProperIdentification: true,
          hasValidReplyTo: true,
        },
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      await complianceService.enforceCANSPAMCompliance(
        'email-123',
        complianceCheck
      );

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE newsletters SET status'),
        expect.arrayContaining([
          'blocked',
          expect.any(String),
          expect.any(Date),
          'email-123',
        ])
      );
    });
  });

  describe('Data Requests and Right to be Forgotten', () => {
    it('should process data request', async () => {
      const mockDataRequest = {
        id: 'request-123',
        contactId: 'contact-123',
        email: 'test@example.com',
        requestType: 'access',
        status: 'pending',
        requestedAt: new Date(),
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [mockDataRequest],
        rowCount: 1,
      });

      const requestData = {
        contactId: 'contact-123',
        email: 'test@example.com',
        requestType: 'access' as const,
        requesterIp: '192.168.1.1',
        requesterUserAgent: 'Mozilla/5.0',
      };

      const result = await complianceService.processDataRequest(requestData);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gdpr_data_requests'),
        expect.arrayContaining([
          expect.any(String), // id
          'contact-123',
          'test@example.com',
          'access',
          'pending',
          undefined, // request_details
          expect.any(Date),
          '192.168.1.1',
          'Mozilla/5.0',
          expect.any(Date),
          expect.any(Date),
        ])
      );

      expect(result).toEqual(mockDataRequest);
    });

    it('should process right to be forgotten', async () => {
      const mockDeletionRequest = {
        id: 'deletion-123',
        contactId: 'contact-123',
        requestId: 'request-123',
        status: 'pending',
        scheduledFor: expect.any(Date),
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [mockDeletionRequest],
        rowCount: 1,
      });

      const result = await complianceService.processRightToBeForgotten(
        'contact-123',
        'request-123'
      );

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_deletion_requests'),
        expect.arrayContaining([
          expect.any(String), // id
          'contact-123',
          'request-123',
          'pending',
          expect.any(Date), // requested_at
          expect.any(Date), // scheduled_for
          expect.any(String), // data_types JSON
          expect.any(String), // retention_exceptions JSON
          'hard_delete',
          true, // verification_required
          expect.any(Date),
          expect.any(Date),
        ])
      );

      expect(result).toEqual(mockDeletionRequest);
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log entry', async () => {
      const mockAuditEntry = {
        id: 'audit-123',
        action: 'consent_recorded',
        entityType: 'consent',
        entityId: 'consent-123',
        timestamp: new Date(),
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [mockAuditEntry],
        rowCount: 1,
      });

      mockRedis.lpush.mockResolvedValueOnce(1);
      mockRedis.ltrim.mockResolvedValueOnce('OK');

      const logData = {
        action: 'consent_recorded',
        entityType: 'consent',
        entityId: 'consent-123',
        userId: 'user-123',
        details: { test: 'data' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const result = await complianceService.createAuditLog(logData);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          expect.any(String), // id
          'consent_recorded',
          'consent',
          'consent-123',
          'user-123',
          expect.any(Date),
          '192.168.1.1',
          'Mozilla/5.0',
          expect.any(String), // JSON details
          expect.any(Date),
        ])
      );

      expect(result).toEqual(mockAuditEntry);
    });

    it('should get audit logs with filters', async () => {
      const mockAuditLogs = [
        {
          id: 'audit-123',
          action: 'consent_recorded',
          entity_type: 'consent',
          timestamp: new Date(),
        },
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // count query
        .mockResolvedValueOnce({ rows: mockAuditLogs }); // logs query

      const filters = {
        entityType: 'consent',
        limit: 50,
        offset: 0,
      };

      const result = await complianceService.getAuditLogs(filters);

      expect(result.total).toBe(1);
      expect(result.logs).toEqual(mockAuditLogs);
    });
  });

  describe('Compliance Reporting', () => {
    it('should generate GDPR compliance report', async () => {
      // Mock database queries for GDPR summary
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // totalConsents
        .mockResolvedValueOnce({ rows: [{ count: '8' }] }) // activeConsents
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // withdrawnConsents
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // dataRequests
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // deletionRequests

      // Mock additional queries for details
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] }) // consent breakdown
        .mockResolvedValueOnce({ rows: [] }) // request breakdown
        .mockResolvedValueOnce({ rows: [] }); // processing times

      const report = await complianceService.generateComplianceReport('gdpr');

      expect(report.reportType).toBe('gdpr');
      expect(report.summary).toMatchObject({
        totalConsents: 10,
        activeConsents: 8,
        withdrawnConsents: 2,
        dataRequests: 5,
        deletionRequests: 1,
      });
      expect(report.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Compliance Health Check', () => {
    it('should perform compliance health check', async () => {
      // Mock queries for health check
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] }) // unresolved violations
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // pending requests
        .mockResolvedValueOnce({
          rows: [{ active_consents: '100', recent_withdrawals: '5' }],
        }) // consent metrics
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // audit gaps

      const healthCheck =
        await complianceService.performComplianceHealthCheck();

      expect(healthCheck.status).toBe('healthy');
      expect(healthCheck.issues).toBeInstanceOf(Array);
      expect(healthCheck.recommendations).toBeInstanceOf(Array);
      expect(healthCheck.metrics).toMatchObject({
        unresolvedViolations: 0,
        pendingDataRequests: 0,
      });
    });
  });
});
