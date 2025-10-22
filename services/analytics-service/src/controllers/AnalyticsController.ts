import { AnalyticsService } from '@/services/AnalyticsService';
import { logger } from '@/utils/logger';
import { Request, Response } from 'express';
import { z } from 'zod';

const TrackEventSchema = z.object({
  contactId: z.string().uuid(),
  newsletterId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  eventType: z.enum([
    'email_open',
    'email_click',
    'website_visit',
    'form_submit',
    'purchase',
    'unsubscribe',
    'bounce',
    'complaint',
  ]),
  metadata: z.record(z.any()).default({}),
  score: z.number().default(1),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

// Schema for metrics validation (to be used in future validation middleware)
// const GetMetricsSchema = z.object({
//   contactId: z.string().uuid().optional(),
//   newsletterId: z.string().uuid().optional(),
//   startDate: z.string().datetime().optional(),
//   endDate: z.string().datetime().optional(),
// });

const CohortAnalysisSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const ROICalculationSchema = z.object({
  campaignId: z.string().uuid().optional(),
  newsletterId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  async trackEvent(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = TrackEventSchema.parse(req.body);

      const event = await this.analyticsService.trackEngagementEvent({
        ...validatedData,
        timestamp: new Date(),
      });

      res.status(201).json({
        success: true,
        data: event,
      });
    } catch (error) {
      logger.error('Failed to track event', { error, body: req.body });

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
        error: 'Failed to track event',
      });
    }
  }

  async getEngagementMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      const { startDate, endDate } = req.query;

      if (!contactId) {
        res.status(400).json({
          success: false,
          error: 'Contact ID is required',
        });
        return;
      }

      const timeRange =
        startDate && endDate
          ? {
              start: new Date(startDate as string),
              end: new Date(endDate as string),
            }
          : undefined;

      const metrics = await this.analyticsService.getEngagementMetrics(
        contactId,
        timeRange
      );

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Failed to get engagement metrics', {
        error,
        params: req.params,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get engagement metrics',
      });
    }
  }

  async getNewsletterMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { newsletterId } = req.params;

      if (!newsletterId) {
        res.status(400).json({
          success: false,
          error: 'Newsletter ID is required',
        });
        return;
      }

      const metrics =
        await this.analyticsService.getNewsletterMetrics(newsletterId);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Failed to get newsletter metrics', {
        error,
        params: req.params,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get newsletter metrics',
      });
    }
  }

  async getCohortAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = CohortAnalysisSchema.parse(req.query);

      const cohorts = await this.analyticsService.getCohortAnalysis(
        validatedData.period,
        new Date(validatedData.startDate),
        new Date(validatedData.endDate)
      );

      res.json({
        success: true,
        data: cohorts,
      });
    } catch (error) {
      logger.error('Failed to get cohort analysis', {
        error,
        query: req.query,
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
        error: 'Failed to get cohort analysis',
      });
    }
  }

  async getROICalculation(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = ROICalculationSchema.parse(req.query);

      const timeRange =
        validatedData.startDate && validatedData.endDate
          ? {
              start: new Date(validatedData.startDate),
              end: new Date(validatedData.endDate),
            }
          : undefined;

      const roi = await this.analyticsService.calculateROI(
        validatedData.campaignId,
        validatedData.newsletterId,
        timeRange
      );

      res.json({
        success: true,
        data: roi,
      });
    } catch (error) {
      logger.error('Failed to calculate ROI', { error, query: req.query });

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
        error: 'Failed to calculate ROI',
      });
    }
  }

  async getRealTimeMetrics(req: Request, res: Response): Promise<void> {
    try {
      // This would typically stream real-time metrics
      // For now, return current day metrics
      // const today = new Date().toISOString().split('T')[0]; // For future use

      // Get real-time metrics from Redis
      const metrics = {
        timestamp: new Date(),
        email_opens: 0, // Would get from Redis
        email_clicks: 0,
        website_visits: 0,
        conversions: 0,
        active_users: 0,
      };

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Failed to get real-time metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get real-time metrics',
      });
    }
  }

  async getOverviewMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { period = '30d' } = req.query;

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // This would aggregate metrics across all newsletters/campaigns
      const overview = {
        period,
        totalSubscribers: 0,
        totalNewsletters: 0,
        totalEngagements: 0,
        averageOpenRate: 0,
        averageClickRate: 0,
        totalRevenue: 0,
        growthRate: 0,
        churnRate: 0,
      };

      res.json({
        success: true,
        data: overview,
      });
    } catch (error) {
      logger.error('Failed to get overview metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get overview metrics',
      });
    }
  }

  async exportMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { format = 'json', ...filters } = req.query;

      // This would generate and return metrics in the requested format
      const data = {
        exported_at: new Date(),
        format,
        filters,
        metrics: [], // Would contain actual metrics data
      };

      switch (format) {
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader(
            'Content-Disposition',
            'attachment; filename=analytics-export.csv'
          );
          // Convert data to CSV format
          res.send('CSV data would go here');
          break;

        case 'excel':
          res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          );
          res.setHeader(
            'Content-Disposition',
            'attachment; filename=analytics-export.xlsx'
          );
          // Convert data to Excel format
          res.send('Excel data would go here');
          break;

        default:
          res.json({
            success: true,
            data,
          });
      }
    } catch (error) {
      logger.error('Failed to export metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to export metrics',
      });
    }
  }
}
