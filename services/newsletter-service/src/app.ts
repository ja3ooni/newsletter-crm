import { config } from '@/config'
import { errorHandler, notFoundHandler, setupGlobalErrorHandlers } from '@/middleware/errorHandler'
import { rateLimiters } from '@/middleware/rateLimit'
import routes from '@/routes'
import { logger } from '@/utils/logger'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

// Setup global error handlers
setupGlobalErrorHandlers()

const app = express()

// Trust proxy if configured
if (config.security.trustProxy) {
  app.set('trust proxy', 1)
}

// Security middleware
app.use(helmet(config.security.helmetOptions))

// CORS configuration
app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
}))

// Compression middleware
app.use(compression())

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - startTime
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info'

    logger[logLevel]('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length'),
    })
  })

  next()
})

// Request ID middleware
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  req.headers['x-request-id'] = requestId
  res.setHeader('X-Request-ID', requestId)
  next()
})

// General rate limiting
app.use(rateLimiters.general)

// Health check endpoint (before routes)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'newsletter-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: config.nodeEnv,
  })
})

// API routes
app.use('/v1', routes)

// Catch 404 and forward to error handler
app.use(notFoundHandler)

// Error handling middleware (must be last)
app.use(errorHandler)

export default app
