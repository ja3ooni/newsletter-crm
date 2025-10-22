import { ReportingService } from '@/services/ReportingService';
import { logger } from '@/utils/logger';
import { Request, Response } from 'express';
import { z } from 'zod';

const CreateReportSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['scheduled', 'on_demand']),
  format: z.enum(['pdf', 'csv', 'excel', 'json']),
  config: z.object({
    metrics: z.array(z.string()).min(1),
    dimensions: z.array(z.string()).default([]),
    filters: z.record(z.any()).default({}),
    timeRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
      period: z.enum(['day', 'week', 'month', 'quarter', 'year']),
    }),
    groupBy: z.array(z.string()).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    includeCharts: z.boolean().default(true),
    includeTables: z.boolean().default(true),
    includeExecutiveSummary: z.boolean().default(true),
  }),
  recipients: z.array(z.string().email()).min(1),
  schedule: z
    .object({
      frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
      time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      timezone: z.string().default('UTC'),
    })
    .optional(),
});

const UpdateReportSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  type: z.enum(['scheduled', 'on_demand']).optional(),
  format: z.enum(['pdf', 'csv', 'excel', 'json']).optional(),
  config: z
    .object({
      metrics: z.array(z.string()).min(1),
      dimensions: z.array(z.string()).default([]),
      filters: z.record(z.any()).default({}),
      timeRange: z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
        period: z.enum(['day', 'week', 'month', 'quarter', 'year']),
      }),
      groupBy: z.array(z.string()).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
      includeCharts: z.boolean().default(true),
      includeTables: z.boolean().default(true),
      includeExecutiveSummary: z.boolean().default(true),
    })
    .optional(),
  recipients: z.array(z.string().email()).min(1).optional(),
  schedule: z
    .object({
      frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
      time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      timezone: z.string().default('UTC'),
    })
    .optional(),
  status: z.enum(['active', 'paused', 'error']).optional(),
});

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class ReportingController {
  private reportingService: ReportingService;

  constructor() {
    this.reportingService = new ReportingService();
  }

  async createReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = CreateReportSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const report = await this.reportingService.createReport(
        validatedData.name,
        validatedData.description,
        validatedData.type,
        validatedData.format,
        {
          ...validatedData.config,
          timeRange: {
            start: new Date(validatedData.config.timeRange.start),
            end: new Date(validatedData.config.timeRange.end),
            period: validatedData.config.timeRange.period,
          },
        },
        validatedData.recipients,
        userId,
        validatedData.schedule
      );

      res.status(201).json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to create report', { error, body: req.body });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create report',
      });
    }
  }

  async getReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;

      const report = await this.reportingService.getReport(reportId);

      if (!report) {
        res.status(404).json({
          success: false,
          error: 'Report not found',
        });
        return;
      }

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to get report', { error, params: req.params });
      res.status(500).json({
        success: false,
        error: 'Failed to get report',
      });
    }
  }

  async getUserReports(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const reports = await this.reportingService.getUserReports(userId);

      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      logger.error('Failed to get user reports', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get user reports',
      });
    }
  }

  async updateReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const validatedData = UpdateReportSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const updates: any = { ...validatedData };
      if (validatedData.config?.timeRange) {
        updates.config = {
          ...validatedData.config,
          timeRange: {
            start: new Date(validatedData.config.timeRange.start),
            end: new Date(validatedData.config.timeRange.end),
            period: validatedData.config.timeRange.period,
          },
        };
      }

      const report = await this.reportingService.updateReport(
        reportId,
        updates,
        userId
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to update report', {
        error,
        params: req.params,
        body: req.body,
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update report',
      });
    }
  }

  async deleteReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      await this.reportingService.deleteReport(reportId, userId);

      res.json({
        success: true,
        message: 'Report deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete report', { error, params: req.params });
      res.status(500).json({
        success: false,
        error: 'Failed to delete report',
      });
    }
  }

  async generateReport(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { reportId } = req.params;

      const filePath = await this.reportingService.generateReport(reportId);

      res.json({
        success: true,
        data: {
          reportId,
          filePath,
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to generate report', { error, params: req.params });
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
      });
    }
  }

  async downloadReport(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { reportId } = req.params;
      // const { format } = req.query; // For future use

      // Generate report on-demand
      // const filePath = await this.reportingService.generateReport(reportId); // For future use

      // In a real implementation, this would stream the file
      res.json({
        success: true,
        message: 'Report generated successfully',
        data: {
          downloadUrl: `/api/v1/reports/${reportId}/download?token=generated_token`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });
    } catch (error) {
      logger.error('Failed to download report', { error, params: req.params });
      res.status(500).json({
        success: false,
        error: 'Failed to download report',
      });
    }
  }

  async getScheduledReports(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const reports = await this.reportingService.getScheduledReports();

      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      logger.error('Failed to get scheduled reports', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get scheduled reports',
      });
    }
  }

  async previewReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;

      // Generate a preview version of the report (limited data)
      const report = await this.reportingService.getReport(reportId);
      if (!report) {
        res.status(404).json({
          success: false,
          error: 'Report not found',
        });
        return;
      }

      // Generate preview data (this would be a subset of the full report)
      const previewData = {
        name: report.name,
        format: report.format,
        config: report.config,
        sampleData: {
          summary: {
            totalSubscribers: 1250,
            totalNewsletters: 45,
            averageOpenRate: 28.5,
            averageClickRate: 4.2,
            totalRevenue: 15750.0,
          },
          charts: [
            {
              title: 'Engagement Trends',
              type: 'line',
              data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                datasets: [
                  {
                    label: 'Opens',
                    data: [120, 135, 150, 142, 168],
                  },
                ],
              },
            },
          ],
        },
      };

      res.json({
        success: true,
        data: previewData,
      });
    } catch (error) {
      logger.error('Failed to preview report', { error, params: req.params });
      res.status(500).json({
        success: false,
        error: 'Failed to preview report',
      });
    }
  }

  async getExecutiveSummary(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { reportId } = req.params;

      const executiveSummary = await this.reportingService.generateExecutiveSummary(
        reportId
      );

      res.json({
        success: true,
        data: executiveSummary,
      });
    } catch (error) {
      logger.error('Failed to get executive summary', {
        error,
        params: req.params,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get executive summary',
      });
    }
  }

  async getReportTemplates(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const templates = await this.reportingService.getReportTemplates();

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      logger.error('Failed to get report templates', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get report templates',
      });
    }
  }

  async createReportFromTemplate(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { templateId } = req.params;
      const { name, recipients, schedule } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const templates = await this.reportingService.getReportTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      // Create report from template
      const report = await this.reportingService.createReport(
        name || template.name,
        template.description,
        schedule ? 'scheduled' : 'on_demand',
        'pdf', // Default format
        {
          ...template.config,
          timeRange: {
            start: new Date(template.config.timeRange!.start),
            end: new Date(template.config.timeRange!.end),
            period: template.config.timeRange!.period,
          },
        } as any,
        recipients || [],
        userId,
        schedule
      );

      res.status(201).json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to create report from template', {
        error,
        params: req.params,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to create report from template',
      });
    }
  }
}
