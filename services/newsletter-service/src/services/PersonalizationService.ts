import { config } from '@/config'
import {
    ContentItem,
    ContentSection,
    DynamicContentBlock,
    NewsletterContent,
    PersonalizationData,
    PersonalizationRule
} from '@/types'
import { logger } from '@/utils/logger'
import { redis } from '@/utils/redis'

export class PersonalizationService {
  async personalizeContent(
    content: NewsletterContent,
    subscriberId: string
  ): Promise<NewsletterContent> {
    try {
      // Get subscriber personalization data
      const personalizationData = await this.getPersonalizationData(subscriberId)
      if (!personalizationData) {
        logger.warn('No personalization data found for subscriber', { subscriberId })
        return content
      }

      // Apply personalization to content
      const personalizedContent = { ...content }

      // Personalize sections
      personalizedContent.sections = await Promise.all(
        content.sections.map(section => this.personalizeSection(section, personalizationData))
      )

      // Apply dynamic content blocks
      personalizedContent.dynamicContent = await Promise.all(
        content.dynamicContent.map(block => this.applyDynamicContent(block, personalizationData))
      )

      // Update personalization metadata
      personalizedContent.personalization = personalizationData

      logger.info('Content personalized successfully', {
        subscriberId,
        sectionsCount: personalizedContent.sections.length,
        dynamicBlocksCount: personalizedContent.dynamicContent.length,
      })

      return personalizedContent
    } catch (error) {
      logger.error('Error personalizing content:', error)
      // Return original content on error
      return content
    }
  }

  async getPersonalizationData(subscriberId: string): Promise<PersonalizationData | null> {
    try {
      const cacheKey = `personalization:${subscriberId}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // In real implementation, this would call CRM service to get subscriber data
      const personalizationData = await this.fetchSubscriberData(subscriberId)

      if (personalizationData) {
        // Cache for 30 minutes
        await redis.set(cacheKey, JSON.stringify(personalizationData), config.personalization.cacheTimeout)
      }

      return personalizationData
    } catch (error) {
      logger.error('Error getting personalization data:', error)
      return null
    }
  }

  async generatePersonalizationRules(
    subscriberSegment: string,
    behaviorData: Record<string, any>
  ): Promise<PersonalizationRule[]> {
    try {
      const rules: PersonalizationRule[] = []

      // Content preference rules
      if (behaviorData.preferredTopics) {
        rules.push({
          id: 'topic-preference',
          condition: `topics.includes('${behaviorData.preferredTopics.join("','")}'})`,
          action: 'prioritize',
          priority: 10,
        })
      }

      // Engagement-based rules
      if (behaviorData.engagementLevel === 'high') {
        rules.push({
          id: 'high-engagement',
          condition: 'engagementLevel === "high"',
          action: 'show_advanced_content',
          priority: 8,
        })
      }

      // Time-based rules
      if (behaviorData.preferredReadingTime) {
        rules.push({
          id: 'reading-time',
          condition: `readingTime <= ${behaviorData.preferredReadingTime}`,
          action: 'filter_by_length',
          priority: 6,
        })
      }

      // Industry-specific rules
      if (behaviorData.industry) {
        rules.push({
          id: 'industry-focus',
          condition: `category === '${behaviorData.industry}'`,
          action: 'boost_relevance',
          priority: 7,
        })
      }

      return rules
    } catch (error) {
      logger.error('Error generating personalization rules:', error)
      return []
    }
  }

  async optimizeSendTime(subscriberId: string): Promise<Date | null> {
    try {
      const personalizationData = await this.getPersonalizationData(subscriberId)
      if (!personalizationData?.behaviorData) {
        return null
      }

      const { behaviorData } = personalizationData

      // Analyze historical engagement patterns
      const engagementHistory = behaviorData.engagementHistory || []
      if (engagementHistory.length === 0) {
        return null
      }

      // Find optimal hour based on historical opens
      const hourlyEngagement: Record<number, number> = {}

      engagementHistory.forEach((event: any) => {
        if (event.type === 'email_open') {
          const hour = new Date(event.timestamp).getHours()
          hourlyEngagement[hour] = (hourlyEngagement[hour] || 0) + 1
        }
      })

      // Find hour with highest engagement
      const optimalHour = Object.entries(hourlyEngagement)
        .sort(([, a], [, b]) => b - a)[0]?.[0]

      if (!optimalHour) {
        return null
      }

      // Create optimal send time for today
      const now = new Date()
      const optimalTime = new Date(now)
      optimalTime.setHours(parseInt(optimalHour), 0, 0, 0)

      // If optimal time has passed today, schedule for tomorrow
      if (optimalTime <= now) {
        optimalTime.setDate(optimalTime.getDate() + 1)
      }

      return optimalTime
    } catch (error) {
      logger.error('Error optimizing send time:', error)
      return null
    }
  }

  async getContentRecommendations(
    subscriberId: string,
    availableContent: ContentItem[]
  ): Promise<ContentItem[]> {
    try {
      const personalizationData = await this.getPersonalizationData(subscriberId)
      if (!personalizationData) {
        return availableContent.slice(0, 10) // Return top 10 if no personalization
      }

      const { preferences, behaviorData } = personalizationData

      // Score content based on personalization data
      const scoredContent = availableContent.map(item => ({
        ...item,
        personalizedScore: this.calculateContentScore(item, preferences, behaviorData),
      }))

      // Sort by personalized score and return top recommendations
      return scoredContent
        .sort((a, b) => b.personalizedScore - a.personalizedScore)
        .slice(0, 15)
        .map(({ personalizedScore, ...item }) => item)
    } catch (error) {
      logger.error('Error getting content recommendations:', error)
      return availableContent.slice(0, 10)
    }
  }

  private async personalizeSection(
    section: ContentSection,
    personalizationData: PersonalizationData
  ): Promise<ContentSection> {
    if (!section.isPersonalized) {
      return section
    }

    const personalizedSection = { ...section }

    // Filter and reorder items based on personalization
    if (section.items.length > 0) {
      const recommendations = await this.getContentRecommendations(
        personalizationData.subscriberId,
        section.items
      )
      personalizedSection.items = recommendations
    }

    // Apply display rules
    if (section.displayRules) {
      const shouldShow = this.evaluateDisplayRules(section.displayRules, personalizationData)
      if (!shouldShow) {
        personalizedSection.items = []
      }
    }

    return personalizedSection
  }

  private async applyDynamicContent(
    block: DynamicContentBlock,
    personalizationData: PersonalizationData
  ): Promise<DynamicContentBlock> {
    const personalizedBlock = { ...block }

    // Find matching variant based on conditions
    for (const variant of block.variants) {
      const matches = block.conditions.every(condition =>
        this.evaluateCondition(condition, personalizationData)
      )

      if (matches) {
        // Apply the matching variant
        personalizedBlock.variants = [variant]
        break
      }
    }

    // If no variant matches, use default
    if (personalizedBlock.variants.length === block.variants.length) {
      const defaultVariant = block.variants.find(v => v.isDefault)
      if (defaultVariant) {
        personalizedBlock.variants = [defaultVariant]
      }
    }

    return personalizedBlock
  }

  private calculateContentScore(
    item: ContentItem,
    preferences: Record<string, any>,
    behaviorData: Record<string, any>
  ): number {
    let score = item.score || 0

    // Topic preference boost
    if (preferences.topics && item.tags) {
      const topicMatches = item.tags.filter(tag =>
        preferences.topics.includes(tag)
      ).length
      score += topicMatches * 2
    }

    // Category preference
    if (preferences.categories && preferences.categories.includes(item.category)) {
      score += 3
    }

    // Difficulty preference
    if (preferences.difficulty === item.difficulty) {
      score += 2
    }

    // Source preference
    if (preferences.sources && preferences.sources.includes(item.source)) {
      score += 1.5
    }

    // Behavioral adjustments
    if (behaviorData.engagementLevel === 'high' && item.difficulty === 'advanced') {
      score += 1
    }

    if (behaviorData.engagementLevel === 'low' && item.difficulty === 'beginner') {
      score += 1
    }

    // Recency boost
    const daysSincePublished = (Date.now() - item.publishedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSincePublished < 1) {
      score += 2
    } else if (daysSincePublished < 7) {
      score += 1
    }

    return score
  }

  private evaluateDisplayRules(
    rules: any[],
    personalizationData: PersonalizationData
  ): boolean {
    return rules.every(rule => {
      switch (rule.action) {
        case 'show':
          return this.evaluateCondition({
            field: rule.condition.split(' ')[0],
            operator: rule.condition.split(' ')[1],
            value: rule.condition.split(' ')[2]
          }, personalizationData)
        case 'hide':
          return !this.evaluateCondition({
            field: rule.condition.split(' ')[0],
            operator: rule.condition.split(' ')[1],
            value: rule.condition.split(' ')[2]
          }, personalizationData)
        default:
          return true
      }
    })
  }

  private evaluateCondition(
    condition: { field: string; operator: string; value: any },
    personalizationData: PersonalizationData
  ): boolean {
    const fieldValue = this.getFieldValue(condition.field, personalizationData)

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value
      case 'contains':
        return Array.isArray(fieldValue)
          ? fieldValue.includes(condition.value)
          : String(fieldValue).includes(condition.value)
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value)
      case 'less_than':
        return Number(fieldValue) < Number(condition.value)
      case 'in':
        return Array.isArray(condition.value)
          ? condition.value.includes(fieldValue)
          : false
      case 'not_in':
        return Array.isArray(condition.value)
          ? !condition.value.includes(fieldValue)
          : true
      default:
        return false
    }
  }

  private getFieldValue(field: string, personalizationData: PersonalizationData): any {
    const parts = field.split('.')
    let value: any = personalizationData

    for (const part of parts) {
      value = value?.[part]
      if (value === undefined) break
    }

    return value
  }

  private async fetchSubscriberData(subscriberId: string): Promise<PersonalizationData | null> {
    try {
      // In real implementation, this would call CRM service
      // For now, return mock data
      const mockData: PersonalizationData = {
        subscriberId,
        preferences: {
          topics: ['AI', 'Machine Learning', 'Web Development'],
          categories: ['tech', 'research'],
          difficulty: 'intermediate',
          sources: ['TechCrunch', 'Hacker News'],
          frequency: 'daily',
        },
        behaviorData: {
          engagementLevel: 'high',
          preferredReadingTime: 5,
          industry: 'technology',
          lastEngagement: new Date(),
          engagementHistory: [],
        },
        demographics: {
          location: 'US',
          timezone: 'America/New_York',
          language: 'en',
        },
      }

      return mockData
    } catch (error) {
      logger.error('Error fetching subscriber data:', error)
      return null
    }
  }
}
