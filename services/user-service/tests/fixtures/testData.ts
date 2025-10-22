import { CreateUserRequest, UpdateUserRequest, User, UserPreferences } from '../../src/types';

export const mockUserPreferences: UserPreferences = {
  emailNotifications: true,
  marketingEmails: true,
  newsletterFrequency: 'weekly',
  contentTypes: ['technology', 'ai'],
  theme: 'light',
  timezone: 'UTC',
  language: 'en'
};

export const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  passwordHash: 'hashed-password-123',
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    timezone: 'UTC',
    language: 'en',
    avatar: 'https://example.com/avatar.jpg',
    company: 'Test Corp',
    jobTitle: 'Developer'
  },
  preferences: mockUserPreferences,
  engagementMetrics: {
    totalLogins: 25,
    newslettersOpened: 10,
    linksClicked: 5,
    engagementScore: 85,
    averageSessionDuration: 300,
    lastLoginAt: new Date('2024-01-15')
  },
  status: 'active',
  emailVerified: true,
  emailVerifiedAt: new Date('2024-01-01'),
  lastLoginAt: new Date('2024-01-15'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15')
};

export const validCreateUserRequest: CreateUserRequest = {
  email: 'newuser@example.com',
  password: 'SecurePassword123!',
  profile: {
    firstName: 'Jane',
    lastName: 'Smith',
    timezone: 'UTC',
    language: 'en'
  }
};

export const validUpdateUserRequest: UpdateUserRequest = {
  profile: {
    firstName: 'Jane',
    lastName: 'Doe',
    company: 'New Corp'
  }
};

export const invalidEmailUser: CreateUserRequest = {
  email: 'invalid-email',
  password: 'SecurePassword123!',
  profile: {
    firstName: 'Test',
    lastName: 'User',
    timezone: 'UTC',
    language: 'en'
  }
};

export const weakPasswordUser: CreateUserRequest = {
  email: 'test@example.com',
  password: '123',
  profile: {
    firstName: 'Test',
    lastName: 'User',
    timezone: 'UTC',
    language: 'en'
  }
};

export const incompleteUser: Partial<CreateUserRequest> = {
  email: 'test@example.com'
  // Missing password and profile
};
