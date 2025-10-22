import { ContactRepository } from '@/repositories/ContactRepository';
import { SegmentRepository } from '@/repositories/SegmentRepository';
import {
    BulkOperationRequest,
    BulkOperationResponse,
    Contact,
    ContactActivity,
    ContactSearchRequest,
    ContactSearchResponse,
    CreateContactRequest,
    CreateSegmentRequest,
    DuplicateGroup,
    EngagementEvent,
    EnrichmentJob,
    NotFoundError,
    PaginatedResponse,
    PaginationOptions,
    Segment,
    UpdateContactRequest,
    UpdateSegmentRequest,
    ValidationError
} from '@/types';
import logger from '@/utils/logger';

export class CRMService {
  constructor(
    private contactRepository: ContactRepository,
    private segmentRepository: SegmentRepository
  ) {}

  // ============================================================================
  // CONTACT MANAGEMENT
  // ============================================================================

  async createContact(contactData: CreateContactRequest, createdBy?: string): Promise<Contact> {
    try {
      logger.info('Creating contact', { email: contactData.email, createdBy });

      const contact = await this.contactRepository.create(contactData, createdBy);

      // Trigger lead scoring for new contact
      await this.calculateLeadScore(contact.id);

      // Add to auto-updating segments
      await this.updateContactSegments(contact.id);

      return contact;
    } catch (error) {
      logger.error('Error creating contact:', error);
      throw error;
    }
  }

  async getContact(id: string): Promise<Contact> {
    const contact = await this.contactRepository.findById(id);
    if (!contact) {
      throw new NotFoundError('Contact');
    }
    return contact;
  }

  async getContactByEmail(email: string): Promise<Contact | null> {
    return this.contactRepository.findByEmail(email);
  }

  async updateContact(id: string, updates: UpdateContactRequest): Promise<Contact> {
    try {
      logger.info('Updating contact', { contactId: id, updates: Object.keys(updates) });

      const contact = await this.contactRepository.update(id, updates);

      // Recalculate lead score if relevant fields changed
      if (this.shouldRecalculateScore(updates)) {
        await this.calculateLeadScore(contact.id);
      }

      // Update segments if conditions might have changed
      await this.updateContactSegments(contact.id);

      return contact;
    } catch (error) {
      logger.error('Error updating contact:', { id, error });
      throw error;
    }
  }

  async deleteContact(id: string): Promise<void> {
    try {
      logger.info('Deleting contact', { contactId: id });

      // Remove from all segments first
      await this.removeContactFromAllSegments(id);

      // Delete the contact
      await this.contactRepository.delete(id);

      logger.info('Contact deleted successfully', { contactId: id });
    } catch (error) {
      logger.error('Error deleting contact:', { id, error });
      throw error;
    }
  }

  async searchContacts(searchParams: ContactSearchRequest): Promise<ContactSearchResponse> {
    return this.contactRepository.search(searchParams);
  }

  async getContactStats(): Promise<{
    total: number;
    byLifecycle: Record<string, number>;
    bySource: Record<string, number>;
    recentActivity: number;
  }> {
    return this.contactRepository.getContactStats();
  }

  // ============================================================================
  // CONTACT ACTIVITIES & ENGAGEMENT
  // ============================================================================

  async trackEngagement(contactId: string, event: Omit<EngagementEvent, 'id' | 'contactId' | 'timestamp' | 'createdAt'>): Promise<void> {
    try {
      // Update last activity timestamp
      await this.contactRepository.updateLastActivity(contactId);

      // Calculate and award points for this engagement
      const points = await this.calculateEngagementPoints(event);
      if (points > 0) {
        const contact = await this.getContact(contactId);
        const newScore = contact.leadScore + points;
        await this.contactRepository.updateLeadScore(contactId, newScore);
      }

      logger.info('Engagement tracked', { contactId, eventType: event.eventType, points });
    } catch (error) {
      logger.error('Error tracking engagement:', { contactId, event, error });
      throw error;
    }
  }

  async getContactJourney(contactId: string): Promise<{
    contact: Contact;
    activities: ContactActivity[];
    engagementEvents: EngagementEvent[];
    segments: Segment[];
  }> {
    try {
      const contact = await this.getContact(contactId);

      // Get contact's segments
      const segments = await this.getContactSegments(contactId);

      // For now, return basic structure - activities and events would come from separate repositories
      return {
        contact,
        activities: [], // TODO: Implement ContactActivityRepository
        engagementEvents: [], // TODO: Implement EngagementEventRepository
        segments,
      };
    } catch (error) {
      logger.error('Error getting contact journey:', { contactId, error });
      throw error;
    }
  }

  // ============================================================================
  // SEGMENTATION
  // ============================================================================

  async createSegment(segmentData: CreateSegmentRequest, createdBy?: string): Promise<Segment> {
    try {
      logger.info('Creating segment', { name: segmentData.name, createdBy });

      const segment = await this.segmentRepository.create(segmentData, createdBy);

      // Calculate initial contacts if auto-updating
      if (segment.isAutoUpdating) {
        await this.segmentRepository.updateContactCount(segment.id);
      }

      return segment;
    } catch (error) {
      logger.error('Error creating segment:', error);
      throw error;
    }
  }

  async getSegment(id: string): Promise<Segment> {
    const segment = await this.segmentRepository.findById(id);
    if (!segment) {
      throw new NotFoundError('Segment');
    }
    return segment;
  }

  async getAllSegments(options?: PaginationOptions): Promise<PaginatedResponse<Segment>> {
    return this.segmentRepository.findAll(options);
  }

  async updateSegment(id: string, updates: UpdateSegmentRequest): Promise<Segment> {
    try {
      logger.info('Updating segment', { segmentId: id, updates: Object.keys(updates) });

      const segment = await this.segmentRepository.update(id, updates);

      return segment;
    } catch (error) {
      logger.error('Error updating segment:', { id, error });
      throw error;
    }
  }

  async deleteSegment(id: string): Promise<void> {
    try {
      logger.info('Deleting segment', { segmentId: id });
      await this.segmentRepository.delete(id);
      logger.info('Segment deleted successfully', { segmentId: id });
    } catch (error) {
      logger.error('Error deleting segment:', { id, error });
      throw error;
    }
  }

  async getSegmentContacts(segmentId: string): Promise<string[]> {
    return this.segmentRepository.getContactIds(segmentId);
  }

  async addContactsToSegment(segmentId: string, contactIds: string[], addedBy?: string): Promise<void> {
    return this.segmentRepository.addContactsToSegment(segmentId, contactIds, addedBy);
  }

  async removeContactsFromSegment(segmentId: string, contactIds: string[]): Promise<void> {
    return this.segmentRepository.removeContactsFromSegment(segmentId, contactIds);
  }

  async getContactSegments(contactId: string): Promise<Segment[]> {
    try {
      // This would typically be a more efficient query, but for now we'll get all segments
      // and filter by contact
      const allSegments = await this.segmentRepository.findAll({ page: 1, limit: 1000 });
      const contactSegments: Segment[] = [];

      for (const segment of allSegments.data) {
        const contactIds = await this.segmentRepository.getContactIds(segment.id);
        if (contactIds.includes(contactId)) {
          contactSegments.push(segment);
        }
      }

      return contactSegments;
    } catch (error) {
      logger.error('Error getting contact segments:', { contactId, error });
      throw error;
    }
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async bulkUpdateContacts(request: BulkOperationRequest): Promise<BulkOperationResponse> {
    try {
      const { contactIds, operation } = request;

      logger.info('Starting bulk operation', {
        type: operation.type,
        contactCount: contactIds.length
      });

      let affectedCount = 0;

      switch (operation.type) {
        case 'update':
          affectedCount = await this.contactRepository.bulkUpdate(contactIds, operation.params);
          break;

        case 'delete':
          affectedCount = await this.contactRepository.bulkDelete(contactIds);
          break;

        case 'add_tags':
          for (const contactId of contactIds) {
            await this.contactRepository.addTags(contactId, operation.params.tags);
          }
          affectedCount = contactIds.length;
          break;

        case 'remove_tags':
          for (const contactId of contactIds) {
            await this.contactRepository.removeTags(contactId, operation.params.tags);
          }
          affectedCount = contactIds.length;
          break;

        case 'change_lifecycle':
          affectedCount = await this.contactRepository.bulkUpdate(contactIds, {
            lifecycle: operation.params.lifecycle
          });
          break;

        case 'assign_owner':
          affectedCount = await this.contactRepository.bulkUpdate(contactIds, {
            ownerId: operation.params.ownerId
          });
          break;

        default:
          throw new ValidationError(`Unsupported bulk operation: ${operation.type}`);
      }

      // Update segments for affected contacts
      for (const contactId of contactIds) {
        await this.updateContactSegments(contactId);
      }

      const jobId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info('Bulk operation completed', {
        jobId,
        type: operation.type,
        affectedCount
      });

      return {
        jobId,
        totalRecords: contactIds.length,
        status: 'completed'
      };
    } catch (error) {
      logger.error('Error in bulk operation:', { request, error });
      throw error;
    }
  }

  // ============================================================================
  // LEAD SCORING
  // ============================================================================

  async calculateLeadScore(contactId: string): Promise<number> {
    try {
      // This is a simplified lead scoring implementation
      // In a real system, this would use the LeadScoringRule repository
      const contact = await this.getContact(contactId);

      let score = 0;

      // Demographic scoring
      if (contact.company) score += 10;
      if (contact.jobTitle) score += 5;
      if (contact.phone) score += 5;

      // Engagement scoring would be calculated from engagement events
      // For now, we'll keep the existing score and add demographic points
      score += contact.leadScore;

      await this.contactRepository.updateLeadScore(contactId, score);

      logger.info('Lead score calculated', { contactId, score });
      return score;
    } catch (error) {
      logger.error('Error calculating lead score:', { contactId, error });
      throw error;
    }
  }

  // ============================================================================
  // CONTACT ENRICHMENT
  // ============================================================================

  async enrichContact(contactId: string, provider: string = 'internal'): Promise<EnrichmentJob> {
    try {
      const contact = await this.getContact(contactId);

      // This is a placeholder for contact enrichment
      // In a real implementation, this would integrate with services like Clearbit, FullContact, etc.

      const enrichmentJob: EnrichmentJob = {
        id: `enrich_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        contactId,
        provider: provider as any,
        status: 'completed',
        requestData: { email: contact.email },
        responseData: {
          // Mock enriched data
          company: contact.company || 'Unknown Company',
          jobTitle: contact.jobTitle || 'Unknown Title',
        },
        enrichedFields: ['company', 'jobTitle'],
        confidence: 0.8,
        createdAt: new Date(),
        completedAt: new Date(),
      };

      logger.info('Contact enrichment completed', { contactId, provider });
      return enrichmentJob;
    } catch (error) {
      logger.error('Error enriching contact:', { contactId, provider, error });
      throw error;
    }
  }

  // ============================================================================
  // DUPLICATE DETECTION
  // ============================================================================

  async findDuplicates(contactId?: string): Promise<DuplicateGroup[]> {
    try {
      // This is a simplified duplicate detection implementation
      // In a real system, this would use fuzzy matching algorithms

      const duplicateGroups: DuplicateGroup[] = [];

      // For now, just find exact email matches
      if (contactId) {
        const contact = await this.getContact(contactId);
        const duplicates = await this.contactRepository.search({
          query: contact.email,
          limit: 10
        });

        if (duplicates.contacts.length > 1) {
          const group: DuplicateGroup = {
            id: `dup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            masterContactId: contactId,
            duplicateContactIds: duplicates.contacts
              .filter(c => c.id !== contactId)
              .map(c => c.id),
            confidence: 1.0,
            matchingFields: ['email'],
            status: 'pending',
            createdAt: new Date(),
          };

          duplicateGroups.push(group);
        }
      }

      logger.info('Duplicate detection completed', {
        contactId,
        duplicateGroupsFound: duplicateGroups.length
      });

      return duplicateGroups;
    } catch (error) {
      logger.error('Error finding duplicates:', { contactId, error });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private shouldRecalculateScore(updates: UpdateContactRequest): boolean {
    const scoringFields = ['company', 'jobTitle', 'phone', 'lifecycle'];
    return scoringFields.some(field => field in updates);
  }

  private async calculateEngagementPoints(event: Omit<EngagementEvent, 'id' | 'contactId' | 'timestamp' | 'createdAt'>): Promise<number> {
    // Simplified engagement scoring
    const pointsMap: Record<string, number> = {
      email_open: 1,
      email_click: 3,
      website_visit: 2,
      form_submit: 5,
      download: 4,
      purchase: 20,
      signup: 10,
      demo_request: 15,
    };

    return pointsMap[event.eventType] || 0;
  }

  private async updateContactSegments(contactId: string): Promise<void> {
    try {
      // Get all auto-updating segments and check if contact should be in them
      const allSegments = await this.segmentRepository.findAll({ page: 1, limit: 1000 });
      const autoSegments = allSegments.data.filter(s => s.isAutoUpdating);

      for (const segment of autoSegments) {
        await this.segmentRepository.updateContactCount(segment.id);
      }
    } catch (error) {
      logger.error('Error updating contact segments:', { contactId, error });
      // Don't throw - this is a background operation
    }
  }

  private async removeContactFromAllSegments(contactId: string): Promise<void> {
    try {
      const segments = await this.getContactSegments(contactId);

      for (const segment of segments) {
        await this.segmentRepository.removeContactsFromSegment(segment.id, [contactId]);
      }
    } catch (error) {
      logger.error('Error removing contact from segments:', { contactId, error });
      // Don't throw - this is cleanup operation
    }
  }
}
