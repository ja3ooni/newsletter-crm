import { NewsletterService } from '@/services/NewsletterService'
import { logger } from '@/utils/logger'
import {
    createNewsletterSchema,
    generateNewsletterSchema,
    handleValidationError,
    newsletterQuerySchema,
    scheduleNewsletterSchema,
    updateNewsletterSchema
} from '@/utils/validation'
import { Request, Response } from 'express'

export class NewsletterController {
  constructor(private newsletterService: NewsletterService) {}

  async createNewsletter(req: Request, res: Response): Promise<void> {
    try {
      const data = createNewsletterSchema.parse(req.body)
      const userId = req.user?.id

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' })
        return
      }

      const newsletter = await this.newsletterService.createNewsletter(data, userId)

      res.status(201).json({
        success: true,
        data: newsletter,
      })
    } catch (error) {
      logger.error('Error in createNewsletter:', error)

      if (error.name === 'ZodError') {
        const validationError = handleValidationError(error)
        res.status(400).json({
          error: validationError.message,
          field: validationError.field,
        })
        return
      }

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }

  async generateContent(req: Request, res: Response): Promise<void> {
    try {
      const data = generateNewsletterSchema.parse(req.body)
      const content = await this.newsletterService.generateNewsletterContent(data)

      res.json({
        success: true,
        data: content,
      })
    } catch (error) {
      logger.error('Error in generateContent:', error)

      if (error.name === 'ZodError') {
        const validationError = handleValidationError(error)
        res.status(400).json({
          error: validationError.message,
          field: validationError.field,
        })
        return
      }

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }

  async getNewsletter(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const newsletter = await this.newsletterService.getNewsletter(id)

      if (!newsletter) {
        res.status(404).json({ error: 'Newsletter not found' })
        return
      }

      res.json({
        success: true,
        data: newsletter,
      })
    } catch (error) {
      logger.error('Error in getNewsletter:', error)
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }

  async getNewsletters(req: Request, res: Response): Promise<void> {
    try {
      const filters = newsletterQuerySchema.parse(req.query)
      const result = await this.newsletterService.getNewsletters(filters)

      res.json({
        success: true,
        data: result.newsletters,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / filters.limit),
        },
      })
    } catch (error) {
      logger.error('Error in getNewsletters:', error)

      if (error.name === 'ZodError') {
        const validationError = handleValidationError(error)
        res.status(400).json({
          error: validationError.message,
          field: validationError.field,
        })
        return
      }

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }

  async updateNewsletter(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const data = updateNewsletterSchema.parse(req.body)

      const newsletter = await this.newsletterService.updateNewsletter(id, data)

      if (!newsletter) {
        res.status(404).json({ error: 'Newsletter not found' })
        return
      }

      res.json({
        success: true,
        data: newsletter,
      })
    } catch (error) {
      logger.error('Error in updateNewsletter:', error)

      if (error.name === 'ZodError') {
        const validationError = handleValidationError(error)
        res.status(400).json({
          error: validationError.message,
          field: validationError.field,
        })
        return
      }

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }

  async deleteNewsletter(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const deleted = await this.newsletterService.deleteNewsletter(id)

      if (!deleted) {
        res.status(404).json({ error: 'Newsletter not found' })
        return
      }

      res.json({
        success: true,
        message: 'Newsletter deleted successfully',
      })
    } catch (error) {
      logger.error('Error in deleteNewsletter:', error)
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }

  async scheduleNewsletter(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const data = scheduleNewsletterSchema.parse(req.body)

      await this.newsletterService.scheduleNewsletter(
        id,
        data.scheduledAt,
        data.timezone
      )

      res.json({
        success: true,
        message: 'Newsletter scheduled successfully',
      })
    } catch (error) {
      logger.error('Error in scheduleNewsletter:', error)

      if (error.name === 'ZodError') {
        const validationError = handleValidationError(error)
        res.status(400).json({
          error: validationError.message,
          field: validationError.field,
        })
        return
      }

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }

  async sendNewsletter(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      await this.newsletterService.sendNewsletter(id)

      res.json({
        success: true,
        message: 'Newsletter queued for sending',
      })
    } catch (error) {
      logger.error('Error in sendNewsletter:', error)
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }

  async duplicateNewsletter(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user?.id

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' })
        return
      }

      const duplicate = await this.newsletterService.duplicateNewsletter(id, userId)

      res.status(201).json({
        success: true,
        data: duplicate,
      })
    } catch (error) {
      logger.error('Error in duplicateNewsletter:', error)
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }

  async previewNewsletter(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { subscriberId } = req.query

      const html = await this.newsletterService.previewNewsletter(
        id,
        subscriberId as string
      )

      res.setHeader('Content-Type', 'text/html')
      res.send(html)
    } catch (error) {
      logger.error('Error in previewNewsletter:', error)
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }

  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { startDate, endDate } = req.query

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'Start date and end date are required' })
        return
      }

      const timeRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string),
      }

      const analytics = await this.newsletterService.getNewsletterAnalytics(id, timeRange)

      if (!analytics) {
        res.status(404).json({ error: 'Newsletter not found or no analytics available' })
        return
      }

      res.json({
        success: true,
        data: analytics,
      })
    } catch (error) {
      logger.error('Error in getAnalytics:', error)
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }

  async getDeliverabilityReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const report = await this.newsletterService.getDeliverabilityReport(id)

      if (!report) {
        res.status(404).json({ error: 'Newsletter not found or deliverability report not available' })
        return
      }

      res.json({
        success: true,
        data: report,
      })
    } catch (error) {
      logger.error('Error in getDeliverabilityReport:', error)
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  }
}
