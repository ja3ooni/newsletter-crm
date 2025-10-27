-- ============================================================================
-- ADVANCED CRM TABLES MIGRATION
-- ============================================================================

-- Sales Pipelines Table
CREATE TABLE IF NOT EXISTS sales_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pipeline Stages Table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES sales_pipelines(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  stage_order INTEGER NOT NULL,
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  is_closed_won BOOLEAN DEFAULT FALSE,
  is_closed_lost BOOLEAN DEFAULT FALSE,
  color VARCHAR(7),
  rotten_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Companies Table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  industry VARCHAR(100),
  size VARCHAR(20) CHECK (size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  revenue DECIMAL(15,2),
  currency VARCHAR(3) DEFAULT 'USD',
  website VARCHAR(500),
  phone VARCHAR(50),
  address JSONB,
  description TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}',
  tags TEXT[],
  owner_id UUID,
  parent_company_id UUID REFERENCES companies(id),
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact-Company Relations Table
CREATE TABLE IF NOT EXISTS contact_company_relations (
  contact_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role VARCHAR(100),
  is_primary BOOLEAN DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (contact_id, company_id)
);

-- Deals Table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_id UUID,
  company_id UUID REFERENCES companies(id),
  pipeline_id UUID NOT NULL REFERENCES sales_pipelines(id),
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  value DECIMAL(15,2),
  currency VARCHAR(3) DEFAULT 'USD',
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  actual_close_date DATE,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  lost_reason TEXT,
  won_reason TEXT,
  owner_id UUID,
  custom_fields JSONB NOT NULL DEFAULT '{}',
  tags TEXT[],
  source VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  last_activity_at TIMESTAMP WITH TIME ZONE,
  rotten_date DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opportunities Table
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_id UUID NOT NULL,
  company_id UUID REFERENCES companies(id),
  deal_id UUID REFERENCES deals(id),
  value DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  stage VARCHAR(20) DEFAULT 'identified' CHECK (stage IN ('identified', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  source VARCHAR(100),
  description TEXT,
  expected_close_date DATE,
  actual_close_date DATE,
  owner_id UUID,
  custom_fields JSONB NOT NULL DEFAULT '{}',
  tags TEXT[],
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'follow_up', 'demo', 'proposal', 'contract', 'other')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'overdue')),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  assigned_to UUID,
  contact_id UUID,
  company_id UUID REFERENCES companies(id),
  deal_id UUID REFERENCES deals(id),
  opportunity_id UUID REFERENCES opportunities(id),
  reminder_at TIMESTAMP WITH TIME ZONE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_pattern JSONB,
  custom_fields JSONB NOT NULL DEFAULT '{}',
  tags TEXT[],
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meetings Table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location VARCHAR(255),
  meeting_url VARCHAR(500),
  attendees JSONB NOT NULL DEFAULT '[]',
  contact_ids UUID[],
  company_ids UUID[],
  deal_id UUID REFERENCES deals(id),
  opportunity_id UUID REFERENCES opportunities(id),
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  outcome TEXT,
  follow_up_tasks UUID[],
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Communication History Table
CREATE TABLE IF NOT EXISTS communication_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID,
  company_id UUID REFERENCES companies(id),
  deal_id UUID REFERENCES deals(id),
  opportunity_id UUID REFERENCES opportunities(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'call', 'meeting', 'note', 'sms', 'social')),
  direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
  subject VARCHAR(255),
  content TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_minutes INTEGER,
  outcome VARCHAR(100),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Custom Fields Table
CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'textarea', 'number', 'decimal', 'boolean', 'date', 'datetime', 'select', 'multiselect', 'url', 'email', 'phone', 'currency', 'percentage')),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal', 'opportunity', 'task')),
  options JSONB,
  validation JSONB,
  is_required BOOLEAN DEFAULT FALSE,
  is_unique BOOLEAN DEFAULT FALSE,
  is_searchable BOOLEAN DEFAULT TRUE,
  default_value TEXT,
  help_text TEXT,
  field_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Win/Loss Analysis Table
CREATE TABLE IF NOT EXISTS win_loss_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id),
  opportunity_id UUID REFERENCES opportunities(id),
  outcome VARCHAR(10) NOT NULL CHECK (outcome IN ('won', 'lost')),
  primary_reason VARCHAR(255) NOT NULL,
  secondary_reasons TEXT[],
  competitor_id UUID,
  feedback TEXT,
  lessons_learned TEXT,
  action_items TEXT[],
  analyzed_by UUID,
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitors Table
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  description TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  pricing JSONB,
  market_share DECIMAL(5,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue Forecasts Table
CREATE TABLE IF NOT EXISTS revenue_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  period VARCHAR(20) NOT NULL CHECK (period IN ('monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_revenue DECIMAL(15,2),
  predicted_revenue DECIMAL(15,2),
  actual_revenue DECIMAL(15,2) DEFAULT 0,
  confidence INTEGER DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  deals JSONB NOT NULL DEFAULT '[]',
  opportunities JSONB NOT NULL DEFAULT '[]',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order ON pipeline_stages(stage_order);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_parent_company_id ON companies(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_companies_tags ON companies USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contact_company_relations_contact_id ON contact_company_relations(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_company_relations_company_id ON contact_company_relations(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_id ON deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_tags ON deals USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_opportunities_contact_id ON opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_company_id ON opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_deal_id ON opportunities(deal_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner_id ON opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_expected_close_date ON opportunities(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_opportunity_id ON tasks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_at ON tasks(reminder_at);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meetings_contact_ids ON meetings USING GIN(contact_ids);
CREATE INDEX IF NOT EXISTS idx_meetings_company_ids ON meetings USING GIN(company_ids);
CREATE INDEX IF NOT EXISTS idx_meetings_deal_id ON meetings(deal_id);
CREATE INDEX IF NOT EXISTS idx_meetings_opportunity_id ON meetings(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_communication_history_contact_id ON communication_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_communication_history_company_id ON communication_history(company_id);
CREATE INDEX IF NOT EXISTS idx_communication_history_deal_id ON communication_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_communication_history_opportunity_id ON communication_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_communication_history_type ON communication_history(type);
CREATE INDEX IF NOT EXISTS idx_communication_history_timestamp ON communication_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_custom_fields_entity_type ON custom_fields(entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_fields_name ON custom_fields(name);
CREATE INDEX IF NOT EXISTS idx_custom_fields_order ON custom_fields(field_order);
CREATE INDEX IF NOT EXISTS idx_win_loss_analysis_deal_id ON win_loss_analysis(deal_id);
CREATE INDEX IF NOT EXISTS idx_win_loss_analysis_opportunity_id ON win_loss_analysis(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_win_loss_analysis_outcome ON win_loss_analysis(outcome);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_period ON revenue_forecasts(period);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_start_date ON revenue_forecasts(start_date);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_end_date ON revenue_forecasts(end_date);
