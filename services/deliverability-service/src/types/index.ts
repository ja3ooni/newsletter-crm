export interface DeliverabilityReport {
  id: string;
  newsletterId: string;
  deliveryRate: number;
  bounceRate: number;
  spamRate: number;
  reputationScore: number;
  domainReputation: Record<string, number>;
  recommendations: string[];
  detailedMetrics: DeliverabilityMetrics;
  createdAt: Date;
}

export interface DeliverabilityMetrics {
  totalSent: number;
  delivered: number;
  bounced: number;
  softBounces: number;
  hardBounces: number;
  spamComplaints: number;
  unsubscribes: number;
  opens: number;
  clicks: number;
  deliveryTime: number; // average in seconds
  inboxPlacement: number; // percentage
  spamFolderPlacement: number; // percentage
}

export interface SenderReputation {
  id: string;
  domain: string;
  ipAddress: string;
  reputationScore: number;
  blacklistStatus: BlacklistStatus[];
  spfRecord: SPFRecord;
  dkimRecord: DKIMRecord;
  dmarcRecord: DMARCRecord;
  lastChecked: Date;
  trends: ReputationTrend[];
}

export interface BlacklistStatus {
  provider: string;
  isListed: boolean;
  reason?: string;
  listedAt?: Date;
  checkedAt: Date;
}

export interface SPFRecord {
  isValid: boolean;
  record: string;
  mechanisms: string[];
  issues: string[];
  lastChecked: Date;
}

export interface DKIMRecord {
  isValid: boolean;
  selector: string;
  publicKey: string;
  issues: string[];
  lastChecked: Date;
}

export interface DMARCRecord {
  isValid: boolean;
  policy: 'none' | 'quarantine' | 'reject';
  percentage: number;
  alignment: {
    spf: 'strict' | 'relaxed';
    dkim: 'strict' | 'relaxed';
  };
  reportingEmails: string[];
  issues: string[];
  lastChecked: Date;
}

export interface ReputationTrend {
  date: Date;
  score: number;
  deliveryRate: number;
  bounceRate: number;
  spamRate: number;
}

export interface BounceEvent {
  id: string;
  emailAddress: string;
  bounceType: 'soft' | 'hard';
  bounceSubType: string;
  reason: string;
  timestamp: Date;
  newsletterId?: string;
  campaignId?: string;
  diagnosticCode?: string;
}

export interface SuppressionList {
  id: string;
  emailAddress: string;
  reason: 'bounce' | 'complaint' | 'unsubscribe' | 'manual';
  addedAt: Date;
  source: string;
  isActive: boolean;
}

export interface DeliverabilityAlert {
  id: string;
  type: 'reputation_drop' | 'high_bounce_rate' | 'blacklist_detected' | 'authentication_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  triggeredAt: Date;
  isResolved: boolean;
  resolvedAt?: Date;
}

export interface DeliverabilityConfig {
  domain: string;
  sendingIp: string;
  returnPath: string;
  dkimSelector: string;
  dkimPrivateKey: string;
  trackingDomain: string;
  suppressionListEnabled: boolean;
  autoSuppressionRules: {
    hardBounceThreshold: number;
    softBounceThreshold: number;
    complaintThreshold: number;
  };
  monitoringSettings: {
    reputationCheckInterval: number; // minutes
    blacklistCheckInterval: number; // minutes
    alertThresholds: {
      reputationScore: number;
      bounceRate: number;
      spamRate: number;
    };
  };
}

export interface EmailValidationResult {
  emailAddress: string;
  isValid: boolean;
  isDeliverable: boolean;
  riskScore: number;
  issues: string[];
  domainInfo: {
    domain: string;
    mxRecords: string[];
    hasValidMx: boolean;
    isDisposable: boolean;
    isRoleAccount: boolean;
  };
}

export interface DeliverabilityInsight {
  type: 'trend' | 'recommendation' | 'alert';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionRequired: boolean;
  suggestedActions: string[];
  data?: Record<string, any>;
}
