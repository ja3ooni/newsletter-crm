import axios from 'axios';
import { config } from 'dotenv';

// Load test environment
config({ path: '.env.test' });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

describe('Newsletter Creation and Distribution Flow E2E', () => {
  let authToken: string;
  let adminUserId: string;
  let testNewsletterId: string;
  let testContactId: string;
  let testSegmentId: string;

  beforeAll(async () => {
    // Setup admin authentication
    const authResponse = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!',
    });
    authToken = authResponse.data.token;
    adminUserId = authResponse.data.user.id;

    // Create test contact for newsletter distribution
    const contactResponse = await axios.post(
      `${API_BASE_URL}/api/v1/crm/contacts`,
      {
        email: `newsletter-test-${Date.now()}@example.com`,
        firstName: 'Newsletter',
        lastName: 'Subscriber',
        lifecycle: 'subscriber',
        preferences: {
          emailFrequency: 'daily',
          contentTypes: ['news', 'research'],
        },
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    testContactId = contactResponse.data.id;

    // Create test segment
    const segmentResponse = await axios.post(
      `${API_BASE_URL}/api/v1/crm/segments`,
      {
        name: `E2E Test Segment ${Date.now()}`,
        description: 'Test segment for newsletter E2E testing',
        conditions: [
          {
            field: 'lifecycle',
            operator: 'equals',
            value: 'subscriber',
          },
        ],
        isAutoUpdating: true,
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    testSegmentId = segmentResponse.data.id;
  });

  afterAll(async () => {
    // Cleanup test data
    const cleanupPromises = [];

    if (testNewsletterId) {
      cleanupPromises.push(
        axios
          .delete(`${API_BASE_URL}/api/v1/newsletters/${testNewsletterId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          })
          .catch(console.warn)
      );
    }

    if (testContactId) {
      cleanupPromises.push(
        axios
          .delete(`${API_BASE_URL}/api/v1/crm/contacts/${testContactId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          })
          .catch(console.warn)
      );
    }

    if (testSegmentId) {
      cleanupPromises.push(
        axios
          .delete(`${API_BASE_URL}/api/v1/crm/segments/${testSegmentId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          })
          .catch(console.warn)
      );
    }

    await Promise.all(cleanupPromises);
  });

  describe('Complete Newsletter Creation Flow', () => {
    it('should create, customize, and schedule newsletter', async () => {
      // Step 1: Generate newsletter content
      const contentGenerationResponse = await axios.post(
        `${API_BASE_URL}/api/v1/newsletters/generate`,
        {
          sections: ['news', 'research', 'github'],
          personalization: {
            topics: ['artificial-intelligence', 'web-development'],
            difficulty: 'intermediate',
          },
          contentFilters: {
            minScore: 0.7,
            maxAge: 24, // hours
            sources: ['techcrunch', 'github', 'arxiv'],
          },
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(contentGenerationResponse.status).toBe(202);
      expect(contentGenerationResponse.data).toHaveProperty('jobId');

      // Step 2: Wait for content generation to complete
      const jobId = contentGenerationResponse.data.jobId;
      let generatedContent = null;
      let attempts = 0;
      const maxAttempts = 15;

      while (!generatedContent && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await axios.get(
          `${API_BASE_URL}/api/v1/newsletters/jobs/${jobId}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        if (statusResponse.data.status === 'completed') {
          generatedContent = statusResponse.data.result;
        }

        attempts++;
      }

      expect(generatedContent).toBeTruthy();
      expect(generatedContent.content.sections.length).toBeGreaterThan(0);

      // Step 3: Create newsletter with generated content
      const newsletterData = {
        title: `E2E Test Newsletter ${Date.now()}`,
        content: generatedContent.content,
        template: 'modern-tech',
        personalization: {
          enableDynamicContent: true,
          personalizeSubject: true,
        },
      };

      const newsletterResponse = await axios.post(
        `${API_BASE_URL}/api/v1/newsletters`,
        newsletterData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(newsletterResponse.status).toBe(201);
      expect(newsletterResponse.data.title).toBe(newsletterData.title);
      expect(newsletterResponse.data.status).toBe('draft');

      testNewsletterId = newsletterResponse.data.id;

      // Step 4: Customize newsletter template
      const templateCustomization = {
        template: {
          primaryColor: '#2563eb',
          fontFamily: 'Inter',
          headerImage: 'https://example.com/header.jpg',
          customCSS:
            '.newsletter-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }',
        },
      };

      const customizationResponse = await axios.put(
        `${API_BASE_URL}/api/v1/newsletters/${testNewsletterId}/template`,
        templateCustomization,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(customizationResponse.status).toBe(200);

      // Step 5: Set up A/B testing
      const abTestData = {
        name: 'Subject Line Test',
        type: 'subject',
        variants: [
          {
            name: 'Original',
            content: 'Your Weekly AI Update',
          },
          {
            name: 'Personalized',
            content: 'AI News Tailored for You',
          },
        ],
        trafficSplit: [50, 50],
        winnerCriteria: 'open_rate',
        duration: 24, // hours
      };

      const abTestResponse = await axios.post(
        `${API_BASE_URL}/api/v1/newsletters/${testNewsletterId}/ab-test`,
        abTestData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(abTestResponse.status).toBe(201);
      expect(abTestResponse.data.variants).toHaveLength(2);

      // Step 6: Preview newsletter
      const previewResponse = await axios.get(
        `${API_BASE_URL}/api/v1/newsletters/${testNewsletterId}/preview`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(previewResponse.status).toBe(200);
      expect(previewResponse.data).toHaveProperty('html');
      expect(previewResponse.data).toHaveProperty('text');
      expect(previewResponse.data.html).toContain('newsletter-header');

      // Step 7: Schedule newsletter
      const scheduleData = {
        scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        segments: [testSegmentId],
        sendOptions: {
          enableTracking: true,
          enablePersonalization: true,
          respectTimezones: true,
        },
      };

      const scheduleResponse = await axios.post(
        `${API_BASE_URL}/api/v1/newsletters/${testNewsletterId}/schedule`,
        scheduleData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(scheduleResponse.status).toBe(200);
      expect(scheduleResponse.data.status).toBe('scheduled');
      expect(scheduleResponse.data.scheduledAt).toBeDefined();
      expect(scheduleResponse.data.targetSegments).toContain(testSegmentId);
    });

    it('should handle newsletter approval workflow', async () => {
      // Step 1: Create newsletter requiring approval
      const newsletterData = {
        title: `Approval Test Newsletter ${Date.now()}`,
        content: {
          sections: [
            {
              type: 'news',
              title: 'Test News',
              items: [
                {
                  title: 'Test Article',
                  summary: 'Test summary',
                  url: 'https://example.com/test',
                },
              ],
            },
          ],
        },
        requiresApproval: true,
      };

      const newsletterResponse = await axios.post(
        `${API_BASE_URL}/api/v1/newsletters`,
        newsletterData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const approvalNewsletterId = newsletterResponse.data.id;

      // Step 2: Submit for approval
      const submissionResponse = await axios.post(
        `${API_BASE_URL}/api/v1/newsletters/${approvalNewsletterId}/submit-approval`,
        {
          message: 'Ready for review',
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(submissionResponse.status).toBe(200);
      expect(submissionResponse.data.status).toBe('pending_approval');

      // Step 3: Approve newsletter
      const approvalResponse = await axios.post(
        `${API_BASE_URL}/api/v1/newsletters/${approvalNewsletterId}/approve`,
        {
          approved: true,
          comments: 'Looks good!',
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(approvalResponse.status).toBe(200);
      expect(approvalResponse.data.status).toBe('approved');

      // Cleanup
      await axios.delete(
        `${API_BASE_URL}/api/v1/newsletters/${approvalNewsletterId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
    });
  });

  describe('Newsletter Distribution and Tracking', () => {
    it('should distribute newsletter and track engagement', async () => {
      // Step 1: Send newsletter immediately (for testing)
      const sendResponse = await axios.post(
        `${API_BASE_URL}/api/v1/newsletters/${testNewsletterId}/send`,
        {
          segments: [testSegmentId],
          sendOptions: {
            enableTracking: true,
            testMode: true, // Prevents actual email sending
          },
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(sendResponse.status).toBe(202);
      expect(sendResponse.data).toHaveProperty('jobId');

      // Step 2: Wait for sending to complete
      const sendJobId = sendResponse.data.jobId;
      let sendingComplete = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!sendingComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await axios.get(
          `${API_BASE_URL}/api/v1/newsletters/jobs/${sendJobId}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        if (statusResponse.data.status === 'completed') {
          sendingComplete = true;
        }

        attempts++;
      }

      expect(sendingComplete).toBe(true);

      // Step 3: Verify newsletter metrics
      const metricsResponse = await axios.get(
        `${API_BASE_URL}/api/v1/newsletters/${testNewsletterId}/metrics`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.data.sent).toBeGreaterThan(0);
      expect(metricsResponse.data).toHaveProperty('delivered');
      expect(metricsResponse.data).toHaveProperty('openRate');
      expect(metricsResponse.data).toHaveProperty('clickRate');

      // Step 4: Simulate engagement tracking
      const engagementEvents = [
        {
          event: 'newsletter_open',
          contactId: testContactId,
          newsletterId: testNewsletterId,
          timestamp: new Date().toISOString(),
        },
        {
          event: 'article_click',
          contactId: testContactId,
          newsletterId: testNewsletterId,
          articleUrl: 'https://example.com/article-1',
          timestamp: new Date().toISOString(),
        },
      ];

      for (const event of engagementEvents) {
        const trackingResponse = await axios.post(
          `${API_BASE_URL}/api/v1/analytics/track`,
          event,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );
        expect(trackingResponse.status).toBe(200);
      }

      // Step 5: Verify updated metrics
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for metrics to update

      const updatedMetricsResponse = await axios.get(
        `${API_BASE_URL}/api/v1/newsletters/${testNewsletterId}/metrics`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(updatedMetricsResponse.status).toBe(200);
      expect(updatedMetricsResponse.data.opens).toBeGreaterThan(0);
      expect(updatedMetricsResponse.data.clicks).toBeGreaterThan(0);
    });

    it('should handle A/B test winner determination', async () => {
      // Wait for A/B test to have some data
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get A/B test results
      const abTestResponse = await axios.get(
        `${API_BASE_URL}/api/v1/newsletters/${testNewsletterId}/ab-test`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(abTestResponse.status).toBe(200);
      expect(abTestResponse.data).toHaveProperty('variants');
      expect(abTestResponse.data.variants).toHaveLength(2);

      // Manually determine winner (for testing)
      const winnerResponse = await axios.post(
        `${API_BASE_URL}/api/v1/newsletters/${testNewsletterId}/ab-test/determine-winner`,
        {
          force: true, // Force winner determination for testing
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(winnerResponse.status).toBe(200);
      expect(winnerResponse.data).toHaveProperty('winner');
      expect(winnerResponse.data.status).toBe('completed');
    });
  });

  describe('Newsletter Performance Analytics', () => {
    it('should provide comprehensive analytics dashboard', async () => {
      // Get newsletter performance analytics
      const analyticsResponse = await axios.get(
        `${API_BASE_URL}/api/v1/analytics/newsletters/${testNewsletterId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.data).toHaveProperty('overview');
      expect(analyticsResponse.data).toHaveProperty('engagement');
      expect(analyticsResponse.data).toHaveProperty('demographics');
      expect(analyticsResponse.data).toHaveProperty('timeline');

      // Verify engagement metrics
      expect(analyticsResponse.data.engagement).toHaveProperty('openRate');
      expect(analyticsResponse.data.engagement).toHaveProperty('clickRate');
      expect(analyticsResponse.data.engagement).toHaveProperty(
        'unsubscribeRate'
      );

      // Get comparative analytics
      const compareResponse = await axios.get(
        `${API_BASE_URL}/api/v1/analytics/newsletters/compare`,
        {
          params: {
            newsletters: [testNewsletterId],
            timeframe: '30d',
          },
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(compareResponse.status).toBe(200);
      expect(Array.isArray(compareResponse.data.comparisons)).toBe(true);
    });
  });
});
