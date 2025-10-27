import axios from 'axios';
import { config } from 'dotenv';

// Load test environment
config({ path: '.env.test' });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const USER_SERVICE_URL = `${API_BASE_URL}/api/v1/users`;

describe('User Service API Integration', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Setup test authentication
    const authResponse = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!',
    });
    authToken = authResponse.data.token;
  });

  afterAll(async () => {
    // Cleanup test user if created
    if (testUserId) {
      try {
        await axios.delete(`${USER_SERVICE_URL}/${testUserId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (error) {
        console.warn('Failed to cleanup test user:', error);
      }
    }
  });

  describe('POST /api/v1/users', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        profile: {
          firstName: 'Test',
          lastName: 'User',
          timezone: 'UTC',
        },
      };

      const response = await axios.post(USER_SERVICE_URL, userData, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.email).toBe(userData.email);
      expect(response.data.profile.firstName).toBe(userData.profile.firstName);
      expect(response.data).not.toHaveProperty('password');
      expect(response.data).not.toHaveProperty('passwordHash');

      testUserId = response.data.id;
    });

    it('should return 400 for invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
        profile: {
          firstName: 'Test',
          lastName: 'User',
        },
      };

      try {
        await axios.post(USER_SERVICE_URL, userData, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        fail('Expected request to fail');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('email');
      }
    });

    it('should return 400 for weak password', async () => {
      const userData = {
        email: `test-weak-${Date.now()}@example.com`,
        password: '123',
        profile: {
          firstName: 'Test',
          lastName: 'User',
        },
      };

      try {
        await axios.post(USER_SERVICE_URL, userData, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        fail('Expected request to fail');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('password');
      }
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return user by ID', async () => {
      const response = await axios.get(`${USER_SERVICE_URL}/${testUserId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(testUserId);
      expect(response.data).toHaveProperty('email');
      expect(response.data).toHaveProperty('profile');
      expect(response.data).not.toHaveProperty('password');
    });

    it('should return 404 for non-existent user', async () => {
      try {
        await axios.get(`${USER_SERVICE_URL}/non-existent-id`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        fail('Expected request to fail');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });
  });

  describe('PUT /api/v1/users/:id', () => {
    it('should update user profile', async () => {
      const updateData = {
        profile: {
          firstName: 'Updated',
          lastName: 'Name',
          company: 'Test Company',
        },
      };

      const response = await axios.put(
        `${USER_SERVICE_URL}/${testUserId}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.profile.firstName).toBe('Updated');
      expect(response.data.profile.lastName).toBe('Name');
      expect(response.data.profile.company).toBe('Test Company');
    });
  });

  describe('PUT /api/v1/users/:id/preferences', () => {
    it('should update user preferences', async () => {
      const preferences = {
        contentSections: ['news', 'research'],
        frequency: 'weekly',
        format: 'html',
        topics: ['ai', 'technology'],
        timezone: 'America/New_York',
      };

      const response = await axios.put(
        `${USER_SERVICE_URL}/${testUserId}/preferences`,
        preferences,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.preferences.frequency).toBe('weekly');
      expect(response.data.preferences.topics).toEqual(['ai', 'technology']);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 for requests without token', async () => {
      try {
        await axios.get(`${USER_SERVICE_URL}/${testUserId}`);
        fail('Expected request to fail');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should return 401 for requests with invalid token', async () => {
      try {
        await axios.get(`${USER_SERVICE_URL}/${testUserId}`, {
          headers: { Authorization: 'Bearer invalid-token' },
        });
        fail('Expected request to fail');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });
});
