import axios from 'axios';
import { config } from 'dotenv';

// Load test environment
config({ path: '.env.test' });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const CRM_SERVICE_URL = `${API_BASE_URL}/api/v1/crm`;

describe('CRM Service API Integration', () => {
  let authToken: string;
  let testContactId: string;
  let testSegmentId: string;

  beforeAll(async () => {
    // Setup test authentication
    const authResponse = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!',
    });
    authToken = authResponse.data.token;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testContactId) {
      try {
        await axios.delete(`${CRM_SERVICE_URL}/contacts/${testContactId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (error) {
        console.warn('Failed to cleanup test contact:', error);
      }
    }
    if (testSegmentId) {
      try {
        await axios.delete(`${CRM_SERVICE_URL}/segments/${testSegmentId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (error) {
        console.warn('Failed to cleanup test segment:', error);
      }
    }
  });

  describe('Contact Management', () => {
    describe('POST /api/v1/crm/contacts', () => {
      it('should create a new contact', async () => {
        const contactData = {
          email: `test-contact-${Date.now()}@example.com`,
          firstName: 'Test',
          lastName: 'Contact',
          company: 'Test Company',
          jobTitle: 'Software Engineer',
          customFields: {
            industry: 'Technology',
            companySize: '50-100',
          },
          tags: ['test', 'integration'],
          source: 'api-test',
        };

        const response = await axios.post(
          `${CRM_SERVICE_URL}/contacts`,
          contactData,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.email).toBe(contactData.email);
        expect(response.data.firstName).toBe(contactData.firstName);
        expect(response.data.customFields.industry).toBe('Technology');
        expect(response.data.tags).toEqual(['test', 'integration']);
        expect(response.data.leadScore).toBe(0);
        expect(response.data.lifecycle).toBe('subscriber');

        testContactId = response.data.id;
      });

      it('should validate required fields', async () => {
        const invalidData = {
          firstName: 'Test',
          // Missing email
        };

        try {
          await axios.post(`${CRM_SERVICE_URL}/contacts`, invalidData, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          fail('Expected request to fail');
        } catch (error: any) {
          expect(error.response.status).toBe(400);
          expect(error.response.data.message).toContain('email');
        }
      });

      it('should prevent duplicate email addresses', async () => {
        const duplicateData = {
          email: `test-contact-${Date.now()}@example.com`,
          firstName: 'Duplicate',
          lastName: 'Contact',
        };

        // Create first contact
        await axios.post(`${CRM_SERVICE_URL}/contacts`, duplicateData, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        // Try to create duplicate
        try {
          await axios.post(`${CRM_SERVICE_URL}/contacts`, duplicateData, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          fail('Expected request to fail');
        } catch (error: any) {
          expect(error.response.status).toBe(409);
          expect(error.response.data.message).toContain('email');
        }
      });
    });

    describe('GET /api/v1/crm/contacts', () => {
      it('should return list of contacts with pagination', async () => {
        const response = await axios.get(`${CRM_SERVICE_URL}/contacts`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data.contacts)).toBe(true);
        expect(response.data).toHaveProperty('pagination');
      });

      it('should support filtering by lifecycle stage', async () => {
        const response = await axios.get(
          `${CRM_SERVICE_URL}/contacts?lifecycle=subscriber`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(200);
        response.data.contacts.forEach((contact: any) => {
          expect(contact.lifecycle).toBe('subscriber');
        });
      });

      it('should support search by email', async () => {
        const response = await axios.get(
          `${CRM_SERVICE_URL}/contacts?search=test-contact`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.contacts.length).toBeGreaterThan(0);
      });
    });

    describe('PUT /api/v1/crm/contacts/:id', () => {
      it('should update contact information', async () => {
        const updateData = {
          jobTitle: 'Senior Software Engineer',
          customFields: {
            industry: 'Technology',
            companySize: '100-500',
            experience: '5+ years',
          },
          tags: ['test', 'integration', 'senior'],
        };

        const response = await axios.put(
          `${CRM_SERVICE_URL}/contacts/${testContactId}`,
          updateData,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.jobTitle).toBe('Senior Software Engineer');
        expect(response.data.customFields.experience).toBe('5+ years');
        expect(response.data.tags).toContain('senior');
      });
    });

    describe('POST /api/v1/crm/contacts/:id/score', () => {
      it('should update contact lead score', async () => {
        const scoreData = {
          points: 25,
          reason: 'Email opened',
          eventType: 'email_open',
        };

        const response = await axios.post(
          `${CRM_SERVICE_URL}/contacts/${testContactId}/score`,
          scoreData,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.leadScore).toBe(25);
        expect(response.data.engagementHistory).toHaveLength(1);
        expect(response.data.engagementHistory[0].type).toBe('email_open');
      });
    });
  });

  describe('Segmentation', () => {
    describe('POST /api/v1/crm/segments', () => {
      it('should create a new segment', async () => {
        const segmentData = {
          name: `Test Segment ${Date.now()}`,
          description: 'Test segment for integration testing',
          conditions: [
            {
              field: 'lifecycle',
              operator: 'equals',
              value: 'subscriber',
            },
            {
              field: 'leadScore',
              operator: 'greater_than',
              value: 20,
              logicalOperator: 'AND',
            },
          ],
          isAutoUpdating: true,
        };

        const response = await axios.post(
          `${CRM_SERVICE_URL}/segments`,
          segmentData,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.name).toBe(segmentData.name);
        expect(response.data.conditions).toHaveLength(2);
        expect(response.data.isAutoUpdating).toBe(true);

        testSegmentId = response.data.id;
      });
    });

    describe('GET /api/v1/crm/segments/:id/contacts', () => {
      it('should return contacts in segment', async () => {
        const response = await axios.get(
          `${CRM_SERVICE_URL}/segments/${testSegmentId}/contacts`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data.contacts)).toBe(true);
        expect(response.data).toHaveProperty('count');
      });
    });
  });

  describe('Lead Scoring', () => {
    describe('POST /api/v1/crm/scoring-rules', () => {
      it('should create a lead scoring rule', async () => {
        const ruleData = {
          name: 'Email Click Scoring',
          trigger: {
            type: 'email_click',
            conditions: {
              linkType: 'article',
            },
          },
          points: 15,
          isActive: true,
        };

        const response = await axios.post(
          `${CRM_SERVICE_URL}/scoring-rules`,
          ruleData,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(201);
        expect(response.data.name).toBe(ruleData.name);
        expect(response.data.points).toBe(15);
        expect(response.data.isActive).toBe(true);
      });
    });
  });

  describe('Contact Journey', () => {
    describe('GET /api/v1/crm/contacts/:id/journey', () => {
      it('should return contact engagement journey', async () => {
        const response = await axios.get(
          `${CRM_SERVICE_URL}/contacts/${testContactId}/journey`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data.events)).toBe(true);
        expect(response.data).toHaveProperty('timeline');
        expect(response.data).toHaveProperty('summary');
      });
    });
  });
});
