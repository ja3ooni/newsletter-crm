-- Migration Scripts Setup
-- Migration: 004_migration_scripts.sql
-- Description: Creates tables and functions to support data migration from DynamoDB to PostgreSQL

-- ============================================================================
-- MIGRATION TRACKING TABLES
-- ============================================================================

-- Migration status tracking
CREATE TABLE migration_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'rolled_back')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    records_processed INTEGER DEFAULT 0,
    records_total INTEGER DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration log for detailed tracking
CREATE TABLE migration_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_name VARCHAR(255) NOT NULL,
    log_level VARCHAR(10) NOT NULL CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data validation results
CREATE TABLE migration_validation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_name VARCHAR(255) NOT NULL,
    validation_type VARCHAR(50) NOT NULL,
    source_count INTEGER,
    target_count INTEGER,
    discrepancy_count INTEGER DEFAULT 0,
    validation_status VARCHAR(20) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'passed', 'failed')),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rollback tracking
CREATE TABLE migration_rollback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_name VARCHAR(255) NOT NULL,
    rollback_reason TEXT,
    backup_location TEXT,
    rollback_status VARCHAR(20) DEFAULT 'pending' CHECK (rollback_status IN ('pending', 'in_progress', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- ============================================================================
-- MIGRATION HELPER FUNCTIONS
-- ============================================================================

-- Function to log migration events
CREATE OR REPLACE FUNCTION log_migration_event(
    p_migration_name VARCHAR(255),
    p_log_level VARCHAR(10),
    p_message TEXT,
    p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO migration_log (migration_name, log_level, message, details)
    VALUES (p_migration_name, p_log_level, p_message, p_details);
END;
$$ LANGUAGE plpgsql;

-- Function to update migration status
CREATE OR REPLACE FUNCTION update_migration_status(
    p_migration_name VARCHAR(255),
    p_status VARCHAR(20),
    p_records_processed INTEGER DEFAULT NULL,
    p_records_total INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO migration_status (migration_name, status, records_processed, records_total, error_message, started_at, completed_at)
    VALUES (
        p_migration_name,
        p_status,
        COALESCE(p_records_processed, 0),
        COALESCE(p_records_total, 0),
        p_error_message,
        CASE WHEN p_status = 'running' THEN NOW() ELSE NULL END,
        CASE WHEN p_status IN ('completed', 'failed', 'rolled_back') THEN NOW() ELSE NULL END
    )
    ON CONFLICT (migration_name) DO UPDATE SET
        status = EXCLUDED.status,
        records_processed = COALESCE(EXCLUDED.records_processed, migration_status.records_processed),
        records_total = COALESCE(EXCLUDED.records_total, migration_status.records_total),
        error_message = EXCLUDED.error_message,
        started_at = COALESCE(EXCLUDED.started_at, migration_status.started_at),
        completed_at = EXCLUDED.completed_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to validate migration data
CREATE OR REPLACE FUNCTION validate_migration_data(
    p_migration_name VARCHAR(255),
    p_validation_type VARCHAR(50),
    p_source_count INTEGER,
    p_target_count INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_discrepancy INTEGER;
    v_status VARCHAR(20);
BEGIN
    v_discrepancy := ABS(p_source_count - p_target_count);
    v_status := CASE WHEN v_discrepancy = 0 THEN 'passed' ELSE 'failed' END;

    INSERT INTO migration_validation (
        migration_name, validation_type, source_count, target_count,
        discrepancy_count, validation_status
    )
    VALUES (
        p_migration_name, p_validation_type, p_source_count, p_target_count,
        v_discrepancy, v_status
    );

    PERFORM log_migration_event(
        p_migration_name,
        CASE WHEN v_status = 'passed' THEN 'INFO' ELSE 'ERROR' END,
        format('Validation %s: Source=%s, Target=%s, Discrepancy=%s',
               p_validation_type, p_source_count, p_target_count, v_discrepancy)
    );

    RETURN v_status = 'passed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA TRANSFORMATION FUNCTIONS
-- ============================================================================

-- Function to transform DynamoDB timestamp to PostgreSQL timestamp
CREATE OR REPLACE FUNCTION transform_dynamo_timestamp(dynamo_ts TEXT)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    -- Handle various timestamp formats from DynamoDB
    IF dynamo_ts IS NULL OR dynamo_ts = '' THEN
        RETURN NULL;
    END IF;

    -- Try ISO format first
    BEGIN
        RETURN dynamo_ts::TIMESTAMP WITH TIME ZONE;
    EXCEPTION WHEN OTHERS THEN
        -- Try epoch timestamp
        BEGIN
            RETURN to_timestamp(dynamo_ts::BIGINT);
        EXCEPTION WHEN OTHERS THEN
            -- Default to current timestamp if parsing fails
            PERFORM log_migration_event('data_transform', 'WARN',
                format('Failed to parse timestamp: %s', dynamo_ts));
            RETURN NOW();
        END;
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to clean and validate email addresses
CREATE OR REPLACE FUNCTION clean_email_address(email_input TEXT)
RETURNS TEXT AS $$
BEGIN
    IF email_input IS NULL OR email_input = '' THEN
        RETURN NULL;
    END IF;

    -- Clean and lowercase email
    email_input := LOWER(TRIM(email_input));

    -- Basic email validation
    IF email_input ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
        RETURN email_input;
    ELSE
        PERFORM log_migration_event('data_transform', 'WARN',
            format('Invalid email format: %s', email_input));
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to transform engagement metrics from DynamoDB format
CREATE OR REPLACE FUNCTION transform_engagement_metrics(dynamo_metrics JSONB)
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
BEGIN
    IF dynamo_metrics IS NULL THEN
        RETURN '{
            "total_opens": 0,
            "total_clicks": 0,
            "total_unsubscribes": 0,
            "engagement_score": 0.0,
            "last_engagement": null
        }'::JSONB;
    END IF;

    -- Transform metrics to new format
    result := jsonb_build_object(
        'total_opens', COALESCE((dynamo_metrics->>'total_opens')::INTEGER, 0),
        'total_clicks', COALESCE((dynamo_metrics->>'total_clicks')::INTEGER, 0),
        'total_unsubscribes', COALESCE((dynamo_metrics->>'unsubscribes')::INTEGER, 0),
        'engagement_score', COALESCE((dynamo_metrics->>'engagement_score')::DECIMAL, 0.0),
        'last_engagement', dynamo_metrics->>'last_opened'
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BACKUP AND ROLLBACK FUNCTIONS
-- ============================================================================

-- Function to create backup before migration
CREATE OR REPLACE FUNCTION create_migration_backup(
    p_migration_name VARCHAR(255),
    p_table_name VARCHAR(255)
)
RETURNS TEXT AS $$
DECLARE
    backup_table_name TEXT;
    backup_count INTEGER;
BEGIN
    backup_table_name := format('%s_backup_%s', p_table_name,
                               to_char(NOW(), 'YYYYMMDD_HH24MISS'));

    -- Create backup table
    EXECUTE format('CREATE TABLE %s AS SELECT * FROM %s',
                   backup_table_name, p_table_name);

    -- Get backup count
    EXECUTE format('SELECT COUNT(*) FROM %s', backup_table_name) INTO backup_count;

    PERFORM log_migration_event(p_migration_name, 'INFO',
        format('Created backup table %s with %s records', backup_table_name, backup_count));

    RETURN backup_table_name;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback migration
CREATE OR REPLACE FUNCTION rollback_migration(
    p_migration_name VARCHAR(255),
    p_backup_table VARCHAR(255),
    p_target_table VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
    rollback_id UUID;
BEGIN
    -- Start rollback tracking
    INSERT INTO migration_rollback (migration_name, backup_location, rollback_status)
    VALUES (p_migration_name, p_backup_table, 'in_progress')
    RETURNING id INTO rollback_id;

    BEGIN
        -- Clear target table
        EXECUTE format('TRUNCATE TABLE %s CASCADE', p_target_table);

        -- Restore from backup
        EXECUTE format('INSERT INTO %s SELECT * FROM %s', p_target_table, p_backup_table);

        -- Update rollback status
        UPDATE migration_rollback
        SET rollback_status = 'completed', completed_at = NOW()
        WHERE id = rollback_id;

        -- Update migration status
        PERFORM update_migration_status(p_migration_name, 'rolled_back');

        PERFORM log_migration_event(p_migration_name, 'INFO',
            format('Successfully rolled back migration from %s', p_backup_table));

        RETURN TRUE;

    EXCEPTION WHEN OTHERS THEN
        -- Update rollback status on error
        UPDATE migration_rollback
        SET rollback_status = 'failed',
            completed_at = NOW(),
            error_message = SQLERRM
        WHERE id = rollback_id;

        PERFORM log_migration_event(p_migration_name, 'ERROR',
            format('Rollback failed: %s', SQLERRM));

        RETURN FALSE;
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION PROGRESS TRACKING
-- ============================================================================

-- Function to get migration progress
CREATE OR REPLACE FUNCTION get_migration_progress(p_migration_name VARCHAR(255))
RETURNS TABLE (
    migration_name VARCHAR(255),
    status VARCHAR(20),
    progress_percentage DECIMAL(5,2),
    records_processed INTEGER,
    records_total INTEGER,
    started_at TIMESTAMP WITH TIME ZONE,
    estimated_completion TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ms.migration_name,
        ms.status,
        CASE
            WHEN ms.records_total > 0 THEN
                ROUND((ms.records_processed::DECIMAL / ms.records_total::DECIMAL) * 100, 2)
            ELSE 0.0
        END as progress_percentage,
        ms.records_processed,
        ms.records_total,
        ms.started_at,
        CASE
            WHEN ms.records_processed > 0 AND ms.status = 'running' THEN
                ms.started_at + (
                    (EXTRACT(EPOCH FROM NOW() - ms.started_at) / ms.records_processed)
                    * (ms.records_total - ms.records_processed)
                ) * INTERVAL '1 second'
            ELSE NULL
        END as estimated_completion
    FROM migration_status ms
    WHERE ms.migration_name = p_migration_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES FOR MIGRATION TABLES
-- ============================================================================

CREATE INDEX idx_migration_status_name ON migration_status(migration_name);
CREATE INDEX idx_migration_status_status ON migration_status(status);
CREATE INDEX idx_migration_log_name ON migration_log(migration_name);
CREATE INDEX idx_migration_log_level ON migration_log(log_level);
CREATE INDEX idx_migration_log_created_at ON migration_log(created_at DESC);
CREATE INDEX idx_migration_validation_name ON migration_validation(migration_name);
CREATE INDEX idx_migration_rollback_name ON migration_rollback(migration_name);

-- ============================================================================
-- INITIAL MIGRATION ENTRIES
-- ============================================================================

-- Register planned migrations
INSERT INTO migration_status (migration_name, status, metadata) VALUES
('csv_subscribers_migration', 'pending', '{"description": "Migrate subscriber data from CSV files to PostgreSQL contacts table"}'),
('dynamodb_newsletters_migration', 'pending', '{"description": "Migrate newsletter data from DynamoDB to PostgreSQL newsletters table"}'),
('dynamodb_content_migration', 'pending', '{"description": "Migrate content items from DynamoDB to PostgreSQL content_items table"}'),
('engagement_data_migration', 'pending', '{"description": "Migrate engagement tracking data to PostgreSQL engagement_events table"}');
