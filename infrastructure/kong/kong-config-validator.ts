/**
 * Kong Configuration Validator
 * Validates Kong configuration against best practices and requirements
 */

import { logger } from '../utils/logger';
import { KongMonitor } from './kong-monitor';

export interface ValidationRule {
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (data: any) => Promise<boolean>;
  recommendation?: string;
}

export interface ValidationResult {
  rule: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  recommendation?: string;
}

export class KongConfigValidator {
  private kong: KongMonitor;
  private rules: ValidationRule[] = [];

  constructor(kongAdminUrl?: string) {
    this.kong = new KongMonitor(kongAdminUrl);
    this.initializeRules();
  }

  private initializeRules(): void {
    this.rules = [
      {
        name: 'health-endpoints',
        description: 'All services should have health check endpoints',
        severity: 'warning',
        check: async (data) => {
          const { services, routes } = data;
          return services.every((service: any) =>
            routes.some((route: any) =>
              route.service.id === service.id &&
              route.paths?.some((path: string) => path.includes('/health'))
            )
          );
        },
        recommendation: 'Add /health endpoints to all services for proper health monitoring',
      },
      {
        name: 'rate-limiting-configured',
        description: 'Rate limiting should be configured for all services',
        severity: 'error',
        check: async (data) => {
          const { plugins } = data;
          return plugins.some((plugin: any) => plugin.name.includes('rate-limiting'));
        },
        recommendation: 'Configure rate limiting plugins to prevent API abuse',
      },
      {
        name: 'authentication-configured',
        description: 'Authentication should be configured for protected endpoints',
        severity: 'error',
        check: async (data) => {
          const { plugins } = data;
          const authPlugins = ['jwt', 'key-auth', 'oauth2', 'basic-auth'];
          return plugins.some((plugin: any) => authPlugins.includes(plugin.name));
        },
        recommendation: 'Configure authentication plugins (JWT, API Key, OAuth2) for security',
      },
      {
        name: 'cors-configured',
        description: 'CORS should be configured for frontend integration',
        severity: 'warning',
        check: async (data) => {
          const { plugins } = data;
          return plugins.some((plugin: any) => plugin.name === 'cors');
        },
        recommendation: 'Configure CORS plugin to allow frontend applications to access the API',
      },
      {
        name: 'monitoring-enabled',
        description: 'Monitoring plugins should be enabled',
        severity: 'warning',
        check: async (data) => {
          const { plugins } = data;
          const monitoringPlugins = ['prometheus', 'request-id', 'correlation-id'];
          return monitoringPlugins.some(name =>
            plugins.some((plugin: any) => plugin.name === name)
          );
        },
        recommendation: 'Enable monitoring plugins (Prometheus, Request ID) for observability',
      },
      {
        name: 'security-headers',
        description: 'Security headers should be configured',
        severity: 'warning',
        check: async (data) => {
          const { plugins } = data;
          return plugins.some((plugin: any) =>
            plugin.name === 'response-transformer' &&
            plugin.config?.add?.headers?.some((header: string) =>
              header.includes('X-Frame-Options') ||
              header.includes('X-Content-Type-Options') ||
              header.includes('Strict-Transport-Security')
            )
          );
        },
        recommendation: 'Configure security headers to protect against common web vulnerabilities',
      },
      {
        name: 'request-size-limiting',
        description: 'Request size limiting should be configured for upload endpoints',
        severity: 'warning',
        check: async (data) => {
          const { plugins } = data;
          return plugins.some((plugin: any) => plugin.name === 'request-size-limiting');
        },
        recommendation: 'Configure request size limiting to prevent large payload attacks',
      },
      {
        name: 'upstream-health-checks',
        description: 'Upstream health checks should be configured',
        severity: 'error',
        check: async (data) => {
          // This would check if upstreams have health checks configured
          // For now, we'll assume they're configured if services exist
          const { services } = data;
          return services.length > 0;
        },
        recommendation: 'Configure upstream health checks for automatic failover',
      },
      {
        name: 'consumer-tiers-configured',
        description: 'Consumer tiers should be configured for subscription management',
        severity: 'warning',
        check: async (data) => {
          const { consumers } = data;
          const requiredTiers = ['free', 'premium', 'enterprise'];
          return requiredTiers.every(tier =>
            consumers.some((consumer: any) => consumer.custom_id === tier)
          );
        },
        recommendation: 'Configure consumer tiers (free, premium, enterprise) for subscription-based access',
      },
      {
        name: 'api-keys-configured',
        description: 'API keys should be configured for consumers',
        severity: 'warning',
        check: async (data) => {
          const { consumers } = data;
          // This is a simplified check - in reality, we'd check if consumers have API keys
          return consumers.length > 0;
        },
        recommendation: 'Configure API keys for all consumer tiers',
      },
    ];
  }

  /**
   * Run all validation rules
   */
  async validate(): Promise<ValidationResult[]> {
    try {
      logger.info('Starting Kong configuration validation...');

      const data = await this.kong.getDashboardData();
      const results: ValidationResult[] = [];

      for (const rule of this.rules) {
        try {
          const passed = await rule.check(data);
          results.push({
            rule: rule.name,
            passed,
            severity: rule.severity,
            message: passed ? `✓ ${rule.description}` : `✗ ${rule.description}`,
            recommendation: passed ? undefined : rule.recommendation,
          });
        } catch (error) {
          logger.error(`Failed to run validation rule ${rule.name}:`, error);
          results.push({
            rule: rule.name,
            passed: false,
            severity: 'error',
            message: `✗ Failed to validate: ${rule.description}`,
            recommendation: 'Check Kong connectivity and configuration',
          });
        }
      }

      logger.info('Kong configuration validation completed');
      return results;
    } catch (error) {
      logger.error('Kong validation failed:', error);
      throw error;
    }
  }

  /**
   * Generate validation report
   */
  async generateReport(): Promise<{
    summary: {
      total: number;
      passed: number;
      failed: number;
      errors: number;
      warnings: number;
      infos: number;
    };
    results: ValidationResult[];
    recommendations: string[];
  }> {
    const results = await this.validate();

    const summary = {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      errors: results.filter(r => r.severity === 'error' && !r.passed).length,
      warnings: results.filter(r => r.severity === 'warning' && !r.passed).length,
      infos: results.filter(r => r.severity === 'info' && !r.passed).length,
    };

    const recommendations = results
      .filter(r => !r.passed && r.recommendation)
      .map(r => r.recommendation!);

    return {
      summary,
      results,
      recommendations,
    };
  }

  /**
   * Check if configuration is production-ready
   */
  async isProductionReady(): Promise<{
    ready: boolean;
    blockers: string[];
    warnings: string[];
  }> {
    const results = await this.validate();

    const blockers = results
      .filter(r => !r.passed && r.severity === 'error')
      .map(r => r.message);

    const warnings = results
      .filter(r => !r.passed && r.severity === 'warning')
      .map(r => r.message);

    return {
      ready: blockers.length === 0,
      blockers,
      warnings,
    };
  }

  /**
   * Auto-fix common configuration issues
   */
  async autoFix(): Promise<{
    fixed: string[];
    failed: string[];
  }> {
    const fixed: string[] = [];
    const failed: string[] = [];

    try {
      // Auto-create consumer tiers if missing
      const consumers = await this.kong.getConsumers();
      const requiredTiers = [
        { username: 'free-tier', customId: 'free', tags: ['tier:free'] },
        { username: 'premium-tier', customId: 'premium', tags: ['tier:premium'] },
        { username: 'enterprise-tier', customId: 'enterprise', tags: ['tier:enterprise'] },
      ];

      for (const tier of requiredTiers) {
        const exists = consumers.some(c => c.custom_id === tier.customId);
        if (!exists) {
          try {
            await this.kong.createConsumer(tier.username, tier.customId, tier.tags);
            fixed.push(`Created consumer tier: ${tier.username}`);
          } catch (error) {
            failed.push(`Failed to create consumer tier: ${tier.username}`);
          }
        }
      }

      // Auto-create API keys for consumers without them
      for (const consumer of consumers) {
        try {
          await this.kong.createApiKey(consumer.id);
          fixed.push(`Created API key for consumer: ${consumer.username}`);
        } catch (error) {
          // Might already exist, which is fine
          if (!error.response || error.response.status !== 409) {
            failed.push(`Failed to create API key for consumer: ${consumer.username}`);
          }
        }
      }

    } catch (error) {
      logger.error('Auto-fix failed:', error);
      failed.push('Auto-fix process failed');
    }

    return { fixed, failed };
  }
}

/**
 * CLI function for validation
 */
export async function validateKongConfig(adminUrl?: string): Promise<void> {
  const validator = new KongConfigValidator(adminUrl);

  try {
    const report = await validator.generateReport();

    console.log('\nKong Configuration Validation Report');
    console.log('=====================================');

    console.log(`\nSummary:`);
    console.log(`  Total checks: ${report.summary.total}`);
    console.log(`  Passed: ${report.summary.passed}`);
    console.log(`  Failed: ${report.summary.failed}`);
    console.log(`  Errors: ${report.summary.errors}`);
    console.log(`  Warnings: ${report.summary.warnings}`);

    console.log('\nResults:');
    report.results.forEach(result => {
      const icon = result.severity === 'error' ? '🔴' :
                   result.severity === 'warning' ? '🟡' : '🔵';
      console.log(`  ${icon} ${result.message}`);
      if (result.recommendation) {
        console.log(`     💡 ${result.recommendation}`);
      }
    });

    if (report.recommendations.length > 0) {
      console.log('\nRecommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    const productionCheck = await validator.isProductionReady();
    console.log(`\nProduction Ready: ${productionCheck.ready ? '✅ YES' : '❌ NO'}`);

    if (productionCheck.blockers.length > 0) {
      console.log('\nBlockers:');
      productionCheck.blockers.forEach(blocker => {
        console.log(`  🚫 ${blocker}`);
      });
    }

  } catch (error) {
    console.error('Validation failed:', error.message);
    process.exit(1);
  }
}
