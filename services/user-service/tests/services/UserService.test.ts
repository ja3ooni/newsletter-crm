import { UserRepository } from '../../src/repositories/UserRepository';
import { UserService } from '../../src/services/UserService';
import { NotFoundError, ValidationError } from '../../src/types';
import {
    incompleteUser,
    invalidEmailUser,
    mockUser,
    validCreateUserRequest,
    weakPasswordUser
} from '../fixtures/testData';
import { createMockUserRepository } from '../mocks/repositories';

// Mock the repository and utilities
jest.mock('../../src/repositories/UserRepository');
jest.mock('../../src/utils/logger');

// Mock auth utilities
const mockHashPassword = jest.fn();
const mockVerifyPassword = jest.fn();
jest.mock('../../src/utils/auth', () => ({
  AuthUtils: {
    hashPassword: mockHashPassword,
    verifyPassword: mockVerifyPassword
  }
}));

// Mock validation utilities
const mockIsValidEmail = jest.fn();
const mockIsValidPassword = jest.fn();
jest.mock('../../src/utils/validation', () => ({
  isValidEmail: mockIsValidEmail,
  isValidPassword: mockIsValidPassword
}));

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    userService = new UserService(mockUserRepository);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    mockIsValidEmail.mockReturnValue(true);
    mockIsValidPassword.mockReturnValue(true);
    mockHashPassword.mockResolvedValue('hashed-password');
    mockVerifyPassword.mockResolvedValue(true);
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const expectedUser = { ...mockUser, id: 'new-user-123' };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(expectedUser);

      const result = await userService.createUser(validCreateUserRequest);

      expect(result).toEqual(expectedUser);
      expect(mockIsValidEmail).toHaveBeenCalledWith(validCreateUserRequest.email);
      expect(mockIsValidPassword).toHaveBeenCalledWith(validCreateUserRequest.password);
      expect(mockHashPassword).toHaveBeenCalledWith(validCreateUserRequest.password);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        ...validCreateUserRequest,
        passwordHash: 'hashed-password'
      });
    });

    it('should throw ValidationError for invalid email', async () => {
      mockIsValidEmail.mockReturnValue(false);

      await expect(userService.createUser(invalidEmailUser))
        .rejects.toThrow(ValidationError);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for weak password', async () => {
      mockIsValidPassword.mockReturnValue(false);

      await expect(userService.createUser(weakPasswordUser))
        .rejects.toThrow(ValidationError);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for existing email', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(userService.createUser(validCreateUserRequest))
        .rejects.toThrow(ValidationError);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for missing required fields', async () => {
      await expect(userService.createUser(incompleteUser as any))
        .rejects.toThrow(ValidationError);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should create user without password for OAuth users', async () => {
      const oauthUserData = {
        email: 'oauth@example.com',
        profile: {
          firstName: 'OAuth',
          lastName: 'User',
          timezone: 'UTC',
          language: 'en'
        }
      };

      const expectedUser = { ...mockUser, email: oauthUserData.email, passwordHash: undefined };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(expectedUser);

      const result = await userService.createUser(oauthUserData);

      expect(result).toEqual(expectedUser);
      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        ...oauthUserData,
        passwordHash: undefined
      });
    });

    it('should handle repository errors gracefully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(userService.createUser(validCreateUserRequest))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle password hashing errors', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockHashPassword.mockRejectedValue(new Error('Hashing failed'));

      await expect(userService.createUser(validCreateUserRequest))
        .rejects.toThrow('Hashing failed');
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const userId = 'user-123';
      const expectedUser = {
        id: userId,
        email: 'test@example.com',
        profile: { firstName: 'John', lastName: 'Doe' },
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

  describe('updateUser', () => {
    const userId = 'user-123';
    const updateData = {
      profile: {
        firstName: 'Jane',
        lastName: 'Smith'
      }
    };

    it('should update user successfully', async () => {
      const updatedUser = {
        id: userId,
        email: 'test@example.com',
        profile: updateData.profile,
        preferences: {
          contentSections: [],
          frequency: 'weekly' as const,
          format: 'html' as const,
          topics: [],
          sendTime: '09:00',
          timezone: 'UTC'
        },
        updatedAt: new Date(),
        createdAt: new Date()
      };

      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUser(userId, updateData);

      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, updateData);
    });

    it('should update user email if valid and not taken', async () => {
      const emailUpdateData = {
        email: 'newemail@example.com'
      };

      const updatedUser = {
        id: userId,
        email: emailUpdateData.email,
        profile: { firstName: 'John', lastName: 'Doe' },
        preferences: {
          contentSections: [],
          frequency: 'weekly' as const,
          format: 'html' as const,
          topics: [],
          sendTime: '09:00',
          timezone: 'UTC'
        },
        updatedAt: new Date(),
        createdAt: new Date()
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUser(userId, emailUpdateData);

      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(emailUpdateData.email);
    });

    it('should throw ValidationError when email is taken by another user', async () => {
      const emailUpdateData = {
        email: 'taken@example.com'
      };

      const existingUser = { id: 'other-user', email: emailUpdateData.email };
      mockUserRepository.findByEmail.mockResolvedValue(existingUser as any);

      await expect(userService.updateUser(userId, emailUpdateData))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user not found', async () => {
      mockUserRepository.update.mockResolvedValue(null);

      await expect(userService.updateUser(userId, updateData))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const userId = 'user-123';
      mockUserRepository.delete.mockResolvedValue(true);

      await userService.deleteUser(userId);

      expect(mockUserRepository.delete).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundError when user not found', async () => {
      const userId = 'non-existent';
      mockUserRepository.delete.mockResolvedValue(false);

      await expect(userService.deleteUser(userId))
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
        profile: { firstName: 'John', lastName: 'Doe' },
        preferences: {
          contentSections: [],
          frequency: 'weekly' as const,
          format: 'html' as const,
          topics: [],
          sendTime: '09:00',
          timezone: 'UTC'
        },
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

    it('should throw ValidationError for user without password', async () => {
      const userWithoutPassword = {
        id: 'user-123',
        email: credentials.email,
        passwordHash: null
      };

      mockUserRepository.findByEmail.mockResolvedValue(userWithoutPassword as any);

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

  describe('updatePreferences', () => {
    const userId = 'user-123';
    const preferences = {
      contentSections: ['news', 'research'],
      frequency: 'weekly' as const,
      format: 'html' as const
    };

    it('should update user preferences', async () => {
      const updatedUser = {
        id: userId,
        email: 'test@example.com',
        profile: { firstName: 'John', lastName: 'Doe' },
        preferences: {
          ...preferences,
          topics: [],
          sendTime: '09:00',
          timezone: 'UTC'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.updatePreferences.mockResolvedValue(updatedUser);

      const result = await userService.updatePreferences(userId, preferences);

      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.updatePreferences).toHaveBeenCalledWith(userId, preferences);
    });

    it('should validate preference values', async () => {
      const invalidPreferences = {
        ...preferences,
        frequency: 'invalid' as any
      };

      await expect(userService.updatePreferences(userId, invalidPreferences))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user not found', async () => {
      mockUserRepository.updatePreferences.mockResolvedValue(null);

      await expect(userService.updatePreferences(userId, preferences))
        .rejects.toThrow(NotFoundError);
    });

    it('should validate content sections as array', async () => {
      const invalidPreferences = {
        contentSections: 'not-an-array' as any
      };

      await expect(userService.updatePreferences(userId, invalidPreferences))
        .rejects.toThrow(ValidationError);
    });

    it('should validate topics as array', async () => {
      const invalidPreferences = {
        topics: 'not-an-array' as any
      };

      await expect(userService.updatePreferences(userId, invalidPreferences))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('changePassword', () => {
    const userId = 'user-123';
    const currentPassword = 'OldPassword123!';
    const newPassword = 'NewPassword123!';

    it('should change password successfully', async () => {
      const user = {
        id: userId,
        email: 'test@example.com',
        passwordHash: 'old-hashed-password',
        profile: { firstName: 'John', lastName: 'Doe' },
        preferences: {
          contentSections: [],
          frequency: 'weekly' as const,
          format: 'html' as const,
          topics: [],
          sendTime: '09:00',
          timezone: 'UTC'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const newHashedPassword = 'new-hashed-password';

      mockUserRepository.findById.mockResolvedValue(user);
      mockVerifyPassword.mockResolvedValue(true);
      mockHashPassword.mockResolvedValue(newHashedPassword);
      mockUserRepository.update.mockResolvedValue({ ...user, passwordHash: newHashedPassword });

      await userService.changePassword(userId, currentPassword, newPassword);

      expect(mockVerifyPassword).toHaveBeenCalledWith(currentPassword, user.passwordHash);
      expect(mockHashPassword).toHaveBeenCalledWith(newPassword);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { passwordHash: newHashedPassword });
    });

    it('should throw ValidationError for incorrect current password', async () => {
      const user = {
        id: userId,
        passwordHash: 'hashed-password'
      };

      mockUserRepository.findById.mockResolvedValue(user as any);
      mockVerifyPassword.mockResolvedValue(false);

      await expect(userService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for user without password', async () => {
      const user = {
        id: userId,
        passwordHash: null
      };

      mockUserRepository.findById.mockResolvedValue(user as any);

      await expect(userService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getPreferences', () => {
    it('should return user preferences', async () => {
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'test@example.com',
        profile: { firstName: 'John', lastName: 'Doe' },
        preferences: {
          contentSections: ['news'],
          frequency: 'weekly' as const,
          format: 'html' as const,
          topics: ['tech'],
          sendTime: '09:00',
          timezone: 'UTC'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findById.mockResolvedValue(user);

      const result = await userService.getPreferences(userId);

      expect(result).toEqual(user.preferences);
    });
  });
});
