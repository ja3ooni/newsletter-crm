-- Performance Indexes and Constraints
-- Migration: 002_indexes_and_constraints.sql
-- Description: Creates indexes, constraints, and performance optimizations

-- ============================================================================
-- USER MANAGEMENT INDEXES
-- ============================================================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_email_verified ON users(email_verified);
CREATE INDEX idx_users_last_login ON users(last_login_at DESC);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- User roles indexes
CREATE INDEX idx_user_roles_name ON user_roles(name);

-- Subscriptions indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- ============================================================================
-- CRM INDEXES
-- ============================================================================

-- Contacts table indexes
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_lifecycle ON contacts(lifecycle);
CREATE INDEX idx_contacts_lead_score ON contacts(lead_score DESC);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_source ON contacts(source);
CREATE INDEX idx_contacts_owner_id ON contacts(owner_id);
CREATE INDEX idx_contacts_created_by ON contacts(created_by);
CREATE INDEX idx_contacts_last_activity ON contacts(last_activity_at DESC);
CREATE INDEX idx_contacts_created_at ON contacts(created_at DESC);
CREATE INDEX idx_contacts_company ON contacts(company);
CREATE INDEX idx_contacts_name ON contacts(first_name, last_name);

-- Full-text search index for contacts
CREATE INDEX idx_contacts_search ON contacts USING GIN(
    to_tsvector('english',
        COALESCE(first_name, '') || ' ' ||
        COALESCE(last_name, '') || ' ' ||
        COALESCE(company, '') || ' ' ||
        COALESCE(job_title, '')
    )
);

-- Segments indexes
CREATE INDEX idx_segments_auto_updating ON segments(is_auto_updating);
CREATE INDEX idx_segments_active ON segments(is_active);
CREATE INDEX idx_segments_created_by ON segments(created_by);
CREATE INDEX idx_segments_name ON segments(name);

-- Contact segments indexes
CREATE INDEX idx_contact_segments_contact_id ON contact_segments(contact_id);
CREATE INDEX idx_contact_segments_segment_id ON contact_segments(segment_id);
CREATE INDEX idx_contact_segments_added_at ON contact_segments(added_at DESC);

-- Engagement events indexes
CREATE INDEX idx_engagement_events_contact_id ON engagement_events(contact_id);
CREATE INDEX idx_engagement_events_type ON engagement_events(event_type);
CREATE INDEX idx_engagement_events_timestamp ON engagement_events(timestamp DESC);
CREATE INDEX idx_engagement_events_newsletter_id ON engagement_events(newsletter_id);
CREATE INDEX idx_engagement_events_campaign_id ON engagement_events(campaign_id);
CREATE INDEX idx_engagement_events_workflow_id ON engagement_events(workflow_id);
CREATE INDEX idx_engagement_events_session_id ON engagement_events(session_id);

-- Composite index for engagement analytics
CREATE INDEX idx_engagement_events_contact_type_time ON engagement_events(contact_id, event_type, timestamp DESC);

-- Lead scoring rules indexes
CREATE INDEX idx_lead_scoring_rules_active ON lead_scoring_rules(is_active);
CREATE INDEX idx_lead_scoring_rules_created_by ON lead_scoring_rules(created_by);

-- Contact activities indexes
CREATE INDEX idx_contact_activities_contact_id ON contact_activities(contact_id);
CREATE INDEX idx_contact_activities_type ON contact_activities(type);
CREATE INDEX idx_contact_activities_status ON contact_activities(status);
CREATE INDEX idx_contact_activities_assigned_to ON contact_activities(assigned_to);
CREATE INDEX idx_contact_activities_due_date ON contact_activities(due_date);
CREATE INDEX idx_contact_activities_created_by ON contact_activities(created_by);
CREATE INDEX idx_contact_activities_created_at ON contact_activities(created_at DESC);

-- Sales pipeline indexes
CREATE INDEX idx_sales_pipelines_default ON sales_pipelines(is_default);
CREATE INDEX idx_sales_pipelines_active ON sales_pipelines(is_active);

-- Deals indexes
CREATE INDEX idx_deals_contact_id ON deals(contact_id);
CREATE INDEX idx_deals_pipeline_id ON deals(pipeline_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_owner_id ON deals(owner_id);
CREATE INDEX idx_deals_expected_close_date ON deals(expected_close_date);
CREATE INDEX idx_deals_value ON deals(value DESC);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);

-- ============================================================================
-- MARKETING AUTOMATION INDEXES
-- ============================================================================

-- Workflows indexes
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_created_by ON workflows(created_by);
CREATE INDEX idx_workflows_name ON workflows(name);
CREATE INDEX idx_workflows_created_at ON workflows(created_at DESC);

-- Workflow executions indexes
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_contact_id ON workflow_executions(contact_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at DESC);

-- Composite index for active workflow executions
CREATE INDEX idx_workflow_executions_active ON workflow_executions(workflow_id, status, started_at)
WHERE status IN ('running', 'paused');

-- Email campaigns indexes
CREATE INDEX idx_email_campaigns_type ON email_campaigns(type);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX idx_email_campaigns_scheduled_at ON email_campaigns(scheduled_at);
CREATE INDEX idx_email_campaigns_sent_at ON email_campaigns(sent_at DESC);
CREATE INDEX idx_email_campaigns_created_by ON email_campaigns(created_by);
CREATE INDEX idx_email_campaigns_target_segments ON email_campaigns USING GIN(target_segments);

-- Drip sequences indexes
CREATE INDEX idx_drip_sequences_campaign_id ON drip_sequences(campaign_id);
CREATE INDEX idx_drip_sequences_order ON drip_sequences(campaign_id, sequence_order);
CREATE INDEX idx_drip_sequences_active ON drip_sequences(is_active);

-- ============================================================================
-- NEWSLETTER AND CONTENT INDEXES
-- ============================================================================

-- Newsletter templates indexes
CREATE INDEX idx_newsletter_templates_category ON newsletter_templates(category);
CREATE INDEX idx_newsletter_templates_public ON newsletter_templates(is_public);
CREATE INDEX idx_newsletter_templates_active ON newsletter_templates(is_active);
CREATE INDEX idx_newsletter_templates_created_by ON newsletter_templates(created_by);
CREATE INDEX idx_newsletter_templates_usage_count ON newsletter_templates(usage_count DESC);

-- Newsletters indexes
CREATE INDEX idx_newsletters_status ON newsletters(status);
CREATE INDEX idx_newsletters_created_by ON newsletters(created_by);
CREATE INDEX idx_newsletters_scheduled_at ON newsletters(scheduled_at);
CREATE INDEX idx_newsletters_sent_at ON newsletters(sent_at DESC);
CREATE INDEX idx_newsletters_template_id ON newsletters(template_id);
CREATE INDEX idx_newsletters_segments ON newsletters USING GIN(segments);

-- A/B tests indexes
CREATE INDEX idx_ab_tests_status ON ab_tests(status);
CREATE INDEX idx_ab_tests_type ON ab_tests(type);
CREATE INDEX idx_ab_tests_newsletter_id ON ab_tests(newsletter_id);
CREATE INDEX idx_ab_tests_campaign_id ON ab_tests(campaign_id);
CREATE INDEX idx_ab_tests_started_at ON ab_tests(started_at DESC);

-- Content items indexes
CREATE INDEX idx_content_items_source ON content_items(source);
CREATE INDEX idx_content_items_published_at ON content_items(published_at DESC);
CREATE INDEX idx_content_items_score ON content_items(score DESC);
CREATE INDEX idx_content_items_category ON content_items(category);
CREATE INDEX idx_content_items_difficulty ON content_items(difficulty);
CREATE INDEX idx_content_items_tags ON content_items USING GIN(tags);
CREATE INDEX idx_content_items_featured ON content_items(is_featured);
CREATE INDEX idx_content_items_active ON content_items(is_active);
CREATE INDEX idx_content_items_engagement_score ON content_items(engagement_score DESC);
CREATE INDEX idx_content_items_hash ON content_items(content_hash);

-- Full-text search index for content
CREATE INDEX idx_content_items_search ON content_items USING GIN(
    to_tsvector('english', title || ' ' || COALESCE(summary, ''))
);

-- Content sources indexes
CREATE INDEX idx_content_sources_type ON content_sources(type);
CREATE INDEX idx_content_sources_active ON content_sources(is_active);
CREATE INDEX idx_content_sources_last_fetched ON content_sources(last_fetched_at DESC);
CREATE INDEX idx_content_sources_quality_score ON content_sources(quality_score DESC);

-- ============================================================================
-- DELIVERABILITY AND COMPLIANCE INDEXES
-- ============================================================================

-- Deliverability reports indexes
CREATE INDEX idx_deliverability_reports_newsletter_id ON deliverability_reports(newsletter_id);
CREATE INDEX idx_deliverability_reports_campaign_id ON deliverability_reports(campaign_id);
CREATE INDEX idx_deliverability_reports_date ON deliverability_reports(report_date DESC);

-- Email suppressions indexes
CREATE INDEX idx_email_suppressions_email ON email_suppressions(email);
CREATE INDEX idx_email_suppressions_type ON email_suppressions(type);
CREATE INDEX idx_email_suppressions_permanent ON email_suppressions(is_permanent);
CREATE INDEX idx_email_suppressions_expires_at ON email_suppressions(expires_at);

-- Compliance logs indexes
CREATE INDEX idx_compliance_logs_contact_id ON compliance_logs(contact_id);
CREATE INDEX idx_compliance_logs_action ON compliance_logs(action);
CREATE INDEX idx_compliance_logs_performed_by ON compliance_logs(performed_by);
CREATE INDEX idx_compliance_logs_created_at ON compliance_logs(created_at DESC);

-- ============================================================================
-- ANALYTICS AND REPORTING INDEXES
-- ============================================================================

-- Email deliveries indexes
CREATE INDEX idx_email_deliveries_contact_id ON email_deliveries(contact_id);
CREATE INDEX idx_email_deliveries_newsletter_id ON email_deliveries(newsletter_id);
CREATE INDEX idx_email_deliveries_campaign_id ON email_deliveries(campaign_id);
CREATE INDEX idx_email_deliveries_message_id ON email_deliveries(message_id);
CREATE INDEX idx_email_deliveries_status ON email_deliveries(status);
CREATE INDEX idx_email_deliveries_timestamp ON email_deliveries(timestamp DESC);

-- Composite index for delivery analytics
CREATE INDEX idx_email_deliveries_analytics ON email_deliveries(newsletter_id, status, timestamp);

-- Click events indexes
CREATE INDEX idx_click_events_contact_id ON click_events(contact_id);
CREATE INDEX idx_click_events_newsletter_id ON click_events(newsletter_id);
CREATE INDEX idx_click_events_campaign_id ON click_events(campaign_id);
CREATE INDEX idx_click_events_timestamp ON click_events(timestamp DESC);
CREATE INDEX idx_click_events_url ON click_events(url);

-- Revenue events indexes
CREATE INDEX idx_revenue_events_contact_id ON revenue_events(contact_id);
CREATE INDEX idx_revenue_events_newsletter_id ON revenue_events(newsletter_id);
CREATE INDEX idx_revenue_events_campaign_id ON revenue_events(campaign_id);
CREATE INDEX idx_revenue_events_deal_id ON revenue_events(deal_id);
CREATE INDEX idx_revenue_events_timestamp ON revenue_events(timestamp DESC);
CREATE INDEX idx_revenue_events_amount ON revenue_events(amount DESC);

-- ============================================================================
-- SYSTEM INDEXES
-- ============================================================================

-- API keys indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);
CREATE INDEX idx_api_keys_last_used ON api_keys(last_used_at DESC);

-- Webhooks indexes
CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active);
CREATE INDEX idx_webhooks_events ON webhooks USING GIN(events);

-- Integrations indexes
CREATE INDEX idx_integrations_user_id ON integrations(user_id);
CREATE INDEX idx_integrations_type ON integrations(type);
CREATE INDEX idx_integrations_active ON integrations(is_active);
CREATE INDEX idx_integrations_sync_status ON integrations(sync_status);
CREATE INDEX idx_integrations_last_sync ON integrations(last_sync_at DESC);

-- Job queue indexes
CREATE INDEX idx_job_queue_type ON job_queue(type);
CREATE INDEX idx_job_queue_status ON job_queue(status);
CREATE INDEX idx_job_queue_priority ON job_queue(priority DESC);
CREATE INDEX idx_job_queue_scheduled_at ON job_queue(scheduled_at);
CREATE INDEX idx_job_queue_created_at ON job_queue(created_at DESC);

-- Composite index for job processing
CREATE INDEX idx_job_queue_processing ON job_queue(status, priority DESC, scheduled_at)
WHERE status IN ('pending', 'retrying');

-- ============================================================================
-- ADDITIONAL CONSTRAINTS
-- ============================================================================

-- Ensure email uniqueness across contacts and users
CREATE UNIQUE INDEX idx_unique_active_email_suppressions ON email_suppressions(email)
WHERE is_permanent = true;

-- Ensure one default pipeline per user
CREATE UNIQUE INDEX idx_unique_default_pipeline ON sales_pipelines(created_by)
WHERE is_default = true;

-- Ensure unique segment names per user
CREATE UNIQUE INDEX idx_unique_segment_names ON segments(name, created_by);

-- Ensure unique template names per user
CREATE UNIQUE INDEX idx_unique_template_names ON newsletter_templates(name, created_by);

-- Ensure unique workflow names per user
CREATE UNIQUE INDEX idx_unique_workflow_names ON workflows(name, created_by);

-- Ensure unique campaign names per user
CREATE UNIQUE INDEX idx_unique_campaign_names ON email_campaigns(name, created_by);

-- ============================================================================
-- PERFORMANCE OPTIMIZATIONS
-- ============================================================================

-- Partial indexes for active records only
CREATE INDEX idx_active_contacts ON contacts(id, email, lifecycle) WHERE status IS NULL OR status = 'active';
CREATE INDEX idx_active_workflows ON workflows(id, name, status) WHERE status = 'active';
CREATE INDEX idx_active_campaigns ON email_campaigns(id, name, status) WHERE status IN ('draft', 'scheduled', 'sending');

-- Covering indexes for common queries
CREATE INDEX idx_contacts_dashboard_covering ON contacts(owner_id, lifecycle, lead_score DESC, last_activity_at DESC)
INCLUDE (first_name, last_name, company, email);

CREATE INDEX idx_deals_pipeline_covering ON deals(pipeline_id, stage, status)
INCLUDE (name, value, expected_close_date, owner_id);

-- Indexes for time-series data partitioning preparation
CREATE INDEX idx_engagement_events_monthly ON engagement_events(date_trunc('month', timestamp), contact_id);
CREATE INDEX idx_email_deliveries_monthly ON email_deliveries(date_trunc('month', timestamp), contact_id);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_campaigns_updated_at BEFORE UPDATE ON email_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_newsletters_updated_at BEFORE UPDATE ON newsletters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_newsletter_templates_updated_at BEFORE UPDATE ON newsletter_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_items_updated_at BEFORE UPDATE ON content_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_sources_updated_at BEFORE UPDATE ON content_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_activities_updated_at BEFORE UPDATE ON contact_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update segment contact count
CREATE OR REPLACE FUNCTION update_segment_contact_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE segments SET contact_count = contact_count + 1 WHERE id = NEW.segment_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE segments SET contact_count = contact_count - 1 WHERE id = OLD.segment_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger to maintain segment contact counts
CREATE TRIGGER update_segment_count_on_insert AFTER INSERT ON contact_segments
    FOR EACH ROW EXECUTE FUNCTION update_segment_contact_count();

CREATE TRIGGER update_segment_count_on_delete AFTER DELETE ON contact_segments
    FOR EACH ROW EXECUTE FUNCTION update_segment_contact_count();

-- Function to update template usage count
CREATE OR REPLACE FUNCTION update_template_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.template_id IS NOT NULL THEN
        UPDATE newsletter_templates SET usage_count = usage_count + 1 WHERE id = NEW.template_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to maintain template usage counts
CREATE TRIGGER update_template_usage_on_newsletter_create AFTER INSERT ON newsletters
    FOR EACH ROW EXECUTE FUNCTION update_template_usage_count();
