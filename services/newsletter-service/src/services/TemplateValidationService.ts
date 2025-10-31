import {
  TemplateValidationError,
  TemplateValidationResult,
  TemplateValidationWarning,
} from '@/types/template';
import { logger } from '@/utils/logger';

export class TemplateValidationService {
  async validateTemplate(
    html: string,
    css?: string
  ): Promise<TemplateValidationResult> {
    const errors: TemplateValidationError[] = [];
    const warnings: TemplateValidationWarning[] = [];
    const suggestions: string[] = [];

    try {
      // HTML validation
      this.validateHTML(html, errors, warnings);

      // CSS validation
      if (css) {
        this.validateCSS(css, errors, warnings);
      }

      // Accessibility validation
      this.validateAccessibility(html, errors, warnings);

      // Performance validation
      this.validatePerformance(html, css, warnings, suggestions);

      // Mobile responsiveness validation
      this.validateResponsiveness(html, css, warnings, suggestions);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
      };
    } catch (error) {
      logger.error('Error validating template:', error);
      errors.push({
        type: 'html',
        message: 'Template validation failed',
        severity: 'error',
      });

      return {
        isValid: false,
        errors,
        warnings,
        suggestions,
      };
    }
  }

  private validateHTML(
    html: string,
    errors: TemplateValidationError[],
    warnings: TemplateValidationWarning[]
  ): void {
    // Check for basic HTML structure
    if (!html.includes('<html') || !html.includes('</html>')) {
      errors.push({
        type: 'html',
        message: 'Missing required HTML structure',
        severity: 'error',
      });
    }

    // Check for required meta tags
    if (
      !html.includes('<meta charset=') &&
      !html.includes('<meta http-equiv="Content-Type"')
    ) {
      warnings.push({
        type: 'best-practice',
        message: 'Missing charset meta tag',
        suggestion: 'Add <meta charset="UTF-8"> for proper character encoding',
      });
    }

    // Check for viewport meta tag
    if (!html.includes('viewport')) {
      warnings.push({
        type: 'compatibility',
        message: 'Missing viewport meta tag',
        suggestion: 'Add viewport meta tag for mobile responsiveness',
      });
    }

    // Check for required template variables
    const requiredVariables = ['{{title}}', '{{content}}'];
    for (const variable of requiredVariables) {
      if (!html.includes(variable)) {
        errors.push({
          type: 'variable',
          message: `Missing required variable: ${variable}`,
          severity: 'error',
        });
      }
    }
  }

  private validateCSS(
    css: string,
    errors: TemplateValidationError[],
    warnings: TemplateValidationWarning[]
  ): void {
    // Check for CSS syntax errors (basic validation)
    const openBraces = (css.match(/{/g) || []).length;
    const closeBraces = (css.match(/}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push({
        type: 'css',
        message: 'CSS syntax error: mismatched braces',
        severity: 'error',
      });
    }

    // Check for potentially problematic CSS
    if (css.includes('!important')) {
      warnings.push({
        type: 'best-practice',
        message: 'Excessive use of !important detected',
        suggestion:
          'Consider using more specific selectors instead of !important',
      });
    }
  }

  private validateAccessibility(
    html: string,
    errors: TemplateValidationError[],
    warnings: TemplateValidationWarning[]
  ): void {
    // Check for images without alt text
    const imgTags = html.match(/<img[^>]*>/g) || [];
    for (const img of imgTags) {
      if (!img.includes('alt=')) {
        warnings.push({
          type: 'accessibility',
          message: 'Image missing alt attribute',
          suggestion: 'Add alt attributes to all images for screen readers',
        });
      }
    }

    // Check for proper heading structure
    if (!html.includes('<h1')) {
      warnings.push({
        type: 'accessibility',
        message: 'Missing main heading (h1)',
        suggestion: 'Include an h1 element for proper document structure',
      });
    }
  }

  private validatePerformance(
    html: string,
    css: string | undefined,
    warnings: TemplateValidationWarning[],
    suggestions: string[]
  ): void {
    // Check HTML size
    if (html.length > 100000) {
      // 100KB
      warnings.push({
        type: 'performance',
        message: 'Large HTML size detected',
        suggestion:
          'Consider optimizing HTML content for better email client compatibility',
      });
    }

    // Check CSS size
    if (css && css.length > 50000) {
      // 50KB
      warnings.push({
        type: 'performance',
        message: 'Large CSS size detected',
        suggestion: 'Consider minifying CSS or moving styles inline',
      });
    }

    // Check for external resources
    if (html.includes('http://') || html.includes('https://')) {
      suggestions.push(
        'Consider hosting images and resources on a reliable CDN'
      );
    }
  }

  private validateResponsiveness(
    html: string,
    css: string | undefined,
    warnings: TemplateValidationWarning[],
    suggestions: string[]
  ): void {
    // Check for responsive meta tag
    if (!html.includes('viewport')) {
      warnings.push({
        type: 'compatibility',
        message: 'Template may not be mobile-responsive',
        suggestion: 'Add viewport meta tag and responsive CSS',
      });
    }

    // Check for media queries
    if (css && !css.includes('@media')) {
      suggestions.push(
        'Consider adding media queries for better mobile experience'
      );
    }

    // Check for fixed widths
    if (html.includes('width="') && !html.includes('max-width')) {
      suggestions.push(
        'Use max-width instead of fixed width for better responsiveness'
      );
    }
  }
}
