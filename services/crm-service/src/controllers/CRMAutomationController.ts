// @ts-nocheck
import { TerritoryRepository } from '@/repositories/TerritoryRepository';
import { CRMAnalyticsService } from '@/services/CRMAnalyticsService';
import { CRMAutomationService } from '@/services/CRMAutomationService';
import { NotFoundError, PaginationOptions, ValidationError } from '@/types';
import logger from '@/utils/logger';
import { validateRequest } from '@/utils/validation';
import { Request, Response } from 'express';
import { z } from 'zod';

// Validation schemas
const createTerritorySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  type: z.enum(['geographic', 'industry', 'company_size', 'revenue', 'custom']),
  rules: z.array(
    z.object({
      field: z.string(),
      operator: z.enum([
        'equals',
        'not_equals',
        'contains',
        'not_contains',
        'greater_than',
        'less_than',
        'in',
        'not_in',
      ]),
      value: z.any(),
      logicalOperator: z.enum(['AND', 'OR']).optional(),
    })
  ),
  assignedUsers: z.array(z.string().uuid()).optional(),
  priority: z.number().int().min(1).max(100).optional(),
});

const updateTerritorySchema = createTerritorySchema.partial();

const assignUserToTerritorySchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'member', 'viewer']).default('member'),
});

const dashboardMetricsSchema = z.object({
  timeRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
  userId: z.string().uuid().optional(),
});

const createCustomDashboardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  widgets: z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        'metric_card',
        'line_chart',
        'bar_chart',
        'pie_chart',
        'table',
        'funnel',
        'gauge',
        'heatmap',
        'leaderboard',
      ]),
      title: z.string(),
      config: z.record(z.any()),
      position: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    })
  ),
  layout: z.object({
    columns: z.number().int().min(1).max(12),
    rows: z.number().int().min(1),
    gap: z.number().min(0),
  }),
  isPublic: z.boolean().default(false),
});

export class CRMAutomationController {
  constructor(
    private automationService: CRMAutomationService,
    private analyticsService: CRMAnalyticsService,
    private territoryRepository: TerritoryRepository
  ) {}

  // ============================================================================
  // TERRITORY MANAGEMENT
  // ============================================================================

  async createTerritory(req: Request, res: Response): Promise<void> {
    try {
      const data = validateRequest(createTerritorySchema, req.body);
      const createdBy = req.user?.id;

      const territory = await this.territoryRepository.create(data, createdBy);

      logger.info('Territory created via API', {
        territoryId: territory.id,
        createdBy,
      });

      res.status(201).json({
        success: true,
        data: territory,
      });
    } catch (error) {
      logger.error('Error creating territory:', error);
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  async getTerritory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const territory = await this.territoryRepository.findById(id);

      if (!territory) {
        res.status(404).json({
          success: false,
          error: 'Territory not found',
        });
        return;
      }

      res.json({
        success: true,
        data: territory,
      });
    } catch (error) {
      logger.error('Error getting territory:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async getAllTerritories(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';

      const options: PaginationOptions = {
        page,
        limit,
        sortBy,
        sortOrder,
      };

      const result = await this.territoryRepository.findAll(options);

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      });
    } catch (error) {
      logger.error('Error getting all territories:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async updateTerritory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = validateRequest(updateTerritorySchema, req.body);

      const territory = await this.territoryRepository.update(id, updates);

      logger.info('Territory updated via API', {
        territoryId: id,
        updatedBy: req.user?.id,
      });

      res.json({
        success: true,
        data: territory,
      });
    } catch (error) {
      logger.error('Error updating territory:', error);
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
      } else if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  async deleteTerritory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.territoryRepository.delete(id);

      logger.info('Territory deleted via API', {
        territoryId: id,
        deletedBy: req.user?.id,
      });

      res.json({
        success: true,
        message: 'Territory deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting territory:', error);
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  async assignUserToTerritory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { userId, role } = validateRequest(
        assignUserToTerritorySchema,
        req.body
      );
      const assignedBy = req.user?.id;

      const assignment = await this.territoryRepository.assignUser(
        id,
        userId,
        role,
        assignedBy
      );

      logger.info('User assigned to territory via API', {
        territoryId: id,
        userId,
        role,
        assignedBy,
      });

      res.status(201).json({
        success: true,
        data: assignment,
      });
    } catch (error) {
      logger.error('Error assigning user to territory:', error);
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  async unassignUserFromTerritory(req: Request, res: Response): Promise<void> {
    try {
      const { id, userId } = req.params;
      await this.territoryRepository.unassignUser(id, userId);

      logger.info('User unassigned from territory via API', {
        territoryId: id,
        userId,
        unassignedBy: req.user?.id,
      });

      res.json({
        success: true,
        message: 'User unassigned from territory successfully',
      });
    } catch (error) {
      logger.error('Error unassigning user from territory:', error);
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  async getTerritoryAssignments(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const assignments = await this.territoryRepository.getAssignments(id);

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      logger.error('Error getting territory assignments:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async getUserTerritories(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const territories = await this.territoryRepository.findByUser(userId);

      res.json({
        success: true,
        data: territories,
      });
    } catch (error) {
      logger.error('Error getting user territories:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async getTerritoryCoverage(req: Request, res: Response): Promise<void> {
    try {
      const coverage = await this.territoryRepository.getTerritoryCoverage();

      res.json({
        success: true,
        data: coverage,
      });
    } catch (error) {
      logger.error('Error getting territory coverage:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // ============================================================================
  // AUTOMATION TRIGGERS
  // ============================================================================

  async triggerLeadAssignment(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      await this.automationService.processLeadAssignment(contactId);

      logger.info('Lead assignment triggered via API', {
        contactId,
        triggeredBy: req.user?.id,
      });

      res.json({
        success: true,
        message: 'Lead assignment processed successfully',
      });
    } catch (error) {
      logger.error('Error triggering lead assignment:', error);
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  async triggerFollowUpSequence(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      const { triggerEvent } = req.body;

      await this.automationService.processFollowUpSequences(
        contactId,
        triggerEvent
      );

      logger.info('Follow-up sequence triggered via API', {
        contactId,
        triggerEvent,
        triggeredBy: req.user?.id,
      });

      res.json({
        success: true,
        message: 'Follow-up sequence processed successfully',
      });
    } catch (error) {
      logger.error('Error triggering follow-up sequence:', error);
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  async triggerLeadQualification(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      await this.automationService.processLeadQualification(contactId);

      logger.info('Lead qualification triggered via API', {
        contactId,
        triggeredBy: req.user?.id,
      });

      res.json({
        success: true,
        message: 'Lead qualification processed successfully',
      });
    } catch (error) {
      logger.error('Error triggering lead qualification:', error);
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  async triggerDataEnrichment(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      await this.automationService.processDataEnrichment(contactId);

      logger.info('Data enrichment triggered via API', {
        contactId,
        triggeredBy: req.user?.id,
      });

      res.json({
        success: true,
        message: 'Data enrichment processed successfully',
      });
    } catch (error) {
      logger.error('Error triggering data enrichment:', error);
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  // ============================================================================
  // ANALYTICS AND REPORTING
  // ============================================================================

  async getDashboardMetrics(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query as any;
      let timeRange;
      let userId;

      if (query.timeRange) {
        const { start, end } = JSON.parse(query.timeRange);
        timeRange = {
          start: new Date(start),
          end: new Date(end),
        };
      }

      if (query.userId) {
        userId = query.userId;
      }

      const metrics = await this.analyticsService.getDashboardMetrics(
        userId,
        timeRange
      );

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Error getting dashboard metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async createCustomDashboard(req: Request, res: Response): Promise<void> {
    try {
      const data = validateRequest(createCustomDashboardSchema, req.body);
      const createdBy = req.user?.id!;

      const dashboard = await this.analyticsService.createCustomDashboard(
        data,
        createdBy
      );

      logger.info('Custom dashboard created via API', {
        dashboardId: dashboard.id,
        createdBy,
      });

      res.status(201).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error('Error creating custom dashboard:', error);
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  async getCustomDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const dashboard = await this.analyticsService.getCustomDashboard(id);

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
      logger.error('Error getting custom dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async getUserDashboards(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id!;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.analyticsService.getUserDashboards(userId, {
        page,
        limit,
      });

      res.json({
        success: true,
        data: result.dashboards,
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page < Math.ceil(result.total / limit),
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      logger.error('Error getting user dashboards:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async bulkAssignContacts(req: Request, res: Response): Promise<void> {
    try {
      const { contactIds, ownerId } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'contactIds must be a non-empty array',
        });
        return;
      }

      if (!ownerId) {
        res.status(400).json({
          success: false,
          error: 'ownerId is required',
        });
        return;
      }

      // Process bulk assignment
      const results = await Promise.allSettled(
        contactIds.map(contactId =>
          this.automationService.processLeadAssignment(contactId)
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info('Bulk contact assignment completed', {
        total: contactIds.length,
        successful,
        failed,
        assignedBy: req.user?.id,
      });

      res.json({
        success: true,
        data: {
          total: contactIds.length,
          successful,
          failed,
        },
      });
    } catch (error) {
      logger.error('Error in bulk contact assignment:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async bulkTriggerAutomation(req: Request, res: Response): Promise<void> {
    try {
      const { contactIds, automationType, config } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'contactIds must be a non-empty array',
        });
        return;
      }

      if (!automationType) {
        res.status(400).json({
          success: false,
          error: 'automationType is required',
        });
        return;
      }

      // Process bulk automation based on type
      let results;
      switch (automationType) {
        case 'lead_assignment':
          results = await Promise.allSettled(
            contactIds.map(contactId =>
              this.automationService.processLeadAssignment(contactId)
            )
          );
          break;
        case 'follow_up_sequence':
          results = await Promise.allSettled(
            contactIds.map(contactId =>
              this.automationService.processFollowUpSequences(
                contactId,
                config?.triggerEvent || 'manual'
              )
            )
          );
          break;
        case 'lead_qualification':
          results = await Promise.allSettled(
            contactIds.map(contactId =>
              this.automationService.processLeadQualification(contactId)
            )
          );
          break;
        case 'data_enrichment':
          results = await Promise.allSettled(
            contactIds.map(contactId =>
              this.automationService.processDataEnrichment(contactId)
            )
          );
          break;
        default:
          res.status(400).json({
            success: false,
            error: 'Invalid automation type',
          });
          return;
      }

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info('Bulk automation completed', {
        automationType,
        total: contactIds.length,
        successful,
        failed,
        triggeredBy: req.user?.id,
      });

      res.json({
        success: true,
        data: {
          automationType,
          total: contactIds.length,
          successful,
          failed,
        },
      });
    } catch (error) {
      logger.error('Error in bulk automation trigger:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
