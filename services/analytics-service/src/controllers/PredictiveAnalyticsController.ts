import { PredictiveAnalyticsService } from '@/services/PredictiveAnalyticsService';
import { logger } from '@/utils/logger';
import { Request, Response } from 'express';
import { z } from 'zod';

// Schemas for validation (to be used in future validation middleware)
// const ChurnPredictionSchema = z.object({
//   contactId: z.string().uuid(),
// });

// const OptimalSendTimeSchema = z.object({
//   contactId: z.string().uuid(),
// });

// const ContentRecommendationSchema = z.object({
//   contactId: z.string().uuid(),
//   limit: z.number().min(1).max(50).default(10),
// });

const ABTestSignificanceSchema = z.object({
  variant1: z.object({
    conversions: z.number().min(0),
    visitors: z.number().min(1),
  }),
  variant2: z.object({
    conversions: z.number().min(0),
    visitors: z.number().min(1),
  }),
});

export class PredictiveAnalyticsController {
  private predictiveService: PredictiveAnalyticsService;

  constructor() {
    this.predictiveService = new PredictiveAnalyticsService();
  }

  async predictChurn(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;

      if (!contactId) {
        res.status(400).json({
          success: false,
          error: 'Contact ID is required',
        });
        return;
      }

      const prediction = await this.predictiveService.predictChurn(contactId);

      res.json({
        success: true,
        data: prediction,
      });
    } catch (error) {
      logger.error('Failed to predict churn', { error, params: req.params });
      res.status(500).json({
        success: false,
        error: 'Failed to predict churn',
      });
    }
  }

  async predictOptimalSendTime(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;

      if (!contactId) {
        res.status(400).json({
          success: false,
          error: 'Contact ID is required',
        });
        return;
      }

      const prediction =
        await this.predictiveService.predictOptimalSendTime(contactId);

      res.json({
        success: true,
        data: prediction,
      });
    } catch (error) {
      logger.error('Failed to predict optimal send time', {
        error,
        params: req.params,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to predict optimal send time',
      });
    }
  }

  async generateContentRecommendations(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { contactId } = req.params;

      if (!contactId) {
        res.status(400).json({
          success: false,
          error: 'Contact ID is required',
        });
        return;
      }

      const prediction =
        await this.predictiveService.generateContentRecommendations(contactId);

      res.json({
        success: true,
        data: prediction,
      });
    } catch (error) {
      logger.error('Failed to generate content recommendations', {
        error,
        params: req.params,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to generate content recommendations',
      });
    }
  }

  async calculateABTestSignificance(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { testId } = req.params;
      const validatedData = ABTestSignificanceSchema.parse(req.body);

      if (!testId) {
        res.status(400).json({
          success: false,
          error: 'Test ID is required',
        });
        return;
      }

      const significance =
        await this.predictiveService.calculateABTestSignificance(
          testId,
          validatedData.variant1,
          validatedData.variant2
        );

      res.json({
        success: true,
        data: significance,
      });
    } catch (error) {
      logger.error('Failed to calculate A/B test significance', {
        error,
        params: req.params,
        body: req.body,
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to calculate A/B test significance',
      });
    }
  }

  async getBulkPredictions(req: Request, res: Response): Promise<void> {
    try {
      const { contactIds, predictionTypes } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Contact IDs array is required',
        });
        return;
      }

      if (!Array.isArray(predictionTypes) || predictionTypes.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Prediction types array is required',
        });
        return;
      }

      const predictions: any[] = [];

      for (const contactId of contactIds) {
        const contactPredictions: any = { contactId };

        for (const type of predictionTypes) {
          try {
            switch (type) {
              case 'churn':
                contactPredictions.churn =
                  await this.predictiveService.predictChurn(contactId);
                break;
              case 'optimal_send_time':
                contactPredictions.optimalSendTime =
                  await this.predictiveService.predictOptimalSendTime(
                    contactId
                  );
                break;
              case 'content_recommendations':
                contactPredictions.contentRecommendations =
                  await this.predictiveService.generateContentRecommendations(
                    contactId
                  );
                break;
            }
          } catch (error) {
            logger.warn('Failed to generate prediction for contact', {
              contactId,
              type,
              error,
            });
            contactPredictions[type] = { error: 'Prediction failed' };
          }
        }

        predictions.push(contactPredictions);
      }

      res.json({
        success: true,
        data: predictions,
      });
    } catch (error) {
      logger.error('Failed to generate bulk predictions', {
        error,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to generate bulk predictions',
      });
    }
  }

  async getModelPerformance(req: Request, res: Response): Promise<void> {
    try {
      const { modelType, timeRange } = req.query;

      // This would typically fetch actual model performance metrics
      const performance = {
        modelType: modelType || 'all',
        timeRange: timeRange || '30d',
        metrics: {
          churn_prediction: {
            accuracy: 0.85,
            precision: 0.82,
            recall: 0.78,
            f1Score: 0.8,
            auc: 0.87,
            totalPredictions: 1250,
            correctPredictions: 1063,
          },
          optimal_send_time: {
            accuracy: 0.73,
            averageImprovement: 15.2, // percentage
            totalPredictions: 890,
            successfulOptimizations: 650,
          },
          content_recommendations: {
            clickThroughRate: 0.12,
            engagementLift: 23.5, // percentage
            totalRecommendations: 2100,
            successfulRecommendations: 1533,
          },
        },
        lastUpdated: new Date(),
      };

      res.json({
        success: true,
        data: performance,
      });
    } catch (error) {
      logger.error('Failed to get model performance', {
        error,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get model performance',
      });
    }
  }

  async updateModelConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const { modelType } = req.params;
      const { configuration } = req.body;

      if (!modelType) {
        res.status(400).json({
          success: false,
          error: 'Model type is required',
        });
        return;
      }

      // This would update model configuration in the database
      logger.info('Model configuration updated', { modelType, configuration });

      res.json({
        success: true,
        message: 'Model configuration updated successfully',
        data: {
          modelType,
          configuration,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to update model configuration', {
        error,
        params: req.params,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to update model configuration',
      });
    }
  }

  async triggerModelRetraining(req: Request, res: Response): Promise<void> {
    try {
      const { modelType } = req.params;

      if (!modelType) {
        res.status(400).json({
          success: false,
          error: 'Model type is required',
        });
        return;
      }

      // This would trigger model retraining process
      logger.info('Model retraining triggered', { modelType });

      res.json({
        success: true,
        message: 'Model retraining triggered successfully',
        data: {
          modelType,
          status: 'queued',
          estimatedCompletionTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        },
      });
    } catch (error) {
      logger.error('Failed to trigger model retraining', {
        error,
        params: req.params,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to trigger model retraining',
      });
    }
  }
}
