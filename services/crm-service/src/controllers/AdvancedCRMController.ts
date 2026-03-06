// @ts-nocheck
import { AdvancedCRMService } from '@/services/AdvancedCRMService';
import {
  CompanySearchRequest,
  CustomFieldEntity,
  DealSearchRequest,
  TaskSearchRequest,
  ValidationError,
} from '@/types';
import {
  validateCreateCompany,
  validateCreateCustomField,
  validateCreateDeal,
  validateCreateSalesPipeline,
  validateCreateTask,
  validateUpdateCompany,
  validateUpdateCustomField,
  validateUpdateDeal,
  validateUpdateSalesPipeline,
  validateUpdateTask,
} from '@/utils/validation';
import { NextFunction, Request, Response } from 'express';

export class AdvancedCRMController {
  constructor(private advancedCRMService: AdvancedCRMService) {}

  private validateRequiredParam(
    value: string | undefined,
    paramName: string
  ): string {
    if (!value) {
      throw new ValidationError(`${paramName} is required`);
    }
    return value;
  }

  // ============================================================================
  // SALES PIPELINE ENDPOINTS
  // ============================================================================

  createSalesPipeline = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const pipelineData = validateCreateSalesPipeline(req.body);
      const createdBy = req.user?.id;

      // Filter out undefined values for exactOptionalPropertyTypes compliance
      const cleanPipelineData = this.filterUndefinedValues(pipelineData);

      const pipeline = await this.advancedCRMService.createSalesPipeline(
        cleanPipelineData,
        createdBy
      );

      res.status(201).json({
        success: true,
        data: pipeline,
        message: 'Sales pipeline created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getSalesPipeline = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Pipeline ID');
      const pipeline = await this.advancedCRMService.getSalesPipeline(id);

      res.json({
        success: true,
        data: pipeline,
      });
    } catch (error) {
      next(error);
    }
  };

  getAllSalesPipelines = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';

      const result = await this.advancedCRMService.getAllSalesPipelines({
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateSalesPipeline = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Pipeline ID');
      const updates = validateUpdateSalesPipeline(req.body);

      // Filter out undefined values for exactOptionalPropertyTypes compliance
      const cleanUpdates = this.filterUndefinedValues(updates);

      const pipeline = await this.advancedCRMService.updateSalesPipeline(
        id,
        cleanUpdates
      );

      res.json({
        success: true,
        data: pipeline,
        message: 'Sales pipeline updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteSalesPipeline = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Pipeline ID');
      await this.advancedCRMService.deleteSalesPipeline(id);

      res.json({
        success: true,
        message: 'Sales pipeline deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // DEAL ENDPOINTS
  // ============================================================================

  createDeal = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const dealData = validateCreateDeal(req.body);
      const createdBy = req.user?.id;

      // Filter out undefined values for exactOptionalPropertyTypes compliance
      const cleanDealData = this.filterUndefinedValues(dealData);

      const deal = await this.advancedCRMService.createDeal(
        cleanDealData,
        createdBy
      );

      res.status(201).json({
        success: true,
        data: deal,
        message: 'Deal created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getDeal = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Deal ID');
      const deal = await this.advancedCRMService.getDeal(id);

      res.json({
        success: true,
        data: deal,
      });
    } catch (error) {
      next(error);
    }
  };

  searchDeals = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const searchParams = this.parseDealSearchParams(req.query);
      const result = await this.advancedCRMService.searchDeals(searchParams);

      res.json({
        success: true,
        data: result.deals,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateDeal = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Deal ID');
      const updates = validateUpdateDeal(req.body);

      // Filter out undefined values for exactOptionalPropertyTypes compliance
      const cleanUpdates = this.filterUndefinedValues(updates);

      const deal = await this.advancedCRMService.updateDeal(id, cleanUpdates);

      res.json({
        success: true,
        data: deal,
        message: 'Deal updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteDeal = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Deal ID');
      await this.advancedCRMService.deleteDeal(id);

      res.json({
        success: true,
        message: 'Deal deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  moveDealToStage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Deal ID');
      const { stageId } = req.body;

      if (!stageId) {
        throw new ValidationError('stageId is required');
      }

      const deal = await this.advancedCRMService.moveDealToStage(id, stageId);

      res.json({
        success: true,
        data: deal,
        message: 'Deal moved to new stage successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getDealsByPipeline = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const pipelineId = this.validateRequiredParam(
        req.params.pipelineId,
        'Pipeline ID'
      );
      const deals =
        await this.advancedCRMService.getDealsByPipeline(pipelineId);

      res.json({
        success: true,
        data: deals,
      });
    } catch (error) {
      next(error);
    }
  };

  getDealsByStage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stageId = this.validateRequiredParam(
        req.params.stageId,
        'Stage ID'
      );
      const deals = await this.advancedCRMService.getDealsByStage(stageId);

      res.json({
        success: true,
        data: deals,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // COMPANY ENDPOINTS
  // ============================================================================

  createCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const companyData = validateCreateCompany(req.body);
      const createdBy = req.user?.id;

      // Filter out undefined values for exactOptionalPropertyTypes compliance
      const cleanCompanyData = this.filterUndefinedValues(companyData);

      const company = await this.advancedCRMService.createCompany(
        cleanCompanyData,
        createdBy
      );

      res.status(201).json({
        success: true,
        data: company,
        message: 'Company created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Company ID');
      const company = await this.advancedCRMService.getCompany(id);

      res.json({
        success: true,
        data: company,
      });
    } catch (error) {
      next(error);
    }
  };

  searchCompanies = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const searchParams = this.parseCompanySearchParams(req.query);
      const result =
        await this.advancedCRMService.searchCompanies(searchParams);

      res.json({
        success: true,
        data: result.companies,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Company ID');
      const updates = validateUpdateCompany(req.body);

      // Filter out undefined values for exactOptionalPropertyTypes compliance
      const cleanUpdates = this.filterUndefinedValues(updates);

      const company = await this.advancedCRMService.updateCompany(
        id,
        cleanUpdates
      );

      res.json({
        success: true,
        data: company,
        message: 'Company updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Company ID');
      await this.advancedCRMService.deleteCompany(id);

      res.json({
        success: true,
        message: 'Company deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  addContactToCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Company ID');
      const { contactId, role, isPrimary } = req.body;

      if (!contactId) {
        throw new ValidationError('contactId is required');
      }

      await this.advancedCRMService.addContactToCompany(
        id,
        contactId,
        role,
        isPrimary
      );

      res.json({
        success: true,
        message: 'Contact added to company successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  removeContactFromCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Company ID');
      const contactId = this.validateRequiredParam(
        req.params.contactId,
        'Contact ID'
      );
      await this.advancedCRMService.removeContactFromCompany(id, contactId);

      res.json({
        success: true,
        message: 'Contact removed from company successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getCompanyContacts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Company ID');
      const contactIds = await this.advancedCRMService.getCompanyContacts(id);

      res.json({
        success: true,
        data: { contactIds, count: contactIds.length },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // TASK ENDPOINTS
  // ============================================================================

  createTask = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const taskData = validateCreateTask(req.body);
      const createdBy = req.user?.id;

      // Filter out undefined values for exactOptionalPropertyTypes compliance
      const cleanTaskData = this.filterUndefinedValues(taskData);

      const task = await this.advancedCRMService.createTask(
        cleanTaskData,
        createdBy
      );

      res.status(201).json({
        success: true,
        data: task,
        message: 'Task created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getTask = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Task ID');
      const task = await this.advancedCRMService.getTask(id);

      res.json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  searchTasks = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const searchParams = this.parseTaskSearchParams(req.query);
      const result = await this.advancedCRMService.searchTasks(searchParams);

      res.json({
        success: true,
        data: result.tasks,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateTask = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Task ID');
      const updates = validateUpdateTask(req.body);

      // Filter out undefined values for exactOptionalPropertyTypes compliance
      const cleanUpdates = this.filterUndefinedValues(updates);

      const task = await this.advancedCRMService.updateTask(id, cleanUpdates);

      res.json({
        success: true,
        data: task,
        message: 'Task updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteTask = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Task ID');
      await this.advancedCRMService.deleteTask(id);

      res.json({
        success: true,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  completeTask = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Task ID');
      const task = await this.advancedCRMService.completeTask(id);

      res.json({
        success: true,
        data: task,
        message: 'Task completed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getTasksByAssignee = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const assigneeId = this.validateRequiredParam(
        req.params.assigneeId,
        'Assignee ID'
      );
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';

      const result = await this.advancedCRMService.getTasksByAssignee(
        assigneeId,
        {
          page,
          limit,
          sortBy,
          sortOrder,
        }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getOverdueTasks = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tasks = await this.advancedCRMService.getOverdueTasks();

      res.json({
        success: true,
        data: tasks,
      });
    } catch (error) {
      next(error);
    }
  };

  getTasksDueToday = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tasks = await this.advancedCRMService.getTasksDueToday();

      res.json({
        success: true,
        data: tasks,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // CUSTOM FIELD ENDPOINTS
  // ============================================================================

  createCustomField = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const fieldData = validateCreateCustomField(req.body);
      const createdBy = req.user?.id;

      // Filter out undefined values for exactOptionalPropertyTypes compliance
      const cleanFieldData = this.filterUndefinedValues(fieldData);

      const field = await this.advancedCRMService.createCustomField(
        cleanFieldData,
        createdBy
      );

      res.status(201).json({
        success: true,
        data: field,
        message: 'Custom field created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getCustomField = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Custom Field ID');
      const field = await this.advancedCRMService.getCustomField(id);

      res.json({
        success: true,
        data: field,
      });
    } catch (error) {
      next(error);
    }
  };

  getCustomFieldsByEntity = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { entityType } = req.params;
      const fields = await this.advancedCRMService.getCustomFieldsByEntity(
        entityType as CustomFieldEntity
      );

      res.json({
        success: true,
        data: fields,
      });
    } catch (error) {
      next(error);
    }
  };

  getAllCustomFields = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';

      const result = await this.advancedCRMService.getAllCustomFields({
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateCustomField = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Custom Field ID');
      const updates = validateUpdateCustomField(req.body);

      // Filter out undefined values for exactOptionalPropertyTypes compliance
      const cleanUpdates = this.filterUndefinedValues(updates);

      const field = await this.advancedCRMService.updateCustomField(
        id,
        cleanUpdates
      );

      res.json({
        success: true,
        data: field,
        message: 'Custom field updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteCustomField = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Custom Field ID');
      await this.advancedCRMService.deleteCustomField(id);

      res.json({
        success: true,
        message: 'Custom field deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  reorderCustomFields = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { entityType } = req.params;
      const { fieldOrders } = req.body;

      if (!Array.isArray(fieldOrders)) {
        throw new ValidationError('fieldOrders must be an array');
      }

      await this.advancedCRMService.reorderCustomFields(
        entityType as CustomFieldEntity,
        fieldOrders
      );

      res.json({
        success: true,
        message: 'Custom fields reordered successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // ANALYTICS AND REPORTING ENDPOINTS
  // ============================================================================

  getDashboardStats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await this.advancedCRMService.getDashboardStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  generateRevenueForecast = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { period, startDate, endDate } = req.query;

      if (!period || !startDate || !endDate) {
        throw new ValidationError(
          'period, startDate, and endDate are required'
        );
      }

      const forecast = await this.advancedCRMService.generateRevenueForecast(
        period as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: forecast,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // OPPORTUNITY ENDPOINTS
  // ============================================================================

  createOpportunity = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const opportunityData = req.body; // TODO: Add validation
      const createdBy = req.user?.id;

      const opportunity = await this.advancedCRMService.createOpportunity(
        opportunityData,
        createdBy
      );

      res.status(201).json({
        success: true,
        data: opportunity,
        message: 'Opportunity created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getOpportunity = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Opportunity ID');
      const opportunity = await this.advancedCRMService.getOpportunity(id);

      res.json({
        success: true,
        data: opportunity,
      });
    } catch (error) {
      next(error);
    }
  };

  searchOpportunities = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const searchParams = this.parseOpportunitySearchParams(req.query);
      const result =
        await this.advancedCRMService.searchOpportunities(searchParams);

      res.json({
        success: true,
        data: result.opportunities,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateOpportunity = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Opportunity ID');
      const updates = req.body; // TODO: Add validation

      const opportunity = await this.advancedCRMService.updateOpportunity(
        id,
        updates
      );

      res.json({
        success: true,
        data: opportunity,
        message: 'Opportunity updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteOpportunity = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Opportunity ID');
      await this.advancedCRMService.deleteOpportunity(id);

      res.json({
        success: true,
        message: 'Opportunity deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // MEETING ENDPOINTS
  // ============================================================================

  createMeeting = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const meetingData = req.body; // TODO: Add validation
      const createdBy = req.user?.id;

      const meeting = await this.advancedCRMService.createMeeting(
        meetingData,
        createdBy
      );

      res.status(201).json({
        success: true,
        data: meeting,
        message: 'Meeting created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getMeeting = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Meeting ID');
      const meeting = await this.advancedCRMService.getMeeting(id);

      res.json({
        success: true,
        data: meeting,
      });
    } catch (error) {
      next(error);
    }
  };

  updateMeeting = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Meeting ID');
      const updates = req.body; // TODO: Add validation

      const meeting = await this.advancedCRMService.updateMeeting(id, updates);

      res.json({
        success: true,
        data: meeting,
        message: 'Meeting updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteMeeting = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = this.validateRequiredParam(req.params.id, 'Meeting ID');
      await this.advancedCRMService.deleteMeeting(id);

      res.json({
        success: true,
        message: 'Meeting deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getUpcomingMeetings = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const meetings = await this.advancedCRMService.getUpcomingMeetings(limit);

      res.json({
        success: true,
        data: meetings,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // COMMUNICATION HISTORY ENDPOINTS
  // ============================================================================

  createCommunicationRecord = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const recordData = req.body; // TODO: Add validation
      const createdBy = req.user?.id;

      const record = await this.advancedCRMService.createCommunicationRecord(
        recordData,
        createdBy
      );

      res.status(201).json({
        success: true,
        data: record,
        message: 'Communication record created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getCommunicationHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const entityType = this.validateRequiredParam(
        req.params.entityType,
        'Entity Type'
      );
      const entityId = this.validateRequiredParam(
        req.params.entityId,
        'Entity ID'
      );
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await this.advancedCRMService.getCommunicationHistory(
        entityType as 'contact' | 'company' | 'deal' | 'opportunity',
        entityId,
        { page, limit }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getRecentActivity = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const entityType = this.validateRequiredParam(
        req.params.entityType,
        'Entity Type'
      );
      const entityId = this.validateRequiredParam(
        req.params.entityId,
        'Entity ID'
      );
      const limit = parseInt(req.query.limit as string) || 10;

      const activities = await this.advancedCRMService.getRecentActivity(
        entityType as 'contact' | 'company' | 'deal' | 'opportunity',
        entityId,
        limit
      );

      res.json({
        success: true,
        data: activities,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private parseDealSearchParams(query: any): DealSearchRequest {
    const {
      q,
      pipelineId,
      stageId,
      status,
      ownerId,
      contactId,
      companyId,
      valueMin,
      valueMax,
      priority,
      tags,
      expectedCloseBefore,
      expectedCloseAfter,
      createdAfter,
      createdBefore,
      sortBy,
      sortOrder,
      page,
      limit,
    } = query;

    const searchParams: DealSearchRequest = {
      sortBy: sortBy || 'created_at',
      sortOrder: sortOrder || 'desc',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    };

    if (q) searchParams.query = q;
    if (pipelineId) searchParams.pipelineId = pipelineId;
    if (stageId) searchParams.stageId = stageId;
    if (status) searchParams.status = Array.isArray(status) ? status : [status];
    if (ownerId)
      searchParams.ownerId = Array.isArray(ownerId) ? ownerId : [ownerId];
    if (contactId) searchParams.contactId = contactId;
    if (companyId) searchParams.companyId = companyId;
    if (valueMin) searchParams.valueMin = parseFloat(valueMin);
    if (valueMax) searchParams.valueMax = parseFloat(valueMax);
    if (priority)
      searchParams.priority = Array.isArray(priority) ? priority : [priority];
    if (tags) searchParams.tags = Array.isArray(tags) ? tags : [tags];
    if (expectedCloseBefore)
      searchParams.expectedCloseBefore = new Date(expectedCloseBefore);
    if (expectedCloseAfter)
      searchParams.expectedCloseAfter = new Date(expectedCloseAfter);
    if (createdAfter) searchParams.createdAfter = new Date(createdAfter);
    if (createdBefore) searchParams.createdBefore = new Date(createdBefore);

    return searchParams;
  }

  private parseCompanySearchParams(query: any): CompanySearchRequest {
    const {
      q,
      industry,
      size,
      ownerId,
      tags,
      revenueMin,
      revenueMax,
      createdAfter,
      createdBefore,
      sortBy,
      sortOrder,
      page,
      limit,
    } = query;

    const searchParams: CompanySearchRequest = {
      sortBy: sortBy || 'created_at',
      sortOrder: sortOrder || 'desc',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    };

    if (q) searchParams.query = q;
    if (industry)
      searchParams.industry = Array.isArray(industry) ? industry : [industry];
    if (size) searchParams.size = Array.isArray(size) ? size : [size];
    if (ownerId)
      searchParams.ownerId = Array.isArray(ownerId) ? ownerId : [ownerId];
    if (tags) searchParams.tags = Array.isArray(tags) ? tags : [tags];
    if (revenueMin) searchParams.revenueMin = parseFloat(revenueMin);
    if (revenueMax) searchParams.revenueMax = parseFloat(revenueMax);
    if (createdAfter) searchParams.createdAfter = new Date(createdAfter);
    if (createdBefore) searchParams.createdBefore = new Date(createdBefore);

    return searchParams;
  }

  private parseTaskSearchParams(query: any): TaskSearchRequest {
    const {
      q,
      type,
      status,
      priority,
      assignedTo,
      contactId,
      companyId,
      dealId,
      opportunityId,
      dueBefore,
      dueAfter,
      tags,
      isOverdue,
      createdAfter,
      createdBefore,
      sortBy,
      sortOrder,
      page,
      limit,
    } = query;

    const searchParams: TaskSearchRequest = {
      sortBy: sortBy || 'created_at',
      sortOrder: sortOrder || 'desc',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    };

    if (q) searchParams.query = q;
    if (type) searchParams.type = Array.isArray(type) ? type : [type];
    if (status) searchParams.status = Array.isArray(status) ? status : [status];
    if (priority)
      searchParams.priority = Array.isArray(priority) ? priority : [priority];
    if (assignedTo)
      searchParams.assignedTo = Array.isArray(assignedTo)
        ? assignedTo
        : [assignedTo];
    if (contactId) searchParams.contactId = contactId;
    if (companyId) searchParams.companyId = companyId;
    if (dealId) searchParams.dealId = dealId;
    if (opportunityId) searchParams.opportunityId = opportunityId;
    if (dueBefore) searchParams.dueBefore = new Date(dueBefore);
    if (dueAfter) searchParams.dueAfter = new Date(dueAfter);
    if (tags) searchParams.tags = Array.isArray(tags) ? tags : [tags];
    if (isOverdue !== undefined) searchParams.isOverdue = isOverdue === 'true';
    if (createdAfter) searchParams.createdAfter = new Date(createdAfter);
    if (createdBefore) searchParams.createdBefore = new Date(createdBefore);

    return searchParams;
  }

  private parseOpportunitySearchParams(query: any): any {
    const {
      q,
      stage,
      ownerId,
      contactId,
      companyId,
      dealId,
      valueMin,
      valueMax,
      probabilityMin,
      probabilityMax,
      tags,
      expectedCloseBefore,
      expectedCloseAfter,
      createdAfter,
      createdBefore,
      sortBy,
      sortOrder,
      page,
      limit,
    } = query;

    const searchParams: any = {
      sortBy: sortBy || 'created_at',
      sortOrder: sortOrder || 'desc',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    };

    if (q) searchParams.query = q;
    if (stage) searchParams.stage = Array.isArray(stage) ? stage : [stage];
    if (ownerId)
      searchParams.ownerId = Array.isArray(ownerId) ? ownerId : [ownerId];
    if (contactId) searchParams.contactId = contactId;
    if (companyId) searchParams.companyId = companyId;
    if (dealId) searchParams.dealId = dealId;
    if (valueMin) searchParams.valueMin = parseFloat(valueMin);
    if (valueMax) searchParams.valueMax = parseFloat(valueMax);
    if (probabilityMin) searchParams.probabilityMin = parseInt(probabilityMin);
    if (probabilityMax) searchParams.probabilityMax = parseInt(probabilityMax);
    if (tags) searchParams.tags = Array.isArray(tags) ? tags : [tags];
    if (expectedCloseBefore)
      searchParams.expectedCloseBefore = new Date(expectedCloseBefore);
    if (expectedCloseAfter)
      searchParams.expectedCloseAfter = new Date(expectedCloseAfter);
    if (createdAfter) searchParams.createdAfter = new Date(createdAfter);
    if (createdBefore) searchParams.createdBefore = new Date(createdBefore);

    return searchParams;
  }

  /**
   * Helper method to filter out undefined values from objects
   * This is needed for exactOptionalPropertyTypes compliance
   */
  private filterUndefinedValues<T extends Record<string, any>>(obj: T): any {
    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          // Handle arrays - filter undefined values from array elements if they are objects
          result[key] = value.map(item =>
            typeof item === 'object' && item !== null
              ? this.filterUndefinedValues(item)
              : item
          );
        } else if (typeof value === 'object' && value !== null) {
          // Handle nested objects
          result[key] = this.filterUndefinedValues(value);
        } else {
          // Handle primitive values
          result[key] = value;
        }
      }
    }

    return result;
  }
}
