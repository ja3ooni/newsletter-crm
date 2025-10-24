import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { z } from 'zod';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
}

export class InputValidator {
  /**
   * Validate and sanitize email input
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];

    if (!email || typeof email !== 'string') {
      errors.push('Email is required and must be a string');

      return { isValid: false, errors };
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!validator.isEmail(trimmedEmail)) {
      errors.push('Invalid email format');
    }

    if (trimmedEmail.length > 254) {
      errors.push('Email address too long');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? trimmedEmail : undefined,
    };
  }

  /**
   * Validate and sanitize HTML content
   */
  static validateHtml(html: string, allowedTags?: string[]): ValidationResult {
    const errors: string[] = [];

    if (!html || typeof html !== 'string') {
      errors.push('HTML content is required and must be a string');

      return { isValid: false, errors };
    }

    // Configure DOMPurify with allowed tags
    const config: any = {
      ALLOWED_TAGS: allowedTags || [
        'p',
        'br',
        'strong',
        'em',
        'u',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'a',
        'img',
        'div',
        'span',
        'table',
        'tr',
        'td',
        'th',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'style'],
      ALLOW_DATA_ATTR: false,
      FORBID_SCRIPT: true,
      FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'iframe'],
      KEEP_CONTENT: true,
    };

    const sanitizedHtml = DOMPurify.sanitize(html, config);

    // Check if content was significantly altered (potential XSS attempt)
    if (html.length > sanitizedHtml.length * 1.5) {
      errors.push('Content contains potentially malicious elements');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitizedHtml,
    };
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (!password || typeof password !== 'string') {
      errors.push('Password is required and must be a string');

      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common patterns
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password cannot contain repeated characters');
    }

    if (/123|abc|qwe|password|admin/i.test(password)) {
      errors.push('Password cannot contain common patterns');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? password : undefined,
    };
  }

  /**
   * Validate URL input
   */
  static validateUrl(
    url: string,
    allowedProtocols: string[] = ['http', 'https']
  ): ValidationResult {
    const errors: string[] = [];

    if (!url || typeof url !== 'string') {
      errors.push('URL is required and must be a string');

      return { isValid: false, errors };
    }

    const trimmedUrl = url.trim();

    if (
      !validator.isURL(trimmedUrl, {
        protocols: allowedProtocols,
        require_protocol: true,
        require_host: true,
        require_valid_protocol: true,
        allow_underscores: false,
        host_whitelist: false,
        host_blacklist: false,
        allow_trailing_dot: false,
        allow_protocol_relative_urls: false,
      })
    ) {
      errors.push('Invalid URL format');
    }

    // Additional security checks
    try {
      const urlObj = new URL(trimmedUrl);

      // Block localhost and private IPs in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = urlObj.hostname.toLowerCase();

        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')
        ) {
          errors.push('Private network URLs are not allowed');
        }
      }

      // Block suspicious protocols
      if (!allowedProtocols.includes(urlObj.protocol.slice(0, -1))) {
        errors.push(`Protocol ${urlObj.protocol} is not allowed`);
      }
    } catch (e) {
      errors.push('Invalid URL structure');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? trimmedUrl : undefined,
    };
  }

  /**
   * Validate JSON input with schema
   */
  static validateJson<T>(data: any, schema: z.ZodSchema<T>): ValidationResult {
    try {
      const validatedData = schema.parse(data);

      return {
        isValid: true,
        errors: [],
        sanitizedData: validatedData,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(
          err => `${err.path.join('.')}: ${err.message}`
        );

        return { isValid: false, errors };
      }

      return {
        isValid: false,
        errors: ['Invalid JSON data structure'],
      };
    }
  }

  /**
   * Sanitize string input for SQL injection prevention
   */
  static sanitizeString(
    input: string,
    maxLength: number = 1000
  ): ValidationResult {
    const errors: string[] = [];

    if (!input || typeof input !== 'string') {
      errors.push('Input is required and must be a string');

      return { isValid: false, errors };
    }

    let sanitized = input.trim();

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Check length
    if (sanitized.length > maxLength) {
      errors.push(`Input exceeds maximum length of ${maxLength} characters`);
      sanitized = sanitized.substring(0, maxLength);
    }

    // Remove potentially dangerous SQL patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
      /(UNION\s+SELECT)/gi,
      /(\bOR\s+1\s*=\s*1\b)/gi,
      /(\bAND\s+1\s*=\s*1\b)/gi,
      /(--|\#|\/\*|\*\/)/g,
      /(\bxp_cmdshell\b)/gi,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(sanitized)) {
        errors.push('Input contains potentially malicious SQL patterns');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
    };
  }

  /**
   * Validate file upload
   */
  static validateFile(
    file: { name: string; size: number; mimetype: string },
    options: {
      allowedTypes?: string[];
      maxSize?: number;
      allowedExtensions?: string[];
    } = {}
  ): ValidationResult {
    const errors: string[] = [];
    const {
      allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
      ],
      maxSize = 5 * 1024 * 1024, // 5MB
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
    } = options;

    if (!file || !file.name || !file.mimetype) {
      errors.push('Invalid file object');

      return { isValid: false, errors };
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds maximum allowed size of ${maxSize} bytes`);
    }

    // Check MIME type
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    // Check file extension
    const extension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf('.'));

    if (!allowedExtensions.includes(extension)) {
      errors.push(`File extension ${extension} is not allowed`);
    }

    // Check for suspicious file names
    if (/[<>:"/\\|?*\x00-\x1f]/.test(file.name)) {
      errors.push('File name contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? file : undefined,
    };
  }
}

// Common validation schemas
export const CommonSchemas = {
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  url: z.string().url().max(2048),
  uuid: z.string().uuid(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z\s\-'\.]+$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  ipAddress: z.string().ip(),
  dateString: z.string().datetime(),
  positiveInteger: z.number().int().positive(),
  nonNegativeInteger: z.number().int().min(0),
};
