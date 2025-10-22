import {
    CampaignMetrics,
    CampaignSubscription,
    CreateDripCampaignRequest,
    DripCampaign,
    FilterParams,
    PaginatedResponse,
    PaginationParams,
    UpdateDripCampaignRequest
} from '@/types';
import { database } from '@/utils/database';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class DripCampaignRepository {
  async create(data: CreateDripCampaignRequest, createdBy: string): Promise<DripCampaign> {
    const id = uuidv4();
    const now = new Date();

    // Add IDs to emails
    const emailsWithIds = data.emails.map((email, index) => ({
      ...email,
      id: uuidv4(),
      order: index,
    }));

    const query = `
      INSERT INTO email_campaigns (
        id, name, description, type, emails, trigger, status, metrics,
        target_segments, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      id,
      data.name,
      data.description,
      'drip',
      JSON.stringify(emailsWithIds),
      JSON.stringify(data.trigger),
      'draft',
      JSON.stringify({
        totalSubscribers: 0,
        activeSubscribers: 0,
        completedSubscribers: 0,
        unsubscribed: 0,
        totalSent: 0,
        totalOpens: 0,
        totalClicks: 0,
        conversionRate: 0,
        emailMetrics: {}
      }),
      data.targetSegments,
      createdBy,
      now,
      now
    ];

    try {
      const result = await database.query(query, values);
      const campaign = this.mapRowToCampaign(result.rows[0]);
      logger.info('Drip campaign created', { campaignId: id, name: data.name });
      return campaign;
    } catch (error) {
      logger.error('Error creating drip campaign', { error, data });
      throw error;
    }
  }

  async findById(id: string): Promise<DripCampaign | null> {
    const query = 'SELECT * FROM email_campaigns WHERE id = $1 AND type = $2';

    try {
      const result = await database.query(query, [id, 'drip']);
      return result.rows[0] ? this.mapRowToCampaign(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding drip campaign by ID', { error, id });
      throw error;
    }
  }

  async findAll(
    pagination: PaginationParams,
    filters?: FilterParams
  ): Promise<PaginatedResponse<DripCampaign>> {
    let whereClause = 'WHERE type = $1';
    const queryParams: any[] = ['drip'];
    let paramIndex = 2;

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      whereClause += ` AND status = ANY($${paramIndex})`;
      queryParams.push(filters.status);
      paramIndex++;
    }

    if (filters?.createdBy) {
      whereClause += ` AND created_by = $${paramIndex}`;
      queryParams.push(filters.createdBy);
      paramIndex++;
    }

    if (filters?.dateRange) {
      whereClause += ` AND created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      queryParams.push(filters.dateRange.start, filters.dateRange.end);
      paramIndex += 2;
    }

    // Count query
    const countQuery = `SELECT COUNT(*) FROM email_campaigns ${whereClause}`;
    const countResult = await database.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Data query with pagination
    const offset = (pagination.page - 1) * pagination.limit;
    const orderBy = pagination.sortBy ?
      `ORDER BY ${pagination.sortBy} ${pagination.sortOrder}` :
      'ORDER BY created_at DESC';

    const dataQuery = `
      SELECT * FROM email_campaigns
      ${whereClause}
      ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(pagination.limit, offset);

    try {
      const result = await database.query(dataQuery, queryParams);
      const campaigns = result.rows.map(row => this.mapRowToCampaign(row));

      return {
        data: campaigns,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
          hasNext: pagination.page < Math.ceil(total / pagination.limit),
          hasPrev: pagination.page > 1,
        },
      };
    } catch (error) {
      logger.error('Error finding drip campaigns', { error, pagination, filters });
      throw error;
    }
  }

  async update(id: string, data: UpdateDripCampaignRequest): Promise<DripCampaign | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(data.name);
      paramIndex++;
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(data.description);
      paramIndex++;
    }

    if (data.emails !== undefined) {
      updates.push(`emails = $${paramIndex}`);
      values.push(JSON.stringify(data.emails));
      paramIndex++;
    }

    if (data.trigger !== undefined) {
      updates.push(`trigger = $${paramIndex}`);
      values.push(JSON.stringify(data.trigger));
      paramIndex++;
    }

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(data.status);
      paramIndex++;
    }

    if (data.targetSegments !== undefined) {
      updates.push(`target_segments = $${paramIndex}`);
      values.push(data.targetSegments);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(id);

    const query = `
      UPDATE email_campaigns
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND type = 'drip'
      RETURNING *
    `;

    try {
      const result = await database.query(query, values);
      if (result.rows[0]) {
        const campaign = this.mapRowToCampaign(result.rows[0]);
        logger.info('Drip campaign updated', { campaignId: id });
        return campaign;
      }
      return null;
    } catch (error) {
      logger.error('Error updating drip campaign', { error, id, data });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM email_campaigns WHERE id = $1 AND type = $2';

    try {
      const result = await database.query(query, [id, 'drip']);
      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.info('Drip campaign deleted', { campaignId: id });
      }
      return deleted;
    } catch (error) {
      logger.error('Error deleting drip campaign', { error, id });
      throw error;
    }
  }

  async updateMetrics(id: string, metrics: CampaignMetrics): Promise<void> {
    const query = `
      UPDATE email_campaigns
      SET metrics = $1, updated_at = $2
      WHERE id = $3 AND type = 'drip'
    `;

    try {
      await database.query(query, [JSON.stringify(metrics), new Date(), id]);
      logger.debug('Drip campaign metrics updated', { campaignId: id });
    } catch (error) {
      logger.error('Error updating drip campaign metrics', { error, id, metrics });
      throw error;
    }
  }

  // Campaign subscription methods
  async createSubscription(
    campaignId: string,
    contactId: string,
    metadata?: Record<string, any>
  ): Promise<CampaignSubscription> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO campaign_subscriptions (
        id, campaign_id, contact_id, status, current_email_index,
        next_email_at, subscribed_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id,
      campaignId,
      contactId,
      'active',
      0,
      null, // Will be calculated based on first email delay
      now,
      JSON.stringify(metadata || {})
    ];

    try {
      const result = await database.query(query, values);
      const subscription = this.mapRowToSubscription(result.rows[0]);
      logger.info('Campaign subscription created', { subscriptionId: id, campaignId, contactId });
      return subscription;
    } catch (error) {
      logger.error('Error creating campaign subscription', { error, campaignId, contactId });
      throw error;
    }
  }

  async findSubscriptionById(id: string): Promise<CampaignSubscription | null> {
    const query = 'SELECT * FROM campaign_subscriptions WHERE id = $1';

    try {
      const result = await database.query(query, [id]);
      return result.rows[0] ? this.mapRowToSubscription(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding subscription by ID', { error, id });
      throw error;
    }
  }

  async findSubscriptionsByCampaign(
    campaignId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<CampaignSubscription>> {
    const offset = (pagination.page - 1) * pagination.limit;

    // Count query
    const countQuery = 'SELECT COUNT(*) FROM campaign_subscriptions WHERE campaign_id = $1';
    const countResult = await database.query(countQuery, [campaignId]);
    const total = parseInt(countResult.rows[0].count);

    // Data query
    const dataQuery = `
      SELECT * FROM campaign_subscriptions
      WHERE campaign_id = $1
      ORDER BY subscribed_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await database.query(dataQuery, [campaignId, pagination.limit, offset]);
      const subscriptions = result.rows.map(row => this.mapRowToSubscription(row));

      return {
        data: subscriptions,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
          hasNext: pagination.page < Math.ceil(total / pagination.limit),
          hasPrev: pagination.page > 1,
        },
      };
    } catch (error) {
      logger.error('Error finding subscriptions by campaign', { error, campaignId });
      throw error;
    }
  }

  async updateSubscription(
    id: string,
    updates: Partial<Pick<CampaignSubscription, 'status' | 'currentEmailIndex' | 'nextEmailAt' | 'completedAt' | 'metadata'>>
  ): Promise<CampaignSubscription | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }

    if (updates.currentEmailIndex !== undefined) {
      updateFields.push(`current_email_index = $${paramIndex}`);
      values.push(updates.currentEmailIndex);
      paramIndex++;
    }

    if (updates.nextEmailAt !== undefined) {
      updateFields.push(`next_email_at = $${paramIndex}`);
      values.push(updates.nextEmailAt);
      paramIndex++;
    }

    if (updates.completedAt !== undefined) {
      updateFields.push(`completed_at = $${paramIndex}`);
      values.push(updates.completedAt);
      paramIndex++;
    }

    if (updates.metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(updates.metadata));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return this.findSubscriptionById(id);
    }

    values.push(id);

    const query = `
      UPDATE campaign_subscriptions
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await database.query(query, values);
      return result.rows[0] ? this.mapRowToSubscription(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error updating subscription', { error, id, updates });
      throw error;
    }
  }

  async findActiveSubscriptions(): Promise<CampaignSubscription[]> {
    const query = `
      SELECT cs.* FROM campaign_subscriptions cs
      JOIN email_campaigns ec ON cs.campaign_id = ec.id
      WHERE cs.status = 'active'
      AND ec.status = 'active'
      AND cs.next_email_at <= NOW()
    `;

    try {
      const result = await database.query(query);
      return result.rows.map(row => this.mapRowToSubscription(row));
    } catch (error) {
      logger.error('Error finding active subscriptions', { error });
      throw error;
    }
  }

  private mapRowToCampaign(row: Record<string, any>): DripCampaign {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      emails: JSON.parse(row.emails),
      trigger: JSON.parse(row.trigger),
      status: row.status,
      metrics: JSON.parse(row.metrics),
      targetSegments: row.target_segments,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToSubscription(row: Record<string, any>): CampaignSubscription {
    return {
      id: row.id,
      campaignId: row.campaign_id,
      contactId: row.contact_id,
      status: row.status,
      currentEmailIndex: row.current_email_index,
      nextEmailAt: row.next_email_at ? new Date(row.next_email_at) : undefined,
      subscribedAt: new Date(row.subscribed_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      metadata: JSON.parse(row.metadata),
    };
  }
}

export default DripCampaignRepository;
