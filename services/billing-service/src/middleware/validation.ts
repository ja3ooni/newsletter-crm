import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';

export const validateRequest = (schema: z.ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate the request against the schema
      const validatedData = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });

      // Replace request data with validated data
      if (validatedData.body) {
        req.body = validatedData.body;
      }
      if (validatedData.query) {
        req.query = validatedData.query;
      }
      if (validatedData.params) {
        req.params = validatedData.params;
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: validationErrors,
        });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationErrors,
        });
        return;
      }

      logger.error('Unexpected validation error', {
        path: req.path,
        method: req.method,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };
};

export const validateBody = (schema: z.ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          success: false,
          error: 'Request body validation failed',
          details: validationErrors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };
};

export const validateQuery = (schema: z.ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          success: false,
          error: 'Query parameter validation failed',
          details: validationErrors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };
};

export const validateParams = (schema: z.ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          success: false,
          error: 'URL parameter validation failed',
          details: validationErrors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };
};
