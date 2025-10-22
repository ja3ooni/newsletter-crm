import { ContentLibraryRepository } from '@/repositories/ContentLibraryRepository'
import { NewsletterRepository } from '@/repositories/NewsletterRepository'
import { TemplateRepository } from '@/repositories/TemplateRepository'
import {
    CreateNewsletterRequest,
    DeliverabilityReport,
    GenerateNewsletterRequest,
    Newsletter,
    NewsletterAnalytics,
    NewsletterContent,
    UpdateNewsletterRequest
} from '@/types'
import { logger } from '@/utils/logger'
import { QUEUE_NAMES, queueService } from '@/utils/queue'
import { redis } from '@/utils/redis'
import { ABTestService } from './ABTestService'
import { PersonalizationService } from './PersonalizationService'
import { SchedulingService } from './SchedulingService'

export class NewsletterService {
  constructor(
    private newsletterRepository: NewsletterRepository,
    private templateRepository: TemplateRepository,
    private contentLibraryRepository: ContentLibraryRepository,
    private personalizationService: PersonalizationService,
    private abTestService: ABTestService,
    private schedulingService: SchedulingService
  ) {}

  async createNewsletter(data: CreateNewsletterRequest, userId: string): Promise<Newsletter> {
    try {
      // Validate template if provided
      if (data.templateId) {
        const template = await this.templateRepository.findById(data.templateId)
        if (!template) {
          throw new Error('Template not found')
        }
      }

      // Validate segments exist (would call CRM service in real implementation)
      if (data.segments.length === 0) {
        throw new Error('At least one segment must be specified')
      }

      // Create newsletter
      const newsletter = await this.newsletterRepository.create({
        ...data,
        createdBy: userId,
      })

      // If A/B test is specified, create it
      if (data.abTest && data.abTest.name && data.abTest.type && data.abTest.variants && data.abTest.trafficSplit && data.abTest.winnerCriteria) {
        await this.abTestService.createTest({
          name: data.abTest.name,
          type: data.abTest.type,
          variants: data.abTest.variants,
          trafficSplit: data.abTest.trafficSplit,
          winnerCriteria: data.abTest.winnerCriteria,
          newsletterId: newsletter.id,
        })
      }

      logger.info('Newsletter created successfully', {
        newsletterId: newsletter.id,
        userId,
        title: newsletter.title,
      })

      return newsletter
    } catch (error) {
      logger.error('Error creating newsletter:', error)
      throw error
    }
  }

  async generateNewsletterContent(request: GenerateNewsletterRequest): Promise<NewsletterContent> {
    try {
      // Add content generation job to queue
      const job = await queueService.addJob(
        QUEUE_NAMES.NEWSLETTER_GENERATION,
        'generate-content',
        request,
        { priority: 'normal' }
      )

      logger.info('Newsletter content generation job queued', {
        jobId: job.id,
        userId: request.userId,
        sections: request.sections,
      })

      // For now, return a basic structure - in real implementation this would be processed by the queue
      const content: NewsletterContent = {
        sections: request.sections.map((sectionType, index) => ({
          id: `section-${index}`,
          type: sectionType as any,
          title: this.getSectionTitle(sectionType),
          items: [],
          order: index,
          isPersonalized: !!request.personalization,
        })),
        personalization: request.personalization || {
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
          categories: request.sections,
        },
        dynamicContent: [],
      }

      return content
    } catch (error) {
      logger.error('Error generating newsletter content:', error)
      throw error
    }
  }

  async getNewsletter(id: string): Promise<Newsletter | null> {
    try {
      // Try cache first
      const cacheKey = `newsletter:${id}`
      let cached: string | null = null

      try {
        cached = await redis.get(cacheKey)
      } catch (error) {
        logger.warn('Redis cache error, falling back to database', {
          error: error instanceof Error ? error.message : String(error)
        })
      }

      if (cached) {
        return JSON.parse(cached)
      }

      const newsletter = await this.newsletterRepository.findById(id)

      if (newsletter) {
        // Cache for 5 minutes (ignore cache errors)
        try {
          await redis.set(cacheKey, JSON.stringify(newsletter), 300)
        } catch (error) {
          logger.warn('Failed to cache newsletter', {
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      return newsletter
    } catch (error) {
      logger.error('Error getting newsletter:', error)
      throw error
    }
  }

  async getNewsletters(filters: {
    status?: Newsletter['status']
    createdBy?: string
    templateId?: string
    search?: string
    dateFrom?: Date
    dateTo?: Date
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<{ newsletters: Newsletter[]; total: number }> {
    try {
      return await this.newsletterRepository.findMany(filters)
    } catch (error) {
      logger.error('Error getting newsletters:', error)
      throw error
    }
  }

  async updateNewsletter(id: string, data: UpdateNewsletterRequest): Promise<Newsletter | null> {
    try {
      const newsletter = await this.newsletterRepository.update(id, data)

      if (newsletter) {
        // Invalidate cache
        await redis.del(`newsletter:${id}`)

        logger.info('Newsletter updated successfully', {
          newsletterId: id,
          updates: Object.keys(data),
        })
      }

      return newsletter
    } catch (error) {
      logger.error('Error updating newsletter:', error)
      throw error
    }
  }

  async deleteNewsletter(id: string): Promise<boolean> {
    try {
      const newsletter = await this.newsletterRepository.findById(id)
      if (!newsletter) {
        return false
      }

      // Don't allow deletion of sent newsletters
      if (newsletter.status === 'sent') {
        throw new Error('Cannot delete sent newsletters')
      }

      // Cancel scheduled job if exists
      if (newsletter.status === 'scheduled') {
        await this.schedulingService.cancelScheduledNewsletter(id)
      }

      const deleted = await this.newsletterRepository.delete(id)

      if (deleted) {
        // Invalidate cache
        await redis.del(`newsletter:${id}`)

        logger.info('Newsletter deleted successfully', { newsletterId: id })
      }

      return deleted
    } catch (error) {
      logger.error('Error deleting newsletter:', error)
      throw error
    }
  }

  async scheduleNewsletter(id: string, scheduledAt: Date, timezone: string = 'UTC'): Promise<void> {
    try {
      const newsletter = await this.newsletterRepository.findById(id)
      if (!newsletter) {
        throw new Error('Newsletter not found')
      }

      if (newsletter.status !== 'draft') {
        throw new Error('Only draft newsletters can be scheduled')
      }

      // Schedule the newsletter
      await this.schedulingService.scheduleNewsletter({
        newsletterId: id,
        scheduledAt,
        timezone,
      })

      // Update newsletter status
      await this.newsletterRepository.update(id, {
        status: 'scheduled',
        scheduledAt,
      })

      // Invalidate cache
      await redis.del(`newsletter:${id}`)

      logger.info('Newsletter scheduled successfully', {
        newsletterId: id,
        scheduledAt,
        timezone,
      })
    } catch (error) {
      logger.error('Error scheduling newsletter:', error)
      throw error
    }
  }

  async sendNewsletter(id: string): Promise<void> {
    try {
      const newsletter = await this.newsletterRepository.findById(id)
      if (!newsletter) {
        throw new Error('Newsletter not found')
      }

      if (newsletter.status === 'sent') {
        throw new Error('Newsletter already sent')
      }

      // Add to sending queue
      await queueService.addJob(
        QUEUE_NAMES.EMAIL_SENDING,
        'send-newsletter',
        { newsletterId: id },
        { priority: 'high' }
      )

      logger.info('Newsletter queued for sending', { newsletterId: id })
    } catch (error) {
      logger.error('Error sending newsletter:', error)
      throw error
    }
  }

  async duplicateNewsletter(id: string, userId: string): Promise<Newsletter> {
    try {
      const original = await this.newsletterRepository.findById(id)
      if (!original) {
        throw new Error('Newsletter not found')
      }

      const duplicateData: CreateNewsletterRequest = {
        title: `${original.title} (Copy)`,
        ...(original.templateId && { templateId: original.templateId }),
        sections: original.content.sections.map(s => s.type),
        segments: original.segments,
        personalization: original.personalization,
        deliverabilitySettings: original.deliverabilitySettings,
      }

      const duplicate = await this.createNewsletter(duplicateData, userId)

      logger.info('Newsletter duplicated successfully', {
        originalId: id,
        duplicateId: duplicate.id,
        userId,
      })

      return duplicate
    } catch (error) {
      logger.error('Error duplicating newsletter:', error)
      throw error
    }
  }

  async previewNewsletter(id: string, subscriberId?: string): Promise<string> {
    try {
      const newsletter = await this.newsletterRepository.findById(id)
      if (!newsletter) {
        throw new Error('Newsletter not found')
      }

      // Get template
      let template = null
      if (newsletter.templateId) {
        template = await this.templateRepository.findById(newsletter.templateId)
      }

      // Apply personalization if subscriber ID provided
      let personalizedContent = newsletter.content
      if (subscriberId && newsletter.personalization.enabled) {
        personalizedContent = await this.personalizationService.personalizeContent(
          newsletter.content,
          subscriberId
        )
      }

      // Render HTML (simplified - would use a proper template engine)
      const html = this.renderNewsletterHTML(personalizedContent, template)

      return html
    } catch (error) {
      logger.error('Error previewing newsletter:', error)
      throw error
    }
  }

  async getNewsletterAnalytics(id: string, timeRange: { start: Date; end: Date }): Promise<NewsletterAnalytics | null> {
    try {
      return await this.newsletterRepository.getAnalytics(id, timeRange)
    } catch (error) {
      logger.error('Error getting newsletter analytics:', error)
      throw error
    }
  }

  async getDeliverabilityReport(id: string): Promise<DeliverabilityReport | null> {
    try {
      const newsletter = await this.newsletterRepository.findById(id)
      if (!newsletter || newsletter.status !== 'sent') {
        return null
      }

      // In real implementation, this would call deliverability service
      const report: DeliverabilityReport = {
        newsletterId: id,
        deliveryRate: 98.5,
        bounceRate: 1.2,
        spamRate: 0.3,
        reputationScore: 95,
        domainReputation: {
          'gmail.com': 98,
          'yahoo.com': 96,
          'outlook.com': 97,
        },
        recommendations: [
          'Consider warming up your IP address',
          'Review subject line for spam triggers',
          'Improve list hygiene',
        ],
        detailedMetrics: {
          hardBounces: 12,
          softBounces: 8,
          spamComplaints: 3,
          unsubscribes: 15,
          deliveredToInbox: 9850,
          deliveredToSpam: 30,
        },
        generatedAt: new Date(),
      }

      return report
    } catch (error) {
      logger.error('Error getting deliverability report:', error)
      throw error
    }
  }

  private getSectionTitle(sectionType: string): string {
    const titles: Record<string, string> = {
      news: 'Latest News',
      research: 'Research & Insights',
      github: 'GitHub Trending',
      events: 'Upcoming Events',
      products: 'Product Updates',
      custom: 'Custom Content',
    }
    return titles[sectionType] || 'Content Section'
  }

  private renderNewsletterHTML(content: NewsletterContent, template: any): string {
    // Simplified HTML rendering - in real implementation would use Handlebars or similar
    let html = '<html><body>'

    content.sections.forEach(section => {
      html += `<div class="section">
        <h2>${section.title}</h2>
        <div class="items">
          ${section.items.map(item => `
            <div class="item">
              <h3>${item.title}</h3>
              <p>${item.summary}</p>
              <a href="${item.url}">Read more</a>
            </div>
          `).join('')}
        </div>
      </div>`
    })

    html += '</body></html>'
    return html
  }
}
