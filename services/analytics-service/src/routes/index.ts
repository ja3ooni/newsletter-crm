// @ts-nocheck
import { AnalyticsController } from '@/controllers/AnalyticsController';
import { PredictiveAnalyticsController } from '@/controllers/PredictiveAnalyticsController';
import { authenticateToken, optionalAuth } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import {
    defaultRateLimit,
    readOnlyRateLimit,
    strictRateLimit,
} from '@/middleware/rateLimit';
import { Router } from 'express';

const router = Router();
const analyticsController = new AnalyticsController();
const predictiveController = new PredictiveAnalyticsController();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'analytics-service',
    timestamp: new Date(),
    status: 'healthy',
  });
});

// Event tracking endpoints
router.post(
  '/events/track',
  defaultRateLimit,
  optionalAuth,
  asyncHandler(analyticsController.trackEvent.bind(analyticsController))
);

// Metrics endpoints
router.get(
  '/metrics/engagement/:contactId',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(
    analyticsController.getEngagementMetrics.bind(analyticsController)
  )
);

router.get(
  '/metrics/newsletter/:newsletterId',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(
    analyticsController.getNewsletterMetrics.bind(analyticsController)
  )
);

router.get(
  '/metrics/overview',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(analyticsController.getOverviewMetrics.bind(analyticsController))
);

router.get(
  '/metrics/realtime',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(analyticsController.getRealTimeMetrics.bind(analyticsController))
);

// Analysis endpoints
router.get(
  '/analysis/cohort',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(analyticsController.getCohortAnalysis.bind(analyticsController))
);

router.get(
  '/analysis/roi',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(analyticsController.getROICalculation.bind(analyticsController))
);

// Export endpoints
router.get(
  '/export/metrics',
  strictRateLimit,
  authenticateToken,
  asyncHandler(analyticsController.exportMetrics.bind(analyticsController))
);

export default router;

// Predictive Analytics endpoints
router.get(
  '/predictions/churn/:contactId',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(predictiveController.predictChurn.bind(predictiveController))
);

router.get(
  '/predictions/send-time/:contactId',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(
    predictiveController.predictOptimalSendTime.bind(predictiveController)
  )
);

router.get(
  '/predictions/content/:contactId',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(
    predictiveController.generateContentRecommendations.bind(
      predictiveController
    )
  )
);

router.post(
  '/predictions/ab-test/:testId/significance',
  defaultRateLimit,
  authenticateToken,
  asyncHandler(
    predictiveController.calculateABTestSignificance.bind(predictiveController)
  )
);

router.post(
  '/predictions/bulk',
  strictRateLimit,
  authenticateToken,
  asyncHandler(
    predictiveController.getBulkPredictions.bind(predictiveController)
  )
);

// Model management endpoints
router.get(
  '/models/performance',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(
    predictiveController.getModelPerformance.bind(predictiveController)
  )
);

router.put(
  '/models/:modelType/configuration',
  strictRateLimit,
  authenticateToken,
  asyncHandler(
    predictiveController.updateModelConfiguration.bind(predictiveController)
  )
);

router.post(
  '/models/:modelType/retrain',
  strictRateLimit,
  authenticateToken,
  asyncHandler(
    predictiveController.triggerModelRetraining.bind(predictiveController)
  )
);
// Dashboard endpoints
const dashboardController =
  new (require('@/controllers/DashboardController').DashboardController)(
    new (require('@/services/WebSocketService').WebSocketService)()
  );

router.post(
  '/dashboards',
  defaultRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.createDashboard.bind(dashboardController))
);

router.get(
  '/dashboards',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.getUserDashboards.bind(dashboardController))
);

router.get(
  '/dashboards/:dashboardId',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.getDashboard.bind(dashboardController))
);

router.put(
  '/dashboards/:dashboardId',
  defaultRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.updateDashboard.bind(dashboardController))
);

router.delete(
  '/dashboards/:dashboardId',
  strictRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.deleteDashboard.bind(dashboardController))
);

router.post(
  '/dashboards/:dashboardId/widgets',
  defaultRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.addWidget.bind(dashboardController))
);

router.put(
  '/dashboards/:dashboardId/widgets/:widgetId',
  defaultRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.updateWidget.bind(dashboardController))
);

router.delete(
  '/dashboards/:dashboardId/widgets/:widgetId',
  defaultRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.removeWidget.bind(dashboardController))
);

router.post(
  '/widgets/:widgetId/data',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.getWidgetData.bind(dashboardController))
);

// Reporting endpoints
const reportingController =
  new (require('@/controllers/ReportingController').ReportingController)();

router.post(
  '/reports',
  defaultRateLimit,
  authenticateToken,
  asyncHandler(reportingController.createReport.bind(reportingController))
);

router.get(
  '/reports',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(reportingController.getUserReports.bind(reportingController))
);

router.get(
  '/reports/:reportId',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(reportingController.getReport.bind(reportingController))
);

router.put(
  '/reports/:reportId',
  defaultRateLimit,
  authenticateToken,
  asyncHandler(reportingController.updateReport.bind(reportingController))
);

router.delete(
  '/reports/:reportId',
  strictRateLimit,
  authenticateToken,
  asyncHandler(reportingController.deleteReport.bind(reportingController))
);

router.post(
  '/reports/:reportId/generate',
  strictRateLimit,
  authenticateToken,
  asyncHandler(reportingController.generateReport.bind(reportingController))
);

router.get(
  '/reports/:reportId/download',
  strictRateLimit,
  authenticateToken,
  asyncHandler(reportingController.downloadReport.bind(reportingController))
);

router.get(
  '/reports/:reportId/preview',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(reportingController.previewReport.bind(reportingController))
);

router.get(
  '/admin/reports/scheduled',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(
    reportingController.getScheduledReports.bind(reportingController)
  )
);

// Dashboard cloning and export
router.post(
  '/dashboards/:dashboardId/clone',
  defaultRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.cloneDashboard.bind(dashboardController))
);

router.get(
  '/dashboards/:dashboardId/export',
  strictRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.exportDashboard.bind(dashboardController))
);

// Advanced reporting endpoints
router.get(
  '/reports/:reportId/executive-summary',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(
    reportingController.getExecutiveSummary.bind(reportingController)
  )
);

router.get(
  '/reports/templates',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(reportingController.getReportTemplates.bind(reportingController))
);

router.post(
  '/reports/templates/:templateId',
  defaultRateLimit,
  authenticateToken,
  asyncHandler(
    reportingController.createReportFromTemplate.bind(reportingController)
  )
);

// KPI and Executive Dashboard endpoints
router.get(
  '/dashboards/kpi-summary',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.getKPISummary.bind(dashboardController))
);

router.get(
  '/dashboards/realtime-metrics',
  readOnlyRateLimit,
  authenticateToken,
  asyncHandler(dashboardController.getRealtimeMetrics.bind(dashboardController))
);
