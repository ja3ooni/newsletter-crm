import axios, { AxiosInstance } from 'axios';
import { Company, Contact, Deal } from '../types/crm';
import logger from '../utils/logger';
import {
  BaseIntegration,
  ExternalCompany,
  ExternalContact,
  ExternalDeal,
  IntegrationConfig,
} from './base-integration';

interface CustomCRMCredentials {
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  authType: 'api_key' | 'basic_auth' | 'bearer_token';
  token?: string;
}

interface CustomCRMMapping {
  contacts: {
    endpoint: string;
    idField: string;
    emailField: string;
    firstNameField?: string;
    lastNameField?: string;
    companyField?: string;
    phoneField?: string;
    lastModifiedField: string;
  };
  deals: {
    endpoint: string;
    idField: string;
    nameField: string;
    valueField: string;
    stageField: string;
    contactIdField?: string;
    companyIdField?: string;
    closeDateField?: string;
    lastModifiedField: string;
  };
  companies: {
    endpoint: string;
    idField: string;
    nameField: string;
    domainField?: string;
    industryField?: string;
    sizeField?: string;
    lastModifiedField: string;
  };
}

export class CustomCRMIntegration extends BaseIntegration {
  private client: AxiosInstance;
  private mapping: CustomCRMMapping;

  constructor(config: IntegrationConfig) {
    super(config);
    const credentials = this.config.credentials as CustomCRMCredentials;
    this.mapping = this.config.settings.mapping as CustomCRMMapping;

    this.client = axios.create({
      baseURL: credentials.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupAuthentication(credentials);
  }

  private setupAuthentication(credentials: CustomCRMCredentials): void {
    switch (credentials.authType) {
      case 'api_key':
        if (credentials.apiKey) {
          this.client.defaults.headers.common['X-API-Key'] = credentials.apiKey;
        }
        break;
      case 'basic_auth':
        if (credentials.username && credentials.password) {
          const auth = Buffer.from(
            `${credentials.username}:${credentials.password}`
          ).toString('base64');
          this.client.defaults.headers.common['Authorization'] =
            `Basic ${auth}`;
        }
        break;
      case 'bearer_token':
        if (credentials.token) {
          this.client.defaults.headers.common['Authorization'] =
            `Bearer ${credentials.token}`;
        }
        break;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      // Test authentication by making a simple request to the contacts endpoint
      const response = await this.client.get(
        `${this.mapping.contacts.endpoint}?limit=1`
      );

      logger.info('Custom CRM authentication successful');
      return response.status === 200;
    } catch (error) {
      logger.error('Custom CRM authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get(
        `${this.mapping.contacts.endpoint}?limit=1`
      );
      return response.status === 200;
    } catch (error) {
      logger.error('Custom CRM connection test failed:', error);
      return false;
    }
  }

  async getContacts(lastSync?: Date): Promise<ExternalContact[]> {
    try {
      let url = this.mapping.contacts.endpoint;
      const params: any = { limit: 1000 };

      if (lastSync) {
        params[`${this.mapping.contacts.lastModifiedField}_gt`] =
          lastSync.toISOString();
      }

      const response = await this.client.get(url, { params });

      // Handle different response formats
      const data = response.data.data || response.data.results || response.data;

      return data.map((record: any) => ({
        id: record[this.mapping.contacts.idField]?.toString(),
        email: record[this.mapping.contacts.emailField],
        firstName: this.mapping.contacts.firstNameField
          ? record[this.mapping.contacts.firstNameField]
          : undefined,
        lastName: this.mapping.contacts.lastNameField
          ? record[this.mapping.contacts.lastNameField]
          : undefined,
        company: this.mapping.contacts.companyField
          ? record[this.mapping.contacts.companyField]
          : undefined,
        phone: this.mapping.contacts.phoneField
          ? record[this.mapping.contacts.phoneField]
          : undefined,
        customFields: {},
        lastModified: new Date(record[this.mapping.contacts.lastModifiedField]),
        source: 'custom_crm',
      }));
    } catch (error) {
      logger.error('Failed to get Custom CRM contacts:', error);
      throw error;
    }
  }

  async createContact(contact: Contact): Promise<string> {
    try {
      const customContact: any = {};

      customContact[this.mapping.contacts.emailField] = contact.email;
      if (this.mapping.contacts.firstNameField && contact.firstName) {
        customContact[this.mapping.contacts.firstNameField] = contact.firstName;
      }
      if (this.mapping.contacts.lastNameField && contact.lastName) {
        customContact[this.mapping.contacts.lastNameField] = contact.lastName;
      }
      if (this.mapping.contacts.companyField && contact.company) {
        customContact[this.mapping.contacts.companyField] = contact.company;
      }
      if (this.mapping.contacts.phoneField && contact.phone) {
        customContact[this.mapping.contacts.phoneField] = contact.phone;
      }

      const response = await this.client.post(
        this.mapping.contacts.endpoint,
        customContact
      );
      const data = response.data.data || response.data;
      return data[this.mapping.contacts.idField]?.toString();
    } catch (error) {
      logger.error('Failed to create Custom CRM contact:', error);
      throw error;
    }
  }

  async updateContact(
    externalId: string,
    contact: Partial<Contact>
  ): Promise<boolean> {
    try {
      const customContact: any = {};

      if (contact.email)
        customContact[this.mapping.contacts.emailField] = contact.email;
      if (contact.firstName && this.mapping.contacts.firstNameField) {
        customContact[this.mapping.contacts.firstNameField] = contact.firstName;
      }
      if (contact.lastName && this.mapping.contacts.lastNameField) {
        customContact[this.mapping.contacts.lastNameField] = contact.lastName;
      }
      if (contact.company && this.mapping.contacts.companyField) {
        customContact[this.mapping.contacts.companyField] = contact.company;
      }
      if (contact.phone && this.mapping.contacts.phoneField) {
        customContact[this.mapping.contacts.phoneField] = contact.phone;
      }

      await this.client.put(
        `${this.mapping.contacts.endpoint}/${externalId}`,
        customContact
      );
      return true;
    } catch (error) {
      logger.error('Failed to update Custom CRM contact:', error);
      return false;
    }
  }

  async deleteContact(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(
        `${this.mapping.contacts.endpoint}/${externalId}`
      );
      return true;
    } catch (error) {
      logger.error('Failed to delete Custom CRM contact:', error);
      return false;
    }
  }

  async getDeals(lastSync?: Date): Promise<ExternalDeal[]> {
    try {
      let url = this.mapping.deals.endpoint;
      const params: any = { limit: 1000 };

      if (lastSync) {
        params[`${this.mapping.deals.lastModifiedField}_gt`] =
          lastSync.toISOString();
      }

      const response = await this.client.get(url, { params });

      const data = response.data.data || response.data.results || response.data;

      return data.map((record: any) => ({
        id: record[this.mapping.deals.idField]?.toString(),
        name: record[this.mapping.deals.nameField],
        value: parseFloat(record[this.mapping.deals.valueField]) || 0,
        stage: record[this.mapping.deals.stageField],
        contactId: this.mapping.deals.contactIdField
          ? record[this.mapping.deals.contactIdField]?.toString()
          : undefined,
        companyId: this.mapping.deals.companyIdField
          ? record[this.mapping.deals.companyIdField]?.toString()
          : undefined,
        closeDate:
          this.mapping.deals.closeDateField &&
          record[this.mapping.deals.closeDateField]
            ? new Date(record[this.mapping.deals.closeDateField])
            : undefined,
        customFields: {},
        lastModified: new Date(record[this.mapping.deals.lastModifiedField]),
      }));
    } catch (error) {
      logger.error('Failed to get Custom CRM deals:', error);
      throw error;
    }
  }

  async createDeal(deal: Deal): Promise<string> {
    try {
      const customDeal: any = {};

      customDeal[this.mapping.deals.nameField] = deal.name;
      customDeal[this.mapping.deals.valueField] = deal.value;
      customDeal[this.mapping.deals.stageField] = deal.stage;

      if (this.mapping.deals.closeDateField && deal.closeDate) {
        customDeal[this.mapping.deals.closeDateField] =
          deal.closeDate.toISOString();
      }

      const response = await this.client.post(
        this.mapping.deals.endpoint,
        customDeal
      );
      const data = response.data.data || response.data;
      return data[this.mapping.deals.idField]?.toString();
    } catch (error) {
      logger.error('Failed to create Custom CRM deal:', error);
      throw error;
    }
  }

  async updateDeal(externalId: string, deal: Partial<Deal>): Promise<boolean> {
    try {
      const customDeal: any = {};

      if (deal.name) customDeal[this.mapping.deals.nameField] = deal.name;
      if (deal.value !== undefined)
        customDeal[this.mapping.deals.valueField] = deal.value;
      if (deal.stage) customDeal[this.mapping.deals.stageField] = deal.stage;
      if (deal.closeDate && this.mapping.deals.closeDateField) {
        customDeal[this.mapping.deals.closeDateField] =
          deal.closeDate.toISOString();
      }

      await this.client.put(
        `${this.mapping.deals.endpoint}/${externalId}`,
        customDeal
      );
      return true;
    } catch (error) {
      logger.error('Failed to update Custom CRM deal:', error);
      return false;
    }
  }

  async deleteDeal(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(`${this.mapping.deals.endpoint}/${externalId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete Custom CRM deal:', error);
      return false;
    }
  }

  async getCompanies(lastSync?: Date): Promise<ExternalCompany[]> {
    try {
      let url = this.mapping.companies.endpoint;
      const params: any = { limit: 1000 };

      if (lastSync) {
        params[`${this.mapping.companies.lastModifiedField}_gt`] =
          lastSync.toISOString();
      }

      const response = await this.client.get(url, { params });

      const data = response.data.data || response.data.results || response.data;

      return data.map((record: any) => ({
        id: record[this.mapping.companies.idField]?.toString(),
        name: record[this.mapping.companies.nameField],
        domain: this.mapping.companies.domainField
          ? record[this.mapping.companies.domainField]
          : undefined,
        industry: this.mapping.companies.industryField
          ? record[this.mapping.companies.industryField]
          : undefined,
        size: this.mapping.companies.sizeField
          ? record[this.mapping.companies.sizeField]?.toString()
          : undefined,
        customFields: {},
        lastModified: new Date(
          record[this.mapping.companies.lastModifiedField]
        ),
      }));
    } catch (error) {
      logger.error('Failed to get Custom CRM companies:', error);
      throw error;
    }
  }

  async createCompany(company: Company): Promise<string> {
    try {
      const customCompany: any = {};

      customCompany[this.mapping.companies.nameField] = company.name;

      if (this.mapping.companies.domainField && company.domain) {
        customCompany[this.mapping.companies.domainField] = company.domain;
      }
      if (this.mapping.companies.industryField && company.industry) {
        customCompany[this.mapping.companies.industryField] = company.industry;
      }
      if (this.mapping.companies.sizeField && company.size) {
        customCompany[this.mapping.companies.sizeField] = company.size;
      }

      const response = await this.client.post(
        this.mapping.companies.endpoint,
        customCompany
      );
      const data = response.data.data || response.data;
      return data[this.mapping.companies.idField]?.toString();
    } catch (error) {
      logger.error('Failed to create Custom CRM company:', error);
      throw error;
    }
  }

  async updateCompany(
    externalId: string,
    company: Partial<Company>
  ): Promise<boolean> {
    try {
      const customCompany: any = {};

      if (company.name)
        customCompany[this.mapping.companies.nameField] = company.name;
      if (company.domain && this.mapping.companies.domainField) {
        customCompany[this.mapping.companies.domainField] = company.domain;
      }
      if (company.industry && this.mapping.companies.industryField) {
        customCompany[this.mapping.companies.industryField] = company.industry;
      }
      if (company.size && this.mapping.companies.sizeField) {
        customCompany[this.mapping.companies.sizeField] = company.size;
      }

      await this.client.put(
        `${this.mapping.companies.endpoint}/${externalId}`,
        customCompany
      );
      return true;
    } catch (error) {
      logger.error('Failed to update Custom CRM company:', error);
      return false;
    }
  }

  async deleteCompany(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(
        `${this.mapping.companies.endpoint}/${externalId}`
      );
      return true;
    } catch (error) {
      logger.error('Failed to delete Custom CRM company:', error);
      return false;
    }
  }
}
