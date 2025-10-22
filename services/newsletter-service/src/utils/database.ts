import { config } from '@/config'
import { Pool, PoolClient } from 'pg'
import { logger } from './logger'

class DatabaseService {
  private pool: Pool
  private isConnected = false

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err)
    })

    this.pool.on('connect', () => {
      logger.info('Database client connected')
    })

    this.pool.on('remove', () => {
      logger.info('Database client removed')
    })
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()
      this.isConnected = true
      logger.info('Database connected successfully')
    } catch (error) {
      logger.error('Failed to connect to database:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end()
      this.isConnected = false
      logger.info('Database disconnected successfully')
    } catch (error) {
      logger.error('Error disconnecting from database:', error)
      throw error
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const start = Date.now()
    try {
      const result = await this.pool.query(text, params)
      const duration = Date.now() - start
      logger.debug('Executed query', { text, duration, rows: result.rowCount })
      return result.rows
    } catch (error) {
      logger.error('Database query error:', { text, params, error })
      throw error
    }
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params)
    return rows[0] || null
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  getPool(): Pool {
    return this.pool
  }

  isHealthy(): boolean {
    return this.isConnected && this.pool.totalCount > 0
  }

  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const start = Date.now()
      await this.query('SELECT 1')
      const responseTime = Date.now() - start

      return {
        status: 'healthy',
        details: {
          totalConnections: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingClients: this.pool.waitingCount,
          responseTime,
        },
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }
}

export const database = new DatabaseService()
export { DatabaseService }
