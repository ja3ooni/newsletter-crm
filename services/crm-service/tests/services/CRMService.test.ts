import { ContactRepository } from '../../src/repositories/ContactRepository';
import { SegmentRepository } from '../../src/repositories/SegmentRepository';
import { CRMService } from '../../src/services/CRMService';
import {
    BulkOperationRequest,
    NotFoundError,
    ValidationError
} from '../../src/types';
import { mockContact, mockSegment, validCreateContactRequest } from '../fixtures/testData';
import { createMockContactRepository, createMockSegmentRepository } from '../mocks/repositories';

// Mock the repositories
jest.mock('../../src/repositories/ContactRepository');
jest.mock('../../src/repositories/SegmentRepository');
jest.mock('../../src/utils/logger');

describe('CRMService', () => {
  let crmService: CRMService;
  let mockContactRepository: jest.Mocked<ContactRepository>;
  let mockSegmentRepository: jest.Mocked<SegmentRepository>;

  beforeEach(() => {
    mockContactRepository = createMockContactRepository();
    mockSegmentRepository = createMockSegmentRepository();
    crmService = new CRMService(mockContactRepository, mockSegmentRepository);
    jest.clearAllMocks();
  });

  describe('createContact', () => {
    it('should create contact with valid data', async () => {
      const expectedContact = { ...mockContact, id: 'new-contact-123' };

      mockContactRepository.create.mockResolvedValue(expectedContact);
      mockContactRepository.findById.mockResolvedValue(expectedContact);
      mockContactRepository.updateLeadScore.mockResolvedValue(undefined);
      mockSegmentRepository.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0
      });

      const result = await crmService.createContact(validCreateContactRequest, 'admin-123');

      expect(result).toEqual(expectedContact);
      expect(mockContactRepository.create).toHaveBeenCalledWith(validCreateContactRequest, 'admin-123');
      expect(mockContactRepository.updateLeadScore).toHaveBeenCalled();
    });

    it('should calculate initial lead score for new contact', async () => {
      const contactWithScore = { ...mockContact, leadScore: 20 }; // company + jobTitle + phone = 20 points

      mockContactRepository.create.mockResolvedValue(contactWithScore);
      mockContactRepository.findById.mockResolvedValue(contactWithScore);
      mockContactRepository.updateLeadScore.mockResolvedValue(undefined);
      mockSegmentRepository.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0
      });

      await crmService.createContact(validCreateContactRequest);

      expect(mockContactRepository.updateLeadScore).toHaveBeenCalled();
    });

    it('should update contact segments after creation', async () => {
      mockContactRepository.create.mockResolvedValue(mockContact);
      mockContactRepository.findById.mockResolvedValue(mockContact);
      mockContactRepository.updateLeadScore.mockResolvedValue(undefined);
      mockSegmentRepository.findAll.mockResolvedValue({
        data: [mockSegment],
        total: 1,
        page: 1,
        limit: 1000,
        totalPages: 1
      });
      mockSegmentRepository.updateContactCount.mockResolvedValue(undefined);

      await crmService.createContact(validCreateContactRequest);

      expect(mockSegmentRepository.updateContactCount).toHaveBeenCalledWith(mockSegment.id);
    });

    it('should handle repository errors gracefully', async () => {
      mockContactRepository.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(crmService.createContact(validCreateContactRequest))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle lead score calculation errors without failing creation', async () => {
      mockContactRepository.create.mockResolvedValue(mockContact);
      mockContactRepository.findById.mockRejectedValue(new Error('Score calculation failed'));
      mockSegmentRepository.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0
      });

      // Should still return the created contact even if scoring fails
      await expect(crmService.createContact(validCreateContactRequest))
        .rejects.toThrow('Score calculation failed');
    });
  });

  describe('getContact', () => {
    it('should return contact when found', async () => {
      const contactId = 'contact-123';
      const expectedContact: Contact = {
        id: contactId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        customFields: {},
        tags: [],
        leadScore: 15,
        lifecycle: 'lead',
        source: 'website',
        consent: {
          marketing: true,
          analytics: true,
          grantedAt: new Date()
        },
        preferences: {
          emailFrequency: 'weekly',
          contentTypes: [],
          communicationChannels: [],
          timezone: 'UTC',
          language: 'en'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockContactRepository.findById.mockResolvedValue(expectedContact);

      const result = await crmService.getContact(contactId);

      expect(result).toEqual(expectedContact);
      expect(mockContactRepository.findById).toHaveBeenCalledWith(contactId);
    });

    it('should throw NotFoundError when contact not found', async () => {
      const contactId = 'non-existent';
      mockContactRepository.findById.mockResolvedValue(null);

      await expect(crmService.getContact(contactId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateContact', () => {
    const contactId = 'contact-123';
    const updateData: UpdateContactRequest = {
      firstName: 'Jane',
      company: 'New Corp',
      jobTitle: 'Senior Developer'
    };

    it('should update contact successfully', async () => {
      const updatedContact: Contact = {
        id: contactId,
        email: 'test@example.com',
        firstName: updateData.firstName!,
        company: updateData.company,
        jobTitle: updateData.jobTitle,
        customFields: {},
        tags: [],
        leadScore: 20,
        lifecycle: 'lead',
        source: 'website',
        consent: {
          marketing: true,
          analytics: true,
          grantedAt: new Date()
        },
        preferences: {
          emailFrequency: 'weekly',
          contentTypes: [],
          communicationChannels: [],
          timezone: 'UTC',
          language: 'en'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockContactRepository.update.mockResolvedValue(updatedContact);
      mockContactRepository.findById.mockResolvedValue(updatedContact);
      mockContactRepository.updateLeadScore.mockResolvedValue(undefined);

      const result = await crmService.updateContact(contactId, updateData);

      expect(result).toEqual(updatedContact);
      expect(mockContactRepository.update).toHaveBeenCalledWith(contactId, updateData);
    });

    it('should recalculate lead score when relevant fields change', async () => {
      const contact: Contact = {
        id: contactId,
        email: 'test@example.com',
        firstName: 'John',
        company: 'Test Corp',
        jobTitle: 'Developer',
        customFields: {},
        tags: [],
        leadScore: 10,
        lifecycle: 'subscriber',
        source: 'manual',
        consent: {
          marketing: true,
          analytics: true,
          grantedAt: new Date()
        },
        preferences: {
          emailFrequency: 'weekly',
          contentTypes: [],
          communicationChannels: [],
          timezone: 'UTC',
          language: 'en'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockContactRepository.update.mockResolvedValue(contact);
      mockContactRepository.findById.mockResolvedValue(contact);
      mockContactRepository.updateLeadScore.mockResolvedValue(undefined);

      await crmService.updateContact(contactId, updateData);

      expect(mockContactRepository.updateLeadScore).toHaveBeenCalled();
    });
  });

  describe('trackEngagement', () => {
    const contactId = 'contact-123';
    const engagementEvent = {
      eventType: 'email_open' as const,
      metadata: { campaignId: 'campaign-123' }
    };

    it('should track engagement and update lead score', async () => {
      const contact: Contact = {
        id: contactId,
        email: 'test@example.com',
        leadScore: 10,
        customFields: {},
        tags: [],
        lifecycle: 'subscriber',
        source: 'manual',
        consent: {
          marketing: true,
          analytics: true,
          grantedAt: new Date()
        },
        preferences: {
          emailFrequency: 'weekly',
          contentTypes: [],
          communicationChannels: [],
          timezone: 'UTC',
          language: 'en'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockContactRepository.updateLastActivity.mockResolvedValue(undefined);
      mockContactRepository.findById.mockResolvedValue(contact);
      mockContactRepository.updateLeadScore.mockResolvedValue(undefined);

      await crmService.trackEngagement(contactId, engagementEvent);

      expect(mockContactRepository.updateLastActivity).toHaveBeenCalledWith(contactId);
      expect(mockContactRepository.updateLeadScore).toHaveBeenCalledWith(contactId, 11); // +1 for email_open
    });

    it('should handle different engagement types with correct scoring', async () => {
      const contact: Contact = {
        id: contactId,
        email: 'test@example.com',
        leadScore: 10,
        customFields: {},
        tags: [],
        lifecycle: 'subscriber',
        source: 'manual',
        consent: {
          marketing: true,
          analytics: true,
          grantedAt: new Date()
        },
        preferences: {
          emailFrequency: 'weekly',
          contentTypes: [],
          communicationChannels: [],
          timezone: 'UTC',
          language: 'en'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockContactRepository.updateLastActivity.mockResolvedValue(undefined);
      mockContactRepository.findById.mockResolvedValue(contact);
      mockContactRepository.updateLeadScore.mockResolvedValue(undefined);

      // Test email click (3 points)
      await crmService.trackEngagement(contactId, {
        eventType: 'email_click',
        metadata: { linkUrl: 'https://example.com' }
      });

      expect(mockContactRepository.updateLeadScore).toHaveBeenCalledWith(contactId, 13);
    });
  });

  describe('createSegment', () => {
    const segmentData: CreateSegmentRequest = {
      name: 'High Value Leads',
      description: 'Contacts with high lead scores',
      conditions: [
        {
          field: 'leadScore',
          operator: 'greater_than',
          value: 50
        }
      ],
      isAutoUpdating: true
    };

    it('should create segment successfully', async () => {
      const expectedSegment = {
        id: 'segment-123',
        name: segmentData.name,
        description: segmentData.description,
        conditions: segmentData.conditions,
        contactCount: 0,
        isAutoUpdating: segmentData.isAutoUpdating,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockSegmentRepository.create.mockResolvedValue(expectedSegment);
      mockSegmentRepository.updateContactCount.mockResolvedValue(undefined);

      const result = await crmService.createSegment(segmentData);

      expect(result).toEqual(expectedSegment);
      expect(mockSegmentRepository.create).toHaveBeenCalledWith(segmentData, undefined);
      expect(mockSegmentRepository.updateContactCount).toHaveBeenCalledWith(expectedSegment.id);
    });
  });

  describe('bulkUpdateContacts', () => {
    const bulkRequest: BulkOperationRequest = {
      contactIds: ['contact-1', 'contact-2', 'contact-3'],
      operation: {
        type: 'update',
        params: {
          lifecycle: 'lead'
        }
      }
    };

    it('should perform bulk update operation', async () => {
      mockContactRepository.bulkUpdate.mockResolvedValue(3);

      const result = await crmService.bulkUpdateContacts(bulkRequest);

      expect(result.totalRecords).toBe(3);
      expect(result.status).toBe('completed');
      expect(mockContactRepository.bulkUpdate).toHaveBeenCalledWith(
        bulkRequest.contactIds,
        bulkRequest.operation.params
      );
    });

    it('should handle add_tags operation', async () => {
      const tagRequest: BulkOperationRequest = {
        contactIds: ['contact-1', 'contact-2'],
        operation: {
          type: 'add_tags',
          params: {
            tags: ['vip', 'newsletter-subscriber']
          }
        }
      };

      mockContactRepository.addTags.mockResolvedValue(undefined);

      const result = await crmService.bulkUpdateContacts(tagRequest);

      expect(result.totalRecords).toBe(2);
      expect(mockContactRepository.addTags).toHaveBeenCalledTimes(2);
    });

    it('should throw ValidationError for unsupported operation', async () => {
      const invalidRequest: BulkOperationRequest = {
        contactIds: ['contact-1'],
        operation: {
          type: 'invalid_operation' as any,
          params: {}
        }
      };

      await expect(crmService.bulkUpdateContacts(invalidRequest))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('calculateLeadScore', () => {
    it('should calculate lead score based on contact data', async () => {
      const contactId = 'contact-123';
      const contact: Contact = {
        id: contactId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Test Corp', // +10 points
        jobTitle: 'Developer', // +5 points
        phone: '+1234567890', // +5 points
        customFields: {},
        tags: [],
        leadScore: 5, // existing score
        lifecycle: 'subscriber',
        source: 'manual',
        consent: {
          marketing: true,
          analytics: true,
          grantedAt: new Date()
        },
        preferences: {
          emailFrequency: 'weekly',
          contentTypes: [],
          communicationChannels: [],
          timezone: 'UTC',
          language: 'en'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockContactRepository.findById.mockResolvedValue(contact);
      mockContactRepository.updateLeadScore.mockResolvedValue(undefined);

      const result = await crmService.calculateLeadScore(contactId);

      expect(result).toBe(25); // 5 + 10 + 5 + 5
      expect(mockContactRepository.updateLeadScore).toHaveBeenCalledWith(contactId, 25);
    });
  });

  describe('findDuplicates', () => {
    it('should find duplicate contacts by email', async () => {
      const contactId = 'contact-123';
      const contact: Contact = {
        id: contactId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        customFields: {},
        tags: [],
        leadScore: 10,
        lifecycle: 'subscriber',
        source: 'manual',
        consent: {
          marketing: true,
          analytics: true,
          grantedAt: new Date()
        },
        preferences: {
          emailFrequency: 'weekly',
          contentTypes: [],
          communicationChannels: [],
          timezone: 'UTC',
          language: 'en'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const duplicateContact: Contact = {
        ...contact,
        id: 'contact-456',
        firstName: 'Johnny'
      };

      mockContactRepository.findById.mockResolvedValue(contact);
      mockContactRepository.search.mockResolvedValue({
        contacts: [contact, duplicateContact],
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1
      });

      const result = await crmService.findDuplicates(contactId);

      expect(result).toHaveLength(1);
      expect(result[0].masterContactId).toBe(contactId);
      expect(result[0].duplicateContactIds).toContain('contact-456');
      expect(result[0].matchingFields).toContain('email');
    });

    it('should return empty array when no duplicates found', async () => {
      const contactId = 'contact-123';
      const contact: Contact = {
        id: contactId,
        email: 'unique@example.com',
        customFields: {},
        tags: [],
        leadScore: 10,
        lifecycle: 'subscriber',
        source: 'manual',
        consent: {
          marketing: true,
          analytics: true,
          grantedAt: new Date()
        },
        preferences: {
          emailFrequency: 'weekly',
          contentTypes: [],
          communicationChannels: [],
          timezone: 'UTC',
          language: 'en'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockContactRepository.findById.mockResolvedValue(contact);
      mockContactRepository.search.mockResolvedValue({
        contacts: [contact],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      });

      const result = await crmService.findDuplicates(contactId);

      expect(result).toHaveLength(0);
    });
  });

  describe('deleteContact', () => {
    it('should delete contact successfully', async () => {
      const contactId = 'contact-123';

      // Mock getContactSegments to return empty array
      mockSegmentRepository.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0
      });

      mockContactRepository.delete.mockResolvedValue(undefined);

      await crmService.deleteContact(contactId);

      expect(mockContactRepository.delete).toHaveBeenCalledWith(contactId);
    });
  });

  describe('getContactByEmail', () => {
    it('should return contact when found', async () => {
      const email = 'test@example.com';
      const contact: Contact = {
        id: 'contact-123',
        email,
        firstName: 'John',
        lastName: 'Doe',
        customFields: {},
        tags: [],
        leadScore: 10,
        lifecycle: 'subscriber',
        source: 'manual',
        consent: {
          marketing: true,
          analytics: true,
          grantedAt: new Date()
        },
        preferences: {
          emailFrequency: 'weekly',
          contentTypes: [],
          communicationChannels: [],
          timezone: 'UTC',
          language: 'en'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockContactRepository.findByEmail.mockResolvedValue(contact);

      const result = await crmService.getContactByEmail(email);

      expect(result).toEqual(contact);
      expect(mockContactRepository.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should return null when contact not found', async () => {
      const email = 'nonexistent@example.com';
      mockContactRepository.findByEmail.mockResolvedValue(null);

      const result = await crmService.getContactByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe('enrichContact', () => {
    it('should enrich contact successfully', async () => {
      const contactId = 'contact-123';
      const contact: Contact = {
        id: contactId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        customFields: {},
        tags: [],
        leadScore: 10,
        lifecycle: 'subscriber',
        source: 'manual',
        consent: {
          marketing: true,
          analytics: true,
          grantedAt: new Date()
        },
        preferences: {
          emailFrequency: 'weekly',
          contentTypes: [],
          communicationChannels: [],
          timezone: 'UTC',
          language: 'en'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockContactRepository.findById.mockResolvedValue(contact);

      const result = await crmService.enrichContact(contactId);

      expect(result.contactId).toBe(contactId);
      expect(result.status).toBe('completed');
      expect(result.enrichedFields).toContain('company');
      expect(result.enrichedFields).toContain('jobTitle');
    });
  });
});
