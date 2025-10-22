import { UserRepository } from '../../src/repositories/UserRepository';
import { UserService } from '../../src/services/UserService';
import { NotFoundError, ValidationError } from '../../src/types';

// Mock the dependencies
jest.mock('../../src/repositories/UserRepository');
jest.mock('../../src/utils/logger');

// Mock auth utilities
const mockHashPassword = jest.fn();
const mockVerifyPassword = jest.fn();
jest.mock('../../src/utils/auth', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword
}));

// Mock validation utilities
const mockValidateEmail = jest.fn();
const mockIsValidPassword = jest.fn();
jest.mock('../../src/utils/validation', () => ({
  validateEmail: mockValidateEmail,
  isValidPassword: mockIsValidPassword
}));

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
      updateStatus: jest.fn(),
      verifyEmail: jest.fn(),
      updateLastLogin: jest.fn(),
      updateEngagementMetrics: jest.fn(),
      findMany: jest.fn(),
      mapDatabaseUserToUser: jest.fn()
    } as any;

    userService = new UserService(mockUserRepository);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    mockValidateEmail.mockReturnValue(true);
    mockIsValidPassword.mockReturnValue(true);
    mockHashPassword.mockResolvedValue('hashed-password');
    mockVerifyPassword.mockResolvedValue(true);
  });

  describe('createUser', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'Password123!',
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        timezone: 'UTC',
        language: 'en'
      }
    };

    it('should create user with valid data', async () => {
      const expectedUser = {
        id: 'user-123',
        email: validUserData.email,
        profile: validUserData.profile,
        preferences: {
          emailNotifications: true,
          marketingEmails: true,
          newsletterFrequency: 'weekly' as const,
          contentTypes: [],
          theme: 'light' as const,
          timezone: 'UTC',
          language: 'en'
        },
        engagementMetrics: {
          totalLogins: 0,
          newslettersOpened: 0,
          linksClicked: 0,
          engagementScore: 0,
          averageSessionDuration: 0
        },
        status: 'active' as const,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(expectedUser);

      const result = await userService.createUser(validUserData);

      expect(result).toEqual(expectedUser);
      expect(mockHashPassword).toHaveBeenCalledWith(validUserData.password);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        ...validUserData,
        passwordHash: 'hashed-password'
      });
    });

    it('should throw ValidationError for invalid email', async () => {
      mockValidateEmail.mockReturnValue(false);

      await expect(userService.createUser({
        ...validUserData,
        email: 'invalid-email'
      })).rejects.toThrow(ValidationError);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for existing email', async () => {
      const existingUser = { id: 'existing-user', email: validUserData.email };
      mockUserRepository.findByEmail.mockResolvedValue(existingUser as any);

      await expect(userService.createUser(validUserData))
        .rejects.toThrow(ValidationError);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const userId = 'user-123';
      const expectedUser = {
        id: userId,
        email: 'test@example.com',
        profile: { firstName: 'John', lastName: 'Doe', timezone: 'UTC', language: 'en' },
        preferences: {
          emailNotifications: true,
          marketingEmails: true,
          newsletterFrequency: 'weekly' as const,
          contentTypes: [],
          theme: 'light' as const,
          timezone: 'UTC',
          language: 'en'
        },
        engagementMetrics: {
          totalLogins: 0,
          newslettersOpened: 0,
          linksClicked: 0,
          engagementScore: 0,
          averageSessionDuration: 0
        },
        status: 'active' as const,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findById.mockResolvedValue(expectedUser);

      const result = await userService.getUserById(userId);

      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundError when user not found', async () => {
      const userId = 'non-existent';
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.getUserById(userId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('authenticateUser', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    it('should authenticate user with valid credentials', async () => {
      const user = {
        id: 'user-123',
        email: credentials.email,
        passwordHash: 'hashed-password',
        profile: { firstName: 'John', lastName: 'Doe', timezone: 'UTC', language: 'en' },
        preferences: {
          emailNotifications: true,
          marketingEmails: true,
          newsletterFrequency: 'weekly' as const,
          contentTypes: [],
          theme: 'light' as const,
          timezone: 'UTC',
          language: 'en'
        },
        engagementMetrics: {
          totalLogins: 5,
          newslettersOpened: 10,
          linksClicked: 3,
          engagementScore: 75,
          averageSessionDuration: 300
        },
        status: 'active' as const,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findByEmail.mockResolvedValue(user);
      mockVerifyPassword.mockResolvedValue(true);

      const result = await userService.authenticateUser(credentials);

      expect(result).toEqual(user);
      expect(mockVerifyPassword).toHaveBeenCalledWith(credentials.password, user.passwordHash);
    });

    it('should throw ValidationError for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(userService.authenticateUser(credentials))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid password', async () => {
      const user = {
        id: 'user-123',
        email: credentials.email,
        passwordHash: 'hashed-password'
      };

      mockUserRepository.findByEmail.mockResolvedValue(user as any);
      mockVerifyPassword.mockResolvedValue(false);

      await expect(userService.authenticateUser(credentials))
        .rejects.toThrow(ValidationError);
    });
  });
});
