/**
 * Database Service Base Class
 * Provides common database operations and patterns for microservices
 */

import { Pool, PoolClient } from 'pg';
import { createLogger } from '../utils/logger';
import { DatabaseConfig, databaseManager, QueryBuilder } from './database-config';
import { MigrationRunner } from './migration-runner';

const logger = createLogger('database-service');

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface QueryOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTTL?: number;
}

export abstract class DatabaseService {
  protected pool: Pool;
  protected serviceName: string;
  private migrationRunner: MigrationRunner;

  constructor(serviceName: string, config?: DatabaseConfig) {
    this.serviceName = serviceName;

    // Use provided config or create from environment
    const dbConfig = config || this.createConfigFromEnvironment();

    // Create or get existing pool
    this.pool = databaseManager.createPool(serviceName, dbConfig);

    // Initialize migration runner
    this.migrationRunner = new MigrationRunner(this.pool);

    logger.info(`Database service initialized for ${serviceName}`);
  }

  /**
   * Initialize the service (run migrations, setup, etc.)
   */
  public async initialize(): Promise<void> {
    try {
      logger.info(`Initializing database service for ${this.serviceName}...`);

      // Run migrations
      await this.migrationRunner.runMigrations();

      // Run service-specific initialization
      await this.onInitialize();

      logger.info(`Database service ${this.serviceName} initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize database service ${this.serviceName}:`, { error });
      throw error;
    }
  }

  /**
   * Health check for the database connection
   */
  public async healthCheck(): Promise<boolean> {
    return databaseManager.healthCheck(this.serviceName);
  }

  /**
   * Execute a query with automatic retry and performance tracking
   */
  protected async query<T = any>(
    text: string,
    params?: any[],
    options?: QueryOptions
  ): Promise<{ rows: T[]; rowCount: number; duration: number }> {
    const maxRetries = options?.retries || 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await databaseManager.query<T>(this.serviceName, text, params);
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break;
        }

        // Only retry on connection errors
        if (this.isRetryableError(error as Error)) {
          const delay = Math.pow(2, attempt) * 100; // Exponential backoff
          logger.warn(`Query attempt ${attempt} failed, retrying in ${delay}ms...`, {
            error: (error as Error).message,
            attempt,
            maxRetries,
          });
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    throw lastError!;
  }

  /**
   * Execute a transaction
   */
  protected async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    return databaseManager.transaction(this.serviceName, callback);
  }

  /**
   * Find a single record by ID
   */
  protected async findById<T>(
    table: string,
    id: string,
    columns: string = '*'
  ): Promise<T | null> {
    const query = new QueryBuilder()
      .select(columns)
      .from(table)
      .where('id = ?', id)
      .limit(1)
      .build();

    const result = await this.query<T>(query.text, query.params);
    return result.rows[0] || null;
  }

  /**
   * Find records with optional filtering and pagination
   */
  protected async find<T>(
    table: string,
    options: {
      where?: Record<string, any>;
      columns?: string;
      pagination?: PaginationOptions;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<T[]> {
    let queryBuilder = new QueryBuilder().select(options.columns || '*').from(table);

    // Add where conditions
    if (options.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryBuilder = queryBuilder.where(`${key} = ?`, value);
        }
      });
    }

    // Add ordering
    if (options.orderBy) {
      queryBuilder = queryBuilder.orderBy(options.orderBy, options.orderDirection || 'ASC');
    }

    // Add pagination
    if (options.pagination) {
      const { page = 1, limit = 20 } = options.pagination;
      const offset = (page - 1) * limit;
      queryBuilder = queryBuilder.limit(limit).offset(offset);
    }

    const query = queryBuilder.build();
    const result = await this.query<T>(query.text, query.params);
    return result.rows;
  }

  /**
   * Find records with pagination metadata
   */
  protected async findWithPagination<T>(
    table: string,
    options: {
      where?: Record<string, any>;
      columns?: string;
      pagination: PaginationOptions;
    }
  ): Promise<PaginatedResult<T>> {
    const { page = 1, limit = 20 } = options.pagination;
    const offset = (page - 1) * limit;

    // Build count query
    let countBuilder = new QueryBuilder().select('COUNT(*) as total').from(table);

    // Build data query
    let dataBuilder = new QueryBuilder()
      .select(options.columns || '*')
      .from(table);

    // Add where conditions to both queries
    if (options.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          countBuilder = countBuilder.where(`${key} = ?`, value);
          dataBuilder = dataBuilder.where(`${key} = ?`, value);
        }
      });
    }

    // Add pagination to data query
    dataBuilder = dataBuilder.limit(limit).offset(offset);

    // Add sorting if specified
    if (options.pagination.sortBy) {
      dataBuilder = dataBuilder.orderBy(
        options.pagination.sortBy,
        options.pagination.sortOrder || 'ASC'
      );
    }

    // Execute both queries
    const [countResult, dataResult] = await Promise.all([
      this.query<{ total: string }>(countBuilder.build().text, countBuilder.build().params),
      this.query<T>(dataBuilder.build().text, dataBuilder.build().params),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Create a new record
   */
  protected async create<T>(
    table: string,
    data: Record<string, any>
  ): Promise<T> {
    const query = QueryBuilder.insert(table, data);
    const result = await this.query<T>(query.text, query.params);
    return result.rows[0];
  }

  /**
   * Update a record by ID
   */
  protected async updateById<T>(
    table: string,
    id: string,
    data: Record<string, any>
  ): Promise<T | null> {
    // Add updated_at timestamp if not provided
    if (!data.updated_at) {
      data.updated_at = new Date();
    }

    const query = QueryBuilder.update(table, data, 'id = $1', [id]);
    const result = await this.query<T>(query.text, query.params);
    return result.rows[0] || null;
  }

  /**
   * Delete a record by ID
   */
  protected async deleteById(table: string, id: string): Promise<boolean> {
    const query = QueryBuilder.delete(table, 'id = $1', [id]);
    const result = await this.query(query.text, query.params);
    return result.rowCount > 0;
  }

  /**
   * Soft delete a record by ID (sets deleted_at timestamp)
   */
  protected async softDeleteById(table: string, id: string): Promise<boolean> {
    const result = await this.updateById(table, id, {
      deleted_at: new Date(),
      updated_at: new Date(),
    });
    return result !== null;
  }

  /**
   * Execute raw SQL (use with caution)
   */
  protected async executeRaw<T = any>(
    sql: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number; duration: number }> {
    return this.query<T>(sql, params);
  }

  /**
   * Get database metrics
   */
  public getMetrics() {
    return databaseManager.getMetrics(this.serviceName);
  }

  /**
   * Close the database connection
   */
  public async close(): Promise<void> {
    await databaseManager.closePool(this.serviceName);
  }

  /**
   * Service-specific initialization hook
   */
  protected async onInitialize(): Promise<void> {
    // Override in subclasses for service-specific initialization
  }

  /**
   * Create database configuration from environment variables
   */
  private createConfigFromEnvironment(): DatabaseConfig {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl) {
      const url = new URL(databaseUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port || '5432', 10),
        database: url.pathname.slice(1),
        username: url.username,
        password: url.password,
        ssl: url.searchParams.get('ssl') === 'true',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
        statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
        queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
      };
    }

    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || `${this.serviceName}_db`,
      username: process.env.DB_USER || 'ailert',
      password: process.env.DB_PASSWORD || 'ailert_dev_password',
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
    };
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'connection terminated',
      'server closed the connection',
    ];

    return retryableErrors.some(errorType =>
      error.message.toLowerCase().includes(errorType.toLowerCase())
    );
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Repository base class for domain-specific database operations
 */
export abstract class Repository<T> extends DatabaseService {
  protected abstract tableName: string;

  /**
   * Find entity by ID
   */
  public async findById(id: string): Promise<T | null> {
    return super.findById<T>(this.tableName, id);
  }

  /**
   * Find all entities with optional filtering
   */
  public async findAll(options: {
    where?: Record<string, any>;
    pagination?: PaginationOptions;
  } = {}): Promise<T[]> {
    return super.find<T>(this.tableName, options);
  }

  /**
   * Find entities with pagination
   */
  public async findWithPagination(options: {
    where?: Record<string, any>;
    pagination: PaginationOptions;
  }): Promise<PaginatedResult<T>> {
    return super.findWithPagination<T>(this.tableName, options);
  }

  /**
   * Create a new entity
   */
  public async create(data: Partial<T>): Promise<T> {
    return super.create<T>(this.tableName, data as Record<string, any>);
  }

  /**
   * Update an entity by ID
   */
  public async update(id: string, data: Partial<T>): Promise<T | null> {
    return super.updateById<T>(this.tableName, id, data as Record<string, any>);
  }

  /**
   * Delete an entity by ID
   */
  public async delete(id: string): Promise<boolean> {
    return super.deleteById(this.tableName, id);
  }

  /**
   * Soft delete an entity by ID
   */
  public async softDelete(id: string): Promise<boolean> {
    return super.softDeleteById(this.tableName, id);
  }
}
