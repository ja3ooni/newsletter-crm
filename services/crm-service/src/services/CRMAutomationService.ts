import { ContactRepository } from '@/repositories/ContactRepository';
import { EngagementEventRepository } from '@/repositories/EngagementEventRepository';
import { LeadScoringRepository } from '@/repositories/LeadScoringRepository';
import { SegmentRepository } from '@/repositories/SegmentRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { TerritoryRepository } from '@/repositories/TerritoryRepository';
import {
  Contact,
  ContactLifecycle,
  CreateTaskRequest,
  EngagementEvent,
  NotFoundError,
} from '@/types';
import { InterServiceClient } from '@/utils/InterServiceClient';
import logger from '@/utils/logger';

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  type: AutomationRuleType;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isActive: boolean;
  priority: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AutomationRuleType =
  | 'lead_assignment'
  | 'follow_up_sequence'
  | 'lead_qualification'
  | 'data_enrichment'
  | 'lifecycle_progression'
  | 'task_creation';

export interface AutomationTrigger {
  event:
    | 'contact_created'
    | 'contact_updated'
    | 'engagement_event'
    | 'score_threshold'
    | 'lifecycle_change'
    | 'time_based';
  conditions?: Record<string, any>;
  schedule?: {
    frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
    time?: string; // HH:MM format
    days?: number[]; // 0=Sunday, 1=Monday, etc.
  };
}

export interface AutomationCondition {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'contains'
    | 'in'
    | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface AutomationAction {
  type:
    | 'assign_owner'
    | 'create_task'
    | 'update_lifecycle'
    | 'add_tags'
    | 'enrich_data'
    | 'send_email'
    | 'create_deal';
  config: Record<string, any>;
  delay?: number; // minutes
}

export interface LeadAssignmentRule {
  id: string;
  name: string;
  priority: number;
  conditions: AutomationCondition[];
  assignmentType:
    | 'territory'
    | 'round_robin'
    | 'load_balanced'
    | 'criteria_based';
  assignmentConfig: {
    territoryId?: string;
    userIds?: string[];
    criteria?: Record<string, any>;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowUpSequence {
  id: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  steps: FollowUpStep[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowUpStep {
  id: string;
  order: number;
  type: 'task' | 'email' | 'wait' | 'condition';
  delay: number; // hours
  config: Record<string, any>;
  conditions?: AutomationCondition[];
}

export interface QualificationWorkflow {
  id: string;
  name: string;
  description?: string;
  scoreThresholds: {
    mql: number; // Marketing Qualified Lead
    sql: number; // Sales Qualified Lead
  };
  actions: {
    onMQL: AutomationAction[];
    onSQL: AutomationAction[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CRMAutomationService {
  constructor(
    private contactRepository: ContactRepository,
    private segmentRepository: SegmentRepository,
    private leadScoringRepository: LeadScoringRepository,
    private taskRepository: TaskRepository,
    private territoryRepository: TerritoryRepository,
    private engagementEventRepository: EngagementEventRepository,
    private interServiceClient: InterServiceClient
  ) {}

  // ============================================================================
  // AUTOMATED LEAD ASSIGNMENT
  // ============================================================================

  async processLeadAssignment(contactId: string): Promise<void> {
    try {
      logger.info('Processing lead assignment', { contactId });

      const contact = await this.contactRepository.findById(contactId);
      if (!contact) {
        throw new NotFoundError('Contact');
      }

      // Skip if contact already has an owner
      if (contact.ownerId) {
        logger.info('Contact already has owner, skipping assignment', {
          contactId,
          ownerId: contact.ownerId,
        });
        return;
      }

      // Get active assignment rules ordered by priority
      const assignmentRules = await this.getActiveLeadAssignmentRules();

      for (const rule of assignmentRules) {
        if (await this.evaluateAssignmentConditions(contact, rule.conditions)) {
          const assignedOwnerId = await this.executeLeadAssignment(
            contact,
            rule
          );
          if (assignedOwnerId) {
            await this.contactRepository.update(contactId, {
              ownerId: assignedOwnerId,
            });

            // Create assignment task
            await this.createAssignmentTask(
              contact,
              assignedOwnerId,
              rule.name
            );

            logger.info('Lead assigned successfully', {
              contactId,
              assignedTo: assignedOwnerId,
              rule: rule.name,
            });
            return;
          }
        }
      }

      logger.warn('No assignment rule matched for contact', { contactId });
    } catch (error) {
      logger.error('Error processing lead assignment:', { contactId, error });
      throw error;
    }
  }

  private async getActiveLeadAssignmentRules(): Promise<LeadAssignmentRule[]> {
    // This would be implemented with a proper repository
    // For now, return mock rules
    return [
      {
        id: '1',
        name: 'Enterprise Territory Assignment',
        priority: 1,
        conditions: [
          { field: 'company', operator: 'not_equals', value: null },
          { field: 'leadScore', operator: 'greater_than', value: 50 },
        ],
        assignmentType: 'territory',
        assignmentConfig: { territoryId: 'enterprise-territory' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        name: 'Round Robin Assignment',
        priority: 2,
        conditions: [],
        assignmentType: 'round_robin',
        assignmentConfig: { userIds: ['user1', 'user2', 'user3'] },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  private async evaluateAssignmentConditions(
    contact: Contact,
    conditions: AutomationCondition[]
  ): Promise<boolean> {
    for (const condition of conditions) {
      const fieldValue = this.getContactFieldValue(contact, condition.field);
      const matches = this.evaluateCondition(fieldValue, condition);

      if (!matches) {
        return false;
      }
    }
    return true;
  }

  private async executeLeadAssignment(
    contact: Contact,
    rule: LeadAssignmentRule
  ): Promise<string | null> {
    switch (rule.assignmentType) {
      case 'territory':
        return this.assignByTerritory(
          contact,
          rule.assignmentConfig.territoryId!
        );
      case 'round_robin':
        return this.assignRoundRobin(rule.assignmentConfig.userIds!);
      case 'load_balanced':
        return this.assignLoadBalanced(rule.assignmentConfig.userIds!);
      case 'criteria_based':
        return this.assignByCriteria(contact, rule.assignmentConfig.criteria!);
      default:
        logger.warn('Unknown assignment type', { type: rule.assignmentType });
        return null;
    }
  }

  private async assignByTerritory(
    contact: Contact,
    territoryId: string
  ): Promise<string | null> {
    try {
      const territory = await this.territoryRepository.findById(territoryId);
      if (!territory || !territory.isActive) {
        return null;
      }

      // Check if contact matches territory rules
      const matchesTerritory = await this.evaluateAssignmentConditions(
        contact,
        territory.rules as AutomationCondition[]
      );

      if (!matchesTerritory) {
        return null;
      }

      // Get territory assignments and find available owner
      const assignments =
        await this.territoryRepository.getAssignments(territoryId);
      const owners = assignments.filter(a => a.role === 'owner');

      if (owners.length === 0) {
        return null;
      }

      // For now, return the first owner (could implement load balancing here)
      return owners[0]!.userId;
    } catch (error) {
      logger.error('Error assigning by territory:', { territoryId, error });
      return null;
    }
  }

  private async assignRoundRobin(userIds: string[]): Promise<string | null> {
    if (userIds.length === 0) return null;

    // Simple round-robin implementation
    // In production, this would track the last assigned user
    const randomIndex = Math.floor(Math.random() * userIds.length);
    return userIds[randomIndex]!;
  }

  private async assignLoadBalanced(userIds: string[]): Promise<string | null> {
    if (userIds.length === 0) return null;

    // Get contact counts for each user and assign to the one with least contacts
    const userContactCounts = await Promise.all(
      userIds.map(async userId => ({
        userId,
        count: 0, // Mock implementation - would call actual repository method
      }))
    );

    const leastBusyUser = userContactCounts.reduce((min, current) =>
      current.count < min.count ? current : min
    );

    return leastBusyUser.userId;
  }

  private async assignByCriteria(
    contact: Contact,
    criteria: Record<string, any>
  ): Promise<string | null> {
    // Implement custom criteria-based assignment logic
    // This could involve complex business rules
    logger.info('Criteria-based assignment not yet implemented', { criteria });
    return null;
  }

  private async createAssignmentTask(
    contact: Contact,
    assignedTo: string,
    ruleName: string
  ): Promise<void> {
    const taskData: CreateTaskRequest = {
      title: `Follow up with new lead: ${contact.firstName} ${contact.lastName}`,
      description: `New lead assigned via ${ruleName}. Contact: ${contact.email}`,
      type: 'follow_up',
      priority: 'medium',
      assignedTo,
      contactId: contact.id,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 24 hours
    };

    await this.taskRepository.create(taskData, 'system');
  }

  // ============================================================================
  // AUTOMATED FOLLOW-UP SEQUENCES
  // ============================================================================

  async processFollowUpSequences(
    contactId: string,
    triggerEvent: string
  ): Promise<void> {
    try {
      logger.info('Processing follow-up sequences', {
        contactId,
        triggerEvent,
      });

      const contact = await this.contactRepository.findById(contactId);
      if (!contact) {
        throw new NotFoundError('Contact');
      }

      const sequences = await this.getActiveFollowUpSequences(triggerEvent);

      for (const sequence of sequences) {
        if (await this.evaluateSequenceTrigger(contact, sequence.trigger)) {
          await this.startFollowUpSequence(contact, sequence);
          logger.info('Follow-up sequence started', {
            contactId,
            sequenceId: sequence.id,
          });
        }
      }
    } catch (error) {
      logger.error('Error processing follow-up sequences:', {
        contactId,
        error,
      });
      throw error;
    }
  }

  private async getActiveFollowUpSequences(
    triggerEvent: string
  ): Promise<FollowUpSequence[]> {
    // Mock implementation - would be replaced with repository call
    return [
      {
        id: '1',
        name: 'New Lead Nurturing',
        description: 'Standard follow-up sequence for new leads',
        trigger: {
          event: 'contact_created',
          conditions: { lifecycle: 'lead' },
        },
        steps: [
          {
            id: '1',
            order: 1,
            type: 'task',
            delay: 1, // 1 hour
            config: {
              title: 'Initial outreach call',
              type: 'call',
              priority: 'high',
            },
          },
          {
            id: '2',
            order: 2,
            type: 'email',
            delay: 24, // 24 hours
            config: {
              templateId: 'welcome-email',
              subject: 'Welcome to our platform',
            },
          },
          {
            id: '3',
            order: 3,
            type: 'task',
            delay: 72, // 72 hours
            config: {
              title: 'Follow-up call',
              type: 'call',
              priority: 'medium',
            },
          },
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  private async evaluateSequenceTrigger(
    contact: Contact,
    trigger: AutomationTrigger
  ): Promise<boolean> {
    if (trigger.conditions) {
      for (const [field, value] of Object.entries(trigger.conditions)) {
        const contactValue = this.getContactFieldValue(contact, field);
        if (contactValue !== value) {
          return false;
        }
      }
    }
    return true;
  }

  private async startFollowUpSequence(
    contact: Contact,
    sequence: FollowUpSequence
  ): Promise<void> {
    for (const step of sequence.steps.sort((a, b) => a.order - b.order)) {
      // Schedule step execution
      await this.scheduleFollowUpStep(contact, step, sequence.id);
    }
  }

  private async scheduleFollowUpStep(
    contact: Contact,
    step: FollowUpStep,
    sequenceId: string
  ): Promise<void> {
    const executeAt = new Date(Date.now() + step.delay * 60 * 60 * 1000);

    switch (step.type) {
      case 'task':
        await this.scheduleTaskCreation(contact, step, executeAt);
        break;
      case 'email':
        await this.scheduleEmailSend(contact, step, executeAt);
        break;
      case 'wait':
        // Just a delay, no action needed
        break;
      case 'condition':
        await this.scheduleConditionCheck(contact, step, executeAt);
        break;
    }
  }

  private async scheduleTaskCreation(
    contact: Contact,
    step: FollowUpStep,
    executeAt: Date
  ): Promise<void> {
    // In a real implementation, this would use a job queue
    setTimeout(async () => {
      try {
        const taskData: CreateTaskRequest = {
          title: step.config.title || 'Follow-up task',
          description: `Automated follow-up task for ${contact.email}`,
          type: step.config.type || 'follow_up',
          priority: step.config.priority || 'medium',
          assignedTo: contact.ownerId || 'system',
          contactId: contact.id,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };

        await this.taskRepository.create(taskData, 'system');
        logger.info('Automated task created', {
          contactId: contact.id,
          taskTitle: taskData.title,
        });
      } catch (error) {
        logger.error('Error creating automated task:', {
          contactId: contact.id,
          error,
        });
      }
    }, executeAt.getTime() - Date.now());
  }

  private async scheduleEmailSend(
    contact: Contact,
    step: FollowUpStep,
    executeAt: Date
  ): Promise<void> {
    // Schedule email through marketing automation service
    setTimeout(async () => {
      try {
        await this.interServiceClient.triggerMarketingAutomation(
          contact.id,
          'send_email',
          {
            templateId: step.config.templateId,
            subject: step.config.subject,
            recipientEmail: contact.email,
          }
        );
        logger.info('Automated email scheduled', { contactId: contact.id });
      } catch (error) {
        logger.error('Error scheduling automated email:', {
          contactId: contact.id,
          error,
        });
      }
    }, executeAt.getTime() - Date.now());
  }

  private async scheduleConditionCheck(
    contact: Contact,
    step: FollowUpStep,
    executeAt: Date
  ): Promise<void> {
    // Schedule condition evaluation
    setTimeout(async () => {
      try {
        const updatedContact = await this.contactRepository.findById(
          contact.id
        );
        if (updatedContact && step.conditions) {
          const conditionMet = await this.evaluateAssignmentConditions(
            updatedContact,
            step.conditions
          );
          logger.info('Condition evaluated', {
            contactId: contact.id,
            conditionMet,
          });
        }
      } catch (error) {
        logger.error('Error evaluating condition:', {
          contactId: contact.id,
          error,
        });
      }
    }, executeAt.getTime() - Date.now());
  }

  // ============================================================================
  // LEAD QUALIFICATION WORKFLOWS
  // ============================================================================

  async processLeadQualification(contactId: string): Promise<void> {
    try {
      logger.info('Processing lead qualification', { contactId });

      const contact = await this.contactRepository.findById(contactId);
      if (!contact) {
        throw new NotFoundError('Contact');
      }

      const workflows = await this.getActiveQualificationWorkflows();

      for (const workflow of workflows) {
        await this.evaluateQualificationWorkflow(contact, workflow);
      }
    } catch (error) {
      logger.error('Error processing lead qualification:', {
        contactId,
        error,
      });
      throw error;
    }
  }

  private async getActiveQualificationWorkflows(): Promise<
    QualificationWorkflow[]
  > {
    // Mock implementation
    return [
      {
        id: '1',
        name: 'Standard Lead Qualification',
        description: 'Standard MQL/SQL qualification workflow',
        scoreThresholds: {
          mql: 50,
          sql: 80,
        },
        actions: {
          onMQL: [
            {
              type: 'update_lifecycle',
              config: { lifecycle: 'marketing_qualified_lead' },
            },
            {
              type: 'create_task',
              config: {
                title: 'Review MQL',
                type: 'follow_up',
                priority: 'medium',
              },
            },
          ],
          onSQL: [
            {
              type: 'update_lifecycle',
              config: { lifecycle: 'sales_qualified_lead' },
            },
            {
              type: 'create_task',
              config: {
                title: 'Schedule sales call',
                type: 'call',
                priority: 'high',
              },
            },
            {
              type: 'create_deal',
              config: {
                name: 'New Opportunity',
                pipelineId: 'default-pipeline',
                stageId: 'initial-contact',
              },
            },
          ],
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  private async evaluateQualificationWorkflow(
    contact: Contact,
    workflow: QualificationWorkflow
  ): Promise<void> {
    const currentScore = contact.leadScore;
    const currentLifecycle = contact.lifecycle;

    // Check for MQL qualification
    if (
      currentScore >= workflow.scoreThresholds.mql &&
      currentLifecycle === 'lead'
    ) {
      await this.executeQualificationActions(contact, workflow.actions.onMQL);
      logger.info('Contact qualified as MQL', {
        contactId: contact.id,
        score: currentScore,
      });
    }

    // Check for SQL qualification
    if (
      currentScore >= workflow.scoreThresholds.sql &&
      currentLifecycle === 'marketing_qualified_lead'
    ) {
      await this.executeQualificationActions(contact, workflow.actions.onSQL);
      logger.info('Contact qualified as SQL', {
        contactId: contact.id,
        score: currentScore,
      });
    }
  }

  private async executeQualificationActions(
    contact: Contact,
    actions: AutomationAction[]
  ): Promise<void> {
    for (const action of actions) {
      await this.executeAutomationAction(contact, action);
    }
  }

  // ============================================================================
  // AUTOMATED DATA ENRICHMENT
  // ============================================================================

  async processDataEnrichment(contactId: string): Promise<void> {
    try {
      logger.info('Processing data enrichment', { contactId });

      const contact = await this.contactRepository.findById(contactId);
      if (!contact) {
        throw new NotFoundError('Contact');
      }

      // Check if enrichment is needed
      if (await this.needsEnrichment(contact)) {
        await this.enrichContactData(contact);
      }
    } catch (error) {
      logger.error('Error processing data enrichment:', { contactId, error });
      throw error;
    }
  }

  private async needsEnrichment(contact: Contact): Promise<boolean> {
    // Check if contact has missing key fields
    const missingFields = [];

    if (!contact.company) missingFields.push('company');
    if (!contact.jobTitle) missingFields.push('jobTitle');
    if (!contact.phone) missingFields.push('phone');
    if (!contact.website) missingFields.push('website');

    return missingFields.length > 0;
  }

  private async enrichContactData(contact: Contact): Promise<void> {
    try {
      // Mock enrichment data - in production, this would call external APIs
      const enrichmentData = {
        company: contact.company || 'Acme Corp',
        jobTitle: contact.jobTitle || 'Marketing Manager',
        phone: contact.phone || '+1-555-0123',
        website: contact.website || 'https://example.com',
      };

      await this.contactRepository.update(contact.id, enrichmentData);

      logger.info('Contact data enriched', {
        contactId: contact.id,
        enrichedFields: Object.keys(enrichmentData),
      });
    } catch (error) {
      logger.error('Error enriching contact data:', {
        contactId: contact.id,
        error,
      });
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getContactFieldValue(contact: Contact, field: string): any {
    switch (field) {
      case 'email':
        return contact.email;
      case 'firstName':
        return contact.firstName;
      case 'lastName':
        return contact.lastName;
      case 'company':
        return contact.company;
      case 'jobTitle':
        return contact.jobTitle;
      case 'phone':
        return contact.phone;
      case 'leadScore':
        return contact.leadScore;
      case 'lifecycle':
        return contact.lifecycle;
      case 'source':
        return contact.source;
      case 'tags':
        return contact.tags;
      default:
        return contact.customFields[field];
    }
  }

  private evaluateCondition(
    fieldValue: any,
    condition: AutomationCondition
  ): boolean {
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'contains':
        return String(fieldValue)
          .toLowerCase()
          .includes(String(condition.value).toLowerCase());
      case 'in':
        return (
          Array.isArray(condition.value) && condition.value.includes(fieldValue)
        );
      case 'not_in':
        return (
          Array.isArray(condition.value) &&
          !condition.value.includes(fieldValue)
        );
      default:
        return false;
    }
  }

  private async executeAutomationAction(
    contact: Contact,
    action: AutomationAction
  ): Promise<void> {
    try {
      switch (action.type) {
        case 'assign_owner':
          await this.contactRepository.update(contact.id, {
            ownerId: action.config.userId,
          });
          break;

        case 'create_task':
          const taskData: CreateTaskRequest = {
            title: action.config.title || 'Automated task',
            description:
              action.config.description ||
              `Automated task for ${contact.email}`,
            type: action.config.type || 'follow_up',
            priority: action.config.priority || 'medium',
            assignedTo: contact.ownerId || action.config.assignedTo,
            contactId: contact.id,
            dueDate:
              action.config.dueDate ||
              new Date(Date.now() + 24 * 60 * 60 * 1000),
          };
          await this.taskRepository.create(taskData, 'system');
          break;

        case 'update_lifecycle':
          await this.contactRepository.update(contact.id, {
            lifecycle: action.config.lifecycle as ContactLifecycle,
          });
          break;

        case 'add_tags':
          const newTags = [...contact.tags, ...action.config.tags];
          await this.contactRepository.update(contact.id, {
            tags: [...new Set(newTags)], // Remove duplicates
          });
          break;

        case 'enrich_data':
          await this.processDataEnrichment(contact.id);
          break;

        case 'send_email':
          await this.interServiceClient.triggerMarketingAutomation(
            contact.id,
            'send_email',
            action.config
          );
          break;

        case 'create_deal':
          // This would call the deal creation service
          logger.info('Deal creation action triggered', {
            contactId: contact.id,
            config: action.config,
          });
          break;

        default:
          logger.warn('Unknown automation action type', { type: action.type });
      }

      logger.info('Automation action executed', {
        contactId: contact.id,
        actionType: action.type,
      });
    } catch (error) {
      logger.error('Error executing automation action:', {
        contactId: contact.id,
        actionType: action.type,
        error,
      });
      throw error;
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  async handleContactCreated(contact: Contact): Promise<void> {
    await Promise.all([
      this.processLeadAssignment(contact.id),
      this.processFollowUpSequences(contact.id, 'contact_created'),
      this.processDataEnrichment(contact.id),
    ]);
  }

  async handleContactUpdated(contact: Contact): Promise<void> {
    await Promise.all([
      this.processFollowUpSequences(contact.id, 'contact_updated'),
      this.processLeadQualification(contact.id),
    ]);
  }

  async handleEngagementEvent(event: EngagementEvent): Promise<void> {
    await Promise.all([
      this.processFollowUpSequences(event.contactId, 'engagement_event'),
      this.processLeadQualification(event.contactId),
    ]);
  }

  async handleScoreThresholdReached(
    contactId: string,
    newScore: number
  ): Promise<void> {
    await this.processLeadQualification(contactId);
  }
}
