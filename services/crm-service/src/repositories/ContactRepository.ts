// @ts-nocheck
import {
  Contact,
  ContactAddress,
  ContactConsent,
  ContactFilter,
  ContactLifecycle,
  ContactPreferences,
  ContactSearchRequest,
  ContactSearchResponse,
  CreateContactRequest,
  DatabaseContact,
  DuplicateContactError,
  NotFoundError,
  UpdateContactRequest
} from '@/types';
import database from '@/utils/database';
import logger from '@/utils/logger';
import redis from '@/utils/redis';

export class ContactRepository {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'contact:';

  // Convert database row to Contact object
  private mapDatabaseToContact(row: DatabaseContact): Contact {
    const contact: Contact = {
      id: row.id,
      email: row.email,
      customFields: row.custom_fields || {},
      tags: row.tags || [],
      leadScore: row.lead_score || 0,
      lifecycle: row.lifecycle as ContactLifecycle,
      preferences: row.preferences as ContactPreferences || {
        emailFrequency: 'weekly' as const,
        contentTypes: [],
        communicationChannels: ['email'],
        timezone: 'UTC',
        language: 'en',
      },
      consent: row.consent as ContactConsent || {
        marketing: false,
        analytics: false,
        thirdParty: false,
        consentDate: new Date(),
        consentSource: 'api',
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Only add optional properties if they have values
    if (row.first_name) contact.firstName = row.first_name;
    if (row.last_name) contact.lastName = row.last_name;
    if (row.company) contact.company = row.company;
    if (row.job_title) contact.jobTitle = row.job_title;
    if (row.phone) contact.phone = row.phone;
    if (row.website) contact.website = row.website;
    if (row.address) contact.address = row.address as ContactAddress;
    if (row.source) contact.source = row.source;
    if (row.utm_source) contact.utmSource = row.utm_source;
    if (row.utm_medium) contact.utmMedium = row.utm_medium;
    if (row.utm_campaign) contact.utmCampaign = row.utm_campaign;
    if (row.last_activity_at) contact.lastActivityAt = row.last_activity_at;
    if (row.owner_id) contact.ownerId = row.owner_id;
    if (row.created_by) contact.createdBy = row.created_by;

    return contact;
  }

  // Convert Contact object to database format
  private mapContactToDatabase(contact: Partial<Contact>): Partial<DatabaseContact> {
    const result: Partial<DatabaseContact> = {};

    if (contact.email !== undefined) result.email = contact.email;
    if (contact.firstName !== undefined) result.first_name = contact.firstName;
    if (contact.lastName !== undefined) result.last_name = contact.lastName;
    if (contact.company !== undefined) result.company = contact.company;
    if (contact.jobTitle !== undefined) result.job_title = contact.jobTitle;
    if (contact.phone !== undefined) result.phone = contact.phone;
    if (contact.website !== undefined) result.website = contact.website;
    if (contact.address !== undefined) result.address = contact.address;
    if (contact.customFields !== undefined) result.custom_fields = contact.customFields;
    if (contact.tags !== undefined) result.tags = contact.tags;
    if (contact.leadScore !== undefined) result.lead_score = contact.leadScore;
    if (contact.lifecycle !== undefined) result.lifecycle = contact.lifecycle;
    if (contact.source !== undefined) result.source = contact.source;
    if (contact.utmSource !== undefined) result.utm_source = contact.utmSource;
    if (contact.utmMedium !== undefined) result.utm_medium = contact.utmMedium;
    if (contact.utmCampaign !== undefined) result.utm_campaign = contact.utmCampaign;
    if (contact.preferences !== undefined) result.preferences = contact.preferences;
    if (contact.consent !== undefined) result.consent = contact.consent;
    if (contact.lastActivityAt !== undefined) result.last_activity_at = contact.lastActivityAt;
    if (contact.ownerId !== undefined) result.owner_id = contact.ownerId;
    if (contact.createdBy !== undefined) result.created_by = contact.createdBy;

    return result;
  }

  async create(contactData: CreateContactRequest, createdBy?: string): Promise<Contact> {
    try {
      // Check for existing contact
      const existing = await this.findByEmail(contactData.email);
      if (existing) {
        throw new DuplicateContactError(contactData.email);
      }

      // Create a proper contact object with defaults
      const contactWithDefaults = {
        ...contactData,
        leadScore: 0,
        createdBy: createdBy || undefined,
        preferences: {
          emailFrequency: 'weekly' as const,
          contentTypes: [],
          communicationChannels: ['email'],
          timezone: 'UTC',
          language: 'en',
          ...contactData.preferences,
        },
        consent: {
          marketing: false,
          analytics: false,
          thirdParty: false,
          consentDate: new Date(),
          consentSource: 'api',
          ...contactData.consent,
        },
      };

      const dbData = this.mapContactToDatabase(contactWithDefaults as Contact);

      const query = `
        INSERT INTO contacts (
          email, first_name, last_name, company, job_title, phone, website,
          address, custom_fields, tags, lead_score, lifecycle, source,
          utm_source, utm_medium, utm_campaign, preferences, consent,
          owner_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING *
      `;

      const values = [
        dbData.email,
        dbData.first_name,
        dbData.last_name,
        dbData.company,
        dbData.job_title,
        dbData.phone,
        dbData.website,
        JSON.stringify(dbData.address || {}),
        JSON.stringify(dbData.custom_fields || {}),
        dbData.tags || [],
        dbData.lead_score || 0,
        dbData.lifecycle || 'subscriber',
        dbData.source,
        dbData.utm_source,
        dbData.utm_medium,
        dbData.utm_campaign,
        JSON.stringify(dbData.preferences || {}),
        JSON.stringify(dbData.consent || {}),
        dbData.owner_id,
        dbData.created_by,
      ];

      const result = await database.query<DatabaseContact>(query, values);
      const contact = this.mapDatabaseToContact(result.rows[0]!);

      // Cache the new contact
      await this.cacheContact(contact);

      logger.info('Contact created', { contactId: contact.id, email: contact.email });
      return contact;
    } catch (error) {
      logger.error('Error creating contact:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Contact | null> {
    try {
      // Try cache first
      const cached = await redis.cacheGet<Contact>(`${this.CACHE_PREFIX}${id}`);
      if (cached) {
        return cached;
      }

      const query = 'SELECT * FROM contacts WHERE id = $1';
      const result = await database.query<DatabaseContact>(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const contact = this.mapDatabaseToContact(result.rows[0]!);
      await this.cacheContact(contact);

      return contact;
    } catch (error) {
      logger.error('Error finding contact by ID:', { id, error });
      throw error;
    }
  }

  async findByEmail(email: string): Promise<Contact | null> {
    try {
      const query = 'SELECT * FROM contacts WHERE email = $1';
      const result = await database.query<DatabaseContact>(query, [email.toLowerCase()]);

      if (result.rows.length === 0) {
        return null;
      }

      const contact = this.mapDatabaseToContact(result.rows[0]!);
      await this.cacheContact(contact);

      return contact;
    } catch (error) {
      logger.error('Error finding contact by email:', { email, error });
      throw error;
    }
  }

  async update(id: string, updates: UpdateContactRequest): Promise<Contact> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError('Contact');
      }

      // Merge preferences properly
      const mergedUpdates = {
        ...updates,
        preferences: updates.preferences ? {
          ...existing.preferences,
          ...updates.preferences,
        } : undefined,
      };

      const dbData = this.mapContactToDatabase(mergedUpdates as Contact);

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.entries(dbData).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          if (key === 'address' || key === 'custom_fields' || key === 'preferences' || key === 'consent') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        return existing;
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE contacts
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await database.query<DatabaseContact>(query, values);
      const contact = this.mapDatabaseToContact(result.rows[0]!);

      // Update cache
      await this.cacheContact(contact);

      logger.info('Contact updated', { contactId: id });
      return contact;
    } catch (error) {
      logger.error('Error updating contact:', { id, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const query = 'DELETE FROM contacts WHERE id = $1';
      const result = await database.query(query, [id]);

      if (result.rowCount === 0) {
        throw new NotFoundError('Contact');
      }

      // Remove from cache
      await redis.del(`${this.CACHE_PREFIX}${id}`);

      logger.info('Contact deleted', { contactId: id });
    } catch (error) {
      logger.error('Error deleting contact:', { id, error });
      throw error;
    }
  }

  async search(searchParams: ContactSearchRequest): Promise<ContactSearchResponse> {
    try {
      const {
        query,
        filters = [],
        segments = [],
        tags = [],
        lifecycle = [],
        source = [],
        ownerId = [],
        createdAfter,
        createdBefore,
        lastActivityAfter,
        lastActivityBefore,
        leadScoreMin,
        leadScoreMax,
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        limit = 50,
      } = searchParams;

      // Build WHERE clause
      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Text search
      if (query) {
        whereConditions.push(`(
          email ILIKE $${paramIndex} OR
          first_name ILIKE $${paramIndex} OR
          last_name ILIKE $${paramIndex} OR
          company ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${query}%`);
        paramIndex++;
      }

      // Filters
      filters.forEach((filter) => {
        const condition = this.buildFilterCondition(filter, paramIndex);
        whereConditions.push(condition.clause);
        queryParams.push(...condition.params);
        paramIndex += condition.params.length;
      });

      // Segments
      if (segments.length > 0) {
        whereConditions.push(`id IN (
          SELECT contact_id FROM contact_segments
          WHERE segment_id = ANY($${paramIndex})
        )`);
        queryParams.push(segments);
        paramIndex++;
      }

      // Tags
      if (tags.length > 0) {
        whereConditions.push(`tags && $${paramIndex}`);
        queryParams.push(tags);
        paramIndex++;
      }

      // Lifecycle
      if (lifecycle.length > 0) {
        whereConditions.push(`lifecycle = ANY($${paramIndex})`);
        queryParams.push(lifecycle);
        paramIndex++;
      }

      // Source
      if (source.length > 0) {
        whereConditions.push(`source = ANY($${paramIndex})`);
        queryParams.push(source);
        paramIndex++;
      }

      // Owner
      if (ownerId.length > 0) {
        whereConditions.push(`owner_id = ANY($${paramIndex})`);
        queryParams.push(ownerId);
        paramIndex++;
      }

      // Date filters
      if (createdAfter) {
        whereConditions.push(`created_at >= $${paramIndex}`);
        queryParams.push(createdAfter);
        paramIndex++;
      }

      if (createdBefore) {
        whereConditions.push(`created_at <= $${paramIndex}`);
        queryParams.push(createdBefore);
        paramIndex++;
      }

      if (lastActivityAfter) {
        whereConditions.push(`last_activity_at >= $${paramIndex}`);
        queryParams.push(lastActivityAfter);
        paramIndex++;
      }

      if (lastActivityBefore) {
        whereConditions.push(`last_activity_at <= $${paramIndex}`);
        queryParams.push(lastActivityBefore);
        paramIndex++;
      }

      // Lead score filters
      if (leadScoreMin !== undefined) {
        whereConditions.push(`lead_score >= $${paramIndex}`);
        queryParams.push(leadScoreMin);
        paramIndex++;
      }

      if (leadScoreMax !== undefined) {
        whereConditions.push(`lead_score <= $${paramIndex}`);
        queryParams.push(leadScoreMax);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Count query
      const countQuery = `SELECT COUNT(*) FROM contacts ${whereClause}`;
      const countResult = await database.query<{ count: string }>(countQuery, queryParams);
      const total = parseInt(countResult.rows[0]!.count, 10);

      // Data query with pagination
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT * FROM contacts
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const dataResult = await database.query<DatabaseContact>(
        dataQuery,
        [...queryParams, limit, offset]
      );

      const contacts = dataResult.rows.map(row => this.mapDatabaseToContact(row));
      const totalPages = Math.ceil(total / limit);

      return {
        contacts,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error searching contacts:', error);
      throw error;
    }
  }

  async findByIds(ids: string[]): Promise<Contact[]> {
    try {
      if (ids.length === 0) return [];

      const query = 'SELECT * FROM contacts WHERE id = ANY($1)';
      const result = await database.query<DatabaseContact>(query, [ids]);

      return result.rows.map(row => this.mapDatabaseToContact(row));
    } catch (error) {
      logger.error('Error finding contacts by IDs:', { ids, error });
      throw error;
    }
  }

  async updateLeadScore(id: string, score: number): Promise<void> {
    try {
      const query = `
        UPDATE contacts
        SET lead_score = $1, updated_at = NOW()
        WHERE id = $2
      `;

      await database.query(query, [score, id]);

      // Invalidate cache
      await redis.del(`${this.CACHE_PREFIX}${id}`);

      logger.info('Lead score updated', { contactId: id, score });
    } catch (error) {
      logger.error('Error updating lead score:', { id, score, error });
      throw error;
    }
  }

  async updateLastActivity(id: string, timestamp: Date = new Date()): Promise<void> {
    try {
      const query = `
        UPDATE contacts
        SET last_activity_at = $1, updated_at = NOW()
        WHERE id = $2
      `;

      await database.query(query, [timestamp, id]);

      // Invalidate cache
      await redis.del(`${this.CACHE_PREFIX}${id}`);

      logger.info('Last activity updated', { contactId: id, timestamp });
    } catch (error) {
      logger.error('Error updating last activity:', { id, timestamp, error });
      throw error;
    }
  }

  async addTags(id: string, tags: string[]): Promise<void> {
    try {
      const query = `
        UPDATE contacts
        SET tags = array(SELECT DISTINCT unnest(tags || $1)), updated_at = NOW()
        WHERE id = $2
      `;

      await database.query(query, [tags, id]);

      // Invalidate cache
      await redis.del(`${this.CACHE_PREFIX}${id}`);

      logger.info('Tags added to contact', { contactId: id, tags });
    } catch (error) {
      logger.error('Error adding tags:', { id, tags, error });
      throw error;
    }
  }

  async removeTags(id: string, tags: string[]): Promise<void> {
    try {
      const query = `
        UPDATE contacts
        SET tags = array(SELECT unnest(tags) EXCEPT SELECT unnest($1)), updated_at = NOW()
        WHERE id = $2
      `;

      await database.query(query, [tags, id]);

      // Invalidate cache
      await redis.del(`${this.CACHE_PREFIX}${id}`);

      logger.info('Tags removed from contact', { contactId: id, tags });
    } catch (error) {
      logger.error('Error removing tags:', { id, tags, error });
      throw error;
    }
  }

  async bulkUpdate(ids: string[], updates: Partial<UpdateContactRequest>): Promise<number> {
    return database.transaction(async (client) => {
      try {
        // Handle preferences merging for bulk updates
        const processedUpdates = {
          ...updates,
          preferences: updates.preferences ? updates.preferences : undefined,
        };

        const dbData = this.mapContactToDatabase(processedUpdates as Contact);

        // Build dynamic update query
        const updateFields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        Object.entries(dbData).forEach(([key, value]) => {
          if (value !== undefined) {
            updateFields.push(`${key} = $${paramIndex}`);
            if (key === 'address' || key === 'custom_fields' || key === 'preferences' || key === 'consent') {
              values.push(JSON.stringify(value));
            } else {
              values.push(value);
            }
            paramIndex++;
          }
        });

        if (updateFields.length === 0) {
          return 0;
        }

        updateFields.push(`updated_at = NOW()`);
        values.push(ids);

        const query = `
          UPDATE contacts
          SET ${updateFields.join(', ')}
          WHERE id = ANY($${paramIndex})
        `;

        const result = await client.query(query, values);

        // Invalidate cache for all updated contacts
        await Promise.all(ids.map(id => redis.del(`${this.CACHE_PREFIX}${id}`)));

        logger.info('Bulk contact update completed', {
          contactCount: result.rowCount,
          updates: Object.keys(updates)
        });

        return result.rowCount || 0;
      } catch (error) {
        logger.error('Error in bulk update:', { ids, updates, error });
        throw error;
      }
    });
  }

  async bulkDelete(ids: string[]): Promise<number> {
    return database.transaction(async (client) => {
      try {
        const query = 'DELETE FROM contacts WHERE id = ANY($1)';
        const result = await client.query(query, [ids]);

        // Remove from cache
        await Promise.all(ids.map(id => redis.del(`${this.CACHE_PREFIX}${id}`)));

        logger.info('Bulk contact deletion completed', { contactCount: result.rowCount });
        return result.rowCount || 0;
      } catch (error) {
        logger.error('Error in bulk delete:', { ids, error });
        throw error;
      }
    });
  }

  async getContactStats(): Promise<{
    total: number;
    byLifecycle: Record<string, number>;
    bySource: Record<string, number>;
    recentActivity: number;
  }> {
    try {
      const [totalResult, lifecycleResult, sourceResult, activityResult] = await Promise.all([
        database.query<{ count: string }>('SELECT COUNT(*) FROM contacts'),
        database.query<{ lifecycle: string; count: string }>(`
          SELECT lifecycle, COUNT(*)
          FROM contacts
          GROUP BY lifecycle
        `),
        database.query<{ source: string; count: string }>(`
          SELECT source, COUNT(*)
          FROM contacts
          WHERE source IS NOT NULL
          GROUP BY source
          ORDER BY COUNT(*) DESC
          LIMIT 10
        `),
        database.query<{ count: string }>(`
          SELECT COUNT(*)
          FROM contacts
          WHERE last_activity_at >= NOW() - INTERVAL '30 days'
        `),
      ]);

      const byLifecycle: Record<string, number> = {};
      lifecycleResult.rows.forEach(row => {
        byLifecycle[row.lifecycle] = parseInt(row.count, 10);
      });

      const bySource: Record<string, number> = {};
      sourceResult.rows.forEach(row => {
        bySource[row.source] = parseInt(row.count, 10);
      });

      return {
        total: parseInt(totalResult.rows[0]!.count, 10),
        byLifecycle,
        bySource,
        recentActivity: parseInt(activityResult.rows[0]!.count, 10),
      };
    } catch (error) {
      logger.error('Error getting contact stats:', error);
      throw error;
    }
  }

  private buildFilterCondition(filter: ContactFilter, paramIndex: number): { clause: string; params: any[] } {
    const { field, operator, value } = filter;

    switch (operator) {
      case 'equals':
        return { clause: `${field} = $${paramIndex}`, params: [value] };
      case 'not_equals':
        return { clause: `${field} != $${paramIndex}`, params: [value] };
      case 'contains':
        return { clause: `${field} ILIKE $${paramIndex}`, params: [`%${value}%`] };
      case 'not_contains':
        return { clause: `${field} NOT ILIKE $${paramIndex}`, params: [`%${value}%`] };
      case 'starts_with':
        return { clause: `${field} ILIKE $${paramIndex}`, params: [`${value}%`] };
      case 'ends_with':
        return { clause: `${field} ILIKE $${paramIndex}`, params: [`%${value}`] };
      case 'greater_than':
        return { clause: `${field} > $${paramIndex}`, params: [value] };
      case 'less_than':
        return { clause: `${field} < $${paramIndex}`, params: [value] };
      case 'greater_than_or_equal':
        return { clause: `${field} >= $${paramIndex}`, params: [value] };
      case 'less_than_or_equal':
        return { clause: `${field} <= $${paramIndex}`, params: [value] };
      case 'in':
        return { clause: `${field} = ANY($${paramIndex})`, params: [Array.isArray(value) ? value : [value]] };
      case 'not_in':
        return { clause: `${field} != ALL($${paramIndex})`, params: [Array.isArray(value) ? value : [value]] };
      case 'is_empty':
        return { clause: `(${field} IS NULL OR ${field} = '')`, params: [] };
      case 'is_not_empty':
        return { clause: `(${field} IS NOT NULL AND ${field} != '')`, params: [] };
      case 'date_before':
        return { clause: `${field} < $${paramIndex}`, params: [value] };
      case 'date_after':
        return { clause: `${field} > $${paramIndex}`, params: [value] };
      case 'date_between':
        return {
          clause: `${field} BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
          params: Array.isArray(value) ? value : [value, value]
        };
      default:
        throw new Error(`Unsupported filter operator: ${operator}`);
    }
  }

  private async cacheContact(contact: Contact): Promise<void> {
    try {
      await redis.cacheSet(`${this.CACHE_PREFIX}${contact.id}`, contact, this.CACHE_TTL);
    } catch (error) {
      logger.warn('Failed to cache contact:', { contactId: contact.id, error });
    }
  }
}
