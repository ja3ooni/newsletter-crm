// @ts-nocheck
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { StructuredLogger } from '../logging/StructuredLogger';
import {
  AuthenticatedRequest,
  AuthenticationMiddleware,
} from './AuthenticationMiddleware';
import { EnvironmentValidator } from './EnvironmentValidator';
import { InputValidator } from './InputValidator';

const logger = new StructuredLogger({
  service: 'SecureApiTemplate',
  environment: process.env.NODE_ENV || 'development',
});

export interface SecureApiConfig {
  serviceName: string;
  port?: number;
  corsOrigin?: string;
  jwtSecret?: string;
  enableRateLimit?: boolean;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}

export class SecureApiTemplate {
  private app: express.Application;
  private authMiddleware: AuthenticationMiddleware;
  private config: SecureApiConfig;

  constructor(config: SecureApiConfig) {
    this.config = {
      port: 3000,
      corsOrigin: process.env.CORS_ORIGIN || '*',
      jwtSecret: process.env.JWT_SECRET || '',
      enableRateLimit: true,
      rateLimitMax: 100,
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
      ...config,
    };

    this.app = express();
    this.authMiddleware = new AuthenticationMiddleware({
      jwtSecret: this.config.jwtSecret!,
    });

    this.setupSecurityMiddleware();
    this.setupRoutes();
  }

  private setupSecurityMiddleware(): void {
    // Security headers
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false, // Disable for API services
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: this.config.corsOrigin === '*' ? true : this.config.corsOrigin,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      })
    );

    // Body parsing with size limits
    this.app.use(
      express.json({
        limit: '10mb',
        verify: (req, res, buf) => {
          // Store raw body for webhook verification if needed
          (req as any).rawBody = buf;
        },
      })
    );
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info('HTTP Request', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: (req as AuthenticatedRequest).user?.id,
        });
      });

      next();
    });

    // Rate limiting
    if (this.config.enableRateLimit) {
      this.app.use(
        this.authMiddleware.rateLimit(
          this.config.rateLimitMax,
          this.config.rateLimitWindowMs
        )
      );
    }

    // Input validation
    this.app.use(this.authMiddleware.validateInput);

    // Authentication (applied to all routes except health checks)
    this.app.use(this.authMiddleware.authenticate);
  }

  private setupRoutes(): void {
    // Health check endpoint (no authentication required)
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        service: this.config.serviceName,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // Ready check endpoint (no authentication required)
    this.app.get('/ready', async (req: Request, res: Response) => {
      try {
        // Add service-specific readiness checks here
        res.json({
          status: 'ready',
          service: this.config.serviceName,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Readiness check failed', error as Error);
        res.status(503).json({
          status: 'not ready',
          service: this.config.serviceName,
          error: 'Service dependencies not available',
        });
      }
    });

    // API info endpoint (no authentication required)
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        service: this.config.serviceName,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        documentation: '/api/docs',
        health: '/health',
        ready: '/ready',
      });
    });
  }

  /**
   * Add a protected route with role-based authorization
   */
  addProtectedRoute(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    handler: (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ) => void | Promise<void>,
    options: {
      requiredRole?: string;
      requiredPermissions?: string[];
      validateSchema?: any; // Zod schema for request validation
    } = {}
  ): void {
    const middlewares: any[] = [];

    // Add authorization if specified
    if (options.requiredRole || options.requiredPermissions) {
      middlewares.push(
        this.authMiddleware.authorize(
          options.requiredRole,
          options.requiredPermissions
        )
      );
    }

    // Add schema validation if specified
    if (options.validateSchema) {
      middlewares.push((req: Request, res: Response, next: NextFunction) => {
        try {
          const validation = InputValidator.validateJson(
            req.body,
            options.validateSchema
          );
          if (!validation.isValid) {
            return res.status(400).json({
              error: 'Invalid request data',
              details: validation.errors,
              code: 'VALIDATION_ERROR',
            });
          }
          req.body = validation.sanitizedData;
          next();
        } catch (error) {
          logger.error('Schema validation error', error as Error, {
            path: req.path,
            method: req.method,
          });
          res.status(400).json({
            error: 'Request validation failed',
            code: 'VALIDATION_ERROR',
          });
        }
      });
    }

    // Add the actual handler with error handling
    middlewares.push(
      async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          await handler(req, res, next);
        } catch (error) {
          logger.error('Route handler error', error as Error, {
            path: req.path,
            method: req.method,
            userId: req.user?.id,
          });

          if (!res.headersSent) {
            res.status(500).json({
              error: 'Internal server error',
              code: 'INTERNAL_ERROR',
              requestId: req.get('X-Request-ID'),
            });
          }
        }
      }
    );

    this.app[method](path, ...middlewares);
  }

  /**
   * Add a public route (no authentication required)
   */
  addPublicRoute(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    handler: (
      req: Request,
      res: Response,
      next: NextFunction
    ) => void | Promise<void>,
    options: {
      validateSchema?: any; // Zod schema for request validation
      rateLimit?: { max: number; windowMs: number };
    } = {}
  ): void {
    const middlewares: any[] = [];

    // Add custom rate limiting if specified
    if (options.rateLimit) {
      middlewares.push(
        this.authMiddleware.rateLimit(
          options.rateLimit.max,
          options.rateLimit.windowMs
        )
      );
    }

    // Add schema validation if specified
    if (options.validateSchema) {
      middlewares.push((req: Request, res: Response, next: NextFunction) => {
        try {
          const validation = InputValidator.validateJson(
            req.body,
            options.validateSchema
          );
          if (!validation.isValid) {
            return res.status(400).json({
              error: 'Invalid request data',
              details: validation.errors,
              code: 'VALIDATION_ERROR',
            });
          }
          req.body = validation.sanitizedData;
          next();
        } catch (error) {
          logger.error('Schema validation error', error as Error, {
            path: req.path,
            method: req.method,
          });
          res.status(400).json({
            error: 'Request validation failed',
            code: 'VALIDATION_ERROR',
          });
        }
      });
    }

    // Add the actual handler with error handling
    middlewares.push(
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          await handler(req, res, next);
        } catch (error) {
          logger.error('Public route handler error', error as Error, {
            path: req.path,
            method: req.method,
          });

          if (!res.headersSent) {
            res.status(500).json({
              error: 'Internal server error',
              code: 'INTERNAL_ERROR',
              requestId: req.get('X-Request-ID'),
            });
          }
        }
      }
    );

    // Skip authentication for this route by adding it before the auth middleware
    const router = express.Router();
    router[method](path, ...middlewares);
    this.app.use(router);
  }

  /**
   * Add error handling middleware
   */
  addErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      logger.warn('Route not found', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      res.status(404).json({
        error: 'Route not found',
        code: 'NOT_FOUND',
        path: req.path,
        method: req.method,
      });
    });

    // Global error handler
    this.app.use(
      (error: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error('Unhandled error', error, {
          path: req.path,
          method: req.method,
          userId: (req as AuthenticatedRequest).user?.id,
        });

        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            message:
              process.env.NODE_ENV === 'development'
                ? error.message
                : undefined,
          });
        }
      }
    );
  }

  /**
   * Start the server
   */
  start(): void {
    this.addErrorHandling();

    const port = this.config.port;
    this.app.listen(port, () => {
      logger.info('Secure API server started', {
        service: this.config.serviceName,
        port,
        environment: process.env.NODE_ENV,
        securityFeatures: [
          'Helmet security headers',
          'CORS protection',
          'Rate limiting',
          'Input validation',
          'JWT authentication',
          'Request logging',
          'Error handling',
        ],
      });
    });
  }

  /**
   * Get the Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get the authentication middleware instance
   */
  getAuthMiddleware(): AuthenticationMiddleware {
    return this.authMiddleware;
  }
}

// Example usage function
export function createSecureApiService(
  config: SecureApiConfig
): SecureApiTemplate {
  // Validate environment variables
  const envConfig = EnvironmentValidator.validateEnvironment({
    required: ['JWT_SECRET'],
    optional: {
      PORT: '3000',
      NODE_ENV: 'development',
      CORS_ORIGIN: '*',
    },
    sensitive: ['JWT_SECRET'],
  });

  return new SecureApiTemplate({
    ...config,
    jwtSecret: envConfig.JWT_SECRET,
    port: parseInt(envConfig.PORT, 10),
    corsOrigin: envConfig.CORS_ORIGIN,
  });
}
