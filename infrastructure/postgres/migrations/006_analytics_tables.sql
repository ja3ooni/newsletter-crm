-- Analytics Service Database Schema
-- Migration: 006_analytics_tables.sql

-- Engagement Events Table
CREATE TABLE IF NOT EXISTS engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL,
  newsletter_id UUID,
  campaign_id UUID,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('email_open', 'email_click', 'website_visit', 'form_submit', 'purchase', 'unsubscribe', 'bounce', 'complaint')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  score INTEGER DEFAULT 1,
  ip_address INET,
  user_agent TEXT,
  location JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Newsletter Metrics Table
CREATE TABLE IF NOT EXISTS newsletter_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL UNIQUE,
  sent INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  opens INTEGER DEFAULT 0,
  unique_opens INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  unsubscribes INTEGER DEFAULT 0,
  bounces INTEGER DEFAULT 0,
  complaints INTEGER DEFAULT 0,
  open_rate DECIMAL(5,2) DEFAULT 0,
  click_rate DECIMAL(5,2) DEFAULT 0,
  unsubscribe_rate DECIMAL(5,2) DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  revenue_attribution DECIMAL(10,2) DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue Attribution Table
CREATE TABLE IF NOT EXISTS revenue_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL,
  newsletter_id UUID,
  campaign_id UUID,
  touchpoint_type VARCHAR(50) NOT NULL CHECK (touchpoint_type IN ('email_open', 'email_click', 'website_visit', 'direct')),
  touchpoint_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  conversion_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  conversion_value DECIMAL(10,2) NOT NULL,
  conversion_type VARCHAR(50) NOT NULL CHECK (conversion_type IN ('purchase', 'subscription', 'upgrade', 'renewal')),
  attribution_model VARCHAR(50) NOT NULL CHECK (attribution_model IN ('first_touch', 'last_touch', 'linear', 'time_decay', 'position_based')),
  attribution_weight DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics Dashboards Table
CREATE TABLE IF NOT EXISTS analytics_dashboards (
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

-- Analytics Reports Table
CREATE TABLE IF NOT EXISTS analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('scheduled', 'on_demand')),
  format VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'csv', 'excel', 'json')),
  schedule JSONB,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  config JSONB NOT NULL DEFAULT '{}',
  last_generated TIMESTAMP WITH TIME ZONE,
  next_scheduled TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics Alerts Table
CREATE TABLE IF NOT EXISTS analytics_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metric VARCHAR(100) NOT NULL,
  condition VARCHAR(50) NOT NULL CHECK (condition IN ('greater_than', 'less_than', 'equals', 'not_equals', 'percentage_change')),
  threshold DECIMAL(10,2) NOT NULL,
  time_window INTEGER NOT NULL, -- minutes
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered TIMESTAMP WITH TIME ZONE,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT '{}' CHECK (channels <@ ARRAY['email', 'slack', 'webhook']),
  webhook_url TEXT,
  slack_channel VARCHAR(100),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriber Behavior Analysis Table
CREATE TABLE IF NOT EXISTS subscriber_behavior (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL UNIQUE,
  engagement_pattern VARCHAR(50) NOT NULL CHECK (engagement_pattern IN ('highly_engaged', 'moderately_engaged', 'low_engaged', 'at_risk', 'churned')),
  preferred_content_types TEXT[] DEFAULT '{}',
  optimal_send_time JSONB NOT NULL DEFAULT '{}',
  engagement_trend VARCHAR(20) CHECK (engagement_trend IN ('increasing', 'stable', 'decreasing')),
  churn_probability DECIMAL(3,2) DEFAULT 0,
  lifetime_value DECIMAL(10,2) DEFAULT 0,
  last_engagement TIMESTAMP WITH TIME ZONE,
  total_engagements INTEGER DEFAULT 0,
  average_engagement_score DECIMAL(5,2) DEFAULT 0,
  content_preferences JSONB NOT NULL DEFAULT '{}',
  device_preferences TEXT[] DEFAULT '{}',
  location_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversion Funnels Table
CREATE TABLE IF NOT EXISTS conversion_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  total_entries INTEGER DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0,
  dropoff_rates DECIMAL(5,2)[] DEFAULT '{}',
  average_time_to_complete INTEGER DEFAULT 0, -- minutes
  conversions_by_step INTEGER[] DEFAULT '{}',
  revenue_by_step DECIMAL(10,2)[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Predictive Insights Table
CREATE TABLE IF NOT EXISTS predictive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('churn_prediction', 'optimal_send_time', 'content_recommendation', 'revenue_forecast')),
  contact_id UUID,
  prediction JSONB NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  factors TEXT[] DEFAULT '{}',
  model_version VARCHAR(50) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_engagement_events_contact_id ON engagement_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_newsletter_id ON engagement_events(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_campaign_id ON engagement_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_event_type ON engagement_events(event_type);
CREATE INDEX IF NOT EXISTS idx_engagement_events_timestamp ON engagement_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_events_composite ON engagement_events(contact_id, event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_metrics_newsletter_id ON newsletter_metrics(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_metrics_updated_at ON newsletter_metrics(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_attribution_contact_id ON revenue_attribution(contact_id);
CREATE INDEX IF NOT EXISTS idx_revenue_attribution_newsletter_id ON revenue_attribution(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_revenue_attribution_campaign_id ON revenue_attribution(campaign_id);
CREATE INDEX IF NOT EXISTS idx_revenue_attribution_conversion_timestamp ON revenue_attribution(conversion_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_attribution_touchpoint_timestamp ON revenue_attribution(touchpoint_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_created_by ON analytics_dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_is_public ON analytics_dashboards(is_public);

CREATE INDEX IF NOT EXISTS idx_analytics_reports_created_by ON analytics_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_status ON analytics_reports(status);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_next_scheduled ON analytics_reports(next_scheduled);

CREATE INDEX IF NOT EXISTS idx_analytics_alerts_created_by ON analytics_alerts(created_by);
CREATE INDEX IF NOT EXISTS idx_analytics_alerts_is_active ON analytics_alerts(is_active);

CREATE INDEX IF NOT EXISTS idx_subscriber_behavior_contact_id ON subscriber_behavior(contact_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_behavior_engagement_pattern ON subscriber_behavior(engagement_pattern);
CREATE INDEX IF NOT EXISTS idx_subscriber_behavior_churn_probability ON subscriber_behavior(churn_probability DESC);

CREATE INDEX IF NOT EXISTS idx_conversion_funnels_name ON conversion_funnels(name);

CREATE INDEX IF NOT EXISTS idx_predictive_insights_type ON predictive_insights(type);
CREATE INDEX IF NOT EXISTS idx_predictive_insights_contact_id ON predictive_insights(contact_id);
CREATE INDEX IF NOT EXISTS idx_predictive_insights_expires_at ON predictive_insights(expires_at);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_newsletter_metrics_updated_at BEFORE UPDATE ON newsletter_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_analytics_dashboards_updated_at BEFORE UPDATE ON analytics_dashboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_analytics_reports_updated_at BEFORE UPDATE ON analytics_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_analytics_alerts_updated_at BEFORE UPDATE ON analytics_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriber_behavior_updated_at BEFORE UPDATE ON subscriber_behavior FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversion_funnels_updated_at BEFORE UPDATE ON conversion_funnels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE engagement_events IS 'Stores all user engagement events for analytics tracking';
COMMENT ON TABLE newsletter_metrics IS 'Aggregated metrics for each newsletter';
COMMENT ON TABLE revenue_attribution IS 'Tracks revenue attribution to marketing touchpoints';
COMMENT ON TABLE analytics_dashboards IS 'Custom analytics dashboards configuration';
COMMENT ON TABLE analytics_reports IS 'Scheduled and on-demand analytics reports';
COMMENT ON TABLE analytics_alerts IS 'Analytics alerts and notifications configuration';
COMMENT ON TABLE subscriber_behavior IS 'Analyzed subscriber behavior patterns and predictions';
COMMENT ON TABLE conversion_funnels IS 'Conversion funnel analysis and tracking';
COMMENT ON TABLE predictive_insights IS 'Machine learning predictions and insights';
