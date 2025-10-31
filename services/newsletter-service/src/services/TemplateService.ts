import {
  CreateTemplateData,
  TemplateRepository,
} from '@/repositories/TemplateRepository';
import { NewsletterTemplate } from '@/types';
import { logger } from '@/utils/logger';

export interface TemplateCustomizationOptions {
  variables: Record<string, any>;
  mobileOptimized: boolean;
  darkModeSupport: boolean;
}

export interface TemplateMarketplaceItem extends NewsletterTemplate {
  downloads: number;
  rating: number;
  reviews: number;
  price: number;
  author: string;
  tags: string[];
}

export class TemplateService {
  constructor(private templateRepository: TemplateRepository) {}

  async createTemplate(data: CreateTemplateData): Promise<NewsletterTemplate> {
    try {
      // Validate template HTML and CSS
      await this.validateTemplate(data.html, data.css);

      // Generate mobile-responsive version
      const mobileOptimizedHtml = await this.generateMobileOptimized(
        data.html,
        data.css
      );

      const templateData = {
        ...data,
        html: mobileOptimizedHtml,
      };

      return await this.templateRepository.create(templateData);
    } catch (error) {
      logger.error('Error creating template:', error);
      throw error;
    }
  }

  async getTemplatesByCategory(
    category: string
  ): Promise<NewsletterTemplate[]> {
    return await this.templateRepository.findByCategory(category);
  }

  async customizeTemplate(
    templateId: string,
    options: TemplateCustomizationOptions
  ): Promise<string> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    let customizedHtml = template.html;

    // Apply variable substitutions
    for (const [key, value] of Object.entries(options.variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      customizedHtml = customizedHtml.replace(regex, String(value));
    }

    return customizedHtml;
  }

  private async validateTemplate(html: string, css?: string): Promise<void> {
    // Basic HTML validation
    if (!html.includes('<html') || !html.includes('</html>')) {
      throw new Error('Invalid HTML structure');
    }

    // Check for required template variables
    const requiredVars = ['{{title}}', '{{content}}'];
    for (const variable of requiredVars) {
      if (!html.includes(variable)) {
        throw new Error(`Missing required variable: ${variable}`);
      }
    }
  }

  private async generateMobileOptimized(
    html: string,
    css?: string
  ): Promise<string> {
    // Add mobile-responsive meta tags and CSS
    const mobileCSS = `
      @media only screen and (max-width: 600px) {
        .container { width: 100% !important; }
        .content { padding: 10px !important; }
      }
    `;

    return html.replace('</head>', `<style>${mobileCSS}</style></head>`);
  }
}
  async getMarketplaceTemplates(): Promise<TemplateMarketplaceItem[]> {
    const publicTemplates = await this.templateRepository.findPublicTemplates();

    // Transform to marketplace items with additional metadata
    return publicTemplates.map(template => ({
      ...template,
      downloads: 0, // TODO: Implement download tracking
      rating: 4.5,  // TODO: Implement rating system
      reviews: 0,   // TODO: Implement review system
      price: 0,     // Free templates for now
      author: template.createdBy,
      tags: this.extractTagsFromTemplate(template),
    }));
  }

  async duplicateTemplate(templateId: string, newName: string, userId: string): Promise<NewsletterTemplate> {
    const originalTemplate = await this.templateRepository.findById(templateId);
    if (!originalTemplate) {
      throw new Error('Template not found');
    }

    const duplicateData: CreateTemplateData = {
      name: newName,
      category: originalTemplate.category,
      html: originalTemplate.html,
      css: originalTemplate.css,
      variables: originalTemplate.variables,
      previewImage: originalTemplate.previewImage,
      isPublic: false, // Duplicates are private by default
      createdBy: userId,
    };

    return await this.templateRepository.create(duplicateData);
  }

  async generatePreviewImage(templateId: string): Promise<string> {
    // TODO: Implement screenshot generation service
    // For now, return a placeholder
    return `https://via.placeholder.com/600x400?text=Template+${templateId}`;
  }

  private extractTagsFromTemplate(template: NewsletterTemplate): string[] {
    const tags: string[] = [template.category];

    // Extract tags from template content
    if (template.html.includes('newsletter')) tags.push('newsletter');
    if (template.html.includes('business')) tags.push('business');
    if (template.html.includes('modern')) tags.push('modern');

    return [...new Set(tags)]; // Remove duplicates
  }

  async searchTemplates(query: string, filters?: {
    category?: string;
    isPublic?: boolean;
    tags?: string[];
  }): Promise<NewsletterTemplate[]> {
    const searchFilters = {
      search: query,
      category: filters?.category as any,
      isPublic: filters?.isPublic,
    };

    const result = await this.templateRepository.findMany(searchFilters);
    return result.templates;
  }

  async validateTemplateVariables(templateId: string, variables: Record<string, any>): Promise<{
    valid: boolean;
    missingVariables: string[];
    invalidVariables: string[];
  }> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const missingVariables: string[] = [];
    const invalidVariables: string[] = [];

    for (const templateVar of template.variables) {
      if (templateVar.required && !(templateVar.name in variables)) {
        missingVariables.push(templateVar.name);
      }

      if (templateVar.name in variables) {
        const value = variables[templateVar.name];
        if (!this.validateVariableType(value, templateVar.type)) {
          invalidVariables.push(templateVar.name);
        }
      }
    }

    return {
      valid: missingVariables.length === 0 && invalidVariables.length === 0,
      missingVariables,
      invalidVariables,
    };
  }

  private validateVariableType(value: any, type: TemplateVariable['type']): boolean {
    switch (type) {
      case 'text':
        return typeof value === 'string';
      case 'image':
        return typeof value === 'string' && (value.startsWith('http') || value.startsWith('data:'));
      case 'color':
        return typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value);
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return true;
    }
  }
}
