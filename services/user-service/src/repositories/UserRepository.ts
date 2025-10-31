import {
  ConflictError,
  CreateUserRequest,
  DatabaseUser,
  EngagementMetrics,
  NotFoundError,
  UpdateUserRequest,
  User,
  UserPreferences,
  UserProfile,
  UserStatus,
} from '@/types';
import { buildSetClause, buildWhereClause, database } from '@/utils/database';
import { logger } from '@/utils/logger';

export class UserRepository {
  // Create a new user
  async create(
    userData: CreateUserRequest & { passwordHash: string }
  ): Promise<User> {
    const { email, passwordHash, profile, preferences = {} } = userData;

    try {
      // Check if user already exists
      const existingUser = await this.findByEmail(email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      const query = `
        INSERT INTO users (email, password_hash, profile, preferences, engagement_metrics, status, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const defaultEngagementMetrics = {
        totalLogins: 0,
        newslettersOpened: 0,
        linksClicked: 0,
        engagementScore: 0,
        averageSessionDuration: 0,
      };

      const values = [
        email,
        passwordHash,
        JSON.stringify(profile),
        JSON.stringify(preferences),
        JSON.stringify(defaultEngagementMetrics),
        'active',
        false,
      ];

      const result = await database.query<DatabaseUser>(query, values);
      const dbUser = result[0];
      if (!dbUser) {
        throw new Error('Failed to create user - no result returned');
      }
      return this.mapDatabaseUserToUser(dbUser);
    } catch (error) {
      logger.error('Error creating user:', { email, error });
      throw error;
    }
  }

  // Find user by ID
  async findById(id: string): Promise<User | null> {
    try {
      const query = 'SELECT * FROM users WHERE id = $1';
      const dbUser = await database.queryOne<DatabaseUser>(query, [id]);
      return dbUser ? this.mapDatabaseUserToUser(dbUser) : null;
    } catch (error) {
      logger.error('Error finding user by ID:', { id, error });
      throw error;
    }
  }

  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    try {
      const query = 'SELECT * FROM users WHERE email = $1';
      const dbUser = await database.queryOne<DatabaseUser>(query, [
        email.toLowerCase(),
      ]);
      return dbUser ? this.mapDatabaseUserToUser(dbUser) : null;
    } catch (error) {
      logger.error('Error finding user by email:', { email, error });
      throw error;
    }
  }

  // Update user
  async update(id: string, updates: UpdateUserRequest): Promise<User> {
    try {
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundError('User');
      }

      const updateData: Record<string, any> = {};

      if (updates.profile) {
        updateData.profile = JSON.stringify({
          ...existingUser.profile,
          ...updates.profile,
        });
      }

      if (updates.preferences) {
        updateData.preferences = JSON.stringify({
          ...existingUser.preferences,
          ...updates.preferences,
        });
      }

      if (Object.keys(updateData).length === 0) {
        return existingUser;
      }

      const { clause, values } = buildSetClause(updateData);
      const query = `UPDATE users ${clause} WHERE id = $${values.length + 1} RETURNING *`;

      const result = await database.query<DatabaseUser>(query, [...values, id]);
      const dbUser = result[0];
      if (!dbUser) {
        throw new Error('Failed to update user - no result returned');
      }
      return this.mapDatabaseUserToUser(dbUser);
    } catch (error) {
      logger.error('Error updating user:', { id, updates, error });
      throw error;
    }
  }

  // Update password
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    try {
      const query =
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2';
      await database.query(query, [passwordHash, id]);
    } catch (error) {
      logger.error('Error updating password:', { id, error });
      throw error;
    }
  }

  // Update user status
  async updateStatus(id: string, status: UserStatus): Promise<User> {
    try {
      const query = `
        UPDATE users
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await database.query<DatabaseUser>(query, [status, id]);
      const dbUser = result[0];
      if (!dbUser) {
        throw new NotFoundError('User');
      }

      return this.mapDatabaseUserToUser(dbUser);
    } catch (error) {
      logger.error('Error updating user status:', { id, status, error });
      throw error;
    }
  }

  // Verify email
  async verifyEmail(id: string): Promise<void> {
    try {
      const query = `
        UPDATE users
        SET email_verified = true, email_verified_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `;
      await database.query(query, [id]);
    } catch (error) {
      logger.error('Error verifying email:', { id, error });
      throw error;
    }
  }

  // Update last login
  async updateLastLogin(id: string): Promise<void> {
    try {
      const query = `
        UPDATE users
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `;
      await database.query(query, [id]);
    } catch (error) {
      logger.error('Error updating last login:', { id, error });
      throw error;
    }
  }

  // Update engagement metrics
  async updateEngagementMetrics(
    id: string,
    metrics: Partial<any>
  ): Promise<void> {
    try {
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundError('User');
      }

      const updatedMetrics = {
        ...existingUser.engagementMetrics,
        ...metrics,
      };

      const query = `
        UPDATE users
        SET engagement_metrics = $1, updated_at = NOW()
        WHERE id = $2
      `;

      await database.query(query, [JSON.stringify(updatedMetrics), id]);
    } catch (error) {
      logger.error('Error updating engagement metrics:', {
        id,
        metrics,
        error,
      });
      throw error;
    }
  }

  // Find users with pagination and filters
  async findMany(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      status?: UserStatus;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = options;

    try {
      const offset = (page - 1) * limit;
      const conditions: Record<string, any> = {};

      if (status) {
        conditions.status = status;
      }

      let searchClause = '';
      const searchValues: any[] = [];

      if (search) {
        searchClause = `AND (
          email ILIKE $${Object.keys(conditions).length + 1} OR
          profile->>'firstName' ILIKE $${Object.keys(conditions).length + 1} OR
          profile->>'lastName' ILIKE $${Object.keys(conditions).length + 1} OR
          profile->>'company' ILIKE $${Object.keys(conditions).length + 1}
        )`;
        searchValues.push(`%${search}%`);
      }

      const { clause: whereClause, values: whereValues } =
        buildWhereClause(conditions);
      const allValues = [...whereValues, ...searchValues];

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM users
        ${whereClause} ${searchClause}
      `;

      const countResult = await database.query<{ total: string }>(
        countQuery,
        allValues
      );
      const totalRow = countResult[0];
      if (!totalRow) {
        throw new Error('Failed to get user count');
      }
      const { total } = totalRow;

      // Data query
      const dataQuery = `
        SELECT * FROM users
        ${whereClause} ${searchClause}
        ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
        LIMIT $${allValues.length + 1} OFFSET $${allValues.length + 2}
      `;

      const users = await database.query<DatabaseUser>(dataQuery, [
        ...allValues,
        limit,
        offset,
      ]);

      return {
        users: users.map(user => this.mapDatabaseUserToUser(user)),
        total: parseInt(total, 10),
        page,
        limit,
      };
    } catch (error) {
      logger.error('Error finding users:', { options, error });
      throw error;
    }
  }

  // Delete user
  async delete(id: string): Promise<boolean> {
    try {
      const query = 'DELETE FROM users WHERE id = $1';
      const result = await database.query(query, [id]);
      return result.length > 0;
    } catch (error) {
      logger.error('Error deleting user:', { id, error });
      throw error;
    }
  }

  // Update user preferences
  async updatePreferences(
    id: string,
    preferences: Partial<any>
  ): Promise<User | null> {
    try {
      const existingUser = await this.findById(id);
      if (!existingUser) {
        return null;
      }

      const updatedPreferences = {
        ...existingUser.preferences,
        ...preferences,
      };

      const query = `
        UPDATE users
        SET preferences = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await database.query<DatabaseUser>(query, [
        JSON.stringify(updatedPreferences),
        id,
      ]);
      const dbUser = result[0];
      if (!dbUser) {
        throw new Error(
          'Failed to update user preferences - no result returned'
        );
      }

      return this.mapDatabaseUserToUser(dbUser);
    } catch (error) {
      logger.error('Error updating user preferences:', {
        id,
        preferences,
        error,
      });
      throw error;
    }
  }

  // Map database user to domain user
  mapDatabaseUserToUser(dbUser: DatabaseUser): User {
    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      profile: dbUser.profile as UserProfile,
      preferences: dbUser.preferences as UserPreferences,
      engagementMetrics: dbUser.engagement_metrics as EngagementMetrics,
      status: dbUser.status as UserStatus,
      emailVerified: dbUser.email_verified,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
    };

    if (dbUser.password_hash !== undefined) {
      user.passwordHash = dbUser.password_hash;
    }
    if (dbUser.email_verified_at !== undefined) {
      user.emailVerifiedAt = dbUser.email_verified_at;
    }
    if (dbUser.last_login_at !== undefined) {
      user.lastLoginAt = dbUser.last_login_at;
    }

    return user;
  }
}
