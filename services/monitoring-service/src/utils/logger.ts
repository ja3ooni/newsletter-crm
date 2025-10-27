import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(
    ({ timestamp, level, message, service, traceId, spanId, ...meta }) => {
      const logEntry = {
        timestamp,
        level,
        message,
        service: service || 'monitoring-service',
        ...(traceId && { traceId }),
        ...(spanId && { spanId }),
        ...meta,
      };
      return JSON.stringify(logEntry);
    }
  )
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'monitoring-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add structured logging for production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/monitoring-error.log',
      level: 'error',
      format: logFormat,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/monitoring-combined.log',
      format: logFormat,
    })
  );
}

// Add correlation ID support
export const addCorrelationId = (correlationId: string): winston.Logger => {
  return logger.child({ correlationId });
};

// Add tracing context support
export const addTracingContext = (
  traceId: string,
  spanId: string
): winston.Logger => {
  return logger.child({ traceId, spanId });
};
