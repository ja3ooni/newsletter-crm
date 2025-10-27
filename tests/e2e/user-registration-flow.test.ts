import axios from 'axios';
import { config } from 'dotenv';

// Load test environment
config({ path: '.env.test' });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

describe('User Registration and Onboarding Flow E2E', () => {
  let testUserEmail: string;
  let authToken: string;
  let userId: string;

  beforeAll(() => {
    testUserEmail = `e2e-test-${Date.now()}@example.com`;
  });

  afterAll(async () => {
    // Cleanup test user
    if (userId && authToken) {
      try {
        await axios.delete(`${API_BASE_URL}/api/v1/users/${userId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (error) {
        console.warn('Failed to cleanup test user:', error);
      }
    }
  });

  describe('Complete User Registration Flow', () => {
    it('should complete full user registration and onboarding', async () => {
      // Step 1: User Registration
      const registrationData = {
        email: testUserEmail,
        password: 'TestPassword123!',
        profile: {
          firstName: 'E2E',
          lastName: 'Test',
          timezone: 'America/New_York',
        },
      };

      const registrationResponse = await axios.post(
        `${API_BASE_URL}/api/v1/auth/register`,
        registrationData
      );

      expect(registrationResponse.status).toBe(201);
      expect(registrationResponse.data).toHaveProperty('user');
      expect(registrationResponse.data).toHaveProperty('token');
      expect(registrationResponse.data.user.email).toBe(testUserEmail);

      authToken = registrationResponse.data.token;
      userId = registrationResponse.data.user.id;

      // Step 2: Email Verification (simulate)
      const verificationResponse = await axios.post(
        `${API_BASE_URL}/api/v1/auth/verify-email`,
        {
          token: 'mock-verification-token',
          userId: userId,
        }
      );

      expect(verificationResponse.status).toBe(200);

      // Step 3: Set User Preferences
      const preferences = {
        contentSections: ['news', 'research', 'github'],
        frequency: 'daily',
        format: 'html',
        topics: [
          'artificial-intelligence',
          'machine-learning',
          'web-development',
        ],
        sendTime: '09:00',
        timezone: 'America/New_York',
      };

      const preferencesResponse = await axios.put(
        `${API_BASE_URL}/api/v1/users/${userId}/preferences`,
        preferences,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(preferencesResponse.status).toBe(200);
      expect(preferencesResponse.data.preferences.frequency).toBe('daily');
      expect(preferencesResponse.data.preferences.topics).toContain(
        'artificial-intelligence'
      );

      // Step 4: Subscribe to Newsletter
      const subscriptionResponse = await axios.post(
        `${API_BASE_URL}/api/v1/subscriptions`,
        {
          userId: userId,
          type: 'newsletter',
          preferences: preferences,
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(subscriptionResponse.status).toBe(201);
      expect(subscriptionResponse.data.status).toBe('active');

      // Step 5: Generate First Personalized Newsletter
      const newsletterGenerationResponse = await axios.post(
        `${API_BASE_URL}/api/v1/newsletters/generate`,
        {
          userId: userId,
          sections: preferences.contentSections,
          personalization: {
            topics: preferences.topics,
            format: preferences.format,
          },
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(newsletterGenerationResponse.status).toBe(202);
      expect(newsletterGenerationResponse.data).toHaveProperty('jobId');

      // Step 6: Check Newsletter Generation Status
      const jobId = newsletterGenerationResponse.data.jobId;
      let generationComplete = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!generationComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

        const statusResponse = await axios.get(
          `${API_BASE_URL}/api/v1/newsletters/jobs/${jobId}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        if (statusResponse.data.status === 'completed') {
          generationComplete = true;
          expect(statusResponse.data.result).toHaveProperty('id');
          expect(
            statusResponse.data.result.content.sections.length
          ).toBeGreaterThan(0);
        }

        attempts++;
      }

      expect(generationComplete).toBe(true);

      // Step 7: Verify User Dashboard Access
      const dashboardResponse = await axios.get(
        `${API_BASE_URL}/api/v1/users/${userId}/dashboard`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.data).toHaveProperty('user');
      expect(dashboardResponse.data).toHaveProperty('recentNewsletters');
      expect(dashboardResponse.data).toHaveProperty('engagementMetrics');
    });

    it('should handle registration with OAuth provider', async () => {
      const oauthData = {
        provider: 'google',
        providerId: 'google-test-id-123',
        email: `oauth-${Date.now()}@example.com`,
        profile: {
          firstName: 'OAuth',
          lastName: 'User',
          avatar: 'https://example.com/avatar.jpg',
        },
      };

      const oauthResponse = await axios.post(
        `${API_BASE_URL}/api/v1/auth/oauth`,
        oauthData
      );

      expect(oauthResponse.status).toBe(201);
      expect(oauthResponse.data.user.email).toBe(oauthData.email);
      expect(oauthResponse.data.user.profile.firstName).toBe('OAuth');
      expect(oauthResponse.data).toHaveProperty('token');

      // Cleanup OAuth user
      const oauthUserId = oauthResponse.data.user.id;
      const oauthToken = oauthResponse.data.token;

      await axios.delete(`${API_BASE_URL}/api/v1/users/${oauthUserId}`, {
        headers: { Authorization: `Bearer ${oauthToken}` },
      });
    });
  });

  describe('Newsletter Engagement Flow', () => {
    it('should track user engagement with newsletter', async () => {
      // Step 1: Get user's latest newsletter
      const newslettersResponse = await axios.get(
        `${API_BASE_URL}/api/v1/users/${userId}/newsletters`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(newslettersResponse.status).toBe(200);
      expect(newslettersResponse.data.newsletters.length).toBeGreaterThan(0);

      const latestNewsletter = newslettersResponse.data.newsletters[0];

      // Step 2: Simulate newsletter open
      const openResponse = await axios.post(
        `${API_BASE_URL}/api/v1/analytics/track`,
        {
          event: 'newsletter_open',
          userId: userId,
          newsletterId: latestNewsletter.id,
          timestamp: new Date().toISOString(),
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(openResponse.status).toBe(200);

      // Step 3: Simulate article click
      const clickResponse = await axios.post(
        `${API_BASE_URL}/api/v1/analytics/track`,
        {
          event: 'article_click',
          userId: userId,
          newsletterId: latestNewsletter.id,
          articleUrl: 'https://example.com/article-1',
          timestamp: new Date().toISOString(),
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(clickResponse.status).toBe(200);

      // Step 4: Verify engagement tracking
      const engagementResponse = await axios.get(
        `${API_BASE_URL}/api/v1/users/${userId}/engagement`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(engagementResponse.status).toBe(200);
      expect(engagementResponse.data.totalOpens).toBeGreaterThan(0);
      expect(engagementResponse.data.totalClicks).toBeGreaterThan(0);
      expect(engagementResponse.data.engagementScore).toBeGreaterThan(0);
    });
  });

  describe('Subscription Management Flow', () => {
    it('should allow user to upgrade to premium subscription', async () => {
      // Step 1: Get available subscription plans
      const plansResponse = await axios.get(
        `${API_BASE_URL}/api/v1/billing/plans`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(plansResponse.status).toBe(200);
      expect(Array.isArray(plansResponse.data.plans)).toBe(true);

      const premiumPlan = plansResponse.data.plans.find(
        (plan: any) => plan.name === 'premium'
      );
      expect(premiumPlan).toBeDefined();

      // Step 2: Create subscription (simulate payment)
      const subscriptionData = {
        planId: premiumPlan.id,
        paymentMethodId: 'pm_test_card_visa', // Stripe test payment method
        billingCycle: 'monthly',
      };

      const subscriptionResponse = await axios.post(
        `${API_BASE_URL}/api/v1/billing/subscriptions`,
        subscriptionData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(subscriptionResponse.status).toBe(201);
      expect(subscriptionResponse.data.status).toBe('active');
      expect(subscriptionResponse.data.plan.name).toBe('premium');

      // Step 3: Verify premium features access
      const featuresResponse = await axios.get(
        `${API_BASE_URL}/api/v1/users/${userId}/features`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(featuresResponse.status).toBe(200);
      expect(featuresResponse.data.premiumFeatures).toBe(true);
      expect(featuresResponse.data.availableFeatures).toContain(
        'advanced-analytics'
      );
      expect(featuresResponse.data.availableFeatures).toContain(
        'custom-branding'
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network failures gracefully', async () => {
      // Simulate network timeout
      const timeoutConfig = {
        timeout: 1, // 1ms timeout to force failure
        headers: { Authorization: `Bearer ${authToken}` },
      };

      try {
        await axios.get(
          `${API_BASE_URL}/api/v1/users/${userId}`,
          timeoutConfig
        );
        fail('Expected request to timeout');
      } catch (error: any) {
        expect(error.code).toBe('ECONNABORTED');
      }

      // Verify service recovers with normal timeout
      const recoveryResponse = await axios.get(
        `${API_BASE_URL}/api/v1/users/${userId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(recoveryResponse.status).toBe(200);
    });

    it('should handle invalid authentication gracefully', async () => {
      try {
        await axios.get(`${API_BASE_URL}/api/v1/users/${userId}`, {
          headers: { Authorization: 'Bearer invalid-token' },
        });
        fail('Expected request to fail');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data).toHaveProperty('message');
      }
    });
  });
});
