-- GDPR Consent Records Table
CREATE TABLE IF NOT EXISTS gdpr_consent_records (
  id VARCHAR(255) PRIMARY KEY,
  contact_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('marketing', 'analytics', 'functional')),
  consent_given BOOLEAN NOT NULL,
  consent_method VARCHAR(50) NOT NULL CHECK (consent_method IN ('opt-in', 'pre-checked', 'implied', 'explicit')),
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  legal_basis VARCHAR(50) NOT NULL CHECK (legal_basis IN ('consent', 'legitimate_interest', 'contract', 'legal_obligation')),
  source VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GDPR Data Requests Table
CREATE TABLE IF NOT EXISTS gdpr_data_requests (
  id VARCHAR(255) PRIMARY KEY,
  contact_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('access', 'portability', 'rectification', 'erasure')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  request_details TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  requester_ip VARCHAR(45) NOT NULL,
  requester_user_agent TEXT NOT NULL,
  processing_notes TEXT,
  data_export_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data Deletion Requests Table
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id VARCHAR(255) PRIMARY KEY,
  contact_id VARCHAR(255) NOT NULL,
  request_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  data_types JSONB NOT NULL DEFAULT '[]',
  retention_exceptions JSONB NOT NULL DEFAULT '[]',
  deletion_method VARCHAR(50) NOT NULL DEFAULT 'hard_delete' CHECK (deletion_method IN ('soft_delete', 'hard_delete', 'anonymize')),
  verification_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (request_id) REFERENCES gdpr_data_requests(id)
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compliance Reports Table
CREATE TABLE IF NOT EXISTS compliance_reports (
  id VARCHAR(255) PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('gdpr', 'can_spam', 'audit')),
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  details JSONB NOT NULL DEFAULT '{}',
  recommendations JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CAN-SPAM Violations Table
CREATE TABLE IF NOT EXISTS can_spam_violations (
  id VARCHAR(255) PRIMARY KEY,
  email_id VARCHAR(255) NOT NULL,
  violation_type VARCHAR(100) NOT NULL CHECK (violation_type IN ('missing_unsubscribe', 'missing_address', 'deceptive_subject', 'false_header')),
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_contact_id ON gdpr_consent_records(contact_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_email ON gdpr_consent_records(email);
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_consent_type ON gdpr_consent_records(consent_type);
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_is_active ON gdpr_consent_records(is_active);
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_timestamp ON gdpr_consent_records(timestamp);

CREATE INDEX IF NOT EXISTS idx_gdpr_data_requests_contact_id ON gdpr_data_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_data_requests_email ON gdpr_data_requests(email);
CREATE INDEX IF NOT EXISTS idx_gdpr_data_requests_request_type ON gdpr_data_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_gdpr_data_requests_status ON gdpr_data_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_data_requests_requested_at ON gdpr_data_requests(requested_at);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_contact_id ON data_deletion_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status ON data_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_scheduled_for ON data_deletion_requests(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_report_type ON compliance_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_generated_at ON compliance_reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_period ON compliance_reports(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_can_spam_violations_email_id ON can_spam_violations(email_id);
CREATE INDEX IF NOT EXISTS idx_can_spam_violations_violation_type ON can_spam_violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_can_spam_violations_severity ON can_spam_violations(severity);
CREATE INDEX IF NOT EXISTS idx_can_spam_violations_resolved ON can_spam_violations(resolved);
CREATE INDEX IF NOT EXISTS idx_can_spam_violations_detected_at ON can_spam_violations(detected_at);

-- Comments for documentation
COMMENT ON TABLE gdpr_consent_records IS 'Stores GDPR consent records with full audit trail';
COMMENT ON TABLE gdpr_data_requests IS 'Tracks GDPR data subject requests (access, portability, rectification, erasure)';
COMMENT ON TABLE data_deletion_requests IS 'Manages right to be forgotten and data deletion workflows';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit logging for compliance reporting';
COMMENT ON TABLE compliance_reports IS 'Generated compliance reports for GDPR, CAN-SPAM, and audit purposes';
COMMENT ON TABLE can_spam_violations IS 'Tracks CAN-SPAM compliance violations and their resolution';

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_gdpr_consent_records_updated_at BEFORE UPDATE ON gdpr_consent_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gdpr_data_requests_updated_at BEFORE UPDATE ON gdpr_data_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_deletion_requests_updated_at BEFORE UPDATE ON data_deletion_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
