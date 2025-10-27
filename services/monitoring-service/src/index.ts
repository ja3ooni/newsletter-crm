import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { initializeTracing } from './config/tracing';
import { alertsRouter } from './routes/alerts';
import { healthRouter } from './routes/health';
import { metricsRouter } from './routes/metrics';
import { tracingRouter } from './routes/tracing';
import { AlertManager } from './services/AlertManager';
import { MetricsCollector } from './services/MetricsCollector';
import { TracingService } from './services/TracingService';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;

// Initialize tracing
initializeTracing();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize services
const metricsCollector = new MetricsCollector();
const alertManager = new AlertManager();
const tracingService = new TracingService();

// Start metrics collection
metricsCollector.startCollection();

// Routes
app.use('/metrics', metricsRouter);
app.use('/health', healthRouter);
app.use('/alerts', alertsRouter);
app.use('/tracing', tracingRouter);

// Global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Something went wrong',
    });
  }
);

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Monitoring service started on port ${PORT}`);
  logger.info('Metrics endpoint: /metrics');
  logger.info('Health endpoint: /health');
  logger.info('Alerts endpoint: /alerts');
  logger.info('Tracing endpoint: /tracing');
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

export default app;
