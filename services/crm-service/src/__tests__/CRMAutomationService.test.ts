import { CRMAutomationService } from '../services/CRMAutomationService';
import { Contact, ContactLifecycle, EngagementEvent } from '../types';

describe('CRMAutomationService', () => {
  let automationService: CRMAutomationService;
  let mockContactRepository: any;
  let mockSegmentRepository: any;
  let mockLeadScoringRepository: any;
  let mockTaskRepository: any;
  let mockTerritoryRepository: any;
  let mockEngagementEventRepository: any;
  let mockInterServiceClient: any;

  const mockContact: Contact = {
    id: 'contact-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    company: 'Acme Corp',
    jobTitle: 'Marketing Manager',
    phone: '+1-555-0123',
    website: 'https://example.com',
    customFields: {},
    tags: ['lead'],
    leadScore: 45,
    lifecycle: 'lead' as ContactLifecycle,
    source: 'website',
    preferences: {
      emailFrequency: 'weekly',
      contentTypes: ['newsletter'],
      communicationChannels: ['email'],
      timezone: 'UTC',
      language: 'en',
    },
    consent: {
      marketing: true,
      analytics: true,
      thirdParty: false,
      consentDate: new Date(),
      consentSource: 'website',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Create mock instances
    mockContactRepository = {
      findById: jest.fn(),
      update: jest.fn(),
      countByOwner: jest.fn(),
    };
    mockSegmentRepository = {};
    mockLeadScoringRepository = {};
    mockTaskRepository = {
      create: jest.fn(),
    };
    mockTerritoryRepository = {
      findById: jest.fn(),
      getAssignments: jest.fn(),
    };
    mockEngagementEventRepository = {};
    mockInterServiceClient = {
      triggerMarketingAutomation: jest.fn(),
    };

    // Initialize service
    automationService = new CRMAutomationService(
      mockContactRepository,
      mockSegmentRepository,
      mockLeadScoringRepository,
      mockTaskRepository,
      mockTerritoryRepository,
      mockEngagementEventRepository,
      mockInterServiceClient
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processLeadAssignment', () => {
    it('should skip assignment if contact already has owner', async () => {
      // Arrange
      const contactWithOwner = { ...mockContact, ownerId: 'existing-owner' };
      mockContactRepository.findById.mockResolvedValue(contactWithOwner);

      // Act
      await automationService.processLeadAssignment('contact-1');

      // Assert
      expect(mockContactRepository.findById).toHaveBeenCalledWith('contact-1');
      expect(mockContactRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error if contact not found', async () => {
      // Arrange
      mockContactRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        automationService.processLeadAssignment('contact-1')
      ).rejects.toThrow('Contact not found');
    });
  });

  describe('processFollowUpSequences', () => {
    it('should process follow-up sequences for valid contact', async () => {
      // Arrange
      mockContactRepository.findById.mockResolvedValue(mockContact);

      // Act
      await automationService.processFollowUpSequences(
        'contact-1',
        'contact_created'
      );

      // Assert
      expect(mockContactRepository.findById).toHaveBeenCalledWith('contact-1');
    });

    it('should throw error if contact not found', async () => {
      // Arrange
      mockContactRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        automationService.processFollowUpSequences(
          'contact-1',
          'contact_created'
        )
      ).rejects.toThrow('Contact not found');
    });
  });

  describe('processLeadQualification', () => {
    it('should process lead qualification for valid contact', async () => {
      // Arrange
      mockContactRepository.findById.mockResolvedValue(mockContact);

      // Act
      await automationService.processLeadQualification('contact-1');

      // Assert
      expect(mockContactRepository.findById).toHaveBeenCalledWith('contact-1');
    });

    it('should throw error if contact not found', async () => {
      // Arrange
      mockContactRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        automationService.processLeadQualification('contact-1')
      ).rejects.toThrow('Contact not found');
    });
  });

  describe('processDataEnrichment', () => {
    it('should process data enrichment for contact with missing fields', async () => {
      // Arrange
      const contactNeedingEnrichment = {
        ...mockContact,
        company: null,
        jobTitle: null,
      };
      mockContactRepository.findById.mockResolvedValue(
        contactNeedingEnrichment
      );
      mockContactRepository.update.mockResolvedValue(mockContact);

      // Act
      await automationService.processDataEnrichment('contact-1');

      // Assert
      expect(mockContactRepository.findById).toHaveBeenCalledWith('contact-1');
      expect(mockContactRepository.update).toHaveBeenCalled();
    });

    it('should skip enrichment for complete contact', async () => {
      // Arrange
      mockContactRepository.findById.mockResolvedValue(mockContact);

      // Act
      await automationService.processDataEnrichment('contact-1');

      // Assert
      expect(mockContactRepository.findById).toHaveBeenCalledWith('contact-1');
      // Should not update if no enrichment needed
    });
  });

  describe('handleContactCreated', () => {
    it('should trigger all automation processes for new contact', async () => {
      // Arrange
      const spy = jest
        .spyOn(automationService, 'processLeadAssignment')
        .mockResolvedValue(undefined);
      const spy2 = jest
        .spyOn(automationService, 'processFollowUpSequences')
        .mockResolvedValue(undefined);
      const spy3 = jest
        .spyOn(automationService, 'processDataEnrichment')
        .mockResolvedValue(undefined);

      // Act
      await automationService.handleContactCreated(mockContact);

      // Assert
      expect(spy).toHaveBeenCalledWith('contact-1');
      expect(spy2).toHaveBeenCalledWith('contact-1', 'contact_created');
      expect(spy3).toHaveBeenCalledWith('contact-1');
    });
  });

  describe('handleContactUpdated', () => {
    it('should trigger appropriate automation processes for updated contact', async () => {
      // Arrange
      const spy = jest
        .spyOn(automationService, 'processFollowUpSequences')
        .mockResolvedValue(undefined);
      const spy2 = jest
        .spyOn(automationService, 'processLeadQualification')
        .mockResolvedValue(undefined);

      // Act
      await automationService.handleContactUpdated(mockContact);

      // Assert
      expect(spy).toHaveBeenCalledWith('contact-1', 'contact_updated');
      expect(spy2).toHaveBeenCalledWith('contact-1');
    });
  });

  describe('handleEngagementEvent', () => {
    it('should trigger automation processes for engagement event', async () => {
      // Arrange
      const mockEvent: EngagementEvent = {
        id: 'event-1',
        contactId: 'contact-1',
        eventType: 'email_open',
        timestamp: new Date(),
        metadata: {},
        score: 5,
        createdAt: new Date(),
      };

      const spy = jest
        .spyOn(automationService, 'processFollowUpSequences')
        .mockResolvedValue(undefined);
      const spy2 = jest
        .spyOn(automationService, 'processLeadQualification')
        .mockResolvedValue(undefined);

      // Act
      await automationService.handleEngagementEvent(mockEvent);

      // Assert
      expect(spy).toHaveBeenCalledWith('contact-1', 'engagement_event');
      expect(spy2).toHaveBeenCalledWith('contact-1');
    });
  });

  describe('handleScoreThresholdReached', () => {
    it('should trigger lead qualification when score threshold is reached', async () => {
      // Arrange
      const spy = jest
        .spyOn(automationService, 'processLeadQualification')
        .mockResolvedValue(undefined);

      // Act
      await automationService.handleScoreThresholdReached('contact-1', 75);

      // Assert
      expect(spy).toHaveBeenCalledWith('contact-1');
    });
  });
});
