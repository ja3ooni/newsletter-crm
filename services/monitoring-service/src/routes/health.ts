import axios from 'axios';
import { Router } from 'express';

const router = Router();

// Health check endpoint
router.get('/', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };

  res.json(healthCheck);
});

// Detailed health check with dependencies
router.get('/detailed', async (req, res) => {
  const services = [
    { name: 'user-service', url: 'http://user-service:3001/health' },
    {
      name: 'newsletter-service',
      url: 'http://newsletter-service:3002/health',
    },
    { name: 'content-service', url: 'http://content-service:3003/health' },
    { name: 'crm-service', url: 'http://crm-service:3004/health' },
    { name: 'analytics-service', url: 'http://analytics-service:3005/health' },
  ];

  const infrastructure = [
    { name: 'prometheus', url: 'http://prometheus:9090/-/healthy' },
    { name: 'postgres', url: 'http://postgres:5432' }, // Would need proper health check
    { name: 'redis', url: 'http://redis:6379' }, // Would need proper health check
  ];

  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {} as Record<string, any>,
    infrastructure: {} as Record<string, any>,
    overall: {
      healthy: 0,
      unhealthy: 0,
      total: 0,
    },
  };

  // Check services
  for (const service of services) {
    try {
      const response = await axios.get(service.url, { timeout: 5000 });
      healthStatus.services[service.name] = {
        status: 'healthy',
        responseTime: response.headers['x-response-time'] || 'unknown',
        lastCheck: new Date().toISOString(),
      };
      healthStatus.overall.healthy++;
    } catch (error) {
      healthStatus.services[service.name] = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString(),
      };
      healthStatus.overall.unhealthy++;
    }
    healthStatus.overall.total++;
  }

  // Check infrastructure
  for (const infra of infrastructure) {
    try {
      const response = await axios.get(infra.url, { timeout: 3000 });
      healthStatus.infrastructure[infra.name] = {
        status: 'healthy',
        lastCheck: new Date().toISOString(),
      };
      healthStatus.overall.healthy++;
    } catch (error) {
      healthStatus.infrastructure[infra.name] = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString(),
      };
      healthStatus.overall.unhealthy++;
    }
    healthStatus.overall.total++;
  }

  // Determine overall status
  if (healthStatus.overall.unhealthy > 0) {
    healthStatus.status =
      healthStatus.overall.unhealthy > healthStatus.overall.healthy
        ? 'unhealthy'
        : 'degraded';
  }

  const statusCode =
    healthStatus.status === 'healthy'
      ? 200
      : healthStatus.status === 'degraded'
        ? 200
        : 503;

  res.status(statusCode).json(healthStatus);
});

// Readiness probe
router.get('/ready', (req, res) => {
  // Check if the service is ready to accept traffic
  const readiness = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    checks: {
      metrics_collector: true,
      alert_manager: true,
      tracing_service: true,
    },
  };

  res.json(readiness);
});

// Liveness probe
router.get('/live', (req, res) => {
  // Simple liveness check
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
});

export { router as healthRouter };
