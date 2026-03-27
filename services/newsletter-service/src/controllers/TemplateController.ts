import { TemplateRepository } from '@/repositories/TemplateRepository';
import { TemplateService } from '@/services/TemplateService';
import { logger } from '@/utils/logger';
import { Request, Response } from 'express';

export class TemplateController {
  private templateService: TemplateService;

  constructor() {
    const templateRepository = new TemplateRepository();

    this.templateService = new TemplateService(templateRepository);
  }

  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateData = {
        ...req.body,
        createdBy: req.user?.id || 'system',
      };

      const template = await this.templateService.createTemplate(templateData);

      res.status(201).json({
        success: true,
        data: template,
        message: 'Template created successfully',
      });
    } catch (error) {
      logger.error('Error creating template:', error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to create template',
      });
    }
  }

  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { category, search, page = 1, limit = 20 } = req.query;

      const filters = {
        category: category as string,
        search: search as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        isPublic: true,
      };

      const result = await this.templateService.searchTemplates(
        (search as string) || '',
        filters
      );

      res.json({
        success: true,
        data: result,
        message: 'Templates retrieved successfully',
      });
    } catch (error) {
      logger.error('Error getting templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve templates',
      });
    }
  }

  async getTemplateById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const templateRepository = new TemplateRepository();
      const template = await templateRepository.findById(id);

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template not found',
        });

        return;
      }

      res.json({
        success: true,
        data: template,
        message: 'Template retrieved successfully',
      });
    } catch (error) {
      logger.error('Error getting template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve template',
      });
    }
  }

  async getMarketplaceTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await this.templateService.getMarketplaceTemplates();

      res.json({
        success: true,
        data: templates,
        message: 'Marketplace templates retrieved successfully',
      });
    } catch (error) {
      logger.error('Error getting marketplace templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve marketplace templates',
      });
    }
  }

  async customizeTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { variables, mobileOptimized = true, darkModeSupport = false } = req.body;

      const customizedHtml = await this.templateService.customizeTemplate(id, {
        variables,
        mobileOptimized,
        darkModeSupport,
      });

      res.json({
        success: true,
        data: { html: customizedHtml },
        message: 'Template customized successfully',
      });
    } catch (error) {
      logger.error('Error customizing template:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to customize template',
      });
    }
  }

  async duplicateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const userId = req.user?.id || 'system';

      const duplicatedTemplate = await this.templateService.duplicateTemplate(id, name, userId);

      res.status(201).json({
        success: true,
        data: duplicatedTemplate,
        message: 'Template duplicated successfully',
      });
    } catch (error) {
      logger.error('Error duplicating template:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to duplicate template',
      });
    }
  }

  async validateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { variables } = req.body;

      const validation = await this.templateService.validateTemplateVariables(id, variables);

      res.json({
        success: true,
        data: validation,
        message: 'Template validation completed',
      });
    } catch (error) {
      logger.error('Error validating template:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to validate template',
      });
    }
  }

  async generatePreview(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const previewUrl = await this.templateService.generatePreviewImage(id);

      res.json({
        success: true,
        data: { previewUrl },
        message: 'Preview generated successfully',
      });
    } catch (error) {
      logger.error('Error generating preview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate preview',
      });
    }
  }

  async getTemplatesByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params;
      const templates = await this.templateService.getTemplatesByCategory(category);

      res.json({
        success: true,
        data: templates,
        message: `Templates for category '${category}' retrieved successfully`,
      });
    } catch (error) {
      logger.error('Error getting templates by category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve templates by category',
      });
    }
  }

  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const templateRepository = new TemplateRepository();
      const updatedTemplate = await templateRepository.update(id, updateData);

      if (!updatedTemplate) {
        res.status(404).json({
          success: false,
          message: 'Template not found',
        });
        return;
      }

      res.json({
        success: true,
        data: updatedTemplate,
        message: 'Template updated successfully',
      });
    } catch (error) {
      logger.error('Error updating template:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update template',
      });
    }
  }

  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const templateRepository = new TemplateRepository();
      const deleted = await templateRepository.delete(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Template not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete template',
      });
    }
  }
}
