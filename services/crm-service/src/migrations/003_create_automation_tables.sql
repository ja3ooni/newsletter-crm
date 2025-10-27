-- Migration: Create CRM Automation Tables
-- Description: Creates tables for territory management, automation rules, and custom dashboards

-- ============================================================================
-- TERRITORY MANAGEMENT TABLES
-- ============================================================================

-- Territories table
CREATE TABLE IF NOT EXISTS territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('geographic', 'industry', 'company_size', 'revenue', 'custom')),
  rules JSONB NOT NULL DEFAULT '[]',
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Territory assignments table
CREATE TABLE IF NOT EXISTS territory_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'member', 'viewer')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID,
  UNIQUE(territory_id, user_id)
);

-- ============================================================================
-- AUTOMATION RULES TABLES
-- ============================================================================

-- Lead assignment rules table
CREATE TABLE IF NOT EXISTS lead_assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 1,
  conditions JSONB NOT NULL DEFAULT '[]',
  assignment_type VARCHAR(50) NOT NULL CHECK (assignment_type IN ('territory', 'round_robin', 'load_balanced', 'criteria_based')),
  assignment_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follow-up sequences table
CREATE TABLE IF NOT EXISTS follow_up_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger JSONB NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follow-up sequence executions table
CREATE TABLE IF NOT EXISTS follow_up_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  current_step INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- Qualification workflows table
CREATE TABLE IF NOT EXISTS qualification_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  score_thresholds JSONB NOT NULL, -- { "mql": 50, "sql": 80 }
  actions JSONB NOT NULL DEFAULT '{}', -- { "onMQL": [...], "onSQL": [...] }
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Automation rules table (generic)
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('lead_assignment', 'follow_up_sequence', 'lead_qualification', 'data_enrichment', 'lifecycle_progression', 'task_creation')),
  trigger JSONB NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 1,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Automation executions log table
CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  contact_id UUID,
  trigger_event VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- ============================================================================
-- ANALYTICS AND REPORTING TABLES
-- ============================================================================

-- Custom dashboards table
CREATE TABLE IF NOT EXISTS custom_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  widgets JSONB NOT NULL DEFAULT '[]',
  layout JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report templates table
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('sales_performance', 'lead_generation', 'pipeline_analysis', 'activity_summary', 'territory_performance', 'custom')),
  config JSONB NOT NULL,
  schedule JSONB, -- For scheduled reports
  recipients TEXT[], -- Email addresses
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report executions table
CREATE TABLE IF NOT EXISTS report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  file_path VARCHAR(500),
  file_size BIGINT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- ============================================================================
-- ENRICHMENT AND DATA QUALITY TABLES
-- ============================================================================

-- Enrichment jobs table
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('clearbit', 'fullcontact', 'hunter', 'pipl', 'internal')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  request_data JSONB NOT NULL DEFAULT '{}',
  response_data JSONB,
  enriched_fields TEXT[],
  confidence DECIMAL(3,2) DEFAULT 0,
  cost DECIMAL(10,4),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enrichment rules table
CREATE TABLE IF NOT EXISTS enrichment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  triggers JSONB NOT NULL DEFAULT '[]',
  fields TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 1,
  cost_limit DECIMAL(10,4),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Duplicate detection groups table
CREATE TABLE IF NOT EXISTS duplicate_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_contact_id UUID NOT NULL,
  duplicate_contact_ids UUID[] NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  matching_fields TEXT[] NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'ignored', 'false_positive')),
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Duplicate detection rules table
CREATE TABLE IF NOT EXISTS duplicate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]', -- Array of { field, weight, matchType, threshold }
  threshold DECIMAL(3,2) NOT NULL DEFAULT 0.8,
  is_active BOOLEAN DEFAULT TRUE,
  auto_merge BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Territory indexes
CREATE INDEX IF NOT EXISTS idx_territories_type ON territories(type);
CREATE INDEX IF NOT EXISTS idx_territories_active ON territories(is_active);
CREATE INDEX IF NOT EXISTS idx_territories_priority ON territories(priority);
CREATE INDEX IF NOT EXISTS idx_territory_assignments_territory_id ON territory_assignments(territory_id);
CREATE INDEX IF NOT EXISTS idx_territory_assignments_user_id ON territory_assignments(user_id);

-- Automation rule indexes
CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_active ON lead_assignment_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_priority ON lead_assignment_rules(priority);
CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_active ON follow_up_sequences(is_active);
CREATE INDEX IF NOT EXISTS idx_follow_up_executions_contact_id ON follow_up_executions(contact_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_executions_status ON follow_up_executions(status);
CREATE INDEX IF NOT EXISTS idx_qualification_workflows_active ON qualification_workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_automation_rules_type ON automation_rules(type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_automation_executions_rule_id ON automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_contact_id ON automation_executions(contact_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_status ON automation_executions(status);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_custom_dashboards_created_by ON custom_dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_dashboards_public ON custom_dashboards(is_public);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(type);
CREATE INDEX IF NOT EXISTS idx_report_templates_active ON report_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_report_executions_template_id ON report_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);

-- Enrichment indexes
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_contact_id ON enrichment_jobs(contact_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status ON enrichment_jobs(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_provider ON enrichment_jobs(provider);
CREATE INDEX IF NOT EXISTS idx_enrichment_rules_active ON enrichment_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_master_contact ON duplicate_groups(master_contact_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_status ON duplicate_groups(status);
CREATE INDEX IF NOT EXISTS idx_duplicate_rules_active ON duplicate_rules(is_active);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables with updated_at columns
CREATE TRIGGER update_territories_updated_at BEFORE UPDATE ON territories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lead_assignment_rules_updated_at BEFORE UPDATE ON lead_assignment_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_follow_up_sequences_updated_at BEFORE UPDATE ON follow_up_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_qualification_workflows_updated_at BEFORE UPDATE ON qualification_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_dashboards_updated_at BEFORE UPDATE ON custom_dashboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON report_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_enrichment_rules_updated_at BEFORE UPDATE ON enrichment_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_duplicate_rules_updated_at BEFORE UPDATE ON duplicate_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert sample territories
INSERT INTO territories (name, description, type, rules, priority, is_active) VALUES
('North America Enterprise', 'Enterprise accounts in North America', 'geographic', '[{"field": "country", "operator": "in", "value": ["US", "CA"]}, {"field": "company_size", "operator": "equals", "value": "enterprise"}]', 1, true),
('Technology Startups', 'Technology startup companies', 'industry', '[{"field": "industry", "operator": "equals", "value": "technology"}, {"field": "company_size", "operator": "in", "value": ["startup", "small"]}]', 2, true),
('High Value Prospects', 'High revenue potential prospects', 'revenue', '[{"field": "estimated_revenue", "operator": "greater_than", "value": 1000000}]', 1, true);

-- Insert sample lead assignment rules
INSERT INTO lead_assignment_rules (name, description, priority, conditions, assignment_type, assignment_config, is_active) VALUES
('Enterprise Territory Assignment', 'Assign enterprise leads to territory owners', 1, '[{"field": "company_size", "operator": "equals", "value": "enterprise"}]', 'territory', '{"territoryId": "north-america-enterprise"}', true),
('Round Robin for SMB', 'Round robin assignment for small/medium business leads', 2, '[{"field": "company_size", "operator": "in", "value": ["small", "medium"]}]', 'round_robin', '{"userIds": ["user1", "user2", "user3"]}', true);

-- Insert sample follow-up sequences
INSERT INTO follow_up_sequences (name, description, trigger, steps, is_active) VALUES
('New Lead Nurturing', 'Standard follow-up sequence for new leads', '{"event": "contact_created", "conditions": {"lifecycle": "lead"}}', '[{"id": "1", "order": 1, "type": "task", "delay": 1, "config": {"title": "Initial outreach call", "type": "call", "priority": "high"}}, {"id": "2", "order": 2, "type": "email", "delay": 24, "config": {"templateId": "welcome-email", "subject": "Welcome to our platform"}}]', true),
('MQL Follow-up', 'Follow-up sequence for marketing qualified leads', '{"event": "lifecycle_change", "conditions": {"lifecycle": "marketing_qualified_lead"}}', '[{"id": "1", "order": 1, "type": "task", "delay": 2, "config": {"title": "Schedule qualification call", "type": "call", "priority": "high"}}]', true);

-- Insert sample qualification workflows
INSERT INTO qualification_workflows (name, description, score_thresholds, actions, is_active) VALUES
('Standard Lead Qualification', 'Standard MQL/SQL qualification workflow', '{"mql": 50, "sql": 80}', '{"onMQL": [{"type": "update_lifecycle", "config": {"lifecycle": "marketing_qualified_lead"}}, {"type": "create_task", "config": {"title": "Review MQL", "type": "follow_up", "priority": "medium"}}], "onSQL": [{"type": "update_lifecycle", "config": {"lifecycle": "sales_qualified_lead"}}, {"type": "create_task", "config": {"title": "Schedule sales call", "type": "call", "priority": "high"}}]}', true);

-- Insert sample custom dashboard
INSERT INTO custom_dashboards (name, description, widgets, layout, is_public, created_by) VALUES
('Sales Performance Dashboard', 'Overview of sales team performance', '[{"id": "1", "type": "metric_card", "title": "Total Deals", "config": {"dataSource": "deals", "metrics": ["count"]}, "position": {"x": 0, "y": 0, "width": 3, "height": 2}}, {"id": "2", "type": "line_chart", "title": "Deal Trend", "config": {"dataSource": "deals", "metrics": ["count"], "timeRange": {"period": "month"}}, "position": {"x": 3, "y": 0, "width": 6, "height": 4}}]', '{"columns": 12, "rows": 8, "gap": 16}', true, 'system');

-- Insert sample enrichment rules
INSERT INTO enrichment_rules (name, provider, triggers, fields, is_active, priority) VALUES
('Auto-enrich new contacts', 'clearbit', '[{"event": "contact_created", "conditions": []}]', '["company", "jobTitle", "phone", "website"]', true, 1),
('Enrich high-value prospects', 'fullcontact', '[{"event": "score_threshold", "conditions": [{"field": "leadScore", "operator": "greater_than", "value": 75}]}]', '["company", "jobTitle", "phone", "website", "socialProfiles"]', true, 2);

-- Insert sample duplicate detection rules
INSERT INTO duplicate_rules (name, fields, threshold, is_active, auto_merge) VALUES
('Email-based duplicate detection', '[{"field": "email", "weight": 1.0, "matchType": "exact", "threshold": 1.0}]', 1.0, true, false),
('Fuzzy name and company matching', '[{"field": "firstName", "weight": 0.3, "matchType": "fuzzy", "threshold": 0.8}, {"field": "lastName", "weight": 0.3, "matchType": "fuzzy", "threshold": 0.8}, {"field": "company", "weight": 0.4, "matchType": "fuzzy", "threshold": 0.7}]', 0.8, true, false);

COMMENT ON TABLE territories IS 'Territory definitions for lead assignment and sales team organization';
COMMENT ON TABLE territory_assignments IS 'User assignments to territories with roles';
COMMENT ON TABLE lead_assignment_rules IS 'Rules for automatically assigning leads to sales reps';
COMMENT ON TABLE follow_up_sequences IS 'Automated follow-up sequences for lead nurturing';
COMMENT ON TABLE qualification_workflows IS 'Lead qualification workflows with score thresholds';
COMMENT ON TABLE automation_rules IS 'Generic automation rules for various CRM processes';
COMMENT ON TABLE custom_dashboards IS 'User-created custom analytics dashboards';
COMMENT ON TABLE enrichment_jobs IS 'Data enrichment job tracking';
COMMENT ON TABLE duplicate_groups IS 'Detected duplicate contact groups';
