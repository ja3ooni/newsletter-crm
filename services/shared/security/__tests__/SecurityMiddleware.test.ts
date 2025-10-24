import { NextFunction, Request, Response } from 'express';
import {
  SecurityMiddleware,
  createSecurityMiddleware,
} from '../SecurityMiddleware';

// Mock express-rate-limit
jest.mock('express-rate-limit');
const mockRateLimit = require('express-rate-limit');

// Mock helmet
jest.mock('helmet');
const mockHelmet = require('helmet');

describe('SecurityMiddleware', () => {
  let securityMiddleware: SecurityMiddleware;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    securityMiddleware = SecurityMiddleware.getInstance();

    mockReq = {
      ip: '127.0.0.1',
      headers: {},
      query: {},
      body: {},
      path: '/test',
      method: 'GET',
      get: jest.fn(),
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
      end: jest.fn(),
    };

    mockNext = jest.fn();

    // Mock rate limit middleware
    mockRateLimit.mockReturnValue(
      (req: Request, res: Response, next: NextFunction) => next()
    );

    // Mock helmet middleware
    mockHelmet.mockReturnValue(
      (req: Request, res: Response, next: NextFunction) => next()
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = SecurityMiddleware.getInstance();
      const instance2 = SecurityMiddleware.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create instance with factory function', () => {
      const instance = createSecurityMiddleware();
      expect(instance).toBeInstanceOf(SecurityMiddleware);
    });
  });

  describe('Security Headers Middleware', () => {
    it('should add security headers', () => {
      const middleware = securityMiddleware.securityHeadersMiddleware();

      mockReq.secure = true;
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-XSS-Protection',
        '1; mode=block'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not add HSTS header for non-HTTPS requests', () => {
      const middleware = securityMiddleware.securityHeadersMiddleware();

      mockReq.secure = false;
      mockReq.headers = {};
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });
  });

  describe('CORS Middleware', () => {
    it('should handle CORS for allowed origins', () => {
      const middleware = securityMiddleware.corsMiddleware();

      mockReq.headers = { origin: 'http://localhost:3000' };
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'http://localhost:3000'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Credentials',
        'true'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle OPTIONS preflight requests', () => {
      const middleware = securityMiddleware.corsMiddleware();

      mockReq.method = 'OPTIONS';
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.end).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Request Sanitization Middleware', () => {
    it('should sanitize query parameters', () => {
      const middleware = securityMiddleware.requestSanitizationMiddleware();

      mockReq.query = {
        search: 'normal query',
        filter: 'safe value',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject malicious query parameters', () => {
      const middleware = securityMiddleware.requestSanitizationMiddleware();

      // Mock InputValidator to return invalid result
      const InputValidator = require('../InputValidator');
      jest.spyOn(InputValidator, 'sanitizeString').mockReturnValue({
        isValid: false,
        errors: ['Malicious content detected'],
        sanitizedData: '',
      });

      mockReq.query = {
        malicious: '<script>alert("xss")</script>',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Invalid query parameter',
        details: ['Malicious content detected'],
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle sanitization errors', () => {
      const middleware = securityMiddleware.requestSanitizationMiddleware();

      // Mock InputValidator to throw error
      const InputValidator = require('../InputValidator');
      jest.spyOn(InputValidator, 'sanitizeString').mockImplementation(() => {
        throw new Error('Sanitization failed');
      });

      mockReq.query = { test: 'value' };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Request processing failed',
      });
    });
  });

  describe('SQL Injection Protection', () => {
    it('should detect SQL injection attempts', () => {
      const middleware = securityMiddleware.sqlInjectionProtection();

      mockReq.body = {
        username: "admin'; DROP TABLE users; --",
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Request contains potentially malicious content',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow safe SQL-like content', () => {
      const middleware = securityMiddleware.sqlInjectionProtection();

      mockReq.body = {
        description: 'This is a normal description with SELECT word in it',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should check nested objects for SQL injection', () => {
      const middleware = securityMiddleware.sqlInjectionProtection();

      mockReq.body = {
        user: {
          profile: {
            bio: "'; DROP TABLE profiles; --",
          },
        },
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('XSS Protection', () => {
    it('should detect and sanitize XSS attempts', () => {
      const middleware = securityMiddleware.xssProtection();

      mockReq.body = {
        comment: '<script>alert("xss")</script>',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.comment).toBe('');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle nested XSS attempts', () => {
      const middleware = securityMiddleware.xssProtection();

      mockReq.body = {
        user: {
          profile: {
            bio: '<iframe src="javascript:alert(1)"></iframe>',
          },
        },
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.user.profile.bio).toBe('');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle arrays with XSS content', () => {
      const middleware = securityMiddleware.xssProtection();

      mockReq.body = {
        comments: [
          'Safe comment',
          '<script>alert("xss")</script>',
          'Another safe comment',
        ],
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.comments[0]).toBe('Safe comment');
      expect(mockReq.body.comments[1]).toBe('');
      expect(mockReq.body.comments[2]).toBe('Another safe comment');
    });
  });

  describe('DDoS Protection', () => {
    it('should allow normal request rates', () => {
      const middleware = securityMiddleware.ddosProtection();

      // Make several normal requests
      for (let i = 0; i < 10; i++) {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(10);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block suspicious high-rate requests', () => {
      const middleware = securityMiddleware.ddosProtection();

      // Simulate high request rate
      for (let i = 0; i < 1001; i++) {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too Many Requests',
        message: 'Suspicious activity detected. Access temporarily restricted.',
        retryAfter: expect.any(Number),
      });
    });

    it('should reset counters after time window', done => {
      const middleware = securityMiddleware.ddosProtection();

      // Make requests to build up counter
      for (let i = 0; i < 500; i++) {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // Wait for time window to pass (mocked)
      setTimeout(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Should allow requests again
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('Content Security Policy', () => {
    it('should set default CSP header', () => {
      const middleware = securityMiddleware.contentSecurityPolicy();

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow custom CSP directives', () => {
      const customDirectives = {
        scriptSrc: ["'self'", "'unsafe-inline'"],
      };

      const middleware =
        securityMiddleware.contentSecurityPolicy(customDirectives);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("script-src 'self' 'unsafe-inline'")
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting middleware', () => {
      const middleware = securityMiddleware.rateLimitMiddleware();

      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          max: 100,
          message: 'Too many requests from this IP, please try again later',
          standardHeaders: true,
          legacyHeaders: false,
        })
      );
    });

    it('should handle rate limit exceeded', () => {
      // Mock rate limit to call handler
      mockRateLimit.mockImplementation((config: any) => {
        return (req: Request, res: Response, next: NextFunction) => {
          config.handler(req, res);
        };
      });

      const middleware = securityMiddleware.rateLimitMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too Many Requests',
        message: 'Too many requests from this IP, please try again later',
        retryAfter: expect.any(Number),
      });
    });
  });

  describe('Slow Down Middleware', () => {
    it('should not delay requests under threshold', () => {
      const middleware = securityMiddleware.slowDownMiddleware();

      const startTime = Date.now();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be immediate
      expect(mockNext).toHaveBeenCalled();
    });

    it('should delay requests over threshold', done => {
      const middleware = securityMiddleware.slowDownMiddleware();

      // Make requests to exceed threshold
      for (let i = 0; i < 51; i++) {
        middleware(mockReq as Request, mockRes as Response, jest.fn());
      }

      const startTime = Date.now();
      middleware(mockReq as Request, mockRes as Response, () => {
        const endTime = Date.now();
        expect(endTime - startTime).toBeGreaterThan(400); // Should be delayed
        done();
      });
    });
  });

  describe('Apply Security Middleware', () => {
    it('should return array of basic security middleware', () => {
      const middlewares = securityMiddleware.applySecurityMiddleware();

      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBeGreaterThan(0);
    });
  });
});
