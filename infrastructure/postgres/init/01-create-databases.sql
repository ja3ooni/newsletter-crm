-- Create multiple databases for microservices
-- This script runs during PostgreSQL initialization

-- Create databases for each service
CREATE DATABASE user_db;
CREATE DATABASE newsletter_db;
CREATE DATABASE content_db;
CREATE DATABASE analytics_db;
CREATE DATABASE crm_db;

-- Create users for each service (optional, for better security)
CREATE USER user_service WITH PASSWORD 'user_service_password';
CREATE USER newsletter_service WITH PASSWORD 'newsletter_service_password';
CREATE USER content_service WITH PASSWORD 'content_service_password';
CREATE USER analytics_service WITH PASSWORD 'analytics_service_password';
CREATE USER crm_service WITH PASSWORD 'crm_service_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE user_db TO user_service;
GRANT ALL PRIVILEGES ON DATABASE newsletter_db TO newsletter_service;
GRANT ALL PRIVILEGES ON DATABASE content_db TO content_service;
GRANT ALL PRIVILEGES ON DATABASE analytics_db TO analytics_service;
GRANT ALL PRIVILEGES ON DATABASE crm_db TO crm_service;

-- Also grant to main user for development
GRANT ALL PRIVILEGES ON DATABASE user_db TO ailert;
GRANT ALL PRIVILEGES ON DATABASE newsletter_db TO ailert;
GRANT ALL PRIVILEGES ON DATABASE content_db TO ailert;
GRANT ALL PRIVILEGES ON DATABASE analytics_db TO ailert;
GRANT ALL PRIVILEGES ON DATABASE crm_db TO ailert;