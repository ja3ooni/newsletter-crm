import { UserRepository } from '../../src/repositories/UserRepository';

export const createMockUserRepository = (): jest.Mocked<UserRepository> => {
  return {
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
};

export const createMockAuthUtils = () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateToken: jest.fn(),
  verifyToken: jest.fn()
});

export const createMockValidationUtils = () => ({
  validateEmail: jest.fn(),
  isValidPassword: jest.fn(),
  validateSchema: jest.fn()
});
