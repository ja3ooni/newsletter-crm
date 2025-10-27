import Joi from 'joi';

export const deliverabilityReportSchema = Joi.object({
  newsletterId: Joi.string().uuid().required(),
  deliveryRate: Joi.number().min(0).max(100).required(),
  bounceRate: Joi.number().min(0).max(100).required(),
  spamRate: Joi.number().min(0).max(100).required(),
  reputationScore: Joi.number().min(0).max(100).required(),
  domainReputation: Joi.object().pattern(
    Joi.string(),
    Joi.number().min(0).max(100)
  ),
  recommendations: Joi.array().items(Joi.string()),
  detailedMetrics: Joi.object({
    totalSent: Joi.number().integer().min(0).required(),
    delivered: Joi.number().integer().min(0).required(),
    bounced: Joi.number().integer().min(0).required(),
    softBounces: Joi.number().integer().min(0).required(),
    hardBounces: Joi.number().integer().min(0).required(),
    spamComplaints: Joi.number().integer().min(0).required(),
    unsubscribes: Joi.number().integer().min(0).required(),
    opens: Joi.number().integer().min(0).required(),
    clicks: Joi.number().integer().min(0).required(),
    deliveryTime: Joi.number().min(0).required(),
    inboxPlacement: Joi.number().min(0).max(100).required(),
    spamFolderPlacement: Joi.number().min(0).max(100).required(),
  }).required(),
});

export const senderReputationSchema = Joi.object({
  domain: Joi.string().domain().required(),
  ipAddress: Joi.string().ip().required(),
  reputationScore: Joi.number().min(0).max(100).required(),
  blacklistStatus: Joi.array().items(
    Joi.object({
      provider: Joi.string().required(),
      isListed: Joi.boolean().required(),
      reason: Joi.string().optional(),
      listedAt: Joi.date().optional(),
      checkedAt: Joi.date().required(),
    })
  ),
  spfRecord: Joi.object({
    isValid: Joi.boolean().required(),
    record: Joi.string().required(),
    mechanisms: Joi.array().items(Joi.string()),
    issues: Joi.array().items(Joi.string()),
    lastChecked: Joi.date().required(),
  }).required(),
  dkimRecord: Joi.object({
    isValid: Joi.boolean().required(),
    selector: Joi.string().required(),
    publicKey: Joi.string().required(),
    issues: Joi.array().items(Joi.string()),
    lastChecked: Joi.date().required(),
  }).required(),
  dmarcRecord: Joi.object({
    isValid: Joi.boolean().required(),
    policy: Joi.string().valid('none', 'quarantine', 'reject').required(),
    percentage: Joi.number().min(0).max(100).required(),
    alignment: Joi.object({
      spf: Joi.string().valid('strict', 'relaxed').required(),
      dkim: Joi.string().valid('strict', 'relaxed').required(),
    }).required(),
    reportingEmails: Joi.array().items(Joi.string().email()),
    issues: Joi.array().items(Joi.string()),
    lastChecked: Joi.date().required(),
  }).required(),
});

export const bounceEventSchema = Joi.object({
  emailAddress: Joi.string().email().required(),
  bounceType: Joi.string().valid('soft', 'hard').required(),
  bounceSubType: Joi.string().required(),
  reason: Joi.string().required(),
  timestamp: Joi.date().required(),
  newsletterId: Joi.string().uuid().optional(),
  campaignId: Joi.string().uuid().optional(),
  diagnosticCode: Joi.string().optional(),
});

export const suppressionListSchema = Joi.object({
  emailAddress: Joi.string().email().required(),
  reason: Joi.string()
    .valid('bounce', 'complaint', 'unsubscribe', 'manual')
    .required(),
  source: Joi.string().required(),
  isActive: Joi.boolean().default(true),
});

export const deliverabilityConfigSchema = Joi.object({
  domain: Joi.string().domain().required(),
  sendingIp: Joi.string().ip().required(),
  returnPath: Joi.string().email().required(),
  dkimSelector: Joi.string().required(),
  dkimPrivateKey: Joi.string().required(),
  trackingDomain: Joi.string().domain().required(),
  suppressionListEnabled: Joi.boolean().default(true),
  autoSuppressionRules: Joi.object({
    hardBounceThreshold: Joi.number().min(1).default(1),
    softBounceThreshold: Joi.number().min(1).default(5),
    complaintThreshold: Joi.number().min(1).default(1),
  }).required(),
  monitoringSettings: Joi.object({
    reputationCheckInterval: Joi.number().min(5).default(30),
    blacklistCheckInterval: Joi.number().min(30).default(240),
    alertThresholds: Joi.object({
      reputationScore: Joi.number().min(0).max(100).default(70),
      bounceRate: Joi.number().min(0).max(100).default(5),
      spamRate: Joi.number().min(0).max(100).default(0.1),
    }).required(),
  }).required(),
});

export const emailValidationSchema = Joi.object({
  emailAddress: Joi.string().email().required(),
});

export const validateRequest = (schema: Joi.ObjectSchema, data: any) => {
  const { error, value } = schema.validate(data, { abortEarly: false });

  if (error) {
    return {
      isValid: false,
      errors: error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    };
  }

  return {
    isValid: true,
    value,
  };
};

// Additional validation schemas for controller use
export const suppressionSchema = Joi.object({
  emailAddress: Joi.string().email().required(),
  reason: Joi.string()
    .valid('bounce', 'complaint', 'unsubscribe', 'manual')
    .required(),
  source: Joi.string().required(),
});

export const bulkEmailValidationSchema = Joi.object({
  emails: Joi.array().items(Joi.string().email()).min(1).max(1000).required(),
});

export const webhookSchema = Joi.object({
  email: Joi.string().email().required(),
  timestamp: Joi.date().default(Date.now),
  type: Joi.string().optional(),
  reason: Joi.string().optional(),
  diagnosticCode: Joi.string().optional(),
});

// Email validation helper
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Domain validation helper
export const isValidDomain = (domain: string): boolean => {
  const domainRegex =
    /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
  return domainRegex.test(domain);
};

// IP address validation helper
export const isValidIP = (ip: string): boolean => {
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
};

// Compliance validation schemas
export const consentSchema = Joi.object({
  contactId: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  consentType: Joi.string()
    .valid('marketing', 'analytics', 'functional')
    .required(),
  consentGiven: Joi.boolean().required(),
  consentMethod: Joi.string()
    .valid('opt-in', 'pre-checked', 'implied', 'explicit')
    .required(),
  legalBasis: Joi.string()
    .valid('consent', 'legitimate_interest', 'contract', 'legal_obligation')
    .required(),
  source: Joi.string().required(),
});

export const consentWithdrawalSchema = Joi.object({
  contactId: Joi.string().uuid().required(),
  consentType: Joi.string()
    .valid('marketing', 'analytics', 'functional')
    .required(),
  reason: Joi.string().optional(),
});

export const dataRequestSchema = Joi.object({
  contactId: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  requestType: Joi.string()
    .valid('access', 'portability', 'rectification', 'erasure')
    .required(),
  requestDetails: Joi.string().optional(),
});

export const emailComplianceSchema = Joi.object({
  subject: Joi.string().required(),
  htmlContent: Joi.string().required(),
  textContent: Joi.string().required(),
  fromAddress: Joi.string().email().required(),
  fromName: Joi.string().required(),
  replyToAddress: Joi.string().email().optional(),
});

export const complianceReportSchema = Joi.object({
  reportType: Joi.string().valid('gdpr', 'can_spam', 'audit').required(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  contactId: Joi.string().uuid().optional(),
  includeDetails: Joi.boolean().default(false),
});

export const auditLogSchema = Joi.object({
  action: Joi.string().required(),
  entityType: Joi.string().required(),
  entityId: Joi.string().required(),
  userId: Joi.string().uuid().optional(),
  details: Joi.object().optional(),
});

export const deletionRequestSchema = Joi.object({
  contactId: Joi.string().uuid().required(),
  requestId: Joi.string().uuid().required(),
  dataTypes: Joi.array()
    .items(Joi.string())
    .default([
      'personal_data',
      'engagement_history',
      'preferences',
      'consent_records',
    ]),
  deletionMethod: Joi.string()
    .valid('soft_delete', 'hard_delete', 'anonymize')
    .default('hard_delete'),
  verificationRequired: Joi.boolean().default(true),
});

export const dataExportSchema = Joi.object({
  contactId: Joi.string().uuid().required(),
  requestId: Joi.string().uuid().required(),
  format: Joi.string().valid('json', 'csv', 'xml').default('json'),
  includeHistory: Joi.boolean().default(true),
});
