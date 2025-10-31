-- Test database initialization script

-- Create test tables for developer tools testing
CREATE TABLE IF NOT EXISTS test_services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'stopped',
    port INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_diagnostics (
    id SERIAL PRIMARY KEY,
    tool_name VARCHAR(255) NOT NULL,
    execution_time INTEGER NOT NULL,
    memory_usage BIGINT NOT NULL,
    cpu_usage DECIMAL(5,2),
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_configurations (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    environment VARCHAR(50) DEFAULT 'test',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test data
INSERT INTO test_services (name, status, port) VALUES
    ('redis', 'running', 6379),
    ('postgres', 'running', 5432),
    ('elasticsearch', 'stopped', 9200),
    ('mock-api', 'running', 1080);

INSERT INTO test_configurations (key, value, environment) VALUES
    ('debug.enabled', 'true', 'test'),
    ('logging.level', 'debug', 'test'),
    ('performance.monitoring', 'true', 'test'),
    ('security.scan.enabled', 'true', 'test');

-- Create indexes for better performance
CREATE INDEX idx_test_services_status ON test_services(status);
CREATE INDEX idx_test_diagnostics_tool_name ON test_diagnostics(tool_name);
CREATE INDEX idx_test_diagnostics_created_at ON test_diagnostics(created_at);
CREATE INDEX idx_test_configurations_key ON test_configurations(key);

-- Create a function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_test_services_updated_at
    BEFORE UPDATE ON test_services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_configurations_updated_at
    BEFORE UPDATE ON test_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
