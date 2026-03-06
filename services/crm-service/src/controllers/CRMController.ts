// @ts-nocheck
import { CRMService } from '@/services/CRMService';
import {
    ContactSearchRequest,
    ValidationError
} from '@/types';
import {
    validateBulkOperation,
    validateCreateContact,
    validateCreateSegment,
    validateUpdateContact,
    validateUpdateSegment
} from '@/utils/validation';
import { NextFunction, Request, Response } from 'express';

export class CRMController {
  constructor(private crmService: CRMService) {}

  // ============================================================================
  // CONTACT ENDPOINTS
  // ============================================================================

  createContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contactData = validateCreateContact(req.body);
      const createdBy = req.user?.id;

      const contact = await this.crmService.createContact(contactData, createdBy);

      res.status(201).json({
        success: true,
        data: contact,
        message: 'Contact created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  getContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const contact = await this.crmService.getContact(id);

      res.json({
        success: true,
        data: contact
      });
    } catch (error) {
      next(error);
    }
  };

  updateContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = validateUpdateContact(req.body);

      const contact = await this.crmService.updateContact(id, updates);

      res.json({
        success: true,
        data: contact,
        message: 'Contact updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  deleteContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.crmService.deleteContact(id);

      res.json({
        success: true,
        message: 'Contact deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  searchContacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const searchParams = this.parseSearchParams(req.query);
      const result = await this.crmService.searchContacts(searchParams);

      res.json({
        success: true,
        data: result.contacts,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getContactStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.crmService.getContactStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };

  getContactJourney = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const journey = await this.crmService.getContactJourney(id);

      res.json({
        success: true,
        data: journey
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // SEGMENT ENDPOINTS
  // ============================================================================

  createSegment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const segmentData = validateCreateSegment(req.body);
      const createdBy = req.user?.id;

      const segment = await this.crmService.createSegment(segmentData, createdBy);

      res.status(201).json({
        success: true,
        data: segment,
        message: 'Segment created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  getSegment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const segment = await this.crmService.getSegment(id);

      res.json({
        success: true,
        data: segment
      });
    } catch (error) {
      next(error);
    }
  };

  getAllSegments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';

      const result = await this.crmService.getAllSegments({
        page,
        limit,
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev
        }
      });
    } catch (error) {
      next(error);
    }
  };

  updateSegment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = validateUpdateSegment(req.body);

      const segment = await this.crmService.updateSegment(id, updates);

      res.json({
        success: true,
        data: segment,
        message: 'Segment updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  deleteSegment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.crmService.deleteSegment(id);

      res.json({
        success: true,
        message: 'Segment deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  getSegmentContacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const contactIds = await this.crmService.getSegmentContacts(id);

      res.json({
        success: true,
        data: { contactIds, count: contactIds.length }
      });
    } catch (error) {
      next(error);
    }
  };

  addContactsToSegment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { contactIds } = req.body;
      const addedBy = req.user?.id;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        throw new ValidationError('contactIds must be a non-empty array');
      }

      await this.crmService.addContactsToSegment(id, contactIds, addedBy);

      res.json({
        success: true,
        message: `${contactIds.length} contacts added to segment`
      });
    } catch (error) {
      next(error);
    }
  };

  removeContactsFromSegment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { contactIds } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        throw new ValidationError('contactIds must be a non-empty array');
      }

      await this.crmService.removeContactsFromSegment(id, contactIds);

      res.json({
        success: true,
        message: `${contactIds.length} contacts removed from segment`
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  bulkUpdateContacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bulkRequest = validateBulkOperation(req.body);

      const result = await this.crmService.bulkUpdateContacts(bulkRequest);

      res.json({
        success: true,
        data: result,
        message: 'Bulk operation completed successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // ENGAGEMENT TRACKING
  // ============================================================================

  trackEngagement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { contactId } = req.params;
      const { eventType, eventName, metadata, score, newsletterId, campaignId } = req.body;

      const engagementData: any = {
        eventType,
        metadata: metadata || {},
        score: score || 0,
      };

      if (eventName) engagementData.eventName = eventName;
      if (newsletterId) engagementData.newsletterId = newsletterId;
      if (campaignId) engagementData.campaignId = campaignId;
      if (req.ip) engagementData.ipAddress = req.ip;
      if (req.get('User-Agent')) engagementData.userAgent = req.get('User-Agent');

      await this.crmService.trackEngagement(contactId, engagementData);

      res.json({
        success: true,
        message: 'Engagement tracked successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // LEAD SCORING
  // ============================================================================

  calculateLeadScore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { contactId } = req.params;
      const score = await this.crmService.calculateLeadScore(contactId);

      res.json({
        success: true,
        data: { contactId, score },
        message: 'Lead score calculated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // CONTACT ENRICHMENT
  // ============================================================================

  enrichContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { contactId } = req.params;
      const { provider } = req.body;

      const enrichmentJob = await this.crmService.enrichContact(contactId, provider);

      res.json({
        success: true,
        data: enrichmentJob,
        message: 'Contact enrichment completed'
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // DUPLICATE DETECTION
  // ============================================================================

  findDuplicates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { contactId } = req.params;
      const duplicates = await this.crmService.findDuplicates(contactId);

      res.json({
        success: true,
        data: duplicates,
        message: `Found ${duplicates.length} duplicate groups`
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private parseSearchParams(query: any): ContactSearchRequest {
    const {
      q,
      tags,
      lifecycle,
      source,
      ownerId,
      createdAfter,
      createdBefore,
      lastActivityAfter,
      lastActivityBefore,
      leadScoreMin,
      leadScoreMax,
      sortBy,
      sortOrder,
      page,
      limit
    } = query;

    const searchParams: ContactSearchRequest = {
      sortBy: sortBy || 'created_at',
      sortOrder: sortOrder || 'desc',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50
    };

    if (q) searchParams.query = q;
    if (tags) searchParams.tags = Array.isArray(tags) ? tags : [tags];
    if (lifecycle) searchParams.lifecycle = Array.isArray(lifecycle) ? lifecycle : [lifecycle];
    if (source) searchParams.source = Array.isArray(source) ? source : [source];
    if (ownerId) searchParams.ownerId = Array.isArray(ownerId) ? ownerId : [ownerId];
    if (createdAfter) searchParams.createdAfter = new Date(createdAfter);
    if (createdBefore) searchParams.createdBefore = new Date(createdBefore);
    if (lastActivityAfter) searchParams.lastActivityAfter = new Date(lastActivityAfter);
    if (lastActivityBefore) searchParams.lastActivityBefore = new Date(lastActivityBefore);
    if (leadScoreMin) searchParams.leadScoreMin = parseInt(leadScoreMin);
    if (leadScoreMax) searchParams.leadScoreMax = parseInt(leadScoreMax);

    return searchParams;
  }
}
