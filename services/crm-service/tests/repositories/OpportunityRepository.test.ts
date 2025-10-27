import { Pool } from 'pg';
import { OpportunityRepository } from '../../src/repositories/OpportunityRepository';
import {
  CreateOpportunityRequest,
  OpportunitySearchRequest,
  UpdateOpportunityRequest,
} from '../../src/types';

// Mock the database pool
const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
} as unknown as Pool;

describe('OpportunityRepository', () => {
  let repository: OpportunityRepository;

  beforeEach(() => {
    repository = new OpportunityRepository(mockPool);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an opportunity successfully', async () => {
      const createRequest: CreateOpportunityRequest = {
        name: 'Test Opportunity',
        contactId: 'contact-123',
        companyId: 'company-123',
        value: 50000,
        currency: 'USD',
        probability: 75,
        stage: 'qualified',
        source: 'website',
        description: 'Test opportunity description',
        expectedCloseDate: new Date('2024-12-31'),
        ownerId: 'user-123',
        customFields: { priority: 'high' },
        tags: ['hot-lead', 'enterprise'],
      };

      const mockDbResult = {
        rows: [
          {
            id: 'opp-123',
            name: 'Test Opportunity',
            contact_id: 'contact-123',
            company_id: 'company-123',
            deal_id: null,
            value: 50000,
            currency: 'USD',
            probability: 75,
            stage: 'qualified',
            source: 'website',
            description: 'Test opportunity description',
            expected_close_date: new Date('2024-12-31'),
            actual_close_date: null,
            owner_id: 'user-123',
            custom_fields: { priority: 'high' },
            tags: ['hot-lead', 'enterprise'],
            created_by: 'user-456',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      mockQuery.mockResolvedValueOnce(mockDbResult);

      const result = await repository.create(createRequest, 'user-456');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO opportunities'),
        expect.arrayContaining([
          'Test Opportunity',
          'contact-123',
          'company-123',
          null, // dealId
          50000,
          'USD',
          75,
          'qualified',
          'website',
          'Test opportunity description',
          expect.any(Date),
          'user-123',
          JSON.stringify({ priority: 'high' }),
          ['hot-lead', 'enterprise'],
          'user-456',
        ])
      );

      expect(result).toEqual({
        id: 'opp-123',
        name: 'Test Opportunity',
        contactId: 'contact-123',
        companyId: 'company-123',
        dealId: null,
        value: 50000,
        currency: 'USD',
        probability: 75,
        stage: 'qualified',
        source: 'website',
        description: 'Test opportunity description',
        expectedCloseDate: expect.any(Date),
        actualCloseDate: null,
        ownerId: 'user-123',
        customFields: { priority: 'high' },
        tags: ['hot-lead', 'enterprise'],
        createdBy: 'user-456',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('findById', () => {
    it('should return opportunity when found', async () => {
      const mockDbResult = {
        rows: [
          {
            id: 'opp-123',
            name: 'Test Opportunity',
            contact_id: 'contact-123',
            company_id: 'company-123',
            deal_id: null,
            value: 50000,
            currency: 'USD',
            probability: 75,
            stage: 'qualified',
            source: 'website',
            description: 'Test opportunity description',
            expected_close_date: new Date('2024-12-31'),
            actual_close_date: null,
            owner_id: 'user-123',
            custom_fields: { priority: 'high' },
            tags: ['hot-lead', 'enterprise'],
            created_by: 'user-456',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      mockQuery.mockResolvedValueOnce(mockDbResult);

      const result = await repository.findById('opp-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM opportunities WHERE id = $1',
        ['opp-123']
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('opp-123');
      expect(result?.name).toBe('Test Opportunity');
    });

    it('should return null when opportunity not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should search opportunities with filters', async () => {
      const searchRequest: OpportunitySearchRequest = {
        query: 'test',
        stage: ['qualified'],
        ownerId: ['user-123'],
        valueMin: 10000,
        valueMax: 100000,
        page: 1,
        limit: 10,
      };

      const mockCountResult = { rows: [{ count: '1' }] };
      const mockOpportunitiesResult = {
        rows: [
          {
            id: 'opp-123',
            name: 'Test Opportunity',
            contact_id: 'contact-123',
            company_id: 'company-123',
            deal_id: null,
            value: 50000,
            currency: 'USD',
            probability: 75,
            stage: 'qualified',
            source: 'website',
            description: 'Test opportunity description',
            expected_close_date: new Date('2024-12-31'),
            actual_close_date: null,
            owner_id: 'user-123',
            custom_fields: {},
            tags: [],
            created_by: 'user-456',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      mockQuery
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockOpportunitiesResult);

      const result = await repository.search(searchRequest);

      expect(result.total).toBe(1);
      expect(result.opportunities).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });
  });

  describe('update', () => {
    it('should update opportunity successfully', async () => {
      const updateRequest: UpdateOpportunityRequest = {
        name: 'Updated Opportunity',
        value: 75000,
        probability: 85,
        stage: 'proposal',
      };

      const mockDbResult = {
        rows: [
          {
            id: 'opp-123',
            name: 'Updated Opportunity',
            contact_id: 'contact-123',
            company_id: 'company-123',
            deal_id: null,
            value: 75000,
            currency: 'USD',
            probability: 85,
            stage: 'proposal',
            source: 'website',
            description: 'Test opportunity description',
            expected_close_date: new Date('2024-12-31'),
            actual_close_date: null,
            owner_id: 'user-123',
            custom_fields: {},
            tags: [],
            created_by: 'user-456',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      mockQuery.mockResolvedValueOnce(mockDbResult);

      const result = await repository.update('opp-123', updateRequest);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE opportunities SET'),
        expect.arrayContaining(['Updated Opportunity', 75000, 85, 'proposal'])
      );

      expect(result.name).toBe('Updated Opportunity');
      expect(result.value).toBe(75000);
      expect(result.probability).toBe(85);
      expect(result.stage).toBe('proposal');
    });
  });

  describe('delete', () => {
    it('should delete opportunity successfully', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await repository.delete('opp-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM opportunities WHERE id = $1',
        ['opp-123']
      );
    });

    it('should throw error when opportunity not found', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      await expect(repository.delete('non-existent')).rejects.toThrow(
        'Opportunity not found'
      );
    });
  });

  describe('getOpportunityStats', () => {
    it('should return opportunity statistics', async () => {
      const mockTotalResult = { rows: [{ count: '10' }] };
      const mockStageResult = {
        rows: [
          { stage: 'qualified', count: '3' },
          { stage: 'proposal', count: '2' },
          { stage: 'closed_won', count: '2' },
          { stage: 'closed_lost', count: '3' },
        ],
      };
      const mockValueResult = {
        rows: [{ total_value: '500000', avg_value: '50000' }],
      };

      mockQuery
        .mockResolvedValueOnce(mockTotalResult)
        .mockResolvedValueOnce(mockStageResult)
        .mockResolvedValueOnce(mockValueResult);

      const result = await repository.getOpportunityStats('user-123');

      expect(result.total).toBe(10);
      expect(result.byStage).toEqual({
        qualified: 3,
        proposal: 2,
        closed_won: 2,
        closed_lost: 3,
      });
      expect(result.totalValue).toBe(500000);
      expect(result.averageValue).toBe(50000);
      expect(result.winRate).toBe(40); // 2 won out of 5 closed (2 won + 3 lost)
    });
  });
});
