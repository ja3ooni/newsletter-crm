#!/usr/bin/env node

/**
 * Kong API Gateway CLI Management Tool
 * Provides command-line interface for Kong management operations
 */

import { Command } from 'commander';
import { KongMonitor } from './kong-monitor';

const program = new Command();
const kong = new KongMonitor(process.env.KONG_ADMIN_URL || 'http://localhost:8001');

program
  .name('kong-cli')
  .description('Kong API Gateway management CLI')
  .version('1.0.0');

// Health check command
program
  .command('health')
  .description('Check Kong health status')
  .action(async () => {
    try {
      const health = await kong.getHealthStatus();
      console.log('Kong Health Status:');
      console.log(`Database reachable: ${health.database.reachable}`);
      console.log(`Active connections: ${health.server.connections_active}`);
      console.log(`Total requests: ${health.server.total_requests}`);
    } catch (error) {
      console.error('Health check failed:', error.message);
      process.exit(1);
    }
  });

// List services command
program
  .command('services')
  .description('List all Kong services')
  .action(async () => {
    try {
      const services = await kong.getServices();
      console.log(`Found ${services.length} services:`);
      services.forEach(service => {
        console.log(`- ${service.name}: ${service.protocol}://${service.host}:${service.port}`);
      });
    } catch (error) {
      console.error('Failed to list services:', error.message);
      process.exit(1);
    }
  });

// List routes command
program
  .command('routes')
  .description('List all Kong routes')
  .action(async () => {
    try {
      const routes = await kong.getRoutes();
      console.log(`Found ${routes.length} routes:`);
      routes.forEach(route => {
        console.log(`- ${route.name}: ${route.methods?.join(', ')} ${route.paths?.join(', ')}`);
      });
    } catch (error) {
      console.error('Failed to list routes:', error.message);
      process.exit(1);
    }
  });

// List consumers command
program
  .command('consumers')
  .description('List all Kong consumers')
  .action(async () => {
    try {
      const consumers = await kong.getConsumers();
      console.log(`Found ${consumers.length} consumers:`);
      consumers.forEach(consumer => {
        console.log(`- ${consumer.username} (${consumer.custom_id || 'no custom_id'})`);
      });
    } catch (error) {
      console.error('Failed to list consumers:', error.message);
      process.exit(1);
    }
  });

// Create consumer command
program
  .command('create-consumer')
  .description('Create a new Kong consumer')
  .requiredOption('-u, --username <username>', 'Consumer username')
  .option('-c, --custom-id <customId>', 'Consumer custom ID')
  .option('-t, --tags <tags>', 'Consumer tags (comma-separated)')
  .action(async (options) => {
    try {
      const tags = options.tags ? options.tags.split(',') : undefined;
      const consumer = await kong.createConsumer(options.username, options.customId, tags);
      console.log(`Created consumer: ${consumer.username} (ID: ${consumer.id})`);
    } catch (error) {
      console.error('Failed to create consumer:', error.message);
      process.exit(1);
    }
  });

// Create API key command
program
  .command('create-api-key')
  .description('Create API key for consumer')
  .requiredOption('-c, --consumer <consumerId>', 'Consumer ID or username')
  .option('-k, --key <key>', 'Custom API key (optional)')
  .action(async (options) => {
    try {
      const credential = await kong.createApiKey(options.consumer, options.key);
      console.log(`Created API key: ${credential.key}`);
    } catch (error) {
      console.error('Failed to create API key:', error.message);
      process.exit(1);
    }
  });

// Update rate limit command
program
  .command('update-rate-limit')
  .description('Update rate limiting for a service')
  .requiredOption('-s, --service <serviceId>', 'Service ID or name')
  .requiredOption('-l, --limits <limits>', 'Rate limits (comma-separated)')
  .option('-w, --window <window>', 'Window size in seconds', '60')
  .action(async (options) => {
    try {
      const limits = options.limits.split(',').map(Number);
      const windowSize = [parseInt(options.window)];
      const plugin = await kong.updateRateLimit(options.service, limits, windowSize);
      console.log(`Updated rate limiting for service: ${options.service}`);
      console.log(`Limits: ${limits.join(', ')} requests per ${options.window} seconds`);
    } catch (error) {
      console.error('Failed to update rate limit:', error.message);
      process.exit(1);
    }
  });

// Metrics command
program
  .command('metrics')
  .description('Show service metrics')
  .action(async () => {
    try {
      const metrics = await kong.getServiceMetrics();
      console.log('Service Metrics:');
      metrics.forEach(metric => {
        console.log(`\n${metric.service_name}:`);
        console.log(`  Total requests: ${metric.total_requests}`);
        console.log(`  Success rate: ${metric.success_rate.toFixed(2)}%`);
        console.log(`  Avg response time: ${metric.avg_response_time.toFixed(2)}ms`);
        console.log(`  Error rate: ${metric.error_rate.toFixed(2)}%`);
      });
    } catch (error) {
      console.error('Failed to get metrics:', error.message);
      process.exit(1);
    }
  });

// Validate configuration command
program
  .command('validate')
  .description('Validate Kong configuration')
  .action(async () => {
    try {
      const validation = await kong.validateConfiguration();

      console.log(`Configuration is ${validation.isValid ? 'VALID' : 'INVALID'}`);

      if (validation.issues.length > 0) {
        console.log('\nIssues found:');
        validation.issues.forEach(issue => console.log(`- ${issue}`));
      }

      if (validation.recommendations.length > 0) {
        console.log('\nRecommendations:');
        validation.recommendations.forEach(rec => console.log(`- ${rec}`));
      }

      if (!validation.isValid) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Failed to validate configuration:', error.message);
      process.exit(1);
    }
  });

// Dashboard command
program
  .command('dashboard')
  .description('Show Kong dashboard data')
  .action(async () => {
    try {
      const data = await kong.getDashboardData();

      console.log('Kong Dashboard');
      console.log('===============');

      console.log(`\nHealth: ${data.health.database.reachable ? 'OK' : 'ERROR'}`);
      console.log(`Services: ${data.services.length}`);
      console.log(`Routes: ${data.routes.length}`);
      console.log(`Consumers: ${data.consumers.length}`);
      console.log(`Plugins: ${data.plugins.length}`);

      console.log('\nActive Services:');
      data.services.forEach(service => {
        const enabled = service.enabled ? '✓' : '✗';
        console.log(`  ${enabled} ${service.name}`);
      });

      console.log('\nActive Plugins:');
      const pluginCounts = data.plugins.reduce((acc, plugin) => {
        acc[plugin.name] = (acc[plugin.name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(pluginCounts).forEach(([name, count]) => {
        console.log(`  ${name}: ${count}`);
      });

    } catch (error) {
      console.error('Failed to get dashboard data:', error.message);
      process.exit(1);
    }
  });

// Setup command for initial Kong configuration
program
  .command('setup')
  .description('Initial Kong setup with default consumers and credentials')
  .action(async () => {
    try {
      console.log('Setting up Kong with default configuration...');

      // Create default consumers for subscription tiers
      const tiers = [
        { username: 'free-tier', customId: 'free', tags: ['tier:free'] },
        { username: 'premium-tier', customId: 'premium', tags: ['tier:premium'] },
        { username: 'enterprise-tier', customId: 'enterprise', tags: ['tier:enterprise'] },
      ];

      for (const tier of tiers) {
        try {
          const consumer = await kong.createConsumer(tier.username, tier.customId, tier.tags);
          console.log(`✓ Created consumer: ${consumer.username}`);

          // Create API key for each tier
          const apiKey = await kong.createApiKey(consumer.id);
          console.log(`✓ Created API key for ${consumer.username}: ${apiKey.key}`);

        } catch (error) {
          if (error.response?.status === 409) {
            console.log(`- Consumer ${tier.username} already exists`);
          } else {
            throw error;
          }
        }
      }

      console.log('\n✓ Kong setup completed successfully!');
      console.log('Apply the declarative configuration with: docker exec ailert-api-gateway kong reload');

    } catch (error) {
      console.error('Setup failed:', error.message);
      process.exit(1);
    }
  });

program.parse();
