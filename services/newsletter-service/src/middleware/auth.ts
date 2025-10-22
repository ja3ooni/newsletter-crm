import { config } from '@/config'
import { logger } from '@/utils/logger'
import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
  }
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' })
    return
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any
    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
    }
    next()
  } catch (error) {
    logger.error('Token verification failed:', error)
    res.status(403).json({ error: 'Invalid or expired token' })
  }
}

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' })
      return
    }

    next()
  }
}

export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    next()
    return
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any
    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
    }
  } catch (error) {
    // Ignore token errors for optional auth
    logger.debug('Optional auth token verification failed:', error)
  }

  next()
}

export const requireOwnership = (resourceIdParam: string = 'id') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // Admin users can access any resource
    if (req.user.role === 'admin') {
      next()
      return
    }

    const resourceId = req.params[resourceIdParam]
    if (!resourceId) {
      res.status(400).json({ error: 'Resource ID required' })
      return
    }

    try {
      // In a real implementation, you would check if the user owns the resource
      // For now, we'll assume the user owns resources they created
      // This would typically involve a database query to check ownership

      // Example: Check if newsletter belongs to user
      // const newsletter = await newsletterService.getNewsletter(resourceId)
      // if (!newsletter || newsletter.createdBy !== req.user.id) {
      //   res.status(403).json({ error: 'Access denied' })
      //   return
      // }

      next()
    } catch (error) {
      logger.error('Error checking resource ownership:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

export const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string

  if (!apiKey) {
    res.status(401).json({ error: 'API key required' })
    return
  }

  // In a real implementation, you would validate the API key against a database
  // For now, we'll use a simple check
  if (apiKey !== process.env.API_KEY) {
    res.status(403).json({ error: 'Invalid API key' })
    return
  }

  // Set a default user for API key authentication
  ;(req as AuthenticatedRequest).user = {
    id: 'api-user',
    email: 'api@ailert.com',
    role: 'api',
  }

  next()
}

export const authMiddleware = {
  authenticate: authenticateToken,
  requireRole,
  optionalAuth,
  requireOwnership,
  apiKey: apiKeyAuth,
}
