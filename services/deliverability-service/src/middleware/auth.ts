import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    // Skip auth for health check and webhook endpoints
    if (req.path === '/health' || req.path.startsWith('/api/v1/webhooks/')) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        status: 'error',
        message: 'Access token is required',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;

      req.user = {
        id: decoded.id || decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user',
      };

      logger.debug('User authenticated', {
        userId: req.user.id,
        email: req.user.email,
        path: req.path
      });

      next();
    } catch (jwtError) {
      logger.warn('Invalid JWT token', {
        error: jwtError,
        token: token.substring(0, 20) + '...'
      });

      res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    logger.error('Auth middleware error', { error, path: req.path });
    res.status(500).json({
      status: 'error',
      message: 'Authentication error',
    });
  }
};

export const requireRole = (requiredRole: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
      return;
    }

    if (req.user.role !== requiredRole && req.user.role !== 'admin') {
      res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole('admin');
