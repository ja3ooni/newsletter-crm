import { config } from '@/config'
import {
    ABTest,
    ABTestResults,
    ABTestVariant,
    VariantMetrics
} from '@/types'
import { database } from '@/utils/database'
import { logger } from '@/utils/logger'
import { redis } from '@/utils/redis'

export interface CreateABTestData {
  name: string
  type: 'subject' | 'content' | 'send_time' | 'template'
  variants: Omit<ABTestVariant, 'metrics'>[]
  trafficSplit: number[]
  winnerCriteria: 'open_rate' | 'click_rate' | 'conversion_rate'
  newsletterId: string
}

export interface UpdateABTestData {
  name?: string
  status?: 'running' | 'completed' | 'paused'
  results?: ABTestResults
}

export class ABTestService {
  async createTest(data: CreateABTestData): Promise<ABTest> {
    try {
      // Validate traffic split
      const totalSplit = data.trafficSplit.reduce((sum, split) => sum + split, 0)
      if (Math.abs(totalSplit - 100) > 0.01) {
        throw new Error('Traffic split must total 100%')
      }

      if (data.variants.length !== data.trafficSplit.length) {
        throw new Error('Number of variants must match traffic split array length')
      }

      if (data.variants.length < 2 || data.variants.length > config.abTesting.maxVariants) {
        throw new Error(`Number of variants must be between 2 and ${config.abTesting.maxVariants}`)
      }

      // Create variants with empty metrics
      const variants: ABTestVariant[] = data.variants.map(variant => ({
        ...variant,
        metrics: {
          sent: 0,
          opens: 0,
          clicks: 0,
          conversions: 0,
          openRate: 0,
          clickRate: 0,
          conversionRate: 0,
        },
      }))

      const query = `
        INSERT INTO ab_tests (
          name, type, variants, traffic_split, winner_criteria, newsletter_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `

      const values = [
        data.name,
        data.type,
        JSON.stringify(variants),
        data.trafficSplit,
        data.winnerCriteria,
        data.newsletterId,
        'running',
      ]

      const result = await database.queryOne<any>(query, values)
      const abTest = this.mapToABTest(result)

      logger.info('A/B test created successfully', {
        testId: abTest.id,
        newsletterId: data.newsletterId,
        type: data.type,
        variantsCount: variants.length,
      })

      return abTest
    } catch (error) {
      logger.error('Error creating A/B test:', error)
      throw error
    }
  }

  async getTest(id: string): Promise<ABTest | null> {
    try {
      const cacheKey = `ab_test:${id}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      const query = `SELECT * FROM ab_tests WHERE id = $1`
      const result = await database.queryOne<any>(query, [id])

      if (!result) {
        return null
      }

      const abTest = this.mapToABTest(result)

      // Cache for 5 minutes
      await redis.set(cacheKey, JSON.stringify(abTest), 300)

      return abTest
    } catch (error) {
      logger.error('Error getting A/B test:', error)
      throw error
    }
  }

  async updateTest(id: string, data: UpdateABTestData): Promise<ABTest | null> {
    try {
      const updates: string[] = []
      const values: any[] = []
      let paramCount = 0

      if (data.name !== undefined) {
        updates.push(`name = $${++paramCount}`)
        values.push(data.name)
      }

      if (data.status !== undefined) {
        updates.push(`status = $${++paramCount}`)
        values.push(data.status)

        if (data.status === 'completed') {
          updates.push(`ended_at = NOW()`)
        }
      }

      if (data.results !== undefined) {
        updates.push(`results = $${++paramCount}`)
        values.push(JSON.stringify(data.results))
      }

      if (updates.length === 0) {
        return this.getTest(id)
      }

      updates.push(`updated_at = NOW()`)
      values.push(id)

      const query = `
        UPDATE ab_tests
        SET ${updates.join(', ')}
        WHERE id = $${++paramCount}
        RETURNING *
      `

      const result = await database.queryOne<any>(query, values)

      if (result) {
        // Invalidate cache
        await redis.del(`ab_test:${id}`)
      }

      return result ? this.mapToABTest(result) : null
    } catch (error) {
      logger.error('Error updating A/B test:', error)
      throw error
    }
  }

  async assignVariant(testId: string, subscriberId: string): Promise<ABTestVariant | null> {
    try {
      const test = await this.getTest(testId)
      if (!test || test.status !== 'running') {
        return null
      }

      // Check if subscriber already assigned
      const assignmentKey = `ab_assignment:${testId}:${subscriberId}`
      const existingAssignment = await redis.get(assignmentKey)

      if (existingAssignment) {
        const variantId = existingAssignment
        return test.variants.find(v => v.id === variantId) || null
      }

      // Assign variant based on traffic split
      const variant = this.selectVariantByTrafficSplit(test.variants, test.trafficSplit)

      // Store assignment (expires when test ends or after 30 days)
      await redis.set(assignmentKey, variant.id, 30 * 24 * 60 * 60)

      logger.debug('Variant assigned to subscriber', {
        testId,
        subscriberId,
        variantId: variant.id,
      })

      return variant
    } catch (error) {
      logger.error('Error assigning variant:', error)
      return null
    }
  }

  async recordEvent(
    testId: string,
    variantId: string,
    eventType: 'sent' | 'open' | 'click' | 'conversion'
  ): Promise<void> {
    try {
      const test = await this.getTest(testId)
      if (!test || test.status !== 'running') {
        return
      }

      const variant = test.variants.find(v => v.id === variantId)
      if (!variant) {
        return
      }

      // Update variant metrics
      variant.metrics[eventType === 'sent' ? 'sent' :
                     eventType === 'open' ? 'opens' :
                     eventType === 'click' ? 'clicks' : 'conversions']++

      // Recalculate rates
      if (variant.metrics.sent > 0) {
        variant.metrics.openRate = (variant.metrics.opens / variant.metrics.sent) * 100
        variant.metrics.clickRate = (variant.metrics.clicks / variant.metrics.sent) * 100
        variant.metrics.conversionRate = (variant.metrics.conversions / variant.metrics.sent) * 100
      }

      // Update database
      const query = `
        UPDATE ab_tests
        SET variants = $1, updated_at = NOW()
        WHERE id = $2
      `
      await database.query(query, [JSON.stringify(test.variants), testId])

      // Invalidate cache
      await redis.del(`ab_test:${testId}`)

      // Check if test should be completed
      await this.checkTestCompletion(testId)

      logger.debug('A/B test event recorded', {
        testId,
        variantId,
        eventType,
        newMetrics: variant.metrics,
      })
    } catch (error) {
      logger.error('Error recording A/B test event:', error)
    }
  }

  async analyzeResults(testId: string): Promise<ABTestResults | null> {
    try {
      const test = await this.getTest(testId)
      if (!test) {
        return null
      }

      // Check if we have enough data
      const totalSent = test.variants.reduce((sum, v) => sum + v.metrics.sent, 0)
      if (totalSent < config.abTesting.minSampleSize) {
        return null
      }

      // Find winner based on criteria
      const sortedVariants = [...test.variants].sort((a, b) => {
        const aValue = this.getMetricValue(a.metrics, test.winnerCriteria)
        const bValue = this.getMetricValue(b.metrics, test.winnerCriteria)
        return bValue - aValue
      })

      const winner = sortedVariants[0]
      const runnerUp = sortedVariants[1]

      if (!winner || !runnerUp) {
        return null
      }

      // Calculate statistical significance
      const significance = this.calculateStatisticalSignificance(
        winner.metrics,
        runnerUp.metrics,
        test.winnerCriteria
      )

      // Calculate improvement
      const winnerValue = this.getMetricValue(winner.metrics, test.winnerCriteria)
      const runnerUpValue = this.getMetricValue(runnerUp.metrics, test.winnerCriteria)
      const improvement = runnerUpValue > 0
        ? ((winnerValue - runnerUpValue) / runnerUpValue) * 100
        : 0

      const results: ABTestResults = {
        winner: winner.id,
        confidence: significance.confidence,
        improvement,
        statisticalSignificance: significance.isSignificant,
      }

      logger.info('A/B test results analyzed', {
        testId,
        winner: winner.id,
        improvement: `${improvement.toFixed(2)}%`,
        confidence: `${(significance.confidence * 100).toFixed(2)}%`,
        isSignificant: significance.isSignificant,
      })

      return results
    } catch (error) {
      logger.error('Error analyzing A/B test results:', error)
      return null
    }
  }

  async getTestsByNewsletter(newsletterId: string): Promise<ABTest[]> {
    try {
      const query = `
        SELECT * FROM ab_tests
        WHERE newsletter_id = $1
        ORDER BY created_at DESC
      `
      const results = await database.query<any>(query, [newsletterId])
      return results.map(result => this.mapToABTest(result))
    } catch (error) {
      logger.error('Error getting tests by newsletter:', error)
      throw error
    }
  }

  async getRunningTests(): Promise<ABTest[]> {
    try {
      const query = `
        SELECT * FROM ab_tests
        WHERE status = 'running'
        ORDER BY created_at DESC
      `
      const results = await database.query<any>(query)
      return results.map(result => this.mapToABTest(result))
    } catch (error) {
      logger.error('Error getting running tests:', error)
      throw error
    }
  }

  private selectVariantByTrafficSplit(variants: ABTestVariant[], trafficSplit: number[]): ABTestVariant {
    const random = Math.random() * 100
    let cumulative = 0

    for (let i = 0; i < variants.length; i++) {
      cumulative += trafficSplit[i] || 0
      if (random <= cumulative) {
        const variant = variants[i]
        if (variant) {
          return variant
        }
      }
    }

    // Fallback to first variant
    const firstVariant = variants[0]
    if (!firstVariant) {
      throw new Error('No variants available')
    }
    return firstVariant
  }

  private getMetricValue(metrics: VariantMetrics, criteria: string): number {
    switch (criteria) {
      case 'open_rate':
        return metrics.openRate
      case 'click_rate':
        return metrics.clickRate
      case 'conversion_rate':
        return metrics.conversionRate
      default:
        return 0
    }
  }

  private calculateStatisticalSignificance(
    winnerMetrics: VariantMetrics,
    runnerUpMetrics: VariantMetrics,
    criteria: string
  ): { confidence: number; isSignificant: boolean } {
    // Simplified statistical significance calculation
    // In real implementation, would use proper statistical tests (z-test, t-test, etc.)

    const winnerValue = this.getMetricValue(winnerMetrics, criteria)
    const runnerUpValue = this.getMetricValue(runnerUpMetrics, criteria)

    const winnerSent = winnerMetrics.sent
    const runnerUpSent = runnerUpMetrics.sent

    if (winnerSent < 30 || runnerUpSent < 30) {
      return { confidence: 0, isSignificant: false }
    }

    // Simple confidence calculation based on sample size and difference
    const difference = Math.abs(winnerValue - runnerUpValue)
    const totalSample = winnerSent + runnerUpSent

    let confidence = Math.min(0.99, (difference / 100) * Math.sqrt(totalSample / 100))

    // Adjust confidence based on sample size
    if (totalSample < 100) {
      confidence *= 0.7
    } else if (totalSample < 500) {
      confidence *= 0.85
    }

    const isSignificant = confidence >= config.abTesting.confidenceLevel

    return { confidence, isSignificant }
  }

  private async checkTestCompletion(testId: string): Promise<void> {
    try {
      const results = await this.analyzeResults(testId)
      if (!results) {
        return
      }

      // Auto-complete test if statistically significant and has enough data
      if (results.statisticalSignificance && results.confidence >= 0.95) {
        await this.updateTest(testId, {
          status: 'completed',
          results,
        })

        logger.info('A/B test auto-completed', {
          testId,
          winner: results.winner,
          confidence: results.confidence,
        })
      }
    } catch (error) {
      logger.error('Error checking test completion:', error)
    }
  }

  private mapToABTest(row: any): ABTest {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      variants: row.variants || [],
      trafficSplit: row.traffic_split || [],
      winnerCriteria: row.winner_criteria,
      status: row.status,
      results: row.results,
      startedAt: row.created_at,
      endedAt: row.ended_at,
    }
  }
}
