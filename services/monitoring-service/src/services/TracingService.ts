import { FORMAT_HTTP_HEADERS, Span, Tracer } from 'opentracing';
import { getTracer } from '../config/tracing';
import { logger } from '../utils/logger';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface SpanData {
  operationName: string;
  startTime: number;
  finishTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    fields: Record<string, any>;
  }>;
  references: Array<{
    type: string;
    referencedContext: any;
  }>;
}

export class TracingService {
  private tracer: Tracer;
  private activeSpans: Map<string, Span> = new Map();

  constructor() {
    this.tracer = getTracer();
  }

  public startSpan(operationName: string, parentContext?: any): Span {
    const spanOptions: any = {};

    if (parentContext) {
      spanOptions.childOf = parentContext;
    }

    const span = this.tracer.startSpan(operationName, spanOptions);

    // Store span for later reference
    const spanId = this.getSpanId(span);
    this.activeSpans.set(spanId, span);

    logger.debug('Span started', {
      operationName,
      spanId,
      traceId: this.getTraceId(span),
    });

    return span;
  }

  public finishSpan(span: Span): void {
    const spanId = this.getSpanId(span);
    span.finish();
    this.activeSpans.delete(spanId);

    logger.debug('Span finished', {
      spanId,
      traceId: this.getTraceId(span),
    });
  }

  public addSpanTag(span: Span, key: string, value: any): void {
    span.setTag(key, value);
  }

  public addSpanLog(span: Span, fields: Record<string, any>): void {
    span.log(fields);
  }

  public getTraceId(span: Span): string {
    return span.context().toTraceId();
  }

  public getSpanId(span: Span): string {
    return span.context().toSpanId();
  }

  public extractContext(headers: Record<string, string>): any {
    return this.tracer.extract(FORMAT_HTTP_HEADERS, headers);
  }

  public injectContext(span: Span, headers: Record<string, string>): void {
    this.tracer.inject(span.context(), FORMAT_HTTP_HEADERS, headers);
  }

  // Middleware for automatic HTTP request tracing
  public createHttpMiddleware() {
    return (req: any, res: any, next: any) => {
      // Extract parent context from headers
      const parentContext = this.extractContext(req.headers);

      // Start span for this request
      const span = this.startSpan(`${req.method} ${req.path}`, parentContext);

      // Add request metadata
      this.addSpanTag(span, 'http.method', req.method);
      this.addSpanTag(span, 'http.url', req.url);
      this.addSpanTag(span, 'http.user_agent', req.get('User-Agent') || '');
      this.addSpanTag(span, 'component', 'http');

      if (req.ip) {
        this.addSpanTag(span, 'http.remote_addr', req.ip);
      }

      // Add span to request for use in handlers
      req.span = span;
      req.traceContext = {
        traceId: this.getTraceId(span),
        spanId: this.getSpanId(span),
      };

      // Log request start
      this.addSpanLog(span, {
        event: 'request.start',
        method: req.method,
        url: req.url,
      });

      // Finish span when response ends
      res.on('finish', () => {
        this.addSpanTag(span, 'http.status_code', res.statusCode);

        if (res.statusCode >= 400) {
          this.addSpanTag(span, 'error', true);
          this.addSpanTag(
            span,
            'error.kind',
            res.statusCode >= 500 ? 'server_error' : 'client_error'
          );
        }

        this.addSpanLog(span, {
          event: 'request.finish',
          status_code: res.statusCode,
        });

        this.finishSpan(span);
      });

      next();
    };
  }

  // Database operation tracing
  public traceDbOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    parentSpan?: Span
  ): Promise<T> {
    const span = this.startSpan(`db.${operationName}`, parentSpan);
    this.addSpanTag(span, 'component', 'database');
    this.addSpanTag(span, 'db.type', 'postgresql');

    return operation()
      .then(result => {
        this.addSpanTag(span, 'db.success', true);
        this.finishSpan(span);
        return result;
      })
      .catch(error => {
        this.addSpanTag(span, 'error', true);
        this.addSpanTag(span, 'db.success', false);
        this.addSpanLog(span, {
          event: 'error',
          'error.object': error,
          message: error.message,
        });
        this.finishSpan(span);
        throw error;
      });
  }

  // HTTP client request tracing
  public traceHttpRequest<T>(
    url: string,
    method: string,
    operation: () => Promise<T>,
    parentSpan?: Span
  ): Promise<T> {
    const span = this.startSpan(
      `http.client.${method.toLowerCase()}`,
      parentSpan
    );
    this.addSpanTag(span, 'component', 'http-client');
    this.addSpanTag(span, 'http.method', method);
    this.addSpanTag(span, 'http.url', url);

    return operation()
      .then(result => {
        this.addSpanTag(span, 'http.success', true);
        this.finishSpan(span);
        return result;
      })
      .catch(error => {
        this.addSpanTag(span, 'error', true);
        this.addSpanTag(span, 'http.success', false);
        this.addSpanLog(span, {
          event: 'error',
          'error.object': error,
          message: error.message,
        });
        this.finishSpan(span);
        throw error;
      });
  }

  // Queue operation tracing
  public traceQueueOperation<T>(
    queueName: string,
    operation: string,
    handler: () => Promise<T>,
    parentSpan?: Span
  ): Promise<T> {
    const span = this.startSpan(`queue.${operation}`, parentSpan);
    this.addSpanTag(span, 'component', 'queue');
    this.addSpanTag(span, 'queue.name', queueName);
    this.addSpanTag(span, 'queue.operation', operation);

    return handler()
      .then(result => {
        this.addSpanTag(span, 'queue.success', true);
        this.finishSpan(span);
        return result;
      })
      .catch(error => {
        this.addSpanTag(span, 'error', true);
        this.addSpanTag(span, 'queue.success', false);
        this.addSpanLog(span, {
          event: 'error',
          'error.object': error,
          message: error.message,
        });
        this.finishSpan(span);
        throw error;
      });
  }

  // Get active spans for debugging
  public getActiveSpans(): SpanData[] {
    const spans: SpanData[] = [];

    for (const [spanId, span] of this.activeSpans) {
      // Note: This is a simplified representation
      // In a real implementation, you'd need to access span internals
      spans.push({
        operationName: 'unknown', // Would need to be tracked separately
        startTime: Date.now(), // Would need to be tracked separately
        tags: {},
        logs: [],
        references: [],
      });
    }

    return spans;
  }

  // Create a child span from current context
  public createChildSpan(operationName: string, parentSpan: Span): Span {
    return this.startSpan(operationName, parentSpan);
  }

  // Utility method to wrap any async function with tracing
  public trace<T>(
    operationName: string,
    operation: (span: Span) => Promise<T>,
    parentSpan?: Span
  ): Promise<T> {
    const span = this.startSpan(operationName, parentSpan);

    return operation(span)
      .then(result => {
        this.finishSpan(span);
        return result;
      })
      .catch(error => {
        this.addSpanTag(span, 'error', true);
        this.addSpanLog(span, {
          event: 'error',
          'error.object': error,
          message: error.message,
        });
        this.finishSpan(span);
        throw error;
      });
  }
}
