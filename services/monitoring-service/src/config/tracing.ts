import { initTracer } from 'jaeger-client';
import { Tracer } from 'opentracing';
import { logger } from '../utils/logger';

let tracer: Tracer;

export const initializeTracing = (): Tracer => {
  const config = {
    serviceName: 'monitoring-service',
    sampler: {
      type: 'const',
      param: 1, // Sample all traces in development
    },
    reporter: {
      logSpans: process.env.NODE_ENV === 'development',
      agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
      agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6832'),
      collectorEndpoint: process.env.JAEGER_COLLECTOR_ENDPOINT,
    },
  };

  const options = {
    tags: {
      'monitoring-service.version': process.env.npm_package_version || '1.0.0',
      'monitoring-service.environment': process.env.NODE_ENV || 'development',
    },
  };

  try {
    tracer = initTracer(config, options);
    logger.info('Jaeger tracing initialized successfully', {
      serviceName: config.serviceName,
      agentHost: config.reporter.agentHost,
      agentPort: config.reporter.agentPort,
    });
  } catch (error) {
    logger.error('Failed to initialize Jaeger tracing:', error);
    // Fallback to no-op tracer
    tracer = new (require('opentracing').Tracer)();
  }

  return tracer;
};

export const getTracer = (): Tracer => {
  if (!tracer) {
    return initializeTracing();
  }
  return tracer;
};

// Middleware for Express to add tracing context
export const tracingMiddleware = (req: any, res: any, next: any): void => {
  const span = tracer.startSpan(`${req.method} ${req.path}`);

  // Add request metadata to span
  span.setTag('http.method', req.method);
  span.setTag('http.url', req.url);
  span.setTag('http.user_agent', req.get('User-Agent') || '');

  // Add span to request context
  req.span = span;
  req.traceId = span.context().toTraceId();
  req.spanId = span.context().toSpanId();

  // Finish span when response ends
  res.on('finish', () => {
    span.setTag('http.status_code', res.statusCode);
    if (res.statusCode >= 400) {
      span.setTag('error', true);
    }
    span.finish();
  });

  next();
};
