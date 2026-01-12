import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { StructuredLogger } from '../logging/StructuredLogger';
import { InputValidator } from './InputValidator';

const logger = new StructuredLogger({
  service: 'AuthenticationMiddleware',
  environment: process.env.NODE_ENV || 'development',
});

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn?: string | number;
  requiredRole?: string;
  requiredPermissions?: string[];
  skipPaths?: string[];
}

export class AuthenticationMiddleware {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = {
      jwtExpiresIn: '24h',
      skipPaths: ['/health', '/ready', '/api/health'],
      ...config,
    };

    if (!this.config.jwtSecret) {
      throw new Error('JWT secret is required for authentication middleware');
    }
  }

  /**
   * JWT Authentication middleware
   */
  authenticate = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      // Skip authentication for certain paths
      if (this.config.skipPaths?.includes(req.path)) {
        return next();
      }

      const authHeader = req.headers.authorization;

      if (!authHeader) {
        logger.warn('Missing authorization header', {
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
        res.status(401).json({
          error: 'Authorization header required',
          code: 'MISSING_AUTH_HEADER',
        });

        return;
      }

      const token = this.extractToken(authHeader);

      if (!token) {
        logger.warn('Invalid authorization header format', {
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
        res.status(401).json({
          error: 'Invalid authorization header format',
          code: 'INVALID_AUTH_FORMAT',
        });

        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;

      // Validate token payload
      if (!decoded.id || !decoded.email) {
        logger.warn('Invalid token payload', {
          path: req.path,
          method: req.method,
          tokenId: decoded.id,
        });
        res.status(401).json({
          error: 'Invalid token payload',
          code: 'INVALID_TOKEN_PAYLOAD',
        });

        return;
      }

      // Attach user to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || 'user',
        permissions: decoded.permissions || [],
      };

      logger.info('User authenticated successfully', {
        userId: req.user.id,
        role: req.user.role,
        path: req.path,
        method: req.method,
      });

      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('JWT verification failed', {
          error: error.message,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
        res.status(401).json({
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN',
        });

        return;
      }

      logger.error('Authentication middleware error', error as Error, {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(500).json({
        error: 'Internal authentication error',
        code: 'AUTH_ERROR',
      });
    }
  };

  /**
   * Role-based authorization middleware
   */
  authorize = (requiredRole?: string, requiredPermissions?: string[]) => {
    return (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): void => {
      try {
        if (!req.user) {
          logger.warn('Authorization attempted without authentication', {
            path: req.path,
            method: req.method,
            ip: req.ip,
          });
          res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED',
          });

          return;
        }

        const roleToCheck = requiredRole || this.config.requiredRole;
        const permissionsToCheck =
          requiredPermissions || this.config.requiredPermissions;

        // Check role if specified
        if (
          roleToCheck &&
          req.user.role !== roleToCheck &&
          req.user.role !== 'admin'
        ) {
          logger.warn('Insufficient role for access', {
            userId: req.user.id,
            userRole: req.user.role,
            requiredRole: roleToCheck,
            path: req.path,
            method: req.method,
          });
          res.status(403).json({
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_ROLE',
          });

          return;
        }

        // Check permissions if specified
        if (permissionsToCheck && permissionsToCheck.length > 0) {
          const hasAllPermissions = permissionsToCheck.every(permission =>
            req.user!.permissions.includes(permission)
          );

          if (!hasAllPermissions && req.user.role !== 'admin') {
            logger.warn('Insufficient permissions for access', {
              userId: req.user.id,
              userPermissions: req.user.permissions,
              requiredPermissions: permissionsToCheck,
              path: req.path,
              method: req.method,
            });
            res.status(403).json({
              error: 'Insufficient permissions',
              code: 'INSUFFICIENT_PERMISSIONS',
            });

            return;
          }
        }

        logger.info('User authorized successfully', {
          userId: req.user.id,
          role: req.user.role,
          permissions: req.user.permissions,
          path: req.path,
          method: req.method,
        });

        next();
      } catch (error) {
        logger.error('Authorization middleware error', error as Error, {
          userId: req.user?.id,
          path: req.path,
          method: req.method,
        });
        res.status(500).json({
          error: 'Internal authorization error',
          code: 'AUTHZ_ERROR',
        });
      }
    };
  };

  /**
   * Input validation middleware
   */
  validateInput = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate common request parameters
      if (req.params) {
        for (const [key, value] of Object.entries(req.params)) {
          if (typeof value === 'string') {
            const validation = InputValidator.sanitizeString(value, 255);

            if (!validation.isValid) {
              logger.warn('Invalid request parameter', {
                parameter: key,
                errors: validation.errors,
                path: req.path,
                method: req.method,
              });
              res.status(400).json({
                error: `Invalid parameter: ${key}`,
                details: validation.errors,
                code: 'INVALID_PARAMETER',
              });

              return;
            }
            req.params[key] = validation.sanitizedData;
          }
        }
      }

      // Validate query parameters
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            const validation = InputValidator.sanitizeString(value, 1000);

            if (!validation.isValid) {
              logger.warn('Invalid query parameter', {
                parameter: key,
                errors: validation.errors,
                path: req.path,
                method: req.method,
              });
              res.status(400).json({
                error: `Invalid query parameter: ${key}`,
                details: validation.errors,
                code: 'INVALID_QUERY',
              });

              return;
            }
            req.query[key] = validation.sanitizedData;
          }
        }
      }

      next();
    } catch (error) {
      logger.error('Input validation middleware error', error as Error, {
        path: req.path,
        method: req.method,
      });
      res.status(500).json({
        error: 'Input validation error',
        code: 'VALIDATION_ERROR',
      });
    }
  };

  /**
   * Rate limiting middleware
   */
  rateLimit = (
    maxRequests: number = 100,
    windowMs: number = 15 * 60 * 1000
  ) => {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const clientId = req.ip || 'unknown';
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean up old entries
        for (const [key, value] of requests.entries()) {
          if (value.resetTime < windowStart) {
            requests.delete(key);
          }
        }

        const clientRequests = requests.get(clientId);

        if (!clientRequests) {
          requests.set(clientId, { count: 1, resetTime: now + windowMs });
          next();

          return;
        }

        if (clientRequests.resetTime < now) {
          // Reset window
          requests.set(clientId, { count: 1, resetTime: now + windowMs });
          next();

          return;
        }

        if (clientRequests.count >= maxRequests) {
          logger.warn('Rate limit exceeded', {
            clientId,
            count: clientRequests.count,
            maxRequests,
            path: req.path,
            method: req.method,
          });
          res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((clientRequests.resetTime - now) / 1000),
            code: 'RATE_LIMIT_EXCEEDED',
          });

          return;
        }

        clientRequests.count++;
        next();
      } catch (error) {
        logger.error('Rate limiting middleware error', error as Error, {
          path: req.path,
          method: req.method,
        });
        next(); // Continue on error to avoid blocking legitimate requests
      }
    };
  };

  /**
   * Extract token from authorization header
   */
  private extractToken(authHeader: string): string | null {
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1] || null;
  }

  /**
   * Generate JWT token
   */
  generateToken(payload: {
    id: string;
    email: string;
    role?: string;
    permissions?: string[];
  }): string {
    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn || '24h',
      issuer: 'datatechtoncrm-platform',
      audience: 'datatechtoncrm-users',
    } as jwt.SignOptions);
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): unknown {
    return jwt.verify(token, this.config.jwtSecret);
  }
}

// Factory function
export function createAuthenticationMiddleware(
  config: Partial<AuthConfig>
): AuthenticationMiddleware {
  const defaultConfig: AuthConfig = {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    skipPaths: ['/health', '/ready', '/api/health'],
  };

  return new AuthenticationMiddleware({ ...defaultConfig, ...config });
}

// Singleton instance
let authMiddlewareInstance: AuthenticationMiddleware | null = null;

export function getAuthenticationMiddleware(): AuthenticationMiddleware {
  if (!authMiddlewareInstance) {
    authMiddlewareInstance = createAuthenticationMiddleware({});
  }

  return authMiddlewareInstance;
}
