-- Deliverability and Compliance System Tables
-- Migration: 007_deliverability_tables.sql

-- Sender reputation tracking table
CREATE TABLE IF NOT EXISTS sender_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  reputation_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  blacklist_status JSONB NOT NULL DEFAULT '[]',
  spf_record JSONB NOT NULL DEFAULT '{}',
  dkim_record JSONB NOT NULL DEFAULT '{}',
  dmarc_record JSONB NOT NULL DEFAULT '{}',
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trends JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(domain, ip_address)
);

-- Reputation trends for historical tracking
CREATE TABLE IF NOT EXISTS reputation_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  date DATE NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  delivery_rate DECIMAL(5,2) NOT NULL,
  bounce_rate DECIMAL(5,2) NOT NULL,
  spam_rate DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(domain, ip_address, date)
);

-- Bounce events tracking
CREATE TABLE IF NOT EXISTS bounce_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address VARCHAR(255) NOT NULL,
  bounce_type VARCHAR(10) NOT NULL CHECK (bounce_type IN ('soft', 'hard')),
  bounce_sub_type VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  newsletter_id UUID,
  campaign_id UUID,
  diagnostic_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppression list for bounced/complained emails
CREATE TABLE IF NOT EXISTS suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address VARCHAR(255) UNIQUE NOT NULL,
  reason VARCHAR(20) NOT NULL CHECK (reason IN ('bounce', 'complaint', 'unsubscribe', 'manual')),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deliverability reports
CREATE TABLE IF NOT EXISTS deliverability_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL,
  delivery_rate DECIMAL(5,2) NOT NULL,
  bounce_rate DECIMAL(5,2) NOT NULL,
  spam_rate DECIMAL(5,2) NOT NULL,
  reputation_score DECIMAL(5,2) NOT NULL,
  domain_reputation JSONB NOT NULL DEFAULT '{}',
  recommendations JSONB NOT NULL DEFAULT '[]',
  detailed_metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deliverability alerts
CREATE TABLE IF NOT EXISTS deliverability_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('reputation_drop', 'high_bounce_rate', 'blacklist_detected', 'authentication_failure')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email validation results cache
CREATE TABLE IF NOT EXISTS email_validation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address VARCHAR(255) UNIQUE NOT NULL,
  is_valid BOOLEAN NOT NULL,
  is_deliverable BOOLEAN NOT NULL,
  risk_score DECIMAL(3,2) NOT NULL DEFAULT 0,
  issues JSONB NOT NULL DEFAULT '[]',
  domain_info JSONB NOT NULL DEFAULT '{}',
  validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deliverability configuration
CREATE TABLE IF NOT EXISTS deliverability_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) UNIQUE NOT NULL,
  sending_ip INET NOT NULL,
  return_path VARCHAR(255) NOT NULL,
  dkim_selector VARCHAR(100) NOT NULL,
  dkim_private_key TEXT NOT NULL,
  tracking_domain VARCHAR(255),
  suppression_list_enabled BOOLEAN DEFAULT TRUE,
  auto_suppression_rules JSONB NOT NULL DEFAULT '{}',
  monitoring_settings JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compliance audit log
CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GDPR data requests
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address VARCHAR(255) NOT NULL,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('access', 'portability', 'deletion', 'rectification')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  details JSONB NOT NULL DEFAULT '{}',
  verification_token VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sender_reputation_domain ON sender_reputation(domain);
CREATE INDEX IF NOT EXISTS idx_sender_reputation_ip ON sender_reputation(ip_address);
CREATE INDEX IF NOT EXISTS idx_sender_reputation_score ON sender_reputation(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_sender_reputation_last_checked ON sender_reputation(last_checked);

CREATE INDEX IF NOT EXISTS idx_reputation_trends_domain_ip ON reputation_trends(domain, ip_address);
CREATE INDEX IF NOT EXISTS idx_reputation_trends_date ON reputation_trends(date DESC);

CREATE INDEX IF NOT EXISTS idx_bounce_events_email ON bounce_events(email_address);
CREATE INDEX IF NOT EXISTS idx_bounce_events_type ON bounce_events(bounce_type);
CREATE INDEX IF NOT EXISTS idx_bounce_events_timestamp ON bounce_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bounce_events_newsletter_id ON bounce_events(newsletter_id);

CREATE INDEX IF NOT EXISTS idx_suppression_list_email ON suppression_list(email_address);
CREATE INDEX IF NOT EXISTS idx_suppression_list_reason ON suppression_list(reason);
CREATE INDEX IF NOT EXISTS idx_suppression_list_active ON suppression_list(is_active);
CREATE INDEX IF NOT EXISTS idx_suppression_list_added_at ON suppression_list(added_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliverability_reports_newsletter_id ON deliverability_reports(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_deliverability_reports_created_at ON deliverability_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliverability_reports_delivery_rate ON deliverability_reports(delivery_rate);

CREATE INDEX IF NOT EXISTS idx_deliverability_alerts_type ON deliverability_alerts(type);
CREATE INDEX IF NOT EXISTS idx_deliverability_alerts_severity ON deliverability_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_deliverability_alerts_resolved ON deliverability_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_deliverability_alerts_triggered_at ON deliverability_alerts(triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_validation_cache_email ON email_validation_cache(email_address);
CREATE INDEX IF NOT EXISTS idx_email_validation_cache_expires_at ON email_validation_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_deliverability_config_domain ON deliverability_config(domain);
CREATE INDEX IF NOT EXISTS idx_deliverability_config_active ON deliverability_config(is_active);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_event_type ON compliance_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_entity ON compliance_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_user_id ON compliance_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_timestamp ON compliance_audit_log(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_email ON gdpr_requests(email_address);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_type ON gdpr_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_requested_at ON gdpr_requests(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_token ON gdpr_requests(verification_token);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sender_reputation_updated_at BEFORE UPDATE ON sender_reputation FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppression_list_updated_at BEFORE UPDATE ON suppression_list FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deliverability_alerts_updated_at BEFORE UPDATE ON deliverability_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deliverability_config_updated_at BEFORE UPDATE ON deliverability_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gdpr_requests_updated_at BEFORE UPDATE ON gdpr_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default deliverability configuration
INSERT INTO deliverability_config (
  domain,
  sending_ip,
  return_path,
  dkim_selector,
  dkim_private_key,
  tracking_domain,
  auto_suppression_rules,
  monitoring_settings
) VALUES (
  'example.com',
  '127.0.0.1',
  'bounce@example.com',
  'default',
  'dummy-private-key',
  'track.example.com',
  '{"hardBounceThreshold": 1, "softBounceThreshold": 5, "complaintThreshold": 1}',
  '{"reputationCheckInterval": 30, "blacklistCheckInterval": 240, "alertThresholds": {"reputationScore": 70, "bounceRate": 5, "spamRate": 0.1}}'
) ON CONFLICT (domain) DO NOTHING;
