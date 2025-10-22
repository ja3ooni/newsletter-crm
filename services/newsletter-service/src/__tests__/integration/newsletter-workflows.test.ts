import { ContentLibraryRepository } from '@/repositories/ContentLibraryRepository'
import { NewsletterRepository } from '@/repositories/NewsletterRepository'
import { TemplateRepository } from '@/repositories/TemplateRepository'
import { ABTestService } from '@/services/ABTestService'
import { NewsletterService } from '@/services/NewsletterService'
import { PersonalizationService } from '@/services/PersonalizationService'
import { SchedulingService } from '@/services/SchedulingService'
import { ABTest, CreateNewsletterRequest, Newsletter } from '@/types'

// Mock dependencies
jest.mock('@/config', () => ({
  config: {
    port: 3002,
    nodeEnv: 'test',
    database: {
      url: 'postgresql://test:test@localhost:5432/test_db',
    },
    redis: {
      url: 'redis://localhost:6379',
    },
    jwt: {
      secret: 'test-secret',
    },
    abTesting: {
      maxVariants: 5,
      minSampleSize: 100,
      confidenceLevel: 0.95,
    },
  },
}))

jest.mock('@/utils/database', () => ({
  database: {
    queryOne: jest.fn(),
    query: jest.fn(),
  },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock('@/utils/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}))

jest.mock('@/utils/queue', () => ({
  queueService: {
    addJob: jest.fn(),
  },
  QUEUE_NAMES: {
    NEWSLETTER_GENERATION: 'newsletter-generation',
    EMAIL_SENDING: 'email-sending',
  },
}))

jest.mock('@/utils/database', () => ({
  database: {
    queryOne: jest.fn(),
    query: jest.fn(),
  },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}))

jest.mock('@/utils/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}))

jest.mock('@/utils/queue', () => ({
  queueService: {
    addJob: jest.fn(),
  },
  QUEUE_NAMES: {
    NEWSLETTER_GENERATION: 'newsletter-generation',
    EMAIL_SENDING: 'email-sending',
  },
}))

describe('Newsletter Workflows Integration Tests', () => {
  let newsletterService: NewsletterService
  let abTestService: ABTestService
  let personalizationService: PersonalizationService
  let schedulingService: SchedulingService
  let newsletterRepository: NewsletterRepository
  let templateRepository: TemplateRepository
  let contentLibraryRepository: ContentLibraryRepository

  const mockDatabase = require('@/utils/database').database
  const mockRedis = require('@/utils/redis').redis
  const mockQueue = require('@/utils/queue').queueService

  beforeEach(() => {
    // Initialize repositories
    newsletterRepository = new NewsletterRepository()
    templateRepository = new TemplateRepository()
    contentLibraryRepository = new ContentLibraryRepository()

    // Initialize services
    personalizationService = new PersonalizationService()
    abTestService = new ABTestService()
    schedulingService = new SchedulingService()

    newsletterService = new NewsletterService(
      newsletterRepository,
      templateRepository,
      contentLibraryRepository,
      personalizationService,
      abTestService,
      schedulingService
    )

    jest.clearAllMocks()
  })

  describe('Complete Newsletter Creation and Sending Workflow', () => {
    const mockUserId = 'user-123'
    const mockTemplateId = 'template-456'
    const mockNewsletterId = 'newsletter-789'

    const mockTemplate = {
      id: mockTemplateId,
      name: 'Tech Newsletter Template',
      category: 'tech' as const,
      html: '<html><body>{{content}}</body></html>',
      css: 'body { font-family: Arial; }',
      variables: [],
      previewImage: 'preview.jpg',
      isPublic: true,
      createdBy: mockUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockNewsletter: Newsletter = {
      id: mockNewsletterId,
      title: 'Weekly Tech Update',
      content: {
        sections: [
          {
            id: 'section-1',
            type: 'news',
            title: 'Latest News',
            items: [],
            order: 0,
            isPersonalized: false,
          },
        ],
        personalization: {
          subscriberId: '',
          preferences: {},
          behaviorData: {},
          demographics: {},
        },
        metadata: {
          generatedAt: new Date(),
          version: '1.0',
          totalItems: 0,
          sources: [],
          categories: ['news'],
        },
        dynamicContent: [],
      },
      templateId: mockTemplateId,
      status: 'draft',
      metrics: {
        sent: 0,
        delivered: 0,
        opens: 0,
        uniqueOpens: 0,
        clicks: 0,
        uniqueClicks: 0,
        unsubscribes: 0,
        bounces: 0,
        complaints: 0,
        openRate: 0,
        clickRate: 0,
        unsubscribeRate: 0,
        bounceRate: 0,
      },

      segments: ['segment-1'],
      personalization: {
        enabled: false,
        rules: [],
        fallbackContent: '',
      },
      deliverabilitySettings: {
        fromName: 'AiLert Newsletter',
        fromEmail: 'noreply@ailert.com',
        replyTo: 'support@ailert.com',
        trackOpens: true,
        trackClicks: true,
        unsubscribeLink: true,
        customHeaders: {},
      },
      createdBy: mockUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should complete full newsletter creation workflow', async () => {
      // Mock template lookup
      jest.spyOn(templateRepository, 'findById').mockResolvedValue(mockTemplate)

      // Mock newsletter creation
      jest.spyOn(newsletterRepository, 'create').mockResolvedValue(mockNewsletter)

      const createRequest: CreateNewsletterRequest = {
        title: 'Weekly Tech Update',
        templateId: mockTemplateId,
        sections: ['news'],
        segments: ['segment-1'],
        personalization: {
          enabled: false,
          rules: [],
          fallbackContent: '',
        },
        deliverabilitySettings: {
          fromName: 'AiLert Newsletter',
          fromEmail: 'noreply@ailert.com',
          replyTo: 'support@ailert.com',
          trackOpens: true,
          trackClicks: true,
          unsubscribeLink: true,
          customHeaders: {},
        },
      }

      const result = await newsletterService.createNewsletter(createRequest, mockUserId)

      expect(templateRepository.findById).toHaveBeenCalledWith(mockTemplateId)
      expect(newsletterRepository.create).toHaveBeenCalledWith({
        ...createRequest,
        createdBy: mockUserId,
      })
      expect(result).toEqual(mockNewsletter)
    })

    it('should generate newsletter content and queue processing', async () => {
      const mockJob = { id: 'job-123' }
      mockQueue.addJob.mockResolvedValue(mockJob)

      const generateRequest = {
        sections: ['news', 'research'],
        userId: mockUserId,
        templateId: mockTemplateId,
      }

      const result = await newsletterService.generateNewsletterContent(generateRequest)

      expect(mockQueue.addJob).toHaveBeenCalledWith(
        'newsletter-generation',
        'generate-content',
        generateRequest,
        { priority: 'normal' }
      )

      expect(result.sections).toHaveLength(2)
      expect(result.sections[0]?.type).toBe('news')
      expect(result.sections[1]?.type).toBe('research')
      expect(result.metadata.categories).toEqual(['news', 'research'])
    })

    it('should schedule newsletter for future sending', async () => {
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      const timezone = 'America/New_York'

      // Mock finding the newsletter
      jest.spyOn(newsletterRepository, 'findById').mockResolvedValue(mockNewsletter)

      // Mock scheduling service
      jest.spyOn(schedulingService, 'scheduleNewsletter').mockResolvedValue({
        id: 'scheduled-123',
        newsletterId: mockNewsletterId,
        scheduledAt,
        timezone,
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Mock newsletter update
      const scheduledNewsletter = { ...mockNewsletter, status: 'scheduled' as const, scheduledAt }
      jest.spyOn(newsletterRepository, 'update').mockResolvedValue(scheduledNewsletter)

      await newsletterService.scheduleNewsletter(mockNewsletterId, scheduledAt, timezone)

      expect(schedulingService.scheduleNewsletter).toHaveBeenCalledWith({
        newsletterId: mockNewsletterId,
        scheduledAt,
        timezone,
      })

      expect(newsletterRepository.update).toHaveBeenCalledWith(mockNewsletterId, {
        status: 'scheduled',
        scheduledAt,
      })

      expect(mockRedis.del).toHaveBeenCalledWith(`newsletter:${mockNewsletterId}`)
    })

    it('should send newsletter immediately', async () => {
      const mockJob = { id: 'send-job-456' }
      mockQueue.addJob.mockResolvedValue(mockJob)

      // Mock finding the newsletter
      jest.spyOn(newsletterRepository, 'findById').mockResolvedValue(mockNewsletter)

      await newsletterService.sendNewsletter(mockNewsletterId)

      expect(mockQueue.addJob).toHaveBeenCalledWith(
        'email-sending',
        'send-newsletter',
        { newsletterId: mockNewsletterId },
        { priority: 'high' }
      )
    })

    it('should prevent sending already sent newsletter', async () => {
      const sentNewsletter = { ...mockNewsletter, status: 'sent' as const }
      jest.spyOn(newsletterRepository, 'findById').mockResolvedValue(sentNewsletter)

      await expect(newsletterService.sendNewsletter(mockNewsletterId))
        .rejects.toThrow('Newsletter already sent')
    })

    it('should generate newsletter preview with personalization', async () => {
      const subscriberId = 'subscriber-123'
      const personalizedContent = {
        ...mockNewsletter.content,
        sections: [
          {
            id: 'section-1',
            type: 'news' as const,
            title: 'Personalized Latest News',
            items: [],
            order: 0,
            isPersonalized: false,
          },
        ],
      }

      // Mock finding newsletter and template
      jest.spyOn(newsletterRepository, 'findById').mockResolvedValue({
        ...mockNewsletter,
        personalization: { enabled: true, rules: [], fallbackContent: '' },
      })
      jest.spyOn(templateRepository, 'findById').mockResolvedValue(mockTemplate)

      // Mock personalization service
      jest.spyOn(personalizationService, 'personalizeContent')
        .mockResolvedValue(personalizedContent)

      const result = await newsletterService.previewNewsletter(mockNewsletterId, subscriberId)

      expect(personalizationService.personalizeContent).toHaveBeenCalledWith(
        expect.any(Object),
        subscriberId
      )

      expect(result).toContain('<html>')
      expect(result).toContain('Personalized Latest News')
    })

    it('should duplicate newsletter successfully', async () => {
      const duplicateId = 'newsletter-duplicate-999'
      const duplicateNewsletter = {
        ...mockNewsletter,
        id: duplicateId,
        title: 'Weekly Tech Update (Copy)',
      }

      // Mock finding original newsletter
      jest.spyOn(newsletterRepository, 'findById').mockResolvedValue(mockNewsletter)

      // Mock template lookup for duplicate
      jest.spyOn(templateRepository, 'findById').mockResolvedValue(mockTemplate)

      // Mock creating duplicate
      jest.spyOn(newsletterRepository, 'create').mockResolvedValue(duplicateNewsletter)

      const result = await newsletterService.duplicateNewsletter(mockNewsletterId, mockUserId)

      expect(newsletterRepository.create).toHaveBeenCalledWith({
        title: 'Weekly Tech Update (Copy)',
        templateId: mockTemplateId,
        sections: ['news'],
        segments: ['segment-1'],
        personalization: mockNewsletter.personalization,
        deliverabilitySettings: mockNewsletter.deliverabilitySettings,
        createdBy: mockUserId,
      })

      expect(result.id).toBe(duplicateId)
      expect(result.title).toBe('Weekly Tech Update (Copy)')
    })

    it('should handle workflow errors gracefully', async () => {
      // Mock template not found
      jest.spyOn(templateRepository, 'findById').mockResolvedValue(null)

      const createRequest: CreateNewsletterRequest = {
        title: 'Test Newsletter',
        templateId: 'non-existent-template',
        sections: ['news'],
        segments: ['segment-1'],
      }

      await expect(newsletterService.createNewsletter(createRequest, mockUserId))
        .rejects.toThrow('Template not found')
    })
  })

  describe('A/B Testing Functionality', () => {
    const mockTestId = 'test-123'
    const mockNewsletterId = 'newsletter-789'
    const mockSubscriberId = 'subscriber-456'

    const mockABTest: ABTest = {
      id: mockTestId,
      name: 'Subject Line Test',
      type: 'subject',
      variants: [
        {
          id: 'variant-a',
          name: 'Control',
          content: { subject: 'Weekly Newsletter' },
          metrics: {
            sent: 500,
            opens: 150,
            clicks: 30,
            conversions: 5,
            openRate: 30,
            clickRate: 6,
            conversionRate: 1,
          },
        },
        {
          id: 'variant-b',
          name: 'Test',
          content: { subject: 'Your Weekly Tech Digest 🚀' },
          metrics: {
            sent: 500,
            opens: 200,
            clicks: 45,
            conversions: 8,
            openRate: 40,
            clickRate: 9,
            conversionRate: 1.6,
          },
        },
      ],
      trafficSplit: [50, 50],
      winnerCriteria: 'open_rate',
      status: 'running',
      startedAt: new Date(),
    }

    it('should create A/B test with newsletter', async () => {
      const mockNewsletter = {
        id: mockNewsletterId,
        title: 'Test Newsletter',
        status: 'draft' as const,
      }

      const createRequest: CreateNewsletterRequest = {
        title: 'Test Newsletter',
        sections: ['news'],
        segments: ['segment-1'],
        abTest: {
          name: 'Subject Line Test',
          type: 'subject' as const,
          variants: [
            {
              id: 'variant-a',
              name: 'Control',
              content: { subject: 'Weekly Newsletter' },
              metrics: { sent: 0, opens: 0, clicks: 0, conversions: 0, openRate: 0, clickRate: 0, conversionRate: 0 }
            },
            {
              id: 'variant-b',
              name: 'Test',
              content: { subject: 'Your Weekly Tech Digest 🚀' },
              metrics: { sent: 0, opens: 0, clicks: 0, conversions: 0, openRate: 0, clickRate: 0, conversionRate: 0 }
            },
          ],
          trafficSplit: [50, 50],
          winnerCriteria: 'open_rate' as const,
        },
      }

      // Mock newsletter creation
      jest.spyOn(newsletterRepository, 'create').mockResolvedValue(mockNewsletter as any)

      // Mock A/B test creation
      jest.spyOn(abTestService, 'createTest').mockResolvedValue(mockABTest)

      const result = await newsletterService.createNewsletter(createRequest, 'user-123')

      expect(abTestService.createTest).toHaveBeenCalledWith({
        ...createRequest.abTest,
        newsletterId: mockNewsletterId,
      })

      expect(result.id).toBe(mockNewsletterId)
    })

    it('should assign variant to subscriber', async () => {
      jest.spyOn(abTestService, 'getTest').mockResolvedValue(mockABTest)
      mockRedis.get.mockResolvedValue(null) // No existing assignment

      const result = await abTestService.assignVariant(mockTestId, mockSubscriberId)

      expect(result).toBeDefined()
      expect(['variant-a', 'variant-b']).toContain(result?.id)
      expect(mockRedis.set).toHaveBeenCalledWith(
        `ab_assignment:${mockTestId}:${mockSubscriberId}`,
        result?.id,
        30 * 24 * 60 * 60 // 30 days
      )
    })

    it('should return existing variant assignment', async () => {
      jest.spyOn(abTestService, 'getTest').mockResolvedValue(mockABTest)
      mockRedis.get.mockResolvedValue('variant-a') // Existing assignment

      const result = await abTestService.assignVariant(mockTestId, mockSubscriberId)

      expect(result?.id).toBe('variant-a')
      expect(mockRedis.set).not.toHaveBeenCalled()
    })

    it('should record A/B test events and update metrics', async () => {
      const testWithUpdatedMetrics = {
        ...mockABTest,
        variants: [
          {
            ...mockABTest.variants[0],
            metrics: {
              ...mockABTest.variants[0]?.metrics,
              opens: 151,
              openRate: 30.2,
            },
          },
          mockABTest.variants[1],
        ],
      }

      jest.spyOn(abTestService, 'getTest').mockResolvedValue(mockABTest)
      mockDatabase.query.mockResolvedValue([])

      await abTestService.recordEvent(mockTestId, 'variant-a', 'open')

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ab_tests'),
        expect.arrayContaining([expect.any(String), mockTestId])
      )

      expect(mockRedis.del).toHaveBeenCalledWith(`ab_test:${mockTestId}`)
    })

    it('should analyze A/B test results and determine winner', async () => {
      const completedTest = {
        ...mockABTest,
        status: 'completed' as const,
      }

      jest.spyOn(abTestService, 'getTest').mockResolvedValue(completedTest)

      const results = await abTestService.analyzeResults(mockTestId)

      expect(results).toBeDefined()
      expect(results?.winner).toBe('variant-b') // Higher open rate (40% vs 30%)
      expect(results?.improvement).toBeGreaterThan(0)
      expect(results?.statisticalSignificance).toBeDefined()
    })

    it('should handle insufficient sample size for analysis', async () => {
      const lowSampleTest: ABTest = {
        ...mockABTest,
        variants: [
          {
            id: mockABTest.variants[0]?.id || 'variant-a',
            name: mockABTest.variants[0]?.name || 'Control',
            content: mockABTest.variants[0]?.content || { subject: 'Weekly Newsletter' },
            metrics: {
              sent: 10,
              opens: 2,
              clicks: 0,
              conversions: 0,
              openRate: 20,
              clickRate: 0,
              conversionRate: 0,
            },
          },
          {
            id: mockABTest.variants[1]?.id || 'variant-b',
            name: mockABTest.variants[1]?.name || 'Test',
            content: mockABTest.variants[1]?.content || { subject: 'Your Weekly Tech Digest 🚀' },
            metrics: {
              sent: 10,
              opens: 3,
              clicks: 1,
              conversions: 0,
              openRate: 30,
              clickRate: 10,
              conversionRate: 0,
            },
          },
        ],
      }

      jest.spyOn(abTestService, 'getTest').mockResolvedValue(lowSampleTest)

      const results = await abTestService.analyzeResults(mockTestId)

      expect(results).toBeNull()
    })

    it('should validate A/B test configuration', async () => {
      const invalidTestData = {
        name: 'Invalid Test',
        type: 'subject' as const,
        variants: [
          { id: 'variant-a', name: 'Control', content: { subject: 'Test' } },
        ], // Only one variant
        trafficSplit: [100],
        winnerCriteria: 'open_rate' as const,
        newsletterId: mockNewsletterId,
      }

      await expect(abTestService.createTest(invalidTestData))
        .rejects.toThrow('Number of variants must be between 2 and')
    })

    it('should validate traffic split totals 100%', async () => {
      const invalidSplitData = {
        name: 'Invalid Split Test',
        type: 'subject' as const,
        variants: [
          { id: 'variant-a', name: 'Control', content: { subject: 'Test A' } },
          { id: 'variant-b', name: 'Test', content: { subject: 'Test B' } },
        ],
        trafficSplit: [60, 30], // Only totals 90%
        winnerCriteria: 'open_rate' as const,
        newsletterId: mockNewsletterId,
      }

      await expect(abTestService.createTest(invalidSplitData))
        .rejects.toThrow('Traffic split must total 100%')
    })

    it('should complete A/B test workflow end-to-end', async () => {
      // 1. Create test
      const createData = {
        name: 'End-to-End Test',
        type: 'subject' as const,
        variants: [
          {
            id: 'variant-a',
            name: 'Control',
            content: { subject: 'Newsletter' },
            metrics: { sent: 0, opens: 0, clicks: 0, conversions: 0, openRate: 0, clickRate: 0, conversionRate: 0 }
          },
          {
            id: 'variant-b',
            name: 'Test',
            content: { subject: 'Newsletter 🚀' },
            metrics: { sent: 0, opens: 0, clicks: 0, conversions: 0, openRate: 0, clickRate: 0, conversionRate: 0 }
          },
        ],
        trafficSplit: [50, 50],
        winnerCriteria: 'open_rate' as const,
        newsletterId: mockNewsletterId,
      }

      mockDatabase.queryOne.mockResolvedValue({
        id: mockTestId,
        name: createData.name,
        type: createData.type,
        variants: createData.variants.map(v => ({ ...v, metrics: { sent: 0, opens: 0, clicks: 0, conversions: 0, openRate: 0, clickRate: 0, conversionRate: 0 } })),
        traffic_split: createData.trafficSplit,
        winner_criteria: createData.winnerCriteria,
        newsletter_id: createData.newsletterId,
        status: 'running',
        created_at: new Date(),
      })

      const createdTest = await abTestService.createTest(createData)

      // 2. Assign variants to subscribers
      jest.spyOn(abTestService, 'getTest').mockResolvedValue(createdTest)
      mockRedis.get.mockResolvedValue(null)

      const assignment1 = await abTestService.assignVariant(mockTestId, 'subscriber-1')
      const assignment2 = await abTestService.assignVariant(mockTestId, 'subscriber-2')

      expect(assignment1).toBeDefined()
      expect(assignment2).toBeDefined()

      // 3. Record events
      await abTestService.recordEvent(mockTestId, assignment1!.id, 'sent')
      await abTestService.recordEvent(mockTestId, assignment1!.id, 'open')
      await abTestService.recordEvent(mockTestId, assignment2!.id, 'sent')

      // 4. Analyze results (would be done after sufficient data)
      const testWithData: ABTest = {
        ...createdTest,
        variants: [
          {
            id: createdTest.variants[0]?.id || 'variant-a',
            name: createdTest.variants[0]?.name || 'Control',
            content: createdTest.variants[0]?.content || { subject: 'Newsletter' },
            metrics: { sent: 100, opens: 30, clicks: 5, conversions: 1, openRate: 30, clickRate: 5, conversionRate: 1 }
          },
          {
            id: createdTest.variants[1]?.id || 'variant-b',
            name: createdTest.variants[1]?.name || 'Test',
            content: createdTest.variants[1]?.content || { subject: 'Newsletter 🚀' },
            metrics: { sent: 100, opens: 40, clicks: 8, conversions: 2, openRate: 40, clickRate: 8, conversionRate: 2 }
          },
        ],
      }

      jest.spyOn(abTestService, 'getTest').mockResolvedValue(testWithData)

      const results = await abTestService.analyzeResults(mockTestId)

      expect(results?.winner).toBe('variant-b')
      expect(results?.improvement).toBeGreaterThan(0)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      // Reset all mocks before each test
      jest.clearAllMocks()
    })

    it('should handle database connection errors', async () => {
      mockDatabase.queryOne.mockRejectedValue(new Error('Database connection failed'))

      const createRequest: CreateNewsletterRequest = {
        title: 'Test Newsletter',
        sections: ['news'],
        segments: ['segment-1'],
      }

      await expect(newsletterService.createNewsletter(createRequest, 'user-123'))
        .rejects.toThrow('Database connection failed')
    })

    it('should handle Redis cache failures gracefully', async () => {
      // Mock Redis failure but allow repository to work
      mockRedis.get.mockImplementation(() => {
        throw new Error('Redis connection failed')
      })

      jest.spyOn(newsletterRepository, 'findById').mockResolvedValue({
        id: 'newsletter-123',
        title: 'Test Newsletter',
      } as any)

      // The service should handle Redis errors gracefully and fall back to database
      const result = await newsletterService.getNewsletter('newsletter-123')

      expect(result).toBeDefined()
      expect(result?.id).toBe('newsletter-123')
    })

    it('should handle queue service failures', async () => {
      // Mock newsletter exists
      jest.spyOn(newsletterRepository, 'findById').mockResolvedValue({
        id: 'newsletter-123',
        status: 'draft',
      } as any)

      // Mock queue failure
      mockQueue.addJob.mockRejectedValue(new Error('Queue service unavailable'))

      await expect(newsletterService.sendNewsletter('newsletter-123'))
        .rejects.toThrow('Queue service unavailable')
    })

    it('should validate required segments', async () => {
      const createRequest: CreateNewsletterRequest = {
        title: 'Test Newsletter',
        sections: ['news'],
        segments: [], // Empty segments
      }

      await expect(newsletterService.createNewsletter(createRequest, 'user-123'))
        .rejects.toThrow('At least one segment must be specified')
    })
  })
})
