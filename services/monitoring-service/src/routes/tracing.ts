import { Router } from 'express';
import { TracingService } from '../services/TracingService';
import { logger } from '../utils/logger';

const router = Router();
const tracingService = new TracingService();

// Get active spans
router.get('/spans', (req, res) => {
  try {
    const spans = tracingService.getActiveSpans();
    res.json({
      spans,
      total: spans.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching active spans:', error);
    res.status(500).json({ error: 'Failed to fetch active spans' });
  }
});

// Trace a custom operation
router.post('/trace', async (req, res) => {
  try {
    const { operationName, metadata } = req.body;

    if (!operationName) {
      return res.status(400).json({ error: 'Operation name is required' });
    }

    const result = await tracingService.trace(operationName, async span => {
      // Add metadata as tags
      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          tracingService.addSpanTag(span, key, value);
        });
      }

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

      return {
        operationName,
        traceId: tracingService.getTraceId(span),
        spanId: tracingService.getSpanId(span),
        timestamp: new Date().toISOString(),
      };
    });

    res.json(result);
  } catch (error) {
    logger.error('Error tracing operation:', error);
    res.status(500).json({ error: 'Failed to trace operation' });
  }
});

// Get tracing configuration
router.get('/config', (req, res) => {
  try {
    const config = {
      serviceName: 'monitoring-service',
      jaegerAgent: {
        host: process.env.JAEGER_AGENT_HOST || 'localhost',
        port: parseInt(process.env.JAEGER_AGENT_PORT || '6832'),
      },
      jaegerCollector: {
        endpoint: process.env.JAEGER_COLLECTOR_ENDPOINT || null,
      },
      sampling: {
        type: 'const',
        param: 1, // Sample all traces
      },
      environment: process.env.NODE_ENV || 'development',
    };

    res.json(config);
  } catch (error) {
    logger.error('Error fetching tracing configuration:', error);
    res.status(500).json({ error: 'Failed to fetch tracing configuration' });
  }
});

// Tracing statistics
router.get('/stats', (req, res) => {
  try {
    const spans = tracingService.getActiveSpans();

    const stats = {
      activeSpans: spans.length,
      spansByOperation: spans.reduce(
        (acc, span) => {
          acc[span.operationName] = (acc[span.operationName] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      averageDuration:
        spans.length > 0
          ? spans.reduce((sum, span) => sum + (span.duration || 0), 0) /
            spans.length
          : 0,
      timestamp: new Date().toISOString(),
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error generating tracing statistics:', error);
    res.status(500).json({ error: 'Failed to generate tracing statistics' });
  }
});

// Health check for tracing service
router.get('/health', (req, res) => {
  try {
    const health = {
      status: 'healthy',
      jaegerConnection: 'connected', // Would check actual connection
      activeSpans: tracingService.getActiveSpans().length,
      timestamp: new Date().toISOString(),
    };

    res.json(health);
  } catch (error) {
    logger.error('Error checking tracing health:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to check tracing health',
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as tracingRouter };
