# Multi-stage Dockerfile for Analytics Service
FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache curl dumb-init python3 make g++ ca-certificates tzdata && \
    rm -rf /var/cache/apk/* && \
    # Create app directory with proper permissions
    mkdir -p /app && \
    # Update CA certificates
    update-ca-certificates

# Set working directory
WORKDIR /app

# Create non-root user early
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production --no-audit --no-fund && \
    npm cache clean --force

# Development dependencies stage
FROM base AS dev-deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm install --no-audit --no-fund

# Development stage
FROM base AS development
WORKDIR /app

# Copy all dependencies
COPY --from=dev-deps /app/node_modules ./node_modules

# Copy source code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3005

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3005/health || exit 1

# Start development server with hot reload
CMD ["dumb-init", "npm", "run", "dev"]

# Build stage
FROM dev-deps AS builder
WORKDIR /app

# Copy source code
COPY --chown=nodejs:nodejs . .

# Build the application
RUN npm run build && \
    npm prune --production --no-audit --no-fund

# Production stage
FROM base AS production
WORKDIR /app

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3005

# Add comprehensive healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3005/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start production server
CMD ["node", "dist/index.js"]
