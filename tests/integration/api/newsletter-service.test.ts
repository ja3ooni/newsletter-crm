import axios from 'axios';
import { config } from 'dotenv';

// Load test environment
config({ path: '.env.test' });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const NEWSLETTER_SERVICE_URL = `${API_BASE_URL}/api/v1/newsletters`;

describe('Newsletter Service API Integration', () => {
  let authToken: string;
  let testNewsletterId: string;

  beforeAll(async () => {
    // Setup test authentication
    const authResponse = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!',
    });
    authToken = authResponse.data.token;
  });

  afterAll(async () => {
    // Cleanup test newsletter if created
    if (testNewsletterId) {
      try {
        await axios.delete(`${NEWSLETTER_SERVICE_URL}/${testNewsletterId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (error) {
        console.warn('Failed to cleanup test newsletter:', error);
      }
    }
  });

  describe('POST /api/v1/newsletters', () => {
    it('should create a new newsletter', async () => {
      const newsletterData = {
        title: `Test Newsletter ${Date.now()}`,
        content: {
          sections: [
            {
              type: 'news',
              title: 'AI News',
              items: [
                {
                  title: 'Test Article',
                  summary: 'Test summary',
                  url: 'https://example.com/test',
                  source: 'Test Source',
                },
              ],
            },
          ],
        },
        status: 'draft',
      };

      const response = await axios.post(
        NEWSLETTER_SERVICE_URL,
        newsletterData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.title).toBe(newsletterData.title);
      expect(response.data.status).toBe('draft');
      expect(response.data.content.sections).toHaveLength(1);

      testNewsletterId = response.data.id;
    });

    it('should validate required fields', async () => {
      const invalidData = {
        content: {
          sections: [],
        },
      };

      try {
        await axios.post(NEWSLETTER_SERVICE_URL, invalidData, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        fail('Expected request to fail');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('title');
      }
    });
  });

  describe('GET /api/v1/newsletters', () => {
    it('should return list of newsletters', async () => {
      const response = await axios.get(NEWSLETTER_SERVICE_URL, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.newsletters)).toBe(true);
      expect(response.data).toHaveProperty('pagination');
    });

    it('should support pagination', async () => {
      const response = await axios.get(
        `${NEWSLETTER_SERVICE_URL}?page=1&limit=5`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.pagination.page).toBe(1);
      expect(response.data.pagination.limit).toBe(5);
    });

    it('should support filtering by status', async () => {
      const response = await axios.get(
        `${NEWSLETTER_SERVICE_URL}?status=draft`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).toBe(200);
      response.data.newsletters.forEach((newsletter: any) => {
        expect(newsletter.status).toBe('draft');
      });
    });
  });

  describe('GET /api/v1/newsletters/:id', () => {
    it('should return newsletter by ID', async () => {
      const response = await axios.get(
        `${NEWSLETTER_SERVICE_URL}/${testNewsletterId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(testNewsletterId);
      expect(response.data).toHaveProperty('title');
      expect(response.data).toHaveProperty('content');
      expect(response.data).toHaveProperty('status');
    });
  });

  describe('PUT /api/v1/newsletters/:id', () => {
    it('should update newsletter', async () => {
      const updateData = {
        title: 'Updated Newsletter Title',
        content: {
          sections: [
            {
              type: 'research',
              title: 'Research Updates',
              items: [
                {
                  title: 'Updated Article',
                  summary: 'Updated summary',
                  url: 'https://example.com/updated',
                  source: 'Updated Source',
                },
              ],
            },
          ],
        },
      };

      const response = await axios.put(
        `${NEWSLETTER_SERVICE_URL}/${testNewsletterId}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.title).toBe('Updated Newsletter Title');
      expect(response.data.content.sections[0].type).toBe('research');
    });
  });

  describe('POST /api/v1/newsletters/:id/schedule', () => {
    it('should schedule newsletter for sending', async () => {
      const scheduleData = {
        scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        segments: ['all-subscribers'],
      };

      const response = await axios.post(
        `${NEWSLETTER_SERVICE_URL}/${testNewsletterId}/schedule`,
        scheduleData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('scheduled');
      expect(response.data.scheduledAt).toBeDefined();
    });
  });

  describe('POST /api/v1/newsletters/generate', () => {
    it('should generate newsletter content', async () => {
      const generateData = {
        sections: ['news', 'research'],
        personalization: {
          userId: 'test-user-id',
          preferences: {
            topics: ['ai', 'machine-learning'],
          },
        },
      };

      const response = await axios.post(
        `${NEWSLETTER_SERVICE_URL}/generate`,
        generateData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).toBe(202);
      expect(response.data).toHaveProperty('jobId');
    });
  });

  describe('GET /api/v1/newsletters/:id/metrics', () => {
    it('should return newsletter metrics', async () => {
      const response = await axios.get(
        `${NEWSLETTER_SERVICE_URL}/${testNewsletterId}/metrics`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('sent');
      expect(response.data).toHaveProperty('delivered');
      expect(response.data).toHaveProperty('opens');
      expect(response.data).toHaveProperty('clicks');
      expect(response.data).toHaveProperty('openRate');
      expect(response.data).toHaveProperty('clickRate');
    });
  });
});
