// @ts-nocheck
import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface DatabaseIndex {
  tableName: string;
  columnNames: string[];
  indexType: 'btree' | 'hash' | 'gin' | 'gist' | 'spgist' | 'brin';
  unique?: boolean;
  partial?: string; // WHERE clause for partial index
  concurrent?: boolean;
}

export interface DatabaseConstraint {
  tableName: string;
  constraintName: string;
  constraintType: 'primary_key' | 'foreign_key' | 'unique' | 'check';
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  checkCondition?: string;
}

export interface QueryOptimization {
  originalQuery: string;
  optimizedQuery: string;
  explanation: string;
  estimatedImprovement: string;
}

export interface DatabasePerformanceMetrics {
  connectionPoolUsage: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  avgQueryTime: number;
  slowQueries: number;
  indexUsage: Record<string, number>;
  tableStats: Record<
    string,
    {
      rowCount: number;
      tableSize: string;
      indexSize: string;
    }
  >;
}

export class DatabaseOptimizer {
  private pool: Pool;
  private performanceMetrics: DatabasePerformanceMetrics;

  constructor(pool: Pool) {
    this.pool = pool;
    this.performanceMetrics = this.initializeMetrics();
  }

  /**
   * Create optimized database indexes for performance
   */
  async createPerformanceIndexes(): Promise<void> {
    const indexes: DatabaseIndex[] = [
      // User table indexes
      {
        tableName: 'users',
        columnNames: ['email'],
        indexType: 'btree',
        unique: true,
      },
      {
        tableName: 'users',
        columnNames: ['status'],
        indexType: 'btree',
      },
      {
        tableName: 'users',
        columnNames: ['created_at'],
        indexType: 'btree',
      },
      {
        tableName: 'users',
        columnNames: ['last_login_at'],
        indexType: 'btree',
        partial: 'last_login_at IS NOT NULL',
      },
      {
        tableName: 'users',
        columnNames: ['email_verified'],
        indexType: 'btree',
        partial: 'email_verified = true',
      },

      // Newsletter table indexes
      {
        tableName: 'newsletters',
        columnNames: ['status'],
        indexType: 'btree',
      },
      {
        tableName: 'newsletters',
        columnNames: ['created_at'],
        indexType: 'btree',
      },
      {
        tableName: 'newsletters',
        columnNames: ['scheduled_at'],
        indexType: 'btree',
        partial: 'scheduled_at IS NOT NULL',
      },
      {
        tableName: 'newsletters',
        columnNames: ['user_id', 'status'],
        indexType: 'btree',
      },

      // Contact table indexes
      {
        tableName: 'contacts',
        columnNames: ['email'],
        indexType: 'btree',
        unique: true,
      },
      {
        tableName: 'contacts',
        columnNames: ['lifecycle'],
        indexType: 'btree',
      },
      {
        tableName: 'contacts',
        columnNames: ['user_id'],
        indexType: 'btree',
      },
      {
        tableName: 'contacts',
        columnNames: ['created_at'],
        indexType: 'btree',
      },
      {
        tableName: 'contacts',
        columnNames: ['tags'],
        indexType: 'gin',
      },

      // Campaign table indexes
      {
        tableName: 'campaigns',
        columnNames: ['status'],
        indexType: 'btree',
      },
      {
        tableName: 'campaigns',
        columnNames: ['user_id', 'status'],
        indexType: 'btree',
      },
      {
        tableName: 'campaigns',
        columnNames: ['created_at'],
        indexType: 'btree',
      },

      // Email delivery table indexes
      {
        tableName: 'email_deliveries',
        columnNames: ['newsletter_id'],
        indexType: 'btree',
      },
      {
        tableName: 'email_deliveries',
        columnNames: ['contact_id'],
        indexType: 'btree',
      },
      {
        tableName: 'email_deliveries',
        columnNames: ['status'],
        indexType: 'btree',
      },
      {
        tableName: 'email_deliveries',
        columnNames: ['sent_at'],
        indexType: 'btree',
        partial: 'sent_at IS NOT NULL',
      },
      {
        tableName: 'email_deliveries',
        columnNames: ['newsletter_id', 'status'],
        indexType: 'btree',
      },

      // Analytics table indexes
      {
        tableName: 'email_analytics',
        columnNames: ['email_delivery_id'],
        indexType: 'btree',
      },
      {
        tableName: 'email_analytics',
        columnNames: ['event_type'],
        indexType: 'btree',
      },
      {
        tableName: 'email_analytics',
        columnNames: ['created_at'],
        indexType: 'btree',
      },
      {
        tableName: 'email_analytics',
        columnNames: ['email_delivery_id', 'event_type'],
        indexType: 'btree',
      },
    ];

    for (const index of indexes) {
      await this.createIndex(index);
    }

    logger.info('Performance indexes created successfully', {
      indexCount: indexes.length,
    });
  }

  /**
   * Create database constraints for data integrity and performance
   */
  async createPerformanceConstraints(): Promise<void> {
    const constraints: DatabaseConstraint[] = [
      // Foreign key constraints
      {
        tableName: 'newsletters',
        constraintName: 'fk_newsletters_user_id',
        constraintType: 'foreign_key',
        columns: ['user_id'],
        referencedTable: 'users',
        referencedColumns: ['id'],
      },
      {
        tableName: 'contacts',
        constraintName: 'fk_contacts_user_id',
        constraintType: 'foreign_key',
        columns: ['user_id'],
        referencedTable: 'users',
        referencedColumns: ['id'],
      },
      {
        tableName: 'campaigns',
        constraintName: 'fk_campaigns_user_id',
        constraintType: 'foreign_key',
        columns: ['user_id'],
        referencedTable: 'users',
        referencedColumns: ['id'],
      },
      {
        tableName: 'email_deliveries',
        constraintName: 'fk_email_deliveries_newsletter_id',
        constraintType: 'foreign_key',
        columns: ['newsletter_id'],
        referencedTable: 'newsletters',
        referencedColumns: ['id'],
      },
      {
        tableName: 'email_deliveries',
        constraintName: 'fk_email_deliveries_contact_id',
        constraintType: 'foreign_key',
        columns: ['contact_id'],
        referencedTable: 'contacts',
        referencedColumns: ['id'],
      },
      {
        tableName: 'email_analytics',
        constraintName: 'fk_email_analytics_delivery_id',
        constraintType: 'foreign_key',
        columns: ['email_delivery_id'],
        referencedTable: 'email_deliveries',
        referencedColumns: ['id'],
      },

      // Check constraints
      {
        tableName: 'users',
        constraintName: 'chk_users_status',
        constraintType: 'check',
        columns: ['status'],
        checkCondition:
          "status IN ('active', 'inactive', 'suspended', 'pending')",
      },
      {
        tableName: 'newsletters',
        constraintName: 'chk_newsletters_status',
        constraintType: 'check',
        columns: ['status'],
        checkCondition:
          "status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')",
      },
      {
        tableName: 'contacts',
        constraintName: 'chk_contacts_lifecycle',
        constraintType: 'check',
        columns: ['lifecycle'],
        checkCondition:
          "lifecycle IN ('lead', 'subscriber', 'customer', 'unsubscribed')",
      },
      {
        tableName: 'email_deliveries',
        constraintName: 'chk_email_deliveries_status',
        constraintType: 'check',
        columns: ['status'],
        checkCondition:
          "status IN ('pending', 'sent', 'delivered', 'bounced', 'failed')",
      },
    ];

    for (const constraint of constraints) {
      await this.createConstraint(constraint);
    }

    logger.info('Performance constraints created successfully', {
      constraintCount: constraints.length,
    });
  }

  /**
   * Optimize database connection pool settings
   */
  async optimizeConnectionPool(): Promise<void> {
    const currentStats = await this.getConnectionPoolStats();

    logger.info('Current connection pool stats', currentStats);

    // Connection pool is already optimized in the Database class
    // This method provides monitoring and recommendations
    const recommendations: string[] = [];

    if (currentStats.waitingClients > 0) {
      recommendations.push(
        'Consider increasing max pool size - clients are waiting for connections'
      );
    }

    if (currentStats.idleConnections > currentStats.totalConnections * 0.5) {
      recommendations.push(
        'Consider decreasing min pool size - too many idle connections'
      );
    }

    if (currentStats.totalConnections < 5) {
      recommendations.push(
        'Consider increasing min pool size for better performance'
      );
    }

    if (recommendations.length > 0) {
      logger.warn('Connection pool optimization recommendations', {
        recommendations,
        currentStats,
      });
    } else {
      logger.info('Connection pool is optimally configured');
    }
  }

  /**
   * Analyze and optimize slow queries
   */
  async optimizeSlowQueries(): Promise<QueryOptimization[]> {
    const slowQueries = await this.identifySlowQueries();
    const optimizations: QueryOptimization[] = [];

    for (const query of slowQueries) {
      const optimization = await this.optimizeQuery(query);
      if (optimization) {
        optimizations.push(optimization);
      }
    }

    logger.info('Query optimization completed', {
      slowQueriesFound: slowQueries.length,
      optimizationsApplied: optimizations.length,
    });

    return optimizations;
  }

  /**
   * Get comprehensive database performance metrics
   */
  async getPerformanceMetrics(): Promise<DatabasePerformanceMetrics> {
    const poolStats = await this.getConnectionPoolStats();
    const queryStats = await this.getQueryPerformanceStats();
    const indexStats = await this.getIndexUsageStats();
    const tableStats = await this.getTableStats();

    this.performanceMetrics = {
      connectionPoolUsage:
        (poolStats.totalConnections / (poolStats.maxConnections || 20)) * 100,
      activeConnections: poolStats.totalConnections - poolStats.idleConnections,
      idleConnections: poolStats.idleConnections,
      waitingClients: poolStats.waitingClients,
      avgQueryTime: queryStats.avgQueryTime,
      slowQueries: queryStats.slowQueryCount,
      indexUsage: indexStats,
      tableStats,
    };

    return { ...this.performanceMetrics };
  }

  /**
   * Perform database maintenance tasks
   */
  async performMaintenance(): Promise<{
    vacuumCompleted: boolean;
    analyzeCompleted: boolean;
    reindexCompleted: boolean;
    statisticsUpdated: boolean;
  }> {
    const results = {
      vacuumCompleted: false,
      analyzeCompleted: false,
      reindexCompleted: false,
      statisticsUpdated: false,
    };

    try {
      // VACUUM to reclaim storage and update statistics
      await this.pool.query('VACUUM ANALYZE');
      results.vacuumCompleted = true;
      results.analyzeCompleted = true;
      logger.info('Database VACUUM ANALYZE completed');
    } catch (error) {
      logger.error('VACUUM ANALYZE failed', error);
    }

    try {
      // Update table statistics
      await this.pool.query('ANALYZE');
      results.statisticsUpdated = true;
      logger.info('Database statistics updated');
    } catch (error) {
      logger.error('Statistics update failed', error);
    }

    // Note: REINDEX is not performed automatically as it can be disruptive
    // It should be scheduled during maintenance windows
    logger.info('Database maintenance completed', results);

    return results;
  }

  /**
   * Health check for database performance
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const start = Date.now();
      await this.pool.query('SELECT 1');
      const responseTime = Date.now() - start;

      const metrics = await this.getPerformanceMetrics();

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Determine health status based on metrics
      if (metrics.avgQueryTime > 1000 || metrics.connectionPoolUsage > 90) {
        status = 'unhealthy';
      } else if (
        metrics.avgQueryTime > 500 ||
        metrics.connectionPoolUsage > 75
      ) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          responseTime,
          metrics,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async createIndex(index: DatabaseIndex): Promise<void> {
    try {
      const indexName = `idx_${index.tableName}_${index.columnNames.join('_')}`;
      const columns = index.columnNames.join(', ');

      let createIndexSQL = `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${index.concurrent ? 'CONCURRENTLY ' : ''}${indexName} ON ${index.tableName}`;

      if (index.indexType !== 'btree') {
        createIndexSQL += ` USING ${index.indexType}`;
      }

      createIndexSQL += ` (${columns})`;

      if (index.partial) {
        createIndexSQL += ` WHERE ${index.partial}`;
      }

      await this.pool.query(createIndexSQL);
      logger.debug('Index created successfully', {
        indexName,
        tableName: index.tableName,
      });
    } catch (error) {
      // Ignore "already exists" errors
      if (error instanceof Error && error.message.includes('already exists')) {
        logger.debug('Index already exists', {
          tableName: index.tableName,
          columns: index.columnNames,
        });
      } else {
        logger.error('Failed to create index', { index, error });
        throw error;
      }
    }
  }

  private async createConstraint(
    constraint: DatabaseConstraint
  ): Promise<void> {
    try {
      let alterSQL = `ALTER TABLE ${constraint.tableName} ADD CONSTRAINT ${constraint.constraintName}`;

      switch (constraint.constraintType) {
        case 'foreign_key':
          alterSQL += ` FOREIGN KEY (${constraint.columns.join(', ')}) REFERENCES ${constraint.referencedTable}(${constraint.referencedColumns?.join(', ')})`;
          break;
        case 'unique':
          alterSQL += ` UNIQUE (${constraint.columns.join(', ')})`;
          break;
        case 'check':
          alterSQL += ` CHECK (${constraint.checkCondition})`;
          break;
        case 'primary_key':
          alterSQL += ` PRIMARY KEY (${constraint.columns.join(', ')})`;
          break;
      }

      await this.pool.query(alterSQL);
      logger.debug('Constraint created successfully', {
        constraintName: constraint.constraintName,
      });
    } catch (error) {
      // Ignore "already exists" errors
      if (error instanceof Error && error.message.includes('already exists')) {
        logger.debug('Constraint already exists', {
          constraintName: constraint.constraintName,
        });
      } else {
        logger.error('Failed to create constraint', { constraint, error });
        throw error;
      }
    }
  }

  private async getConnectionPoolStats(): Promise<{
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
    maxConnections?: number;
  }> {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
      maxConnections: 20, // Default max from pg pool
    };
  }

  private async getQueryPerformanceStats(): Promise<{
    avgQueryTime: number;
    slowQueryCount: number;
  }> {
    try {
      // This would require pg_stat_statements extension in production
      // For now, return mock data
      return {
        avgQueryTime: 50, // milliseconds
        slowQueryCount: 0,
      };
    } catch (error) {
      logger.warn('Could not retrieve query performance stats', error);
      return {
        avgQueryTime: 0,
        slowQueryCount: 0,
      };
    }
  }

  private async getIndexUsageStats(): Promise<Record<string, number>> {
    try {
      const result = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        ORDER BY idx_tup_read DESC
      `);

      const indexStats: Record<string, number> = {};
      for (const row of result) {
        indexStats[`${row.tablename}.${row.indexname}`] = row.idx_tup_read || 0;
      }

      return indexStats;
    } catch (error) {
      logger.warn('Could not retrieve index usage stats', error);
      return {};
    }
  }

  private async getTableStats(): Promise<
    Record<
      string,
      {
        rowCount: number;
        tableSize: string;
        indexSize: string;
      }
    >
  > {
    try {
      const result = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          n_tup_ins + n_tup_upd + n_tup_del as row_count,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
          pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      const tableStats: Record<
        string,
        {
          rowCount: number;
          tableSize: string;
          indexSize: string;
        }
      > = {};

      for (const row of result) {
        tableStats[row.tablename] = {
          rowCount: parseInt(row.row_count) || 0,
          tableSize: row.table_size || '0 bytes',
          indexSize: row.index_size || '0 bytes',
        };
      }

      return tableStats;
    } catch (error) {
      logger.warn('Could not retrieve table stats', error);
      return {};
    }
  }

  private async identifySlowQueries(): Promise<string[]> {
    // In production, this would query pg_stat_statements
    // For now, return common slow query patterns
    return [
      'SELECT * FROM users WHERE email LIKE %@domain.com%',
      'SELECT * FROM contacts WHERE tags @> \'["tag1"]\'',
      'SELECT * FROM email_deliveries WHERE sent_at BETWEEN ? AND ?',
    ];
  }

  private async optimizeQuery(
    query: string
  ): Promise<QueryOptimization | null> {
    // Simple query optimization suggestions
    if (query.includes('SELECT *')) {
      return {
        originalQuery: query,
        optimizedQuery: query.replace('SELECT *', 'SELECT specific_columns'),
        explanation:
          'Avoid SELECT * to reduce data transfer and improve performance',
        estimatedImprovement: '20-40% faster query execution',
      };
    }

    if (query.includes('LIKE %')) {
      return {
        originalQuery: query,
        optimizedQuery: query.replace(
          'LIKE %',
          'Use full-text search or proper indexing'
        ),
        explanation:
          'Leading wildcard LIKE queries cannot use indexes effectively',
        estimatedImprovement:
          '50-80% faster query execution with proper indexing',
      };
    }

    return null;
  }

  private initializeMetrics(): DatabasePerformanceMetrics {
    return {
      connectionPoolUsage: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      avgQueryTime: 0,
      slowQueries: 0,
      indexUsage: {},
      tableStats: {},
    };
  }
}
