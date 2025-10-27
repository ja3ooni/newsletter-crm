// GDPR Compliance Types
export interface GDPRConsentRecord {
  id: string;
  contactId: string;
  email: string;
  consentType: 'marketing' | 'analytics' | 'functional';
  consentGiven: boolean;
  consentMethod: 'opt-in' | 'pre-checked' | 'implied' | 'explicit';
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  legalBasis:
    | 'consent'
    | 'legitimate_interest'
    | 'contract'
    | 'legal_obligation';
  source: string;
  isActive: boolean;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GDPRDataRequest {
  id: string;
  contactId: string;
  email: string;
  requestType: 'access' | 'portability' | 'rectification' | 'erasure';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestDetails: string | null;
  requestedAt: Date;
  processedAt: Date | null;
  completedAt: Date | null;
  requesterIp: string;
  requesterUserAgent: string;
  processingNotes: string | null;
  dataExportUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsentStatus {
  consentType: string;
  consentGiven: boolean;
  isActive: boolean;
  timestamp: Date;
  withdrawnAt: Date | null;
  legalBasis: string;
}

export interface DataDeletionRequest {
  id: string;
  contactId: string;
  requestId: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requestedAt: Date;
  scheduledFor: Date;
  completedAt: Date | null;
  dataTypes: string[];
  retentionExceptions: string[];
  deletionMethod: 'soft_delete' | 'hard_delete' | 'anonymize';
  verificationRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataPortabilityRequest {
  requestId: string;
  contactId: string;
  exportUrl: string;
  exportedAt: Date;
  expiresAt: Date;
  format: 'json' | 'csv' | 'xml';
  status: 'pending' | 'completed' | 'expired';
}

// CAN-SPAM Compliance Types
export interface CANSPAMCompliance {
  isCompliant: boolean;
  violations: string[];
  warnings: string[];
  checkedAt: Date;
  requirements: {
    hasUnsubscribeLink: boolean;
    hasPhysicalAddress: boolean;
    hasAccurateFromInfo: boolean;
    hasNonDeceptiveSubject: boolean;
    hasProperIdentification: boolean;
    hasValidReplyTo: boolean;
  };
}

export interface CANSPAMViolation {
  id: string;
  emailId: string;
  violationType:
    | 'missing_unsubscribe'
    | 'missing_address'
    | 'deceptive_subject'
    | 'false_header';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  resolved: boolean;
  resolvedAt: Date | null;
}

// Audit Logging Types
export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  timestamp: Date;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, any>;
  createdAt: Date;
}

export interface AuditLogFilter {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// Compliance Reporting Types
export interface ComplianceReport {
  id: string;
  reportType: 'gdpr' | 'can_spam' | 'audit';
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: Record<string, any>;
  details: Record<string, any>;
  recommendations: string[];
}

export interface ComplianceMetrics {
  gdpr: {
    totalConsents: number;
    activeConsents: number;
    withdrawnConsents: number;
    dataRequests: number;
    deletionRequests: number;
    averageProcessingTime: number;
  };
  canSpam: {
    emailsScanned: number;
    compliantEmails: number;
    violationsFound: number;
    blockedEmails: number;
  };
  audit: {
    totalEvents: number;
    criticalEvents: number;
    complianceEvents: number;
    securityEvents: number;
  };
}

// Request/Response Types
export interface ConsentRequest {
  contactId: string;
  email: string;
  consentType: 'marketing' | 'analytics' | 'functional';
  consentGiven: boolean;
  consentMethod: 'opt-in' | 'pre-checked' | 'implied' | 'explicit';
  legalBasis:
    | 'consent'
    | 'legitimate_interest'
    | 'contract'
    | 'legal_obligation';
  source: string;
  ipAddress: string;
  userAgent: string;
}

export interface ConsentWithdrawalRequest {
  contactId: string;
  consentType: string;
  reason?: string;
  ipAddress: string;
  userAgent: string;
}

export interface DataRequestSubmission {
  contactId: string;
  email: string;
  requestType: 'access' | 'portability' | 'rectification' | 'erasure';
  requestDetails?: string;
  requesterIp: string;
  requesterUserAgent: string;
}

export interface EmailComplianceCheck {
  subject: string;
  htmlContent: string;
  textContent: string;
  fromAddress: string;
  fromName: string;
  replyToAddress?: string;
}

export interface ComplianceReportRequest {
  reportType: 'gdpr' | 'can_spam' | 'audit';
  startDate?: Date;
  endDate?: Date;
  contactId?: string;
  includeDetails?: boolean;
}

// Database Schema Types
export interface GDPRConsentRecordDB {
  id: string;
  contact_id: string;
  email: string;
  consent_type: string;
  consent_given: boolean;
  consent_method: string;
  ip_address: string;
  user_agent: string;
  timestamp: Date;
  legal_basis: string;
  source: string;
  is_active: boolean;
  withdrawn_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface GDPRDataRequestDB {
  id: string;
  contact_id: string;
  email: string;
  request_type: string;
  status: string;
  request_details: string | null;
  requested_at: Date;
  processed_at: Date | null;
  completed_at: Date | null;
  requester_ip: string;
  requester_user_agent: string;
  processing_notes: string | null;
  data_export_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DataDeletionRequestDB {
  id: string;
  contact_id: string;
  request_id: string;
  status: string;
  requested_at: Date;
  scheduled_for: Date;
  completed_at: Date | null;
  data_types: string; // JSON string
  retention_exceptions: string; // JSON string
  deletion_method: string;
  verification_required: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AuditLogEntryDB {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  timestamp: Date;
  ip_address: string | null;
  user_agent: string | null;
  details: string; // JSON string
  created_at: Date;
}

export interface ComplianceReportDB {
  id: string;
  report_type: string;
  generated_at: Date;
  period_start: Date;
  period_end: Date;
  summary: string; // JSON string
  details: string; // JSON string
  recommendations: string; // JSON string
}

// Validation Schemas
export interface ConsentValidationSchema {
  contactId: string;
  email: string;
  consentType: 'marketing' | 'analytics' | 'functional';
  consentGiven: boolean;
  consentMethod: 'opt-in' | 'pre-checked' | 'implied' | 'explicit';
  legalBasis:
    | 'consent'
    | 'legitimate_interest'
    | 'contract'
    | 'legal_obligation';
  source: string;
}

export interface DataRequestValidationSchema {
  contactId: string;
  email: string;
  requestType: 'access' | 'portability' | 'rectification' | 'erasure';
  requestDetails?: string;
}

export interface EmailComplianceValidationSchema {
  subject: string;
  htmlContent: string;
  textContent: string;
  fromAddress: string;
  fromName: string;
  replyToAddress?: string;
}

// Error Types
export class ComplianceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'ComplianceError';
  }
}

export class GDPRError extends ComplianceError {
  constructor(message: string, code: string = 'GDPR_ERROR') {
    super(message, code, 400);
    this.name = 'GDPRError';
  }
}

export class CANSPAMError extends ComplianceError {
  constructor(message: string, code: string = 'CAN_SPAM_ERROR') {
    super(message, code, 400);
    this.name = 'CANSPAMError';
  }
}

export class AuditError extends ComplianceError {
  constructor(message: string, code: string = 'AUDIT_ERROR') {
    super(message, code, 500);
    this.name = 'AuditError';
  }
}
