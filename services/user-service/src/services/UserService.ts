import { UserRepository } from '@/repositories/UserRepository';
import {
    CreateUserRequest,
    NotFoundError,
    UpdateUserRequest,
    User,
    UserPreferences,
    ValidationError
} from '@/types';
import { AuthUtils } from '@/utils/auth';
import { logger } from '@/utils/logger';
import { isValidEmail, isValidPassword } from '@/utils/validation';

export class UserService {
  constructor(private userRepository: UserRepository) {}

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      // Validate input data
      this.validateUserData(userData);

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(userData.email);
      if (existingUser) {
        throw new ValidationError('User with this email already exists');
      }

      // Hash password if provided
      let passwordHash: string;
      if (userData.password) {
        passwordHash = await AuthUtils.hashPassword(userData.password);
      } else {
        throw new ValidationError('Password is required');
      }

      const user = await this.userRepository.create({
        ...userData,
        passwordHash
      });

      logger.info('User created successfully', { userId: user.id, email: user.email });
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async updateUser(id: string, updates: UpdateUserRequest): Promise<User> {
    try {
      // Validate updates
      if (updates.email) {
        this.validateEmail(updates.email);

        // Check if email is already taken by another user
        const existingUser = await this.userRepository.findByEmail(updates.email);
        if (existingUser && existingUser.id !== id) {
          throw new ValidationError('Email is already taken by another user');
        }
      }

      const user = await this.userRepository.update(id, updates);
      if (!user) {
        throw new NotFoundError('User');
      }

      logger.info('User updated successfully', { userId: id });
      return user;
    } catch (error) {
      logger.error('Error updating user:', { id, error });
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      const deleted = await this.userRepository.delete(id);
      if (!deleted) {
        throw new NotFoundError('User');
      }

      logger.info('User deleted successfully', { userId: id });
    } catch (error) {
      logger.error('Error deleting user:', { id, error });
      throw error;
    }
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  async authenticateUser(credentials: { email: string; password: string }): Promise<User> {
    try {
      const user = await this.userRepository.findByEmail(credentials.email);
      if (!user || !user.passwordHash) {
        throw new ValidationError('Invalid email or password');
      }

      const isValidPassword = await AuthUtils.verifyPassword(credentials.password, user.passwordHash!);
      if (!isValidPassword) {
        throw new ValidationError('Invalid email or password');
      }

      logger.info('User authenticated successfully', { userId: user.id, email: user.email });
      return user;
    } catch (error) {
      logger.error('Authentication failed:', { email: credentials.email, error });
      throw error;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);

      if (!user.passwordHash) {
        throw new ValidationError('User does not have a password set');
      }

      // Verify current password
      const isValidPassword = await AuthUtils.verifyPassword(currentPassword, user.passwordHash!);
      if (!isValidPassword) {
        throw new ValidationError('Current password is incorrect');
      }

      // Validate new password
      this.validatePassword(newPassword);

      // Hash and update new password
      const newPasswordHash = await AuthUtils.hashPassword(newPassword);
      await this.userRepository.update(userId, { passwordHash: newPasswordHash });

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Error changing password:', { userId, error });
      throw error;
    }
  }

  // ============================================================================
  // USER PREFERENCES
  // ============================================================================

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<User> {
    try {
      // Validate preferences
      this.validatePreferences(preferences);

      const user = await this.userRepository.updatePreferences(userId, preferences);
      if (!user) {
        throw new NotFoundError('User');
      }

      logger.info('User preferences updated', { userId });
      return user;
    } catch (error) {
      logger.error('Error updating preferences:', { userId, error });
      throw error;
    }
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const user = await this.getUserById(userId);
    return user.preferences;
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  private validateUserData(userData: CreateUserRequest): void {
    if (!userData.email) {
      throw new ValidationError('Email is required');
    }

    this.validateEmail(userData.email);

    if (userData.password) {
      this.validatePassword(userData.password);
    }

    if (!userData.profile?.firstName) {
      throw new ValidationError('First name is required');
    }

    if (!userData.profile?.lastName) {
      throw new ValidationError('Last name is required');
    }
  }

  private validateEmail(email: string): void {
    if (!isValidEmail(email)) {
      throw new ValidationError('Invalid email format');
    }
  }

  private validatePassword(password: string): void {
    if (!isValidPassword(password)) {
      throw new ValidationError('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number');
    }
  }

  private validatePreferences(preferences: Partial<UserPreferences>): void {
    // Validate newsletter frequency
    if (preferences.newsletterFrequency && !['daily', 'weekly', 'monthly'].includes(preferences.newsletterFrequency)) {
      throw new ValidationError('Invalid newsletter frequency value');
    }

    // Validate theme
    if (preferences.theme && !['light', 'dark', 'auto'].includes(preferences.theme)) {
      throw new ValidationError('Invalid theme value');
    }

    // Validate content types
    if (preferences.contentTypes && !Array.isArray(preferences.contentTypes)) {
      throw new ValidationError('Content types must be an array');
    }

    // Validate timezone
    if (preferences.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: preferences.timezone });
      } catch {
        throw new ValidationError('Invalid timezone');
      }
    }

    // Validate language
    if (preferences.language && !['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'].includes(preferences.language)) {
      throw new ValidationError('Invalid language value');
    }
  }
}

export default UserService;
