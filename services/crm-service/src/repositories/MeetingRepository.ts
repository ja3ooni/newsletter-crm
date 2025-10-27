import {
  CreateMeetingRequest,
  Meeting,
  NotFoundError,
  PaginatedResponse,
  PaginationOptions,
  UpdateMeetingRequest,
} from '@/types';
import logger from '@/utils/logger';
import { Pool } from 'pg';

export class MeetingRepository {
  constructor(private db: Pool) {}

  async create(
    data: CreateMeetingRequest,
    createdBy?: string
  ): Promise<Meeting> {
    try {
      const result = await this.db.query(
        `INSERT INTO meetings (
          title, description, start_time, end_time, location, meeting_url,
          attendees, contact_ids, company_ids, deal_id, opportunity_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          data.title,
          data.description,
          data.startTime,
          data.endTime,
          data.location,
          data.meetingUrl,
          JSON.stringify(data.attendees || []),
          data.contactIds || [],
          data.companyIds || [],
          data.dealId,
          data.opportunityId,
          createdBy,
        ]
      );

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error creating meeting:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Meeting | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM meetings WHERE id = $1',
        [id]
      );

      return result.rows.length > 0 ? this.mapFromDb(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding meeting by ID:', { id, error });
      throw error;
    }
  }

  async update(id: string, updates: UpdateMeetingRequest): Promise<Meeting> {
    try {
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      const updateableFields = [
        'title',
        'description',
        'start_time',
        'end_time',
        'location',
        'meeting_url',
        'attendees',
        'contact_ids',
        'company_ids',
        'deal_id',
        'opportunity_id',
        'status',
        'outcome',
        'follow_up_tasks',
      ];

      for (const [key, value] of Object.entries(updates)) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (updateableFields.includes(dbField)) {
          setParts.push(`${dbField} = $${paramIndex++}`);
          if (key === 'attendees') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
        }
      }

      if (setParts.length === 0) {
        const meeting = await this.findById(id);
        if (!meeting) throw new NotFoundError('Meeting');
        return meeting;
      }

      setParts.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      values.push(id);

      const result = await this.db.query(
        `UPDATE meetings SET ${setParts.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Meeting');
      }

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error updating meeting:', { id, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.db.query('DELETE FROM meetings WHERE id = $1', [
        id,
      ]);

      if (result.rowCount === 0) {
        throw new NotFoundError('Meeting');
      }
    } catch (error) {
      logger.error('Error deleting meeting:', { id, error });
      throw error;
    }
  }

  async findAll(
    options?: PaginationOptions
  ): Promise<PaginatedResponse<Meeting>> {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'start_time',
        sortOrder = 'asc',
      } = options || {};
      const offset = (page - 1) * limit;

      const countResult = await this.db.query('SELECT COUNT(*) FROM meetings');
      const total = parseInt(countResult.rows[0].count);

      const meetingsResult = await this.db.query(
        `SELECT * FROM meetings
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const meetings = meetingsResult.rows.map(this.mapFromDb);

      return {
        data: meetings,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error finding all meetings:', error);
      throw error;
    }
  }

  async findByContact(contactId: string): Promise<Meeting[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM meetings WHERE $1 = ANY(contact_ids) ORDER BY start_time DESC',
        [contactId]
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding meetings by contact:', { contactId, error });
      throw error;
    }
  }

  async findByCompany(companyId: string): Promise<Meeting[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM meetings WHERE $1 = ANY(company_ids) ORDER BY start_time DESC',
        [companyId]
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding meetings by company:', { companyId, error });
      throw error;
    }
  }

  async findByDeal(dealId: string): Promise<Meeting[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM meetings WHERE deal_id = $1 ORDER BY start_time DESC',
        [dealId]
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding meetings by deal:', { dealId, error });
      throw error;
    }
  }

  async findUpcoming(limit: number = 10): Promise<Meeting[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM meetings
         WHERE start_time > NOW() AND status = 'scheduled'
         ORDER BY start_time ASC
         LIMIT $1`,
        [limit]
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding upcoming meetings:', error);
      throw error;
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Meeting[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM meetings
         WHERE start_time >= $1 AND start_time <= $2
         ORDER BY start_time ASC`,
        [startDate, endDate]
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding meetings by date range:', {
        startDate,
        endDate,
        error,
      });
      throw error;
    }
  }

  private mapFromDb(row: any): Meeting {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      startTime: row.start_time,
      endTime: row.end_time,
      location: row.location,
      meetingUrl: row.meeting_url,
      attendees: row.attendees || [],
      contactIds: row.contact_ids || [],
      companyIds: row.company_ids || [],
      dealId: row.deal_id,
      opportunityId: row.opportunity_id,
      status: row.status,
      outcome: row.outcome,
      followUpTasks: row.follow_up_tasks || [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
