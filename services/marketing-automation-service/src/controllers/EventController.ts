// @ts-nocheck
import { EventService } from '@/services/EventService';
import { FilterParams, PaginationParams } from '@/types';
import { logger } from '@/utils/logger';
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';

export class EventController {
  private eventService: EventService;

  constructor() {
    this.eventService = new EventService();
  }

  // ============================================================================
  // EVENT MANAGEMENT ENDPOINTS
  // ============================================================================

  async createEvent(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });

        return;
      }

      const { type, contactId, data, source } = req.body;

      const event = await this.eventService.createEvent(
        type,
        contactId,
        data,
        source
      );

      res.status(201).json({
        success: true,
        message: 'Event created successfully',
        data: event,
      });

      logger.info('Event created via API', {
        eventId: event.id,
        type,
        contactId,
        source,
        createdBy: req.user?.id || 'system',
        ip: req.ip,
      });
    } catch (error) {
      logger.error('Error in createEvent controller', {
        error,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async getEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const event = await this.eventService.getEvent(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: 'Event not found',
        });

        return;
      }

      res.json({
        success: true,
        data: event,
      });
    } catch (error) {
      logger.error('Error in getEvent controller', {
        error,
        eventId: req.params.id,
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async getEventsByContact(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;

      const pagination: PaginationParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const filters: FilterParams = {};

      if (req.query.startDate && req.query.endDate) {
        filters.dateRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string),
        };
      }

      const result = await this.eventService.getEventsByContact(
        contactId,
        pagination,
        filters
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error in getEventsByContact controller', {
        error,
        contactId: req.params.contactId,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async getEventsByType(req: Request, res: Response): Promise<void> {
    try {
      const { eventType } = req.params;

      const pagination: PaginationParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const filters: FilterParams = {};

      if (req.query.startDate && req.query.endDate) {
        filters.dateRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string),
        };
      }

      const result = await this.eventService.getEventsByType(
        eventType,
        pagination,
        filters
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error in getEventsByType controller', {
        error,
        eventType: req.params.eventType,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async processEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await this.eventService.processEvent(id);

      res.json({
        success: true,
        message: 'Event processed successfully',
      });

      logger.info('Event processed via API', {
        eventId: id,
        processedBy: req.user?.id || 'system',
        ip: req.ip,
      });
    } catch (error) {
      logger.error('Error in processEvent controller', {
        error,
        eventId: req.params.id,
      });
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async processUnprocessedEvents(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = parseInt(req.query.batchSize as string) || 100;

      const processedCount =
        await this.eventService.processUnprocessedEvents(batchSize);

      res.json({
        success: true,
        message: 'Unprocessed events processed successfully',
        data: {
          processedCount,
          batchSize,
        },
      });

      logger.info('Unprocessed events processed via API', {
        processedCount,
        batchSize,
        triggeredBy: req.user?.id || 'system',
        ip: req.ip,
      });
    } catch (error) {
      logger.error('Error in processUnprocessedEvents controller', { error });
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  // ============================================================================
  // EVENT TRIGGER MANAGEMENT ENDPOINTS
  // ============================================================================

  async createEventTrigger(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });

        return;
      }

      const { name, eventType, conditions, workflowId, campaignId } = req.body;

      const trigger = await this.eventService.createEventTrigger(
        name,
        eventType,
        conditions,
        workflowId,
        campaignId
      );

      res.status(201).json({
        success: true,
        message: 'Event trigger created successfully',
        data: trigger,
      });

      logger.info('Event trigger created via API', {
        triggerId: trigger.id,
        name,
        eventType,
        workflowId,
        campaignId,
        createdBy: req.user?.id || 'system',
        ip: req.ip,
      });
    } catch (error) {
      logger.error('Error in createEventTrigger controller', {
        error,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async getEventTrigger(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const trigger = await this.eventService.getEventTrigger(id);

      if (!trigger) {
        res.status(404).json({
          success: false,
          message: 'Event trigger not found',
        });

        return;
      }

      res.json({
        success: true,
        data: trigger,
      });
    } catch (error) {
      logger.error('Error in getEventTrigger controller', {
        error,
        triggerId: req.params.id,
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async getEventTriggers(req: Request, res: Response): Promise<void> {
    try {
      const pagination: PaginationParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const filters: FilterParams = {};

      if (req.query.startDate && req.query.endDate) {
        filters.dateRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string),
        };
      }

      const result = await this.eventService.getEventTriggers(
        pagination,
        filters
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error in getEventTriggers controller', {
        error,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async updateEventTrigger(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });

        return;
      }

      const { id } = req.params;
      const { name, conditions, isActive } = req.body;

      const trigger = await this.eventService.updateEventTrigger(id, {
        name,
        conditions,
        isActive,
      });

      if (!trigger) {
        res.status(404).json({
          success: false,
          message: 'Event trigger not found',
        });

        return;
      }

      res.json({
        success: true,
        message: 'Event trigger updated successfully',
        data: trigger,
      });

      logger.info('Event trigger updated via API', {
        triggerId: id,
        updatedBy: req.user?.id || 'system',
        ip: req.ip,
      });
    } catch (error) {
      logger.error('Error in updateEventTrigger controller', {
        error,
        triggerId: req.params.id,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async deleteEventTrigger(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const deleted = await this.eventService.deleteEventTrigger(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Event trigger not found',
        });

        return;
      }

      res.json({
        success: true,
        message: 'Event trigger deleted successfully',
      });

      logger.info('Event trigger deleted via API', {
        triggerId: id,
        deletedBy: req.user?.id || 'system',
        ip: req.ip,
      });
    } catch (error) {
      logger.error('Error in deleteEventTrigger controller', {
        error,
        triggerId: req.params.id,
      });
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async activateEventTrigger(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const trigger = await this.eventService.activateEventTrigger(id);

      if (!trigger) {
        res.status(404).json({
          success: false,
          message: 'Event trigger not found',
        });

        return;
      }

      res.json({
        success: true,
        message: 'Event trigger activated successfully',
        data: trigger,
      });

      logger.info('Event trigger activated via API', {
        triggerId: id,
        activatedBy: req.user?.id || 'system',
        ip: req.ip,
      });
    } catch (error) {
      logger.error('Error in activateEventTrigger controller', {
        error,
        triggerId: req.params.id,
      });
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async deactivateEventTrigger(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const trigger = await this.eventService.deactivateEventTrigger(id);

      if (!trigger) {
        res.status(404).json({
          success: false,
          message: 'Event trigger not found',
        });

        return;
      }

      res.json({
        success: true,
        message: 'Event trigger deactivated successfully',
        data: trigger,
      });

      logger.info('Event trigger deactivated via API', {
        triggerId: id,
        deactivatedBy: req.user?.id || 'system',
        ip: req.ip,
      });
    } catch (error) {
      logger.error('Error in deactivateEventTrigger controller', {
        error,
        triggerId: req.params.id,
      });
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  // ============================================================================
  // ANALYTICS ENDPOINTS
  // ============================================================================

  async getEventStats(req: Request, res: Response): Promise<void> {
    try {
      let dateRange;

      if (req.query.startDate && req.query.endDate) {
        dateRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string),
        };
      }

      const stats = await this.eventService.getEventStats(dateRange);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error in getEventStats controller', {
        error,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  // ============================================================================
  // MAINTENANCE ENDPOINTS
  // ============================================================================

  async cleanupOldEvents(req: Request, res: Response): Promise<void> {
    try {
      const olderThanDays = parseInt(req.query.olderThanDays as string) || 90;

      const deletedCount =
        await this.eventService.cleanupOldEvents(olderThanDays);

      res.json({
        success: true,
        message: 'Old events cleaned up successfully',
        data: {
          deletedCount,
          olderThanDays,
        },
      });

      logger.info('Old events cleaned up via API', {
        deletedCount,
        olderThanDays,
        triggeredBy: req.user?.id || 'system',
        ip: req.ip,
      });
    } catch (error) {
      logger.error('Error in cleanupOldEvents controller', { error });
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
}

export default EventController;
