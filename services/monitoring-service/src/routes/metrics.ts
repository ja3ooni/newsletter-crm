import { Router } from 'express';
import { register } from 'prom-client';
import { MetricsCollector } from '../services/MetricsCollector';
import { logger } from '../utils/logger';

const router = Router();
const metricsCollector = new MetricsCollector();

// Prometheus metrics endpoint
router.get('/', async (req, res) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// Custom business metrics endpoint
router.get('/business', async (req, res) => {
  try {
    // This would typically aggregate business metrics from various services
    const businessMetrics = {
      newsletters: {
        generated_today: 150,
        sent_today: 145,
        failed_today: 5,
        total_subscribers: 25000,
      },
      users: {
        active_today: 1200,
        new_registrations_today: 45,
        churn_rate_weekly: 2.3,
      },
      performance: {
        avg_response_time_ms: 245,
        error_rate_percent: 0.8,
        uptime_percent: 99.95,
      },
      revenue: {
        mrr: 15000,
        arr: 180000,
        conversion_rate_percent: 3.2,
      },
    };

    res.json(businessMetrics);
  } catch (error) {
    logger.error('Error generating business metrics:', error);
    res.status(500).json({ error: 'Failed to generate business metrics' });
  }
});

// Service-specific metrics
router.get('/services/:serviceName', async (req, res) => {
  try {
    const { serviceName } = req.params;

    // Filter metrics for specific service
    const allMetrics = await register.metrics();
    const serviceMetrics = allMetrics
      .split('\n')
      .filter(line => line.includes(`service="${serviceName}"`))
      .join('\n');

    res.set('Content-Type', register.contentType);
    res.send(serviceMetrics);
  } catch (error) {
    logger.error(
      `Error generating metrics for service ${req.params.serviceName}:`,
      error
    );
    res.status(500).json({ error: 'Failed to generate service metrics' });
  }
});

// Record custom metric endpoint
router.post('/record', (req, res) => {
  try {
    const { type, data } = req.body;

    switch (type) {
      case 'http_request':
        metricsCollector.recordHttpRequest(
          data.method,
          data.route,
          data.statusCode,
          data.duration,
          data.service
        );
        break;
      case 'email_sent':
        metricsCollector.recordEmailSent(data.type, data.status);
        break;
      case 'newsletter_generated':
        metricsCollector.recordNewsletterGenerated(data.type, data.status);
        break;
      case 'user_registration':
        metricsCollector.recordUserRegistration(data.source, data.plan);
        break;
      case 'subscription_change':
        metricsCollector.recordSubscriptionChange(
          data.fromPlan,
          data.toPlan,
          data.action
        );
        break;
      case 'api_error':
        metricsCollector.recordApiError(
          data.service,
          data.endpoint,
          data.errorType
        );
        break;
      default:
        return res.status(400).json({ error: 'Unknown metric type' });
    }

    res.json({ success: true, message: 'Metric recorded' });
  } catch (error) {
    logger.error('Error recording metric:', error);
    res.status(500).json({ error: 'Failed to record metric' });
  }
});

export { router as metricsRouter };
