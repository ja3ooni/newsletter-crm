import { NotFoundError, ValidationError } from '@shared/errors';
import { NewsletterRepository } from '../../src/repositories/NewsletterRepository';
import { ContentService } from '../../src/services/ContentService';
import { NewsletterService } from '../../src/services/NewsletterService';
import { TemplateService } from '../../src/services/TemplateService';

// Mock dependencies
jest.mock('../../src/repositories/NewsletterRepository');
jest.mock('../../src/services/ContentService');
jest.mock('../../src/services/TemplateService');

const MockNewsletterRepository = NewsletterRepository as jest.MockedClass<
  typeof NewsletterRepository
>;
const MockContentService = ContentService as jest.MockedClass<
  typeof ContentService
>;
const MockTemplateService = TemplateService as jest.MockedClass<
  typeof TemplateService
>;

describe('NewsletterService', () => {
  let newsletterService: NewsletterService;
  let mockNewsletterRepository: jest.Mocked<NewsletterRepository>;
  let mockContentService: jest.Mocked<ContentService>;
  let mockTemplateService: jest.Mocked<TemplateService>;

  const mockNewsletter = {
    id: 'newsletter-123',
    title: 'Test Newsletter',
    content: {
      sections: [
        {
          id: 'section-1',
          type: 'news',
          title: 'AI News',
          items: [
            {
              id: 'item-1',
              title: 'Test Article',
              summary: 'Test summary',
              url: 'https://example.com/test',
              source: 'Test Source',
              publishedAt: new Date(),
              score: 0.8,
              tags: ['ai', 'technology'],
            },
          ],
          order: 1,
          isPersonalized: false,
        },
      ],
      personalization: {},
      metadata: {
        generatedAt: new Date(),
        version: '1.0',
      },
    },
    status: 'draft' as const,
    createdBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockNewsletterRepository =
      new MockNewsletterRepository() as jest.Mocked<NewsletterRepository>;
    mockContentService =
      new MockContentService() as jest.Mocked<ContentService>;
    mockTemplateService =
      new MockTemplateService() as jest.Mocked<TemplateService>;

    newsletterService = new NewsletterService(
      mockNewsletterRepository,
      mockContentService,
      mockTemplateService
    );

    jest.clearAllMocks();
  });

  describe('createNewsletter', () => {
    const validNewsletterData = {
      title: 'Test Newsletter',
      content: {
        sections: [
          {
            type: 'news',
            title: 'AI News',
            items: [],
          },
        ],
      },
      createdBy: 'user-123',
    };

    it('should create newsletter with valid data', async () => {
      mockNewsletterRepository.create.mockResolvedValue(mockNewsletter);

      const result =
        await newsletterService.createNewsletter(validNewsletterData);

      expect(result).toEqual(mockNewsletter);
      expect(mockNewsletterRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: validNewsletterData.title,
          status: 'draft',
        })
      );
    });

    it('should throw ValidationError for missing title', async () => {
      const invalidData = {
        ...validNewsletterData,
        title: '',
      };

      await expect(
        newsletterService.createNewsletter(invalidData)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty content sections', async () => {
      const invalidData = {
        ...validNewsletterData,
        content: {
          sections: [],
        },
      };

      await expect(
        newsletterService.createNewsletter(invalidData)
      ).rejects.toThrow(ValidationError);
    });

    it('should validate content section structure', async () => {
      const invalidData = {
        ...validNewsletterData,
        content: {
          sections: [
            {
              type: 'invalid-type',
              title: 'Test',
            },
          ],
        },
      };

      await expect(
        newsletterService.createNewsletter(invalidData)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getNewsletterById', () => {
    it('should return newsletter when found', async () => {
      mockNewsletterRepository.findById.mockResolvedValue(mockNewsletter);

      const result =
        await newsletterService.getNewsletterById('newsletter-123');

      expect(result).toEqual(mockNewsletter);
      expect(mockNewsletterRepository.findById).toHaveBeenCalledWith(
        'newsletter-123'
      );
    });

    it('should throw NotFoundError when newsletter not found', async () => {
      mockNewsletterRepository.findById.mockResolvedValue(null);

      await expect(
        newsletterService.getNewsletterById('non-existent')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateNewsletter', () => {
    const updateData = {
      title: 'Updated Newsletter',
      content: {
        sections: [
          {
            type: 'research',
            title: 'Research Updates',
            items: [],
          },
        ],
      },
    };

    it('should update newsletter successfully', async () => {
      const updatedNewsletter = {
        ...mockNewsletter,
        ...updateData,
        updatedAt: new Date(),
      };

      mockNewsletterRepository.findById.mockResolvedValue(mockNewsletter);
      mockNewsletterRepository.update.mockResolvedValue(updatedNewsletter);

      const result = await newsletterService.updateNewsletter(
        'newsletter-123',
        updateData
      );

      expect(result).toEqual(updatedNewsletter);
      expect(mockNewsletterRepository.update).toHaveBeenCalledWith(
        'newsletter-123',
        expect.objectContaining(updateData)
      );
    });

    it('should throw NotFoundError when newsletter not found', async () => {
      mockNewsletterRepository.findById.mockResolvedValue(null);

      await expect(
        newsletterService.updateNewsletter('non-existent', updateData)
      ).rejects.toThrow(NotFoundError);
    });

    it('should prevent updating sent newsletters', async () => {
      const sentNewsletter = {
        ...mockNewsletter,
        status: 'sent' as const,
      };

      mockNewsletterRepository.findById.mockResolvedValue(sentNewsletter);

      await expect(
        newsletterService.updateNewsletter('newsletter-123', updateData)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('generateNewsletter', () => {
    const generateParams = {
      sections: ['news', 'research'],
      personalization: {
        userId: 'user-123',
        preferences: {
          topics: ['ai', 'technology'],
        },
      },
    };

    it('should generate newsletter with personalized content', async () => {
      const mockContent = {
        sections: [
          {
            type: 'news',
            title: 'AI News',
            items: [
              {
                title: 'Generated Article',
                summary: 'Generated summary',
                url: 'https://example.com/generated',
                source: 'Generated Source',
              },
            ],
          },
        ],
      };

      mockContentService.generatePersonalizedContent.mockResolvedValue(
        mockContent
      );
      mockNewsletterRepository.create.mockResolvedValue(mockNewsletter);

      const result = await newsletterService.generateNewsletter(generateParams);

      expect(result).toEqual(mockNewsletter);
      expect(
        mockContentService.generatePersonalizedContent
      ).toHaveBeenCalledWith(
        generateParams.sections,
        generateParams.personalization
      );
    });

    it('should handle content generation failures', async () => {
      mockContentService.generatePersonalizedContent.mockRejectedValue(
        new Error('Content generation failed')
      );

      await expect(
        newsletterService.generateNewsletter(generateParams)
      ).rejects.toThrow('Content generation failed');
    });
  });

  describe('scheduleNewsletter', () => {
    const scheduleData = {
      scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
      segments: ['segment-1', 'segment-2'],
    };

    it('should schedule newsletter successfully', async () => {
      const scheduledNewsletter = {
        ...mockNewsletter,
        status: 'scheduled' as const,
        scheduledAt: scheduleData.scheduledAt,
      };

      mockNewsletterRepository.findById.mockResolvedValue(mockNewsletter);
      mockNewsletterRepository.update.mockResolvedValue(scheduledNewsletter);

      const result = await newsletterService.scheduleNewsletter(
        'newsletter-123',
        scheduleData
      );

      expect(result).toEqual(scheduledNewsletter);
      expect(mockNewsletterRepository.update).toHaveBeenCalledWith(
        'newsletter-123',
        expect.objectContaining({
          status: 'scheduled',
          scheduledAt: scheduleData.scheduledAt,
        })
      );
    });

    it('should validate schedule time is in the future', async () => {
      const pastScheduleData = {
        ...scheduleData,
        scheduledAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockNewsletterRepository.findById.mockResolvedValue(mockNewsletter);

      await expect(
        newsletterService.scheduleNewsletter('newsletter-123', pastScheduleData)
      ).rejects.toThrow(ValidationError);
    });

    it('should validate segments exist', async () => {
      const invalidScheduleData = {
        ...scheduleData,
        segments: [],
      };

      mockNewsletterRepository.findById.mockResolvedValue(mockNewsletter);

      await expect(
        newsletterService.scheduleNewsletter(
          'newsletter-123',
          invalidScheduleData
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getNewsletterMetrics', () => {
    const mockMetrics = {
      sent: 1000,
      delivered: 950,
      opens: 380,
      uniqueOpens: 350,
      clicks: 95,
      uniqueClicks: 85,
      unsubscribes: 5,
      bounces: 50,
      openRate: 36.8,
      clickRate: 24.3,
      unsubscribeRate: 0.5,
    };

    it('should return newsletter metrics', async () => {
      mockNewsletterRepository.findById.mockResolvedValue(mockNewsletter);
      mockNewsletterRepository.getMetrics.mockResolvedValue(mockMetrics);

      const result =
        await newsletterService.getNewsletterMetrics('newsletter-123');

      expect(result).toEqual(mockMetrics);
      expect(mockNewsletterRepository.getMetrics).toHaveBeenCalledWith(
        'newsletter-123'
      );
    });

    it('should throw NotFoundError for non-existent newsletter', async () => {
      mockNewsletterRepository.findById.mockResolvedValue(null);

      await expect(
        newsletterService.getNewsletterMetrics('non-existent')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteNewsletter', () => {
    it('should delete draft newsletter successfully', async () => {
      mockNewsletterRepository.findById.mockResolvedValue(mockNewsletter);
      mockNewsletterRepository.delete.mockResolvedValue(true);

      const result = await newsletterService.deleteNewsletter('newsletter-123');

      expect(result).toBe(true);
      expect(mockNewsletterRepository.delete).toHaveBeenCalledWith(
        'newsletter-123'
      );
    });

    it('should prevent deleting sent newsletters', async () => {
      const sentNewsletter = {
        ...mockNewsletter,
        status: 'sent' as const,
      };

      mockNewsletterRepository.findById.mockResolvedValue(sentNewsletter);

      await expect(
        newsletterService.deleteNewsletter('newsletter-123')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when newsletter not found', async () => {
      mockNewsletterRepository.findById.mockResolvedValue(null);

      await expect(
        newsletterService.deleteNewsletter('non-existent')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listNewsletters', () => {
    const mockNewsletters = [mockNewsletter];
    const mockPagination = {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    };

    it('should return paginated newsletters', async () => {
      mockNewsletterRepository.findMany.mockResolvedValue({
        newsletters: mockNewsletters,
        pagination: mockPagination,
      });

      const result = await newsletterService.listNewsletters({
        page: 1,
        limit: 10,
      });

      expect(result.newsletters).toEqual(mockNewsletters);
      expect(result.pagination).toEqual(mockPagination);
    });

    it('should support filtering by status', async () => {
      mockNewsletterRepository.findMany.mockResolvedValue({
        newsletters: mockNewsletters,
        pagination: mockPagination,
      });

      await newsletterService.listNewsletters({
        page: 1,
        limit: 10,
        status: 'draft',
      });

      expect(mockNewsletterRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'draft',
        })
      );
    });
  });
});
