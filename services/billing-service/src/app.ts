import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { BillingController } from './controllers/BillingController';
import { BillingRepository } from './repositories/BillingRepository';
import { createBillingRoutes } from './routes/billing';
import { DunningService } from './services/DunningService';
import { EventService } from './services/EventService';
import { StripeService } from './services/StripeService';
import { SubscriptionService } from './services/SubscriptionService';
import { WebhookService } from './services/WebhookService';
import { logger } from './utils/logger';

export class BillingApp {
  private app: express.Application;
  private stripeService: StripeService;
  private billingRepository: BillingRepository;
  private eventService: EventService;
  private subscriptionService: SubscriptionService;
  private dunningService: DunningService;
  private webhookService: WebhookService;
  private billingController: BillingController;

  constructor() {
    this.app = express();
    this.initializeServices();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeServices(): void {
    // Initialize services in dependency order
    this.stripeService = new StripeService();
    this.billingRepository = new BillingRepository();
    this.eventService = new EventService(this.billingRepository);
    this.subscriptionService = new SubscriptionService(
      this.stripeService,
      this.billingRepository,
      this.eventService
    );
    this.dunningService = new DunningService(
      this.stripeService,
      this.billingRepository,
      this.eventService
    );
    this.webhookService = new WebhookService(
      this.subscriptionService,
      this.billingRepository,
      this.eventService,
      this.dunningService
    );
    this.billingController = new BillingController(
      this.subscriptionService,
      this.billingRepository,
      this.webhookService
    );
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS configuration
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
        ],
        credentials: true,
      })
    );

    // Raw body parser for Stripe webhooks (must be before express.json())
    this.app.use(
      '/api/v1/billing/webhooks/stripe',
      express.raw({ type: 'application/json' })
    );

    // JSON body parser for all other routes
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'billing-service',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // API routes
    this.app.use(
      '/api/v1/billing',
      createBillingRoutes(this.billingController)
    );

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
      });
    });
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use(
      (
        error: Error,
        req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        logger.error('Unhandled error', {
          error: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method,
        });

        // Don't expose internal errors in production
        const isDevelopment = process.env.NODE_ENV === 'development';

        res.status(500).json({
          success: false,
          error: 'Internal server error',
          ...(isDevelopment && { details: error.message, stack: error.stack }),
        });
      }
    );

    // Handle uncaught exceptions
    process.on('uncaughtException', error => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', { reason, promise });
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      process.exit(0);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }

  public async start(port: number = 3000): Promise<void> {
    try {
      this.app.listen(port, () => {
        logger.info(`Billing service started on port ${port}`, {
          port,
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
        });
      });
    } catch (error) {
      logger.error('Failed to start billing service', { error: error.message });
      process.exit(1);
    }
  }
}
