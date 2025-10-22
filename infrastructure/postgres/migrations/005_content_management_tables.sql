-- Content Management System Tables
-- Migration: 005_content_management_tables.sql
-- Description: Creates tables for content library, content blocks, and approval workflows

-- ============================================================================
-- CONTENT LIBRARY TABLES
-- ============================================================================

-- Content library items for reusable content
CREATE TABLE content_library_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('article', 'block', 'template', 'image')),
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES users(id) NOT NULL,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content blocks for reusable newsletter components
CREATE TABLE content_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    html TEXT NOT NULL,
    css TEXT,
    variables JSONB NOT NULL DEFAULT '[]',
    category VARCHAR(100) NOT NULL,
    is_reusable BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approval workflows for content review
CREATE TABLE approval_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES content_library_items(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revision_requested', 'cancelled')),
    stages JSONB NOT NULL DEFAULT '[]',
    current_stage INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content performance tracking
CREATE TABLE content_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES content_library_items(id) ON DELETE CASCADE,
    newsletter_id UUID REFERENCES newsletters(id),
    campaign_id UUID REFERENCES email_campaigns(id),
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('views', 'clicks', 'shares', 'engagement_time', 'conversions')),
    metric_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Content analytics aggregated data
CREATE TABLE content_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES content_library_items(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_views INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    avg_engagement_time DECIMAL(8,2) DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    performance_score DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR CONTENT MANAGEMENT TABLES
-- ============================================================================

-- Content library items indexes
CREATE INDEX idx_content_library_items_type ON content_library_items(type);
CREATE INDEX idx_content_library_items_status ON content_library_items(status);
CREATE INDEX idx_content_library_items_category ON content_library_items(category);
CREATE INDEX idx_content_library_items_tags ON content_library_items USING GIN(tags);
CREATE INDEX idx_content_library_items_created_by ON content_library_items(created_by);
CREATE INDEX idx_content_library_items_approved_by ON content_library_items(approved_by);
CREATE INDEX idx_content_library_items_created_at ON content_library_items(created_at DESC);
CREATE INDEX idx_content_library_items_approved_at ON content_library_items(approved_at DESC);

-- Full-text search index for content library
CREATE INDEX idx_content_library_search ON content_library_items USING GIN(
    to_tsvector('english', title || ' ' || content)
);

-- Content blocks indexes
CREATE INDEX idx_content_blocks_name ON content_blocks(name);
CREATE INDEX idx_content_blocks_category ON content_blocks(category);
CREATE INDEX idx_content_blocks_reusable ON content_blocks(is_reusable);
CREATE INDEX idx_content_blocks_created_by ON content_blocks(created_by);
CREATE INDEX idx_content_blocks_created_at ON content_blocks(created_at DESC);

-- Full-text search index for content blocks
CREATE INDEX idx_content_blocks_search ON content_blocks USING GIN(
    to_tsvector('english', name || ' ' || html)
);

-- Approval workflows indexes
CREATE INDEX idx_approval_workflows_content_id ON approval_workflows(content_id);
CREATE INDEX idx_approval_workflows_status ON approval_workflows(status);
CREATE INDEX idx_approval_workflows_current_stage ON approval_workflows(current_stage);
CREATE INDEX idx_approval_workflows_created_by ON approval_workflows(created_by);
CREATE INDEX idx_approval_workflows_created_at ON approval_workflows(created_at DESC);

-- Content performance indexes
CREATE INDEX idx_content_performance_content_id ON content_performance(content_id);
CREATE INDEX idx_content_performance_newsletter_id ON content_performance(newsletter_id);
CREATE INDEX idx_content_performance_campaign_id ON content_performance(campaign_id);
CREATE INDEX idx_content_performance_metric_type ON content_performance(metric_type);
CREATE INDEX idx_content_performance_recorded_at ON content_performance(recorded_at DESC);

-- Content analytics indexes
CREATE INDEX idx_content_analytics_content_id ON content_analytics(content_id);
CREATE INDEX idx_content_analytics_period ON content_analytics(period_start, period_end);
CREATE INDEX idx_content_analytics_performance_score ON content_analytics(performance_score DESC);
CREATE INDEX idx_content_analytics_created_at ON content_analytics(created_at DESC);

-- ============================================================================
-- CONSTRAINTS AND UNIQUE INDEXES
-- ============================================================================

-- Ensure unique content block names per user
CREATE UNIQUE INDEX idx_unique_content_block_names ON content_blocks(name, created_by);

-- Ensure unique content analytics per content and period
CREATE UNIQUE INDEX idx_unique_content_analytics_period ON content_analytics(content_id, period_start, period_end);

-- Ensure one active approval workflow per content item
CREATE UNIQUE INDEX idx_unique_active_approval_workflow ON approval_workflows(content_id)
WHERE status IN ('pending', 'revision_requested');

-- ============================================================================
-- TRIGGERS FOR CONTENT MANAGEMENT
-- ============================================================================

-- Apply updated_at triggers to content management tables
CREATE TRIGGER update_content_library_items_updated_at BEFORE UPDATE ON content_library_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_blocks_updated_at BEFORE UPDATE ON content_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON approval_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_analytics_updated_at BEFORE UPDATE ON content_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically approve certain content types
CREATE OR REPLACE FUNCTION auto_approve_content()
RETURNS TRIGGER AS $
BEGIN
    -- Auto-approve image and block types for trusted users
    IF NEW.type IN ('image', 'block') AND NEW.created_by IN (
        SELECT user_id FROM user_role_assignments ura
        JOIN user_roles ur ON ura.role_id = ur.id
        WHERE ur.name IN ('admin', 'editor')
    ) THEN
        NEW.status = 'approved';
        NEW.approved_by = NEW.created_by;
        NEW.approved_at = NOW();
    END IF;

    RETURN NEW;
END;
$ language 'plpgsql';

-- Trigger for auto-approval
CREATE TRIGGER auto_approve_content_trigger BEFORE INSERT ON content_library_items
    FOR EACH ROW EXECUTE FUNCTION auto_approve_content();

-- Function to update content performance scores
CREATE OR REPLACE FUNCTION update_content_performance_score()
RETURNS TRIGGER AS $
BEGIN
    -- Recalculate performance score when new performance data is added
    INSERT INTO content_analytics (
        content_id,
        period_start,
        period_end,
        performance_score
    )
    SELECT
        NEW.content_id,
        date_trunc('day', NEW.recorded_at)::date,
        date_trunc('day', NEW.recorded_at)::date,
        CASE
            WHEN NEW.metric_type = 'clicks' THEN NEW.metric_value * 2
            WHEN NEW.metric_type = 'shares' THEN NEW.metric_value * 3
            WHEN NEW.metric_type = 'conversions' THEN NEW.metric_value * 5
            ELSE NEW.metric_value
        END
    ON CONFLICT (content_id, period_start, period_end)
    DO UPDATE SET
        performance_score = content_analytics.performance_score + EXCLUDED.performance_score,
        updated_at = NOW();

    RETURN NEW;
END;
$ language 'plpgsql';

-- Trigger for performance score updates
CREATE TRIGGER update_performance_score_trigger AFTER INSERT ON content_performance
    FOR EACH ROW EXECUTE FUNCTION update_content_performance_score();
