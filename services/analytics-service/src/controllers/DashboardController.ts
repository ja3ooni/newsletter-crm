// @ts-nocheck
import { DashboardService } from '@/services/DashboardService';
import { WebSocketService } from '@/services/WebSocketService';
import { logger } from '@/utils/logger';
import { Request, Response } from 'express';
import { z } from 'zod';

const CreateDashboardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
});

const UpdateDashboardSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  layout: z
    .object({
      columns: z.number().min(1).max(24),
      rows: z.number().min(1).max(20),
      gap: z.number().min(0).max(50),
      responsive: z.boolean(),
    })
    .optional(),
});

const AddWidgetSchema = z.object({
  type: z.enum(['metric', 'chart', 'table', 'heatmap', 'funnel', 'cohort']),
  title: z.string().min(1).max(255),
  config: z.object({
    chartType: z.enum(['line', 'bar', 'pie', 'area', 'scatter']).optional(),
    metrics: z.array(z.string()).min(1),
    dimensions: z.array(z.string()).default([]),
    filters: z.record(z.any()).default({}),
    timeRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
      period: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']),
    }),
    aggregation: z.enum(['sum', 'avg', 'count', 'min', 'max']).default('sum'),
    groupBy: z.array(z.string()).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    limit: z.number().min(1).max(1000).optional(),
  }),
  position: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().min(1).max(12),
    height: z.number().min(1).max(8),
  }),
  dataSource: z.string(),
  refreshInterval: z.number().min(30).max(3600).optional(),
});

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class DashboardController {
  private dashboardService: DashboardService;

  constructor(wsService: WebSocketService) {
    this.dashboardService = new DashboardService(wsService);
  }

  async createDashboard(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const validatedData = CreateDashboardSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const dashboard = await this.dashboardService.createDashboard(
        validatedData.name,
        validatedData.description,
        userId,
        validatedData.isPublic
      );

      res.status(201).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error('Failed to create dashboard', { error, body: req.body });

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
        error: 'Failed to create dashboard',
      });
    }
  }

  async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const dashboard = await this.dashboardService.getDashboard(
        dashboardId,
        userId
      );

      if (!dashboard) {
        res.status(404).json({
          success: false,
          error: 'Dashboard not found',
        });
        return;
      }

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error('Failed to get dashboard', { error, params: req.params });
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard',
      });
    }
  }

  async updateDashboard(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const validatedData = UpdateDashboardSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const dashboard = await this.dashboardService.updateDashboard(
        dashboardId,
        validatedData,
        userId
      );

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error('Failed to update dashboard', {
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
        error: 'Failed to update dashboard',
      });
    }
  }

  async deleteDashboard(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      await this.dashboardService.deleteDashboard(dashboardId, userId);

      res.json({
        success: true,
        message: 'Dashboard deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete dashboard', { error, params: req.params });
      res.status(500).json({
        success: false,
        error: 'Failed to delete dashboard',
      });
    }
  }

  async getUserDashboards(
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

      const dashboards = await this.dashboardService.getUserDashboards(userId);

      res.json({
        success: true,
        data: dashboards,
      });
    } catch (error) {
      logger.error('Failed to get user dashboards', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get user dashboards',
      });
    }
  }

  async addWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const validatedData = AddWidgetSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const widget = await this.dashboardService.addWidget(
        dashboardId,
        {
          type: validatedData.type,
          title: validatedData.title,
          config: {
            ...validatedData.config,
            timeRange: {
              start: new Date(validatedData.config.timeRange.start),
              end: new Date(validatedData.config.timeRange.end),
              period: validatedData.config.timeRange.period,
            },
          },
          position: validatedData.position,
          dataSource: validatedData.dataSource,
          refreshInterval: validatedData.refreshInterval,
        },
        userId
      );

      res.status(201).json({
        success: true,
        data: widget,
      });
    } catch (error) {
      logger.error('Failed to add widget', {
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
        error: 'Failed to add widget',
      });
    }
  }

  async updateWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId, widgetId } = req.params;
      const updates = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const widget = await this.dashboardService.updateWidget(
        dashboardId,
        widgetId,
        updates,
        userId
      );

      res.json({
        success: true,
        data: widget,
      });
    } catch (error) {
      logger.error('Failed to update widget', {
        error,
        params: req.params,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to update widget',
      });
    }
  }

  async removeWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId, widgetId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      await this.dashboardService.removeWidget(dashboardId, widgetId, userId);

      res.json({
        success: true,
        message: 'Widget removed successfully',
      });
    } catch (error) {
      logger.error('Failed to remove widget', { error, params: req.params });
      res.status(500).json({
        success: false,
        error: 'Failed to remove widget',
      });
    }
  }

  async getWidgetData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { widgetId } = req.params;
      const config = req.body;

      const data = await this.dashboardService.getWidgetData(widgetId, config);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get widget data', { error, params: req.params });
      res.status(500).json({
        success: false,
        error: 'Failed to get widget data',
      });
    }
  }

  async cloneDashboard(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const { name } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      if (!name || typeof name !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Dashboard name is required',
        });
        return;
      }

      const clonedDashboard = await this.dashboardService.cloneDashboard(
        dashboardId,
        name,
        userId
      );

      res.status(201).json({
        success: true,
        data: clonedDashboard,
      });
    } catch (error) {
      logger.error('Failed to clone dashboard', {
        error,
        params: req.params,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to clone dashboard',
      });
    }
  }

  async exportDashboard(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const { format = 'json' } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      if (!['json', 'pdf', 'csv', 'excel'].includes(format as string)) {
        res.status(400).json({
          success: false,
          error: 'Invalid format. Supported formats: json, pdf, csv, excel',
        });
        return;
      }

      const fileName = await this.dashboardService.exportDashboard(
        dashboardId,
        userId,
        format as 'json' | 'pdf' | 'csv' | 'excel'
      );

      res.json({
        success: true,
        data: {
          fileName,
          downloadUrl: `/api/v1/dashboards/${dashboardId}/download?file=${fileName}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });
    } catch (error) {
      logger.error('Failed to export dashboard', {
        error,
        params: req.params,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to export dashboard',
      });
    }
  }

  async getKPISummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { timeRange = '30d' } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      // Calculate time range
      const now = new Date();
      let start: Date;
      switch (timeRange) {
        case '7d':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
        default:
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const kpiSummary = await this.dashboardService.getKPISummary(userId, {
        start,
        end: now,
      });

      res.json({
        success: true,
        data: kpiSummary,
      });
    } catch (error) {
      logger.error('Failed to get KPI summary', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to get KPI summary',
      });
    }
  }

  async getRealtimeMetrics(
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

      const realtimeMetrics = await this.dashboardService.getRealtimeMetrics();

      res.json({
        success: true,
        data: realtimeMetrics,
      });
    } catch (error) {
      logger.error('Failed to get realtime metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get realtime metrics',
      });
    }
  }
}
