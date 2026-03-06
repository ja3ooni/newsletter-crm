// @ts-nocheck
import {
  CommunicationHistoryRepository,
  CreateCommunicationRecordRequest,
} from '@/repositories/CommunicationHistoryRepository';
import { CompanyRepository } from '@/repositories/CompanyRepository';
import { CustomFieldRepository } from '@/repositories/CustomFieldRepository';
import { MeetingRepository } from '@/repositories/MeetingRepository';
import { OpportunityRepository } from '@/repositories/OpportunityRepository';
import { SalesPipelineRepository } from '@/repositories/SalesPipelineRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import {
  Company,
  CompanySearchRequest,
  CompanySearchResponse,
  CreateCompanyRequest,
  CreateCustomFieldRequest,
  CreateDealRequest,
  CreateMeetingRequest,
  CreateOpportunityRequest,
  CreateSalesPipelineRequest,
  CreateTaskRequest,
  CustomField,
  CustomFieldEntity,
  Deal,
  DealSearchRequest,
  DealSearchResponse,
  Meeting,
  NotFoundError,
  Opportunity,
  OpportunitySearchRequest,
  OpportunitySearchResponse,
  PaginatedResponse,
  PaginationOptions,
  SalesPipeline,
  Task,
  TaskSearchRequest,
  TaskSearchResponse,
  UpdateCompanyRequest,
  UpdateCustomFieldRequest,
  UpdateDealRequest,
  UpdateMeetingRequest,
  UpdateOpportunityRequest,
  UpdateSalesPipelineRequest,
  UpdateTaskRequest,
  ValidationError,
} from '@/types';
import logger from '@/utils/logger';

export class AdvancedCRMService {
  constructor(
    private salesPipelineRepository: SalesPipelineRepository,
    private companyRepository: CompanyRepository,
    private taskRepository: TaskRepository,
    private customFieldRepository: CustomFieldRepository,
    private opportunityRepository: OpportunityRepository,
    private meetingRepository: MeetingRepository,
    private communicationHistoryRepository: CommunicationHistoryRepository
  ) {}

  // ============================================================================
  // SALES PIPELINE MANAGEMENT
  // ============================================================================

  async createSalesPipeline(
    data: CreateSalesPipelineRequest,
    createdBy?: string
  ): Promise<SalesPipeline> {
    try {
      logger.info('Creating sales pipeline', { name: data.name, createdBy });

      // Validate stages
      if (!data.stages || data.stages.length === 0) {
        throw new ValidationError(
          'Sales pipeline must have at least one stage'
        );
      }

      // Ensure stage orders are sequential
      const sortedStages = data.stages.sort((a, b) => a.order - b.order);
      for (let i = 0; i < sortedStages.length; i++) {
        if (sortedStages[i]!.order !== i + 1) {
          throw new ValidationError(
            'Stage orders must be sequential starting from 1'
          );
        }
      }

      const pipeline = await this.salesPipelineRepository.createPipeline(
        data,
        createdBy
      );

      logger.info('Sales pipeline created successfully', {
        pipelineId: pipeline.id,
      });
      return pipeline;
    } catch (error) {
      logger.error('Error creating sales pipeline:', error);
      throw error;
    }
  }

  async getSalesPipeline(id: string): Promise<SalesPipeline> {
    const pipeline = await this.salesPipelineRepository.findPipelineById(id);
    if (!pipeline) {
      throw new NotFoundError('Sales Pipeline');
    }
    return pipeline;
  }

  async getAllSalesPipelines(
    options?: PaginationOptions
  ): Promise<PaginatedResponse<SalesPipeline>> {
    return this.salesPipelineRepository.findAllPipelines(options);
  }

  async updateSalesPipeline(
    id: string,
    updates: UpdateSalesPipelineRequest
  ): Promise<SalesPipeline> {
    try {
      logger.info('Updating sales pipeline', {
        pipelineId: id,
        updates: Object.keys(updates),
      });

      // Validate stages if provided
      if (updates.stages) {
        const sortedStages = updates.stages.sort((a, b) => a.order! - b.order!);
        for (let i = 0; i < sortedStages.length; i++) {
          if (sortedStages[i]!.order !== i + 1) {
            throw new ValidationError(
              'Stage orders must be sequential starting from 1'
            );
          }
        }
      }

      const pipeline = await this.salesPipelineRepository.updatePipeline(
        id,
        updates
      );

      logger.info('Sales pipeline updated successfully', { pipelineId: id });
      return pipeline;
    } catch (error) {
      logger.error('Error updating sales pipeline:', { id, error });
      throw error;
    }
  }

  async deleteSalesPipeline(id: string): Promise<void> {
    try {
      logger.info('Deleting sales pipeline', { pipelineId: id });

      // Check if pipeline has active deals
      const deals = await this.salesPipelineRepository.getDealsByPipeline(id);
      if (deals.length > 0) {
        throw new ValidationError('Cannot delete pipeline with active deals');
      }

      await this.salesPipelineRepository.deletePipeline(id);

      logger.info('Sales pipeline deleted successfully', { pipelineId: id });
    } catch (error) {
      logger.error('Error deleting sales pipeline:', { id, error });
      throw error;
    }
  }

  // ============================================================================
  // DEAL MANAGEMENT
  // ============================================================================

  async createDeal(data: CreateDealRequest, createdBy?: string): Promise<Deal> {
    try {
      logger.info('Creating deal', { name: data.name, createdBy });

      // Validate pipeline and stage exist
      const pipeline = await this.getSalesPipeline(data.pipelineId);
      const stage = pipeline.stages.find(s => s.id === data.stageId);
      if (!stage) {
        throw new ValidationError('Invalid stage for the selected pipeline');
      }

      // Validate custom fields if provided
      if (data.customFields) {
        const validation =
          await this.customFieldRepository.validateEntityCustomFields(
            'deal',
            data.customFields
          );
        if (!validation.isValid) {
          throw new ValidationError(
            `Custom field validation failed: ${validation.errors.join(', ')}`
          );
        }
      }

      const deal = await this.salesPipelineRepository.createDeal(
        data,
        createdBy
      );

      logger.info('Deal created successfully', { dealId: deal.id });
      return deal;
    } catch (error) {
      logger.error('Error creating deal:', error);
      throw error;
    }
  }

  async getDeal(id: string): Promise<Deal> {
    const deal = await this.salesPipelineRepository.findDealById(id);
    if (!deal) {
      throw new NotFoundError('Deal');
    }
    return deal;
  }

  async searchDeals(
    searchParams: DealSearchRequest
  ): Promise<DealSearchResponse> {
    return this.salesPipelineRepository.searchDeals(searchParams);
  }

  async updateDeal(id: string, updates: UpdateDealRequest): Promise<Deal> {
    try {
      logger.info('Updating deal', {
        dealId: id,
        updates: Object.keys(updates),
      });

      // Validate stage if provided
      if (updates.stageId) {
        const deal = await this.getDeal(id);
        const pipeline = await this.getSalesPipeline(deal.pipelineId);
        const stage = pipeline.stages.find(s => s.id === updates.stageId);
        if (!stage) {
          throw new ValidationError('Invalid stage for the deal pipeline');
        }

        // Auto-update probability based on stage
        if (!updates.probability) {
          updates.probability = stage.probability;
        }

        // Auto-update status based on stage
        if (stage.isClosedWon) {
          updates.status = 'won';
          updates.actualCloseDate = new Date();
        } else if (stage.isClosedLost) {
          updates.status = 'lost';
          updates.actualCloseDate = new Date();
        }
      }

      // Validate custom fields if provided
      if (updates.customFields) {
        const validation =
          await this.customFieldRepository.validateEntityCustomFields(
            'deal',
            updates.customFields
          );
        if (!validation.isValid) {
          throw new ValidationError(
            `Custom field validation failed: ${validation.errors.join(', ')}`
          );
        }
      }

      const deal = await this.salesPipelineRepository.updateDeal(id, updates);

      logger.info('Deal updated successfully', { dealId: id });
      return deal;
    } catch (error) {
      logger.error('Error updating deal:', { id, error });
      throw error;
    }
  }

  async deleteDeal(id: string): Promise<void> {
    try {
      logger.info('Deleting deal', { dealId: id });
      await this.salesPipelineRepository.deleteDeal(id);
      logger.info('Deal deleted successfully', { dealId: id });
    } catch (error) {
      logger.error('Error deleting deal:', { id, error });
      throw error;
    }
  }

  async moveDealToStage(dealId: string, stageId: string): Promise<Deal> {
    return this.updateDeal(dealId, { stageId });
  }

  async getDealsByPipeline(pipelineId: string): Promise<Deal[]> {
    return this.salesPipelineRepository.getDealsByPipeline(pipelineId);
  }

  async getDealsByStage(stageId: string): Promise<Deal[]> {
    return this.salesPipelineRepository.getDealsByStage(stageId);
  }

  // ============================================================================
  // COMPANY MANAGEMENT
  // ============================================================================

  async createCompany(
    data: CreateCompanyRequest,
    createdBy?: string
  ): Promise<Company> {
    try {
      logger.info('Creating company', { name: data.name, createdBy });

      // Check for duplicate domain
      if (data.domain) {
        const existingCompany = await this.companyRepository.findByDomain(
          data.domain
        );
        if (existingCompany) {
          throw new ValidationError(
            `Company with domain ${data.domain} already exists`
          );
        }
      }

      // Validate custom fields if provided
      if (data.customFields) {
        const validation =
          await this.customFieldRepository.validateEntityCustomFields(
            'company',
            data.customFields
          );
        if (!validation.isValid) {
          throw new ValidationError(
            `Custom field validation failed: ${validation.errors.join(', ')}`
          );
        }
      }

      const company = await this.companyRepository.create(data, createdBy);

      logger.info('Company created successfully', { companyId: company.id });
      return company;
    } catch (error) {
      logger.error('Error creating company:', error);
      throw error;
    }
  }

  async getCompany(id: string): Promise<Company> {
    const company = await this.companyRepository.findById(id);
    if (!company) {
      throw new NotFoundError('Company');
    }
    return company;
  }

  async searchCompanies(
    searchParams: CompanySearchRequest
  ): Promise<CompanySearchResponse> {
    return this.companyRepository.search(searchParams);
  }

  async updateCompany(
    id: string,
    updates: UpdateCompanyRequest
  ): Promise<Company> {
    try {
      logger.info('Updating company', {
        companyId: id,
        updates: Object.keys(updates),
      });

      // Check for duplicate domain if updating
      if (updates.domain) {
        const existingCompany = await this.companyRepository.findByDomain(
          updates.domain
        );
        if (existingCompany && existingCompany.id !== id) {
          throw new ValidationError(
            `Company with domain ${updates.domain} already exists`
          );
        }
      }

      // Validate custom fields if provided
      if (updates.customFields) {
        const validation =
          await this.customFieldRepository.validateEntityCustomFields(
            'company',
            updates.customFields
          );
        if (!validation.isValid) {
          throw new ValidationError(
            `Custom field validation failed: ${validation.errors.join(', ')}`
          );
        }
      }

      const company = await this.companyRepository.update(id, updates);

      logger.info('Company updated successfully', { companyId: id });
      return company;
    } catch (error) {
      logger.error('Error updating company:', { id, error });
      throw error;
    }
  }

  async deleteCompany(id: string): Promise<void> {
    try {
      logger.info('Deleting company', { companyId: id });
      await this.companyRepository.delete(id);
      logger.info('Company deleted successfully', { companyId: id });
    } catch (error) {
      logger.error('Error deleting company:', { id, error });
      throw error;
    }
  }

  async addContactToCompany(
    companyId: string,
    contactId: string,
    role?: string,
    isPrimary: boolean = false
  ): Promise<void> {
    try {
      await this.companyRepository.addContact(
        companyId,
        contactId,
        role,
        isPrimary
      );
      logger.info('Contact added to company', {
        companyId,
        contactId,
        role,
        isPrimary,
      });
    } catch (error) {
      logger.error('Error adding contact to company:', {
        companyId,
        contactId,
        error,
      });
      throw error;
    }
  }

  async removeContactFromCompany(
    companyId: string,
    contactId: string
  ): Promise<void> {
    try {
      await this.companyRepository.removeContact(companyId, contactId);
      logger.info('Contact removed from company', { companyId, contactId });
    } catch (error) {
      logger.error('Error removing contact from company:', {
        companyId,
        contactId,
        error,
      });
      throw error;
    }
  }

  async getCompanyContacts(companyId: string): Promise<string[]> {
    return this.companyRepository.getContacts(companyId);
  }

  // ============================================================================
  // TASK AND ACTIVITY MANAGEMENT
  // ============================================================================

  async createTask(data: CreateTaskRequest, createdBy?: string): Promise<Task> {
    try {
      logger.info('Creating task', { title: data.title, createdBy });

      // Validate custom fields if provided
      if (data.customFields) {
        const validation =
          await this.customFieldRepository.validateEntityCustomFields(
            'task',
            data.customFields
          );
        if (!validation.isValid) {
          throw new ValidationError(
            `Custom field validation failed: ${validation.errors.join(', ')}`
          );
        }
      }

      const task = await this.taskRepository.create(data, createdBy);

      logger.info('Task created successfully', { taskId: task.id });
      return task;
    } catch (error) {
      logger.error('Error creating task:', error);
      throw error;
    }
  }

  async getTask(id: string): Promise<Task> {
    const task = await this.taskRepository.findById(id);
    if (!task) {
      throw new NotFoundError('Task');
    }
    return task;
  }

  async searchTasks(
    searchParams: TaskSearchRequest
  ): Promise<TaskSearchResponse> {
    return this.taskRepository.search(searchParams);
  }

  async updateTask(id: string, updates: UpdateTaskRequest): Promise<Task> {
    try {
      logger.info('Updating task', {
        taskId: id,
        updates: Object.keys(updates),
      });

      // Validate custom fields if provided
      if (updates.customFields) {
        const validation =
          await this.customFieldRepository.validateEntityCustomFields(
            'task',
            updates.customFields
          );
        if (!validation.isValid) {
          throw new ValidationError(
            `Custom field validation failed: ${validation.errors.join(', ')}`
          );
        }
      }

      const task = await this.taskRepository.update(id, updates);

      logger.info('Task updated successfully', { taskId: id });
      return task;
    } catch (error) {
      logger.error('Error updating task:', { id, error });
      throw error;
    }
  }

  async deleteTask(id: string): Promise<void> {
    try {
      logger.info('Deleting task', { taskId: id });
      await this.taskRepository.delete(id);
      logger.info('Task deleted successfully', { taskId: id });
    } catch (error) {
      logger.error('Error deleting task:', { id, error });
      throw error;
    }
  }

  async completeTask(id: string): Promise<Task> {
    try {
      logger.info('Completing task', { taskId: id });
      const task = await this.taskRepository.markAsCompleted(id);
      logger.info('Task completed successfully', { taskId: id });
      return task;
    } catch (error) {
      logger.error('Error completing task:', { id, error });
      throw error;
    }
  }

  async getTasksByAssignee(
    assigneeId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<Task>> {
    return this.taskRepository.findByAssignee(assigneeId, options);
  }

  async getOverdueTasks(): Promise<Task[]> {
    return this.taskRepository.findOverdueTasks();
  }

  async getTasksDueToday(): Promise<Task[]> {
    return this.taskRepository.findTasksDueToday();
  }

  async getTasksWithReminders(): Promise<Task[]> {
    return this.taskRepository.findTasksWithReminders();
  }

  // ============================================================================
  // CUSTOM FIELD MANAGEMENT
  // ============================================================================

  async createCustomField(
    data: CreateCustomFieldRequest,
    createdBy?: string
  ): Promise<CustomField> {
    try {
      logger.info('Creating custom field', {
        name: data.name,
        entityType: data.entityType,
        createdBy,
      });

      const field = await this.customFieldRepository.create(data, createdBy);

      logger.info('Custom field created successfully', { fieldId: field.id });
      return field;
    } catch (error) {
      logger.error('Error creating custom field:', error);
      throw error;
    }
  }

  async getCustomField(id: string): Promise<CustomField> {
    const field = await this.customFieldRepository.findById(id);
    if (!field) {
      throw new NotFoundError('Custom Field');
    }
    return field;
  }

  async getCustomFieldsByEntity(
    entityType: CustomFieldEntity
  ): Promise<CustomField[]> {
    return this.customFieldRepository.findByEntityType(entityType);
  }

  async getAllCustomFields(
    options?: PaginationOptions
  ): Promise<PaginatedResponse<CustomField>> {
    return this.customFieldRepository.findAll(options);
  }

  async updateCustomField(
    id: string,
    updates: UpdateCustomFieldRequest
  ): Promise<CustomField> {
    try {
      logger.info('Updating custom field', {
        fieldId: id,
        updates: Object.keys(updates),
      });

      const field = await this.customFieldRepository.update(id, updates);

      logger.info('Custom field updated successfully', { fieldId: id });
      return field;
    } catch (error) {
      logger.error('Error updating custom field:', { id, error });
      throw error;
    }
  }

  async deleteCustomField(id: string): Promise<void> {
    try {
      logger.info('Deleting custom field', { fieldId: id });
      await this.customFieldRepository.delete(id);
      logger.info('Custom field deleted successfully', { fieldId: id });
    } catch (error) {
      logger.error('Error deleting custom field:', { id, error });
      throw error;
    }
  }

  async reorderCustomFields(
    entityType: CustomFieldEntity,
    fieldOrders: { id: string; order: number }[]
  ): Promise<void> {
    try {
      logger.info('Reordering custom fields', {
        entityType,
        fieldCount: fieldOrders.length,
      });
      await this.customFieldRepository.reorderFields(entityType, fieldOrders);
      logger.info('Custom fields reordered successfully', { entityType });
    } catch (error) {
      logger.error('Error reordering custom fields:', { entityType, error });
      throw error;
    }
  }

  // ============================================================================
  // MEETING MANAGEMENT
  // ============================================================================

  async createMeeting(
    data: CreateMeetingRequest,
    createdBy?: string
  ): Promise<Meeting> {
    try {
      logger.info('Creating meeting', { title: data.title, createdBy });

      const meeting = await this.meetingRepository.create(data, createdBy);

      logger.info('Meeting created successfully', { meetingId: meeting.id });
      return meeting;
    } catch (error) {
      logger.error('Error creating meeting:', error);
      throw error;
    }
  }

  async getMeeting(id: string): Promise<Meeting> {
    const meeting = await this.meetingRepository.findById(id);
    if (!meeting) {
      throw new NotFoundError('Meeting');
    }
    return meeting;
  }

  async updateMeeting(
    id: string,
    updates: UpdateMeetingRequest
  ): Promise<Meeting> {
    try {
      logger.info('Updating meeting', {
        meetingId: id,
        updates: Object.keys(updates),
      });

      const meeting = await this.meetingRepository.update(id, updates);

      logger.info('Meeting updated successfully', { meetingId: id });
      return meeting;
    } catch (error) {
      logger.error('Error updating meeting:', { id, error });
      throw error;
    }
  }

  async deleteMeeting(id: string): Promise<void> {
    try {
      logger.info('Deleting meeting', { meetingId: id });
      await this.meetingRepository.delete(id);
      logger.info('Meeting deleted successfully', { meetingId: id });
    } catch (error) {
      logger.error('Error deleting meeting:', { id, error });
      throw error;
    }
  }

  async getMeetingsByContact(contactId: string): Promise<Meeting[]> {
    return this.meetingRepository.findByContact(contactId);
  }

  async getMeetingsByCompany(companyId: string): Promise<Meeting[]> {
    return this.meetingRepository.findByCompany(companyId);
  }

  async getMeetingsByDeal(dealId: string): Promise<Meeting[]> {
    return this.meetingRepository.findByDeal(dealId);
  }

  async getUpcomingMeetings(limit: number = 10): Promise<Meeting[]> {
    return this.meetingRepository.findUpcoming(limit);
  }

  async getMeetingsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<Meeting[]> {
    return this.meetingRepository.findByDateRange(startDate, endDate);
  }

  // ============================================================================
  // COMMUNICATION HISTORY MANAGEMENT
  // ============================================================================

  async createCommunicationRecord(
    data: CreateCommunicationRecordRequest,
    createdBy?: string
  ): Promise<any> {
    try {
      logger.info('Creating communication record', {
        type: data.type,
        createdBy,
      });

      const record = await this.communicationHistoryRepository.create(
        data,
        createdBy
      );

      logger.info('Communication record created successfully', {
        recordId: record.id,
      });
      return record;
    } catch (error) {
      logger.error('Error creating communication record:', error);
      throw error;
    }
  }

  async getCommunicationHistory(
    entityType: 'contact' | 'company' | 'deal' | 'opportunity',
    entityId: string,
    options?: PaginationOptions
  ): Promise<any> {
    switch (entityType) {
      case 'contact':
        return this.communicationHistoryRepository.findByContact(
          entityId,
          options
        );
      case 'company':
        return this.communicationHistoryRepository.findByCompany(
          entityId,
          options
        );
      case 'deal':
        return this.communicationHistoryRepository.findByDeal(
          entityId,
          options
        );
      case 'opportunity':
        return this.communicationHistoryRepository.findByOpportunity(
          entityId,
          options
        );
      default:
        throw new ValidationError('Invalid entity type');
    }
  }

  async getRecentActivity(
    entityType: 'contact' | 'company' | 'deal' | 'opportunity',
    entityId: string,
    limit: number = 10
  ): Promise<any[]> {
    return this.communicationHistoryRepository.getRecentActivity(
      entityType,
      entityId,
      limit
    );
  }

  async getCommunicationStats(
    entityType: 'contact' | 'company' | 'deal' | 'opportunity',
    entityId: string
  ): Promise<any> {
    return this.communicationHistoryRepository.getCommunicationStats(
      entityType,
      entityId
    );
  }

  // ============================================================================
  // OPPORTUNITY MANAGEMENT
  // ============================================================================

  async createOpportunity(
    data: CreateOpportunityRequest,
    createdBy?: string
  ): Promise<Opportunity> {
    try {
      logger.info('Creating opportunity', { name: data.name, createdBy });

      // Validate custom fields if provided
      if (data.customFields) {
        const validation =
          await this.customFieldRepository.validateEntityCustomFields(
            'opportunity',
            data.customFields
          );
        if (!validation.isValid) {
          throw new ValidationError(
            `Custom field validation failed: ${validation.errors.join(', ')}`
          );
        }
      }

      const opportunity = await this.opportunityRepository.create(
        data,
        createdBy
      );

      logger.info('Opportunity created successfully', {
        opportunityId: opportunity.id,
      });
      return opportunity;
    } catch (error) {
      logger.error('Error creating opportunity:', error);
      throw error;
    }
  }

  async getOpportunity(id: string): Promise<Opportunity> {
    const opportunity = await this.opportunityRepository.findById(id);
    if (!opportunity) {
      throw new NotFoundError('Opportunity');
    }
    return opportunity;
  }

  async searchOpportunities(
    searchParams: OpportunitySearchRequest
  ): Promise<OpportunitySearchResponse> {
    return this.opportunityRepository.search(searchParams);
  }

  async updateOpportunity(
    id: string,
    updates: UpdateOpportunityRequest
  ): Promise<Opportunity> {
    try {
      logger.info('Updating opportunity', {
        opportunityId: id,
        updates: Object.keys(updates),
      });

      // Validate custom fields if provided
      if (updates.customFields) {
        const validation =
          await this.customFieldRepository.validateEntityCustomFields(
            'opportunity',
            updates.customFields
          );
        if (!validation.isValid) {
          throw new ValidationError(
            `Custom field validation failed: ${validation.errors.join(', ')}`
          );
        }
      }

      const opportunity = await this.opportunityRepository.update(id, updates);

      logger.info('Opportunity updated successfully', { opportunityId: id });
      return opportunity;
    } catch (error) {
      logger.error('Error updating opportunity:', { id, error });
      throw error;
    }
  }

  async deleteOpportunity(id: string): Promise<void> {
    try {
      logger.info('Deleting opportunity', { opportunityId: id });
      await this.opportunityRepository.delete(id);
      logger.info('Opportunity deleted successfully', { opportunityId: id });
    } catch (error) {
      logger.error('Error deleting opportunity:', { id, error });
      throw error;
    }
  }

  async getOpportunitiesByContact(contactId: string): Promise<Opportunity[]> {
    return this.opportunityRepository.findByContact(contactId);
  }

  async getOpportunitiesByCompany(companyId: string): Promise<Opportunity[]> {
    return this.opportunityRepository.findByCompany(companyId);
  }

  async getOpportunitiesByDeal(dealId: string): Promise<Opportunity[]> {
    return this.opportunityRepository.findByDeal(dealId);
  }

  // ============================================================================
  // REVENUE FORECASTING (Placeholder for future implementation)
  // ============================================================================

  async generateRevenueForecast(
    period: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      logger.info('Generating revenue forecast', {
        period,
        startDate,
        endDate,
      });

      // Get all open deals within the forecast period
      const deals = await this.searchDeals({
        status: ['open'],
        expectedCloseAfter: startDate,
        expectedCloseBefore: endDate,
        limit: 1000,
      });

      let totalWeightedValue = 0;
      let totalPotentialValue = 0;
      const forecastDeals = [];

      for (const deal of deals.deals) {
        if (deal.value && deal.probability) {
          const weightedValue = deal.value * (deal.probability / 100);
          totalWeightedValue += weightedValue;
          totalPotentialValue += deal.value;

          forecastDeals.push({
            dealId: deal.id,
            name: deal.name,
            value: deal.value,
            probability: deal.probability,
            expectedCloseDate: deal.expectedCloseDate,
            weightedValue,
          });
        }
      }

      const forecast = {
        period,
        startDate,
        endDate,
        totalDeals: deals.total,
        totalPotentialValue,
        predictedRevenue: totalWeightedValue,
        confidence: deals.total > 0 ? Math.min(90, 50 + deals.total * 2) : 0,
        deals: forecastDeals,
        generatedAt: new Date(),
      };

      logger.info('Revenue forecast generated', {
        period,
        totalDeals: deals.total,
        predictedRevenue: totalWeightedValue,
      });

      return forecast;
    } catch (error) {
      logger.error('Error generating revenue forecast:', error);
      throw error;
    }
  }

  // ============================================================================
  // ANALYTICS AND REPORTING
  // ============================================================================

  async getDashboardStats(): Promise<{
    deals: any;
    tasks: any;
    companies: any;
    pipeline: any;
    opportunities: any;
    meetings: any;
  }> {
    try {
      // Get deal stats
      const allDeals = await this.searchDeals({ limit: 1000 });
      const dealStats = {
        total: allDeals.total,
        open: allDeals.deals.filter(d => d.status === 'open').length,
        won: allDeals.deals.filter(d => d.status === 'won').length,
        lost: allDeals.deals.filter(d => d.status === 'lost').length,
        totalValue: allDeals.deals.reduce((sum, d) => sum + (d.value || 0), 0),
        averageValue:
          allDeals.total > 0
            ? allDeals.deals.reduce((sum, d) => sum + (d.value || 0), 0) /
              allDeals.total
            : 0,
      };

      // Get task stats
      const taskStats = await this.taskRepository.getTaskStats();

      // Get company stats
      const companyStats = await this.companyRepository.getCompanyStats();

      // Get pipeline performance
      const pipelines = await this.getAllSalesPipelines({
        page: 1,
        limit: 100,
      });
      const pipelineStats = {
        total: pipelines.total,
        active: pipelines.data.filter(p => p.isActive).length,
      };

      // Get opportunity stats
      const opportunityStats =
        await this.opportunityRepository.getOpportunityStats();

      // Get meeting stats
      const upcomingMeetings = await this.getUpcomingMeetings(50);
      const meetingStats = {
        upcoming: upcomingMeetings.length,
        today: upcomingMeetings.filter(m => {
          const today = new Date();
          const meetingDate = new Date(m.startTime);
          return meetingDate.toDateString() === today.toDateString();
        }).length,
      };

      return {
        deals: dealStats,
        tasks: taskStats,
        companies: companyStats,
        pipeline: pipelineStats,
        opportunities: opportunityStats,
        meetings: meetingStats,
      };
    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      throw error;
    }
  }
}
