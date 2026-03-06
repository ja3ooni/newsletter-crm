// @ts-nocheck
import {
  Company,
  CompanySearchRequest,
  CompanySearchResponse,
  CreateCompanyRequest,
  NotFoundError,
  PaginatedResponse,
  PaginationOptions,
  UpdateCompanyRequest,
} from '@/types';
import logger from '@/utils/logger';
import { Pool } from 'pg';

export class CompanyRepository {
  constructor(private db: Pool) {}

  async create(
    data: CreateCompanyRequest,
    createdBy?: string
  ): Promise<Company> {
    try {
      const result = await this.db.query(
        `INSERT INTO companies (
          name, domain, industry, size, revenue, currency, website, phone,
          address, description, custom_fields, tags, owner_id, parent_company_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          data.name,
          data.domain,
          data.industry,
          data.size,
          data.revenue,
          data.currency || 'USD',
          data.website,
          data.phone,
          JSON.stringify(data.address || {}),
          data.description,
          JSON.stringify(data.customFields || {}),
          data.tags || [],
          data.ownerId,
          data.parentCompanyId,
          createdBy,
        ]
      );

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error creating company:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Company | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM companies WHERE id = $1',
        [id]
      );

      return result.rows.length > 0 ? this.mapFromDb(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding company by ID:', { id, error });
      throw error;
    }
  }

  async findByDomain(domain: string): Promise<Company | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM companies WHERE domain = $1',
        [domain]
      );

      return result.rows.length > 0 ? this.mapFromDb(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding company by domain:', { domain, error });
      throw error;
    }
  }

  async search(
    searchParams: CompanySearchRequest
  ): Promise<CompanySearchResponse> {
    try {
      const {
        query,
        industry,
        size,
        ownerId,
        tags,
        revenueMin,
        revenueMax,
        createdAfter,
        createdBefore,
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        limit = 50,
      } = searchParams;

      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (query) {
        conditions.push(
          `(name ILIKE $${paramIndex} OR domain ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
        );
        values.push(`%${query}%`);
        paramIndex++;
      }

      if (industry && industry.length > 0) {
        conditions.push(`industry = ANY($${paramIndex++})`);
        values.push(industry);
      }

      if (size && size.length > 0) {
        conditions.push(`size = ANY($${paramIndex++})`);
        values.push(size);
      }

      if (ownerId && ownerId.length > 0) {
        conditions.push(`owner_id = ANY($${paramIndex++})`);
        values.push(ownerId);
      }

      if (tags && tags.length > 0) {
        conditions.push(`tags && $${paramIndex++}`);
        values.push(tags);
      }

      if (revenueMin !== undefined) {
        conditions.push(`revenue >= $${paramIndex++}`);
        values.push(revenueMin);
      }

      if (revenueMax !== undefined) {
        conditions.push(`revenue <= $${paramIndex++}`);
        values.push(revenueMax);
      }

      if (createdAfter) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(createdAfter);
      }

      if (createdBefore) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(createdBefore);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const offset = (page - 1) * limit;

      // Count total
      const countResult = await this.db.query(
        `SELECT COUNT(*) FROM companies ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get companies
      const companiesResult = await this.db.query(
        `SELECT * FROM companies ${whereClause}
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset]
      );

      const companies = companiesResult.rows.map(this.mapFromDb);

      return {
        companies,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error searching companies:', error);
      throw error;
    }
  }

  async update(id: string, updates: UpdateCompanyRequest): Promise<Company> {
    try {
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      const updateableFields = [
        'name',
        'domain',
        'industry',
        'size',
        'revenue',
        'currency',
        'website',
        'phone',
        'address',
        'description',
        'custom_fields',
        'tags',
        'owner_id',
        'parent_company_id',
      ];

      for (const [key, value] of Object.entries(updates)) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (updateableFields.includes(dbField)) {
          setParts.push(`${dbField} = $${paramIndex++}`);
          if (key === 'address' || key === 'customFields') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
        }
      }

      if (setParts.length === 0) {
        const company = await this.findById(id);
        if (!company) throw new NotFoundError('Company');
        return company;
      }

      setParts.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      values.push(id);

      const result = await this.db.query(
        `UPDATE companies SET ${setParts.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Company');
      }

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error updating company:', { id, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.db.query(
        'DELETE FROM companies WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('Company');
      }
    } catch (error) {
      logger.error('Error deleting company:', { id, error });
      throw error;
    }
  }

  async findAll(
    options?: PaginationOptions
  ): Promise<PaginatedResponse<Company>> {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = options || {};
      const offset = (page - 1) * limit;

      const countResult = await this.db.query('SELECT COUNT(*) FROM companies');
      const total = parseInt(countResult.rows[0].count);

      const companiesResult = await this.db.query(
        `SELECT * FROM companies
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const companies = companiesResult.rows.map(this.mapFromDb);

      return {
        data: companies,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error finding all companies:', error);
      throw error;
    }
  }

  async addContact(
    companyId: string,
    contactId: string,
    role?: string,
    isPrimary: boolean = false
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO contact_company_relations (contact_id, company_id, role, is_primary)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (contact_id, company_id) DO UPDATE SET
         role = EXCLUDED.role,
         is_primary = EXCLUDED.is_primary,
         updated_at = NOW()`,
        [contactId, companyId, role, isPrimary]
      );

      // Update last activity
      await this.updateLastActivity(companyId);
    } catch (error) {
      logger.error('Error adding contact to company:', {
        companyId,
        contactId,
        error,
      });
      throw error;
    }
  }

  async removeContact(companyId: string, contactId: string): Promise<void> {
    try {
      await this.db.query(
        'DELETE FROM contact_company_relations WHERE company_id = $1 AND contact_id = $2',
        [companyId, contactId]
      );
    } catch (error) {
      logger.error('Error removing contact from company:', {
        companyId,
        contactId,
        error,
      });
      throw error;
    }
  }

  async getContacts(companyId: string): Promise<string[]> {
    try {
      const result = await this.db.query(
        'SELECT contact_id FROM contact_company_relations WHERE company_id = $1',
        [companyId]
      );

      return result.rows.map(row => row.contact_id);
    } catch (error) {
      logger.error('Error getting company contacts:', { companyId, error });
      throw error;
    }
  }

  async updateLastActivity(companyId: string): Promise<void> {
    try {
      await this.db.query(
        'UPDATE companies SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
        [companyId]
      );
    } catch (error) {
      logger.error('Error updating company last activity:', {
        companyId,
        error,
      });
      // Don't throw - this is a background operation
    }
  }

  async addTags(companyId: string, tags: string[]): Promise<void> {
    try {
      await this.db.query(
        'UPDATE companies SET tags = array_cat(tags, $1), updated_at = NOW() WHERE id = $2',
        [tags, companyId]
      );
    } catch (error) {
      logger.error('Error adding tags to company:', { companyId, tags, error });
      throw error;
    }
  }

  async removeTags(companyId: string, tags: string[]): Promise<void> {
    try {
      await this.db.query(
        'UPDATE companies SET tags = array_remove_multiple(tags, $1), updated_at = NOW() WHERE id = $2',
        [tags, companyId]
      );
    } catch (error) {
      logger.error('Error removing tags from company:', {
        companyId,
        tags,
        error,
      });
      throw error;
    }
  }

  async getCompanyStats(): Promise<{
    total: number;
    byIndustry: Record<string, number>;
    bySize: Record<string, number>;
    recentActivity: number;
  }> {
    try {
      const totalResult = await this.db.query('SELECT COUNT(*) FROM companies');
      const total = parseInt(totalResult.rows[0].count);

      const industryResult = await this.db.query(`
        SELECT industry, COUNT(*) as count
        FROM companies
        WHERE industry IS NOT NULL
        GROUP BY industry
      `);
      const byIndustry = industryResult.rows.reduce((acc, row) => {
        acc[row.industry] = parseInt(row.count);
        return acc;
      }, {});

      const sizeResult = await this.db.query(`
        SELECT size, COUNT(*) as count
        FROM companies
        WHERE size IS NOT NULL
        GROUP BY size
      `);
      const bySize = sizeResult.rows.reduce((acc, row) => {
        acc[row.size] = parseInt(row.count);
        return acc;
      }, {});

      const recentActivityResult = await this.db.query(`
        SELECT COUNT(*) FROM companies
        WHERE last_activity_at >= NOW() - INTERVAL '30 days'
      `);
      const recentActivity = parseInt(recentActivityResult.rows[0].count);

      return {
        total,
        byIndustry,
        bySize,
        recentActivity,
      };
    } catch (error) {
      logger.error('Error getting company stats:', error);
      throw error;
    }
  }

  private mapFromDb(row: any): Company {
    return {
      id: row.id,
      name: row.name,
      domain: row.domain,
      industry: row.industry,
      size: row.size,
      revenue: row.revenue,
      currency: row.currency,
      website: row.website,
      phone: row.phone,
      address: row.address || {},
      description: row.description,
      customFields: row.custom_fields || {},
      tags: row.tags || [],
      ownerId: row.owner_id,
      parentCompanyId: row.parent_company_id,
      subsidiaries: [], // TODO: Implement hierarchical relationships
      contacts: [], // TODO: Load contacts if needed
      deals: [], // TODO: Load deals if needed
      opportunities: [], // TODO: Load opportunities if needed
      lastActivityAt: row.last_activity_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
