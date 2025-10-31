/**
 * Shared utilities and services for AiLert platform
 */

// Error handling
export * from './errors';

// Logging
export * from './logging/ErrorTracker';
export * from './logging/LogAnalyzer';
export * from './logging/LoggingMiddleware';
export * from './logging/StructuredLogger';

// Security
export * from './security/AuthenticationMiddleware';
export * from './security/EncryptionService';
export * from './security/InputValidator';
export * from './security/KeyRotationService';
export * from './security/SecretManager';
export * from './security/SecureServiceCommunication';
export * from './security/SecurityMiddleware';

// Performance
export * from './performance/MemoryLeakDetector';
export * from './performance/MemoryOptimizer';
export * from './performance/PerformanceOptimizationService';
export * from './performance/ResourceCleanupService';
export * from './performance/ResourceMonitor';

// Caching
export * from './cache/CacheInvalidationStrategy';
export * from './cache/CacheManager';
export * from './cache/CDNManager';
export * from './cache/QueryCache';

// Database
export * from './database/ConnectionPoolManager';
export * from './database/DatabaseOptimizer';
export * from './database/RedisCacheIntegration';

// API
export * from './api/ExternalServicePoolManager';
export * from './api/MultiLevelCacheStrategy';
export * from './api/ResponseTimeOptimizer';

// Email
export * from './email/EngagementBasedPrioritization';
export * from './email/OptimizedEmailSender';

// Monitoring
export * from './monitoring/MonitoringMiddleware';

// Utils
export * from './utils/logger';
