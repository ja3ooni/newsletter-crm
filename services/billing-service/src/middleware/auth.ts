import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authorization token required',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET environment variable not set');
      res.status(500).json({
        success: false,
        error: 'Server configuration error',
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      isAdmin: decoded.role === 'admin' || decoded.isAdmin === true,
    };

    next();
  } catch (error) {
    logger.error('Authentication failed', { error: error.message });

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: 'Token expired',
      });
      return;
    }

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

export const adminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
    return;
  }

  next();
};

export const optionalAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const token = authHeader.substring(7);

    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET environment variable not set');
      next();
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      isAdmin: decoded.role === 'admin' || decoded.isAdmin === true,
    };

    next();
  } catch (error) {
    // Token is invalid, but we continue without authentication
    logger.debug('Optional authentication failed', { error: error.message });
    next();
  }
};
