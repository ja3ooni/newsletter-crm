// @ts-nocheck
import { Company, Contact, Deal } from '../types/crm';

export interface IntegrationConfig {
  id: string;
  name: string;
  type: 'salesforce' | 'hubspot' | 'pipedrive' | 'custom';
  credentials: Record<string, any>;
  settings: Record<string, any>;
  isActive: boolean;
  syncSettings: {
    bidirectional: boolean;
    syncContacts: boolean;
    syncDeals: boolean;
    syncCompanies: boolean;
    syncInterval: number; // minutes
    lastSync?: Date;
  };
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: SyncError[];
  duration: number;
}

export interface SyncError {
  recordId: string;
  error: string;
  details?: any;
}

export interface ExternalContact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  customFields: Record<string, any>;
  lastModified: Date;
  source: string;
}

export interface ExternalDeal {
  id: string;
  name: string;
  value: number;
  stage: string;
  contactId?: string;
  companyId?: string;
  closeDate?: Date;
  customFields: Record<string, any>;
  lastModified: Date;
}

export interface ExternalCompany {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  customFields: Record<string, any>;
  lastModified: Date;
}

export abstract class BaseIntegration {
  protected config: IntegrationConfig;

  constructor(config: IntegrationConfig) {
    this.config = config;
  }

  abstract authenticate(): Promise<boolean>;
  abstract testConnection(): Promise<boolean>;

  // Contact operations
  abstract getContacts(lastSync?: Date): Promise<ExternalContact[]>;
  abstract createContact(contact: Contact): Promise<string>;
  abstract updateContact(
    externalId: string,
    contact: Partial<Contact>
  ): Promise<boolean>;
  abstract deleteContact(externalId: string): Promise<boolean>;

  // Deal operations
  abstract getDeals(lastSync?: Date): Promise<ExternalDeal[]>;
  abstract createDeal(deal: Deal): Promise<string>;
  abstract updateDeal(
    externalId: string,
    deal: Partial<Deal>
  ): Promise<boolean>;
  abstract deleteDeal(externalId: string): Promise<boolean>;

  // Company operations
  abstract getCompanies(lastSync?: Date): Promise<ExternalCompany[]>;
  abstract createCompany(company: Company): Promise<string>;
  abstract updateCompany(
    externalId: string,
    company: Partial<Company>
  ): Promise<boolean>;
  abstract deleteCompany(externalId: string): Promise<boolean>;

  // Sync operations
  async syncToExternal(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [],
      duration: 0,
    };

    try {
      if (!(await this.authenticate())) {
        throw new Error('Authentication failed');
      }

      // Implementation would sync local data to external system
      // This is a base implementation that subclasses would override

      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        recordId: 'sync',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  async syncFromExternal(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [],
      duration: 0,
    };

    try {
      if (!(await this.authenticate())) {
        throw new Error('Authentication failed');
      }

      // Implementation would sync external data to local system
      // This is a base implementation that subclasses would override

      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        recordId: 'sync',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  getConfig(): IntegrationConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<IntegrationConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
