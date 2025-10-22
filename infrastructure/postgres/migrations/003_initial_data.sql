-- Initial Data Seeding
-- Migration: 003_initial_data.sql
-- Description: Seeds initial data including roles, subscription plans, and default configurations

-- ============================================================================
-- USER ROLES AND PERMISSIONS
-- ============================================================================

-- Insert default user roles
INSERT INTO user_roles (id, name, description, permissions) VALUES
(
    uuid_generate_v4(),
    'admin',
    'Full system administrator with all permissions',
    '[
        "users.create", "users.read", "users.update", "users.delete",
        "contacts.create", "contacts.read", "contacts.update", "contacts.delete",
        "segments.create", "segments.read", "segments.update", "segments.delete",
        "workflows.create", "workflows.read", "workflows.update", "workflows.delete",
        "campaigns.create", "campaigns.read", "campaigns.update", "campaigns.delete",
        "newsletters.create", "newsletters.read", "newsletters.update", "newsletters.delete",
        "templates.create", "templates.read", "templates.update", "templates.delete",
        "analytics.read", "reports.read", "settings.update", "integrations.manage",
        "billing.read", "billing.update", "system.admin"
    ]'::jsonb
),
(
    uuid_generate_v4(),
    'editor',
    'Content editor with newsletter and campaign management permissions',
    '[
        "contacts.read", "contacts.update",
        "segments.create", "segments.read", "segments.update",
        "workflows.create", "workflows.read", "workflows.update",
        "campaigns.create", "campaigns.read", "campaigns.update",
        "newsletters.create", "newsletters.read", "newsletters.update",
        "templates.create", "templates.read", "templates.update",
        "analytics.read", "reports.read"
    ]'::jsonb
),
(
    uuid_generate_v4(),
    'marketer',
    'Marketing specialist with CRM and automation permissions',
    '[
        "contacts.create", "contacts.read", "contacts.update",
        "segments.create", "segments.read", "segments.update",
        "workflows.create", "workflows.read", "workflows.update",
        "campaigns.create", "campaigns.read", "campaigns.update",
        "newsletters.read", "analytics.read", "reports.read"
    ]'::jsonb
),
(
    uuid_generate_v4(),
    'subscriber',
    'Basic subscriber with limited read permissions',
    '[
        "newsletters.read", "profile.update", "preferences.update"
    ]'::jsonb
),
(
    uuid_generate_v4(),
    'api_user',
    'API access user with programmatic permissions',
    '[
        "contacts.create", "contacts.read", "contacts.update",
        "segments.read", "campaigns.read", "newsletters.read",
        "analytics.read", "webhooks.manage"
    ]'::jsonb
);

-- ============================================================================
-- SUBSCRIPTION PLANS
-- ============================================================================

-- Insert default subscription plans
INSERT INTO subscription_plans (id, name, description, price_monthly, price_yearly, features, limits) VALUES
(
    uuid_generate_v4(),
    'Free',
    'Basic newsletter functionality for getting started',
    0.00,
    0.00,
    '[
        "Basic newsletter creation",
        "Up to 100 subscribers",
        "1 newsletter per month",
        "Basic templates",
        "Email support"
    ]'::jsonb,
    '{
        "subscribers": 100,
        "newsletters_per_month": 1,
        "templates": 5,
        "segments": 1,
        "workflows": 0,
        "api_calls_per_month": 100,
        "storage_gb": 0.1
    }'::jsonb
),
(
    uuid_generate_v4(),
    'Starter',
    'Perfect for small businesses and growing newsletters',
    29.00,
    290.00,
    '[
        "Advanced newsletter editor",
        "Up to 1,000 subscribers",
        "Unlimited newsletters",
        "Premium templates",
        "Basic CRM features",
        "Email automation",
        "Analytics dashboard",
        "Email support"
    ]'::jsonb,
    '{
        "subscribers": 1000,
        "newsletters_per_month": -1,
        "templates": 50,
        "segments": 10,
        "workflows": 5,
        "api_calls_per_month": 1000,
        "storage_gb": 1
    }'::jsonb
),
(
    uuid_generate_v4(),
    'Professional',
    'Advanced features for marketing teams and agencies',
    99.00,
    990.00,
    '[
        "Everything in Starter",
        "Up to 10,000 subscribers",
        "Advanced CRM with lead scoring",
        "Marketing automation workflows",
        "A/B testing",
        "Advanced analytics",
        "Custom branding",
        "Priority support",
        "API access"
    ]'::jsonb,
    '{
        "subscribers": 10000,
        "newsletters_per_month": -1,
        "templates": 200,
        "segments": 50,
        "workflows": 25,
        "api_calls_per_month": 10000,
        "storage_gb": 10,
        "custom_branding": true,
        "ab_testing": true,
        "advanced_analytics": true
    }'::jsonb
),
(
    uuid_generate_v4(),
    'Enterprise',
    'Full-featured solution for large organizations',
    299.00,
    2990.00,
    '[
        "Everything in Professional",
        "Unlimited subscribers",
        "Advanced deliverability tools",
        "Custom integrations",
        "Dedicated account manager",
        "SLA guarantee",
        "Advanced security features",
        "Custom reporting",
        "White-label options"
    ]'::jsonb,
    '{
        "subscribers": -1,
        "newsletters_per_month": -1,
        "templates": -1,
        "segments": -1,
        "workflows": -1,
        "api_calls_per_month": 100000,
        "storage_gb": 100,
        "custom_branding": true,
        "ab_testing": true,
        "advanced_analytics": true,
        "white_label": true,
        "sla": true,
        "dedicated_support": true
    }'::jsonb
);

-- ============================================================================
-- DEFAULT NEWSLETTER TEMPLATES
-- ============================================================================

-- Insert default newsletter templates
INSERT INTO newsletter_templates (id, name, category, html, css, variables, preview_image, is_public, created_by) VALUES
(
    uuid_generate_v4(),
    'Modern Tech Newsletter',
    'tech',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{newsletter_title}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">{{newsletter_title}}</h1>
                            <p style="color: #ffffff; margin: 10px 0 0; opacity: 0.9;">{{newsletter_subtitle}}</p>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            {{newsletter_content}}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0; color: #6c757d; font-size: 14px;">
                                You received this email because you subscribed to our newsletter.
                                <a href="{{unsubscribe_url}}" style="color: #667eea;">Unsubscribe</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>',
    '.newsletter-content h2 { color: #333; font-size: 24px; margin: 30px 0 15px; }
     .newsletter-content p { color: #555; line-height: 1.6; margin: 15px 0; }
     .newsletter-content a { color: #667eea; text-decoration: none; }
     .newsletter-content a:hover { text-decoration: underline; }',
    '[
        {"name": "newsletter_title", "type": "text", "defaultValue": "Tech Weekly", "description": "Main newsletter title"},
        {"name": "newsletter_subtitle", "type": "text", "defaultValue": "Your weekly dose of tech news", "description": "Newsletter subtitle"},
        {"name": "newsletter_content", "type": "text", "defaultValue": "", "description": "Main newsletter content"}
    ]'::jsonb,
    '/templates/modern-tech-preview.png',
    true,
    NULL
),
(
    uuid_generate_v4(),
    'Minimal Business',
    'business',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{newsletter_title}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Georgia, serif; background-color: #ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table width="600" cellpadding="0" cellspacing="0">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 0 0 30px; text-align: center; border-bottom: 2px solid #333333;">
                            <h1 style="color: #333333; margin: 0; font-size: 32px; font-weight: normal; letter-spacing: 2px;">{{newsletter_title}}</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 0;">
                            {{newsletter_content}}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 0 0; border-top: 1px solid #e0e0e0; text-align: center;">
                            <p style="margin: 0; color: #888888; font-size: 12px; font-family: Arial, sans-serif;">
                                <a href="{{unsubscribe_url}}" style="color: #888888;">Unsubscribe</a> |
                                <a href="{{preferences_url}}" style="color: #888888;">Update Preferences</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>',
    '.newsletter-content h2 { color: #333; font-size: 22px; margin: 25px 0 10px; font-weight: normal; }
     .newsletter-content p { color: #444; line-height: 1.7; margin: 15px 0; font-size: 16px; }
     .newsletter-content a { color: #333; border-bottom: 1px solid #333; text-decoration: none; }',
    '[
        {"name": "newsletter_title", "type": "text", "defaultValue": "Business Brief", "description": "Newsletter title"},
        {"name": "newsletter_content", "type": "text", "defaultValue": "", "description": "Newsletter content"}
    ]'::jsonb,
    '/templates/minimal-business-preview.png',
    true,
    NULL
);

-- ============================================================================
-- DEFAULT SALES PIPELINE
-- ============================================================================

-- Insert default sales pipeline
INSERT INTO sales_pipelines (id, name, description, stages, is_default, created_by) VALUES
(
    uuid_generate_v4(),
    'Default Sales Pipeline',
    'Standard B2B sales pipeline with common stages',
    '[
        {"name": "Lead", "probability": 10, "description": "Initial contact or inquiry"},
        {"name": "Qualified", "probability": 25, "description": "Lead has been qualified and shows interest"},
        {"name": "Proposal", "probability": 50, "description": "Proposal or quote has been sent"},
        {"name": "Negotiation", "probability": 75, "description": "In active negotiation"},
        {"name": "Closed Won", "probability": 100, "description": "Deal successfully closed"},
        {"name": "Closed Lost", "probability": 0, "description": "Deal was lost"}
    ]'::jsonb,
    true,
    NULL
);

-- ============================================================================
-- DEFAULT LEAD SCORING RULES
-- ============================================================================

-- Insert default lead scoring rules
INSERT INTO lead_scoring_rules (id, name, description, trigger, points, is_active) VALUES
(
    uuid_generate_v4(),
    'Email Open',
    'Points for opening newsletter emails',
    '{"event_type": "email_open"}'::jsonb,
    5,
    true
),
(
    uuid_generate_v4(),
    'Email Click',
    'Points for clicking links in emails',
    '{"event_type": "email_click"}'::jsonb,
    10,
    true
),
(
    uuid_generate_v4(),
    'Website Visit',
    'Points for visiting the website',
    '{"event_type": "website_visit"}'::jsonb,
    3,
    true
),
(
    uuid_generate_v4(),
    'Form Submission',
    'Points for submitting contact forms',
    '{"event_type": "form_submit"}'::jsonb,
    25,
    true
),
(
    uuid_generate_v4(),
    'Newsletter Subscription',
    'Points for subscribing to newsletter',
    '{"event_type": "newsletter_subscribe"}'::jsonb,
    15,
    true
),
(
    uuid_generate_v4(),
    'Content Download',
    'Points for downloading content/resources',
    '{"event_type": "content_download"}'::jsonb,
    20,
    true
);

-- ============================================================================
-- DEFAULT CONTENT SOURCES
-- ============================================================================

-- Insert default content sources for tech newsletters
INSERT INTO content_sources (id, name, type, url, configuration, is_active, fetch_frequency) VALUES
(
    uuid_generate_v4(),
    'Hacker News',
    'api',
    'https://hacker-news.firebaseio.com/v0/topstories.json',
    '{
        "api_key": null,
        "max_items": 10,
        "min_score": 100,
        "categories": ["technology", "programming", "startups"]
    }'::jsonb,
    true,
    3600
),
(
    uuid_generate_v4(),
    'GitHub Trending',
    'api',
    'https://api.github.com/search/repositories',
    '{
        "query_params": {"q": "created:>{{date}}", "sort": "stars", "order": "desc"},
        "max_items": 5,
        "languages": ["javascript", "python", "typescript", "go", "rust"]
    }'::jsonb,
    true,
    7200
),
(
    uuid_generate_v4(),
    'TechCrunch RSS',
    'rss',
    'https://techcrunch.com/feed/',
    '{
        "max_items": 15,
        "categories": ["startups", "funding", "ai", "mobile"]
    }'::jsonb,
    true,
    1800
),
(
    uuid_generate_v4(),
    'Dev.to RSS',
    'rss',
    'https://dev.to/feed',
    '{
        "max_items": 10,
        "tags": ["javascript", "python", "webdev", "tutorial"]
    }'::jsonb,
    true,
    3600
);

-- ============================================================================
-- DEFAULT SEGMENTS
-- ============================================================================

-- Insert default segments (these will be global/system segments)
INSERT INTO segments (id, name, description, conditions, is_auto_updating, created_by) VALUES
(
    uuid_generate_v4(),
    'Highly Engaged Subscribers',
    'Subscribers with high engagement scores and recent activity',
    '{
        "rules": [
            {"field": "engagement_score", "operator": "greater_than", "value": 75},
            {"field": "last_activity_at", "operator": "within_days", "value": 30}
        ],
        "logic": "AND"
    }'::jsonb,
    true,
    NULL
),
(
    uuid_generate_v4(),
    'New Subscribers',
    'Subscribers who joined in the last 7 days',
    '{
        "rules": [
            {"field": "created_at", "operator": "within_days", "value": 7}
        ]
    }'::jsonb,
    true,
    NULL
),
(
    uuid_generate_v4(),
    'Inactive Subscribers',
    'Subscribers with no activity in the last 60 days',
    '{
        "rules": [
            {"field": "last_activity_at", "operator": "older_than_days", "value": 60}
        ]
    }'::jsonb,
    true,
    NULL
),
(
    uuid_generate_v4(),
    'Enterprise Contacts',
    'Contacts from companies with 500+ employees',
    '{
        "rules": [
            {"field": "custom_fields.company_size", "operator": "greater_than", "value": 500}
        ]
    }'::jsonb,
    true,
    NULL
);

-- ============================================================================
-- DEFAULT WORKFLOW TEMPLATES
-- ============================================================================

-- Insert default workflow templates
INSERT INTO workflows (id, name, description, trigger, steps, status, created_by) VALUES
(
    uuid_generate_v4(),
    'Welcome Series',
    'Automated welcome email series for new subscribers',
    '{
        "type": "event",
        "event": "contact_created",
        "conditions": [
            {"field": "source", "operator": "equals", "value": "newsletter_signup"}
        ]
    }'::jsonb,
    '[
        {
            "id": "welcome_email_1",
            "type": "email",
            "delay_hours": 0,
            "config": {
                "subject": "Welcome to our newsletter!",
                "template": "welcome_email_1",
                "personalization": true
            }
        },
        {
            "id": "welcome_email_2",
            "type": "email",
            "delay_hours": 72,
            "config": {
                "subject": "Getting the most out of your subscription",
                "template": "welcome_email_2"
            }
        },
        {
            "id": "welcome_email_3",
            "type": "email",
            "delay_hours": 168,
            "config": {
                "subject": "Here are our most popular resources",
                "template": "welcome_email_3"
            }
        }
    ]'::jsonb,
    'active',
    NULL
),
(
    uuid_generate_v4(),
    'Re-engagement Campaign',
    'Win back inactive subscribers',
    '{
        "type": "schedule",
        "schedule": "0 9 * * 1",
        "conditions": [
            {"field": "last_activity_at", "operator": "older_than_days", "value": 30},
            {"field": "lifecycle", "operator": "equals", "value": "subscriber"}
        ]
    }'::jsonb,
    '[
        {
            "id": "reengagement_email_1",
            "type": "email",
            "delay_hours": 0,
            "config": {
                "subject": "We miss you! Here''s what you''ve been missing",
                "template": "reengagement_email_1"
            }
        },
        {
            "id": "wait_7_days",
            "type": "wait",
            "delay_hours": 168
        },
        {
            "id": "reengagement_email_2",
            "type": "email",
            "delay_hours": 0,
            "config": {
                "subject": "Last chance - Update your preferences or unsubscribe",
                "template": "reengagement_email_2"
            }
        }
    ]'::jsonb,
    'active',
    NULL
);

-- ============================================================================
-- SYSTEM CONFIGURATION
-- ============================================================================

-- Create a system configuration table for global settings
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default system configuration
INSERT INTO system_config (key, value, description) VALUES
('email_settings', '{
    "from_name": "AiLert Newsletter",
    "from_email": "newsletter@ailert.com",
    "reply_to": "support@ailert.com",
    "bounce_email": "bounce@ailert.com",
    "default_timezone": "UTC"
}'::jsonb, 'Default email sending configuration'),

('deliverability_settings', '{
    "enable_dkim": true,
    "enable_spf": true,
    "enable_dmarc": true,
    "bounce_threshold": 5.0,
    "complaint_threshold": 0.5,
    "reputation_threshold": 80
}'::jsonb, 'Email deliverability and reputation settings'),

('analytics_settings', '{
    "track_opens": true,
    "track_clicks": true,
    "track_unsubscribes": true,
    "retention_days": 730,
    "anonymize_after_days": 365
}'::jsonb, 'Analytics and tracking configuration'),

('security_settings', '{
    "password_min_length": 8,
    "require_2fa": false,
    "session_timeout_hours": 24,
    "max_login_attempts": 5,
    "lockout_duration_minutes": 30
}'::jsonb, 'Security and authentication settings'),

('feature_flags', '{
    "enable_ab_testing": true,
    "enable_workflows": true,
    "enable_crm": true,
    "enable_analytics": true,
    "enable_integrations": true,
    "enable_api": true
}'::jsonb, 'Feature flags for enabling/disabling functionality');

-- ============================================================================
-- INDEXES FOR INITIAL DATA
-- ============================================================================

-- Ensure we have proper indexes on the seeded data
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Update statistics after data insertion
ANALYZE users;
ANALYZE user_roles;
ANALYZE subscription_plans;
ANALYZE subscriptions;
ANALYZE contacts;
ANALYZE segments;
ANALYZE workflows;
ANALYZE newsletter_templates;
ANALYZE content_sources;
ANALYZE lead_scoring_rules;
ANALYZE sales_pipelines;
ANALYZE system_config;
