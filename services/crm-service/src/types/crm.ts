// @ts-nocheck
export interface Contact {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  customFields?: Record<string, any>;
  tags?: string[];
  lifecycleStage?: string;
  leadScore?: number;
  source?: string;
  ownerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Deal {
  id?: string;
  name: string;
  value: number;
  stage: string;
  contactId?: string;
  companyId?: string;
  closeDate?: Date;
  probability?: number;
  source?: string;
  ownerId?: string;
  customFields?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Company {
  id?: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  customFields?: Record<string, any>;
  ownerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Segment {
  id?: string;
  name: string;
  description?: string;
  conditions: SegmentCondition[];
  isActive?: boolean;
  contactCount?: number;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SegmentCondition {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'greater_than'
    | 'less_than'
    | 'greater_than_or_equal'
    | 'less_than_or_equal'
    | 'is_empty'
    | 'is_not_empty'
    | 'in'
    | 'not_in'
    | 'date_before'
    | 'date_after'
    | 'date_between';
  value?: any;
  logicalOperator?: 'AND' | 'OR';
  group?: string;
}

export interface CreateContactRequest {
  email: string;
  firstName: string;
  lastName?: string;
  company?: string;
  phone?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  customFields?: Record<string, any>;
  tags?: string[];
  lifecycleStage?: string;
  source?: string;
  ownerId?: string;
}

export interface CreateSegmentRequest {
  name: string;
  description: string;
  conditions: SegmentCondition[];
  isActive?: boolean;
}

export interface BulkOperationRequest {
  operation: {
    type:
      | 'update'
      | 'delete'
      | 'add_tags'
      | 'remove_tags'
      | 'change_lifecycle'
      | 'assign_owner';
    params: Record<string, any>;
  };
  contactIds: string[];
  data: Record<string, any>;
}
