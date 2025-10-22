import { DripCampaignService } from '@/services/DripCampaignService';
import {
    CreateDripCampaignRequest,
    FilterParams,
    PaginationParams,
    UpdateDripCampaignRequest
} from '@/types';
import { logger } from '@/utils/logger';
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';

export class DripCampaignController {
  private dripCampaignService: DripCampaignService;

  constructor() {
    this.dripCampaignService = new DripCampaignService();
  }

  // ============================================================================
  // DRIP CAMPAIGN MANAGEMENT ENDPOINTS
  // ============================================================================

  async createDripCampaign(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const campaignData: CreateDripCampaignRequest = req.body;
      const createdBy = req.user?.id || 'system';

      const campaign = await this.dripCampaignService.createDripCampaign(campaignData, createdBy);

      res.status(201).json({
        success: true,
        message: 'Drip campaign created successfully',
        data: campaign
      });

      logger.info('Drip campaign created via API', {
        campaignId: campaign.id,
        name: campaign.name,
        emailCount: campaign.emails.length,
        createdBy,
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in createDripCampaign controller', { error, body: req.body });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async getDripCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const campaign = await this.dripCampaignService.getDripCampaign(id);

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'Drip campaign not found'
        });
        return;
      }

      res.json({
        success: true,
        data: campaign
      });

    } catch (error) {
      logger.error('Error in getDripCampaign controller', { error, campaignId: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async getDripCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const pagination: PaginationParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
      };

      const filters: FilterParams = {};

      if (req.query.status) {
        filters.status = Array.isArray(req.query.status)
          ? req.query.status as string[]
          : [req.query.status as string];
      }

      if (req.query.createdBy) {
        filters.createdBy = req.query.createdBy as string;
      }

      if (req.query.startDate && req.query.endDate) {
        filters.dateRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string)
        };
      }

      const result = await this.dripCampaignService.getDripCampaigns(pagination, filters);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });

    } catch (error) {
      logger.error('Error in getDripCampaigns controller', { error, query: req.query });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async updateDripCampaign(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const updateData: UpdateDripCampaignRequest = req.body;

      const campaign = await this.dripCampaignService.updateDripCampaign(id, updateData);

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'Drip campaign not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Drip campaign updated successfully',
        data: campaign
      });

      logger.info('Drip campaign updated via API', {
        campaignId: id,
        updatedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in updateDripCampaign controller', {
        error,
        campaignId: req.params.id,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async deleteDripCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const deleted = await this.dripCampaignService.deleteDripCampaign(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Drip campaign not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Drip campaign deleted successfully'
      });

      logger.info('Drip campaign deleted via API', {
        campaignId: id,
        deletedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in deleteDripCampaign controller', {
        error,
        campaignId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async activateDripCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const campaign = await this.dripCampaignService.activateDripCampaign(id);

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'Drip campaign not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Drip campaign activated successfully',
        data: campaign
      });

      logger.info('Drip campaign activated via API', {
        campaignId: id,
        activatedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in activateDripCampaign controller', {
        error,
        campaignId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async pauseDripCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const campaign = await this.dripCampaignService.pauseDripCampaign(id);

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'Drip campaign not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Drip campaign paused successfully',
        data: campaign
      });

      logger.info('Drip campaign paused via API', {
        campaignId: id,
        pausedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in pauseDripCampaign controller', {
        error,
        campaignId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT ENDPOINTS
  // ============================================================================

  async subscribeToCampaign(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const { contactId, metadata } = req.body;

      const subscription = await this.dripCampaignService.subscribeToCampaign(
        id,
        contactId,
        metadata
      );

      res.status(201).json({
        success: true,
        message: 'Contact subscribed to campaign successfully',
        data: subscription
      });

      logger.info('Contact subscribed to drip campaign via API', {
        campaignId: id,
        subscriptionId: subscription.id,
        contactId,
        subscribedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in subscribeToCampaign controller', {
        error,
        campaignId: req.params.id,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async unsubscribeFromCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;

      const subscription = await this.dripCampaignService.unsubscribeFromCampaign(subscriptionId);

      if (!subscription) {
        res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Contact unsubscribed from campaign successfully',
        data: subscription
      });

      logger.info('Contact unsubscribed from drip campaign via API', {
        subscriptionId,
        campaignId: subscription.campaignId,
        contactId: subscription.contactId,
        unsubscribedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in unsubscribeFromCampaign controller', {
        error,
        subscriptionId: req.params.subscriptionId
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async pauseSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;

      const subscription = await this.dripCampaignService.pauseSubscription(subscriptionId);

      if (!subscription) {
        res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Subscription paused successfully',
        data: subscription
      });

      logger.info('Subscription paused via API', {
        subscriptionId,
        pausedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in pauseSubscription controller', {
        error,
        subscriptionId: req.params.subscriptionId
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async resumeSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;

      const subscription = await this.dripCampaignService.resumeSubscription(subscriptionId);

      if (!subscription) {
        res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Subscription resumed successfully',
        data: subscription
      });

      logger.info('Subscription resumed via API', {
        subscriptionId,
        resumedBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in resumeSubscription controller', {
        error,
        subscriptionId: req.params.subscriptionId
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  async getCampaignSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const pagination: PaginationParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
      };

      const result = await this.dripCampaignService.getCampaignSubscriptions(id, pagination);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });

    } catch (error) {
      logger.error('Error in getCampaignSubscriptions controller', {
        error,
        campaignId: req.params.id,
        query: req.query
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // ============================================================================
  // ANALYTICS ENDPOINTS
  // ============================================================================

  async getCampaignAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const analytics = await this.dripCampaignService.getCampaignAnalytics(id);

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Error in getCampaignAnalytics controller', {
        error,
        campaignId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  async processActiveSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      const processedCount = await this.dripCampaignService.processActiveSubscriptions();

      res.json({
        success: true,
        message: 'Active subscriptions processed successfully',
        data: {
          processedCount
        }
      });

      logger.info('Active subscriptions processed via API', {
        processedCount,
        triggeredBy: req.user?.id || 'system',
        ip: req.ip
      });

    } catch (error) {
      logger.error('Error in processActiveSubscriptions controller', { error });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }
}

export default DripCampaignController;
