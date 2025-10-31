import compression from 'compression';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export interface ResponseTimeConfig {
  enableCompression: boolean;
  compressionLevel: number;
  compressionThreshold: number; // bytes
  enableCaching: boolean;
  defaultCacheTTL: number; // seconds
  enableETag: boolean;
  enableLastModified: boolean;
  slowResponseThreshold: number; // milliseconds
  enableMetrics: boolean;
}

export interface ResponseTimeMetrics {
  totalRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  slowRequests: number;
  cachedResponses: number;
  compressedResponses: number;
  cacheHitRate: number;
  compressionRatio: number;
}

export interface EndpointMetrics {
  path: string;
  method: string;
  avgResponseTime: number;
  requestCount: number;
  errorCount: number;
  slowRequestCount: number;
  cacheHitCount: number;
  lastAccessed: Date;
}

export class ResponseTimeOptimizer {
  private config: ResponseTimeConfig;
  private metrics: ResponseTimeMetrics;
  private endpointMetrics: Map<string, EndpointMetrics>;
  private responseTimes: number[];
  private maxResponseTimeHistory: number;

  constructor(config: Partial<ResponseTimeConfig> = {}) {
    this.config = {
      enableCompression: true,
      compressionLevel: 6,
      compressionThreshold: 1024,
      enableCaching: true,
      defaultCacheTTL: 300,
      enableETag: true,
      enableLastModified: true,
      slowResponseThreshold: 2000,
      enableMetrics: true,
      ...config,
    };

    this.metrics = this.initializeMetrics();
    this.endpointMetrics = new Map();
    this.responseTimes = [];
    this.maxResponseTimeHistory = 1000; // Keep last 1000 response times for percentile calculation

    logger.info('Response time optimizer initialized', {
      enableCompression: this.config.enableCompression,
      enableCaching: this.config.enableCaching,
      slowResponseThreshold: this.config.slowResponseThreshold,
    });
  }

  /**
   * Get compression middleware
   */
  getCompressionMiddleware() {
    if (!this.config.enableCompression) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return compression({
      level: this.config.compressionLevel,
      threshold: this.config.compressionThreshold,
      filter: (req, res) => {
        // Don't compress if client doesn't support it
        if (!req.headers['accept-encoding']) {
          return false;
        }

        // Don't compress images, videos, or already compressed content
        const contentType = res.getHeader('content-type') as string;
        if (contentType) {
          const nonCompressibleTypes = [
            'image/',
            'video/',
            'audio/',
            'application/zip',
            'application/gzip',
            'application/x-rar',
          ];

          if (nonCompressibleTypes.some(type => contentType.startsWith(type))) {
            return false;
          }
        }

        return compression.filter(req, res);
      },
    });
  }

  /**
   * Get response time tracking middleware
   */
  getResponseTimeMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const endpointKey = `${req.method}:${req.route?.path || req.path}`;

      // Override res.end to capture response time
      const originalEnd = res.end;
      const self = this;
      res.end = function (...args: any[]) {
        const responseTime = Date.now() - startTime;

        // Update metrics
        if (self.config?.enableMetrics) {
          self.updateResponseTimeMetrics(responseTime, endpointKey, req, res);
        }

        // Log slow responses
        if (responseTime > self.config?.slowResponseThreshold) {
          logger.warn('Slow response detected', {
            method: req.method,
            path: req.path,
            responseTime,
            statusCode: res.statusCode,
          });
        }

        return originalEnd.apply(this, args);
      };

      next();
    };
  }

  /**
   * Get caching middleware
   */
  getCachingMiddleware(options?: {
    ttl?: number;
    varyBy?: string[];
    skipCache?: (req: Request) => boolean;
  }) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableCaching) {
        return next();
      }

      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Skip caching if custom condition is met
      if (options?.skipCache && options.skipCache(req)) {
        return next();
      }

      const ttl = options?.ttl || this.config.defaultCacheTTL;
      const varyBy = options?.varyBy || [];

      // Set cache headers
      res.set({
        'Cache-Control': `public, max-age=${ttl}`,
        Vary: varyBy.join(', '),
      });

      // Set ETag if enabled
      if (this.config.enableETag) {
        const originalSend = res.send;
        const self = this;
        res.send = function (body: any) {
          if (body && typeof body === 'string') {
            const etag = self.generateETag(body);
            this.set('ETag', etag);

            // Check if client has cached version
            if (req.headers['if-none-match'] === etag) {
              this.status(304).end();
              return this;
            }
          }

          return originalSend.call(this, body);
        };
      }

      // Set Last-Modified if enabled
      if (this.config.enableLastModified) {
        res.set('Last-Modified', new Date().toUTCString());
      }

      next();
    };
  }

  /**
   * Get connection pooling middleware for external services
   */
  getConnectionPoolingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add connection pooling headers for keep-alive
      res.set({
        Connection: 'keep-alive',
        'Keep-Alive': 'timeout=5, max=1000',
      });

      next();
    };
  }

  /**
   * Get request/response compression middleware
   */
  getRequestCompressionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Handle compressed request bodies
      if (req.headers['content-encoding'] === 'gzip') {
        // Request body decompression would be handled by body parser middleware
        logger.debug('Received compressed request', {
          path: req.path,
          contentLength: req.headers['content-length'],
        });
      }

      next();
    };
  }

  /**
   * Get current response time metrics
   */
  getMetrics(): ResponseTimeMetrics {
    this.updatePercentileMetrics();
    return { ...this.metrics };
  }

  /**
   * Get endpoint-specific metrics
   */
  getEndpointMetrics(): EndpointMetrics[] {
    return Array.from(this.endpointMetrics.values()).sort(
      (a, b) => b.avgResponseTime - a.avgResponseTime
    );
  }

  /**
   * Get slow endpoints report
   */
  getSlowEndpoints(threshold?: number): EndpointMetrics[] {
    const slowThreshold = threshold || this.config.slowResponseThreshold;

    return Array.from(this.endpointMetrics.values())
      .filter(endpoint => endpoint.avgResponseTime > slowThreshold)
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime);
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): Array<{
    type: 'caching' | 'compression' | 'pooling' | 'query' | 'cdn';
    priority: 'high' | 'medium' | 'low';
    endpoint?: string;
    description: string;
    estimatedImprovement: string;
  }> {
    const recommendations: Array<{
      type: 'caching' | 'compression' | 'pooling' | 'query' | 'cdn';
      priority: 'high' | 'medium' | 'low';
      endpoint?: string;
      description: string;
      estimatedImprovement: string;
    }> = [];

    const metrics = this.getMetrics();
    const slowEndpoints = this.getSlowEndpoints();

    // Caching recommendations
    if (metrics.cacheHitRate < 50) {
      recommendations.push({
        type: 'caching',
        priority: 'high',
        description: `Cache hit rate is ${metrics.cacheHitRate.toFixed(1)}%. Consider implementing more aggressive caching strategies.`,
        estimatedImprovement: '30-50% reduction in response time',
      });
    }

    // Compression recommendations
    if (metrics.compressionRatio < 30) {
      recommendations.push({
        type: 'compression',
        priority: 'medium',
        description: `Compression ratio is ${metrics.compressionRatio.toFixed(1)}%. Consider enabling compression for more content types.`,
        estimatedImprovement: '20-40% reduction in response size',
      });
    }

    // Endpoint-specific recommendations
    for (const endpoint of slowEndpoints.slice(0, 5)) {
      // Top 5 slow endpoints
      if (endpoint.cacheHitCount === 0) {
        recommendations.push({
          type: 'caching',
          priority: 'high',
          endpoint: `${endpoint.method} ${endpoint.path}`,
          description: `Endpoint has no cache hits. Consider implementing caching.`,
          estimatedImprovement: '50-70% reduction in response time',
        });
      }

      if (endpoint.avgResponseTime > 5000) {
        recommendations.push({
          type: 'query',
          priority: 'high',
          endpoint: `${endpoint.method} ${endpoint.path}`,
          description: `Endpoint has very slow response time (${endpoint.avgResponseTime}ms). Consider query optimization.`,
          estimatedImprovement: '60-80% reduction in response time',
        });
      }
    }

    // CDN recommendations
    if (metrics.avgResponseTime > 1000) {
      recommendations.push({
        type: 'cdn',
        priority: 'medium',
        description:
          'Consider implementing CDN for static assets and API responses.',
        estimatedImprovement:
          '40-60% reduction in response time for cached content',
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Optimize response times automatically
   */
  async performAutoOptimizations(): Promise<{
    applied: string[];
    recommendations: string[];
  }> {
    const applied: string[] = [];
    const recommendations: string[] = [];

    // Auto-enable compression if not enabled and beneficial
    if (!this.config.enableCompression && this.metrics.avgResponseTime > 1000) {
      this.config.enableCompression = true;
      applied.push('Enabled response compression');
    }

    // Auto-enable caching if not enabled and beneficial
    if (!this.config.enableCaching && this.metrics.avgResponseTime > 500) {
      this.config.enableCaching = true;
      applied.push('Enabled response caching');
    }

    // Adjust compression level based on performance
    if (this.config.enableCompression && this.metrics.compressionRatio < 20) {
      if (this.config.compressionLevel < 9) {
        this.config.compressionLevel = Math.min(
          9,
          this.config.compressionLevel + 1
        );
        applied.push(
          `Increased compression level to ${this.config.compressionLevel}`
        );
      }
    }

    // Generate recommendations for manual optimization
    const slowEndpoints = this.getSlowEndpoints();
    if (slowEndpoints.length > 0) {
      recommendations.push(`Optimize ${slowEndpoints.length} slow endpoints`);
    }

    if (this.metrics.cacheHitRate < 70) {
      recommendations.push('Implement more aggressive caching strategies');
    }

    logger.info('Auto-optimization completed', { applied, recommendations });

    return { applied, recommendations };
  }

  /**
   * Health check for response time optimization
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const metrics = this.getMetrics();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (metrics.p95ResponseTime > 5000 || metrics.avgResponseTime > 2000) {
      status = 'unhealthy';
    } else if (
      metrics.p95ResponseTime > 2000 ||
      metrics.avgResponseTime > 1000
    ) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        metrics,
        slowEndpoints: this.getSlowEndpoints().length,
        recommendations: this.getOptimizationRecommendations().length,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private updateResponseTimeMetrics(
    responseTime: number,
    endpointKey: string,
    req: Request,
    res: Response
  ): void {
    // Update global metrics
    this.metrics.totalRequests++;

    // Add to response time history
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }

    // Update average response time (exponential moving average)
    const alpha = 0.1;
    this.metrics.avgResponseTime =
      this.metrics.avgResponseTime * (1 - alpha) + responseTime * alpha;

    // Count slow requests
    if (responseTime > this.config.slowResponseThreshold) {
      this.metrics.slowRequests++;
    }

    // Count cached responses
    if (res.getHeader('x-cache-hit') === 'true') {
      this.metrics.cachedResponses++;
    }

    // Count compressed responses
    if (res.getHeader('content-encoding')) {
      this.metrics.compressedResponses++;
    }

    // Update endpoint-specific metrics
    this.updateEndpointMetrics(endpointKey, responseTime, req, res);

    // Update derived metrics
    this.updateDerivedMetrics();
  }

  private updateEndpointMetrics(
    endpointKey: string,
    responseTime: number,
    req: Request,
    res: Response
  ): void {
    let endpoint = this.endpointMetrics.get(endpointKey);

    if (!endpoint) {
      endpoint = {
        path: req.route?.path || req.path,
        method: req.method,
        avgResponseTime: responseTime,
        requestCount: 1,
        errorCount: 0,
        slowRequestCount: 0,
        cacheHitCount: 0,
        lastAccessed: new Date(),
      };
    } else {
      // Update average response time
      const totalTime =
        endpoint.avgResponseTime * endpoint.requestCount + responseTime;
      endpoint.requestCount++;
      endpoint.avgResponseTime = totalTime / endpoint.requestCount;
      endpoint.lastAccessed = new Date();
    }

    // Count errors
    if (res.statusCode >= 400) {
      endpoint.errorCount++;
    }

    // Count slow requests
    if (responseTime > this.config.slowResponseThreshold) {
      endpoint.slowRequestCount++;
    }

    // Count cache hits
    if (res.getHeader('x-cache-hit') === 'true') {
      endpoint.cacheHitCount++;
    }

    this.endpointMetrics.set(endpointKey, endpoint);
  }

  private updateDerivedMetrics(): void {
    // Update cache hit rate
    this.metrics.cacheHitRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.cachedResponses / this.metrics.totalRequests) * 100
        : 0;

    // Update compression ratio
    this.metrics.compressionRatio =
      this.metrics.totalRequests > 0
        ? (this.metrics.compressedResponses / this.metrics.totalRequests) * 100
        : 0;
  }

  private updatePercentileMetrics(): void {
    if (this.responseTimes.length === 0) return;

    const sorted = [...this.responseTimes].sort((a, b) => a - b);

    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    this.metrics.p95ResponseTime = sorted[p95Index] || 0;
    this.metrics.p99ResponseTime = sorted[p99Index] || 0;
  }

  private generateETag(content: string): string {
    const crypto = require('crypto');
    return `"${crypto.createHash('md5').update(content).digest('hex')}"`;
  }

  private initializeMetrics(): ResponseTimeMetrics {
    return {
      totalRequests: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      slowRequests: 0,
      cachedResponses: 0,
      compressedResponses: 0,
      cacheHitRate: 0,
      compressionRatio: 0,
    };
  }
}
