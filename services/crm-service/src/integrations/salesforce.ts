// @ts-nocheck
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

interface SalesforceCredentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  securityToken: string;
  instanceUrl?: string;
}

interface SalesforceTokenResponse {
  access_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

export class SalesforceIntegration extends BaseIntegration {
  private client: AxiosInstance;
  private accessToken?: string;
  private instanceUrl?: string;

  constructor(config: IntegrationConfig) {
    super(config);
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      const credentials = this.config.credentials as SalesforceCredentials;

      const response = await axios.post(
        'https://login.salesforce.com/services/oauth2/token',
        {
          grant_type: 'password',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          username: credentials.username,
          password: credentials.password + credentials.securityToken,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const tokenData: SalesforceTokenResponse = response.data;
      this.accessToken = tokenData.access_token;
      this.instanceUrl = tokenData.instance_url;

      this.client.defaults.headers.common['Authorization'] =
        `Bearer ${this.accessToken}`;
      this.client.defaults.baseURL = this.instanceUrl;

      logger.info('Salesforce authentication successful');
      return true;
    } catch (error) {
      logger.error('Salesforce authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!(await this.authenticate())) {
        return false;
      }

      const response = await this.client.get('/services/data/v58.0/');
      return response.status === 200;
    } catch (error) {
      logger.error('Salesforce connection test failed:', error);
      return false;
    }
  }

  async getContacts(lastSync?: Date): Promise<ExternalContact[]> {
    try {
      let query = `SELECT Id, Email, FirstName, LastName, Account.Name, Phone, LastModifiedDate FROM Contact`;

      if (lastSync) {
        const isoDate = lastSync.toISOString();
        query += ` WHERE LastModifiedDate > ${isoDate}`;
      }

      query += ` ORDER BY LastModifiedDate DESC LIMIT 2000`;

      const response = await this.client.get(
        `/services/data/v58.0/query/?q=${encodeURIComponent(query)}`
      );

      return response.data.records.map((record: any) => ({
        id: record.Id,
        email: record.Email,
        firstName: record.FirstName,
        lastName: record.LastName,
        company: record.Account?.Name,
        phone: record.Phone,
        customFields: {},
        lastModified: new Date(record.LastModifiedDate),
        source: 'salesforce',
      }));
    } catch (error) {
      logger.error('Failed to get Salesforce contacts:', error);
      throw error;
    }
  }

  async createContact(contact: Contact): Promise<string> {
    try {
      const salesforceContact = {
        Email: contact.email,
        FirstName: contact.firstName,
        LastName: contact.lastName,
        Phone: contact.phone,
        Company: contact.company,
      };

      const response = await this.client.post(
        '/services/data/v58.0/sobjects/Contact/',
        salesforceContact
      );
      return response.data.id;
    } catch (error) {
      logger.error('Failed to create Salesforce contact:', error);
      throw error;
    }
  }

  async updateContact(
    externalId: string,
    contact: Partial<Contact>
  ): Promise<boolean> {
    try {
      const salesforceContact: any = {};

      if (contact.email) salesforceContact.Email = contact.email;
      if (contact.firstName) salesforceContact.FirstName = contact.firstName;
      if (contact.lastName) salesforceContact.LastName = contact.lastName;
      if (contact.phone) salesforceContact.Phone = contact.phone;
      if (contact.company) salesforceContact.Company = contact.company;

      await this.client.patch(
        `/services/data/v58.0/sobjects/Contact/${externalId}`,
        salesforceContact
      );
      return true;
    } catch (error) {
      logger.error('Failed to update Salesforce contact:', error);
      return false;
    }
  }

  async deleteContact(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(
        `/services/data/v58.0/sobjects/Contact/${externalId}`
      );
      return true;
    } catch (error) {
      logger.error('Failed to delete Salesforce contact:', error);
      return false;
    }
  }

  async getDeals(lastSync?: Date): Promise<ExternalDeal[]> {
    try {
      let query = `SELECT Id, Name, Amount, StageName, Contact__c, Account.Id, CloseDate, LastModifiedDate FROM Opportunity`;

      if (lastSync) {
        const isoDate = lastSync.toISOString();
        query += ` WHERE LastModifiedDate > ${isoDate}`;
      }

      query += ` ORDER BY LastModifiedDate DESC LIMIT 2000`;

      const response = await this.client.get(
        `/services/data/v58.0/query/?q=${encodeURIComponent(query)}`
      );

      return response.data.records.map((record: any) => ({
        id: record.Id,
        name: record.Name,
        value: record.Amount || 0,
        stage: record.StageName,
        contactId: record.Contact__c,
        companyId: record.Account?.Id,
        closeDate: record.CloseDate ? new Date(record.CloseDate) : undefined,
        customFields: {},
        lastModified: new Date(record.LastModifiedDate),
      }));
    } catch (error) {
      logger.error('Failed to get Salesforce deals:', error);
      throw error;
    }
  }

  async createDeal(deal: Deal): Promise<string> {
    try {
      const salesforceDeal = {
        Name: deal.name,
        Amount: deal.value,
        StageName: deal.stage,
        CloseDate:
          deal.closeDate?.toISOString().split('T')[0] ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
      };

      const response = await this.client.post(
        '/services/data/v58.0/sobjects/Opportunity/',
        salesforceDeal
      );
      return response.data.id;
    } catch (error) {
      logger.error('Failed to create Salesforce deal:', error);
      throw error;
    }
  }

  async updateDeal(externalId: string, deal: Partial<Deal>): Promise<boolean> {
    try {
      const salesforceDeal: any = {};

      if (deal.name) salesforceDeal.Name = deal.name;
      if (deal.value !== undefined) salesforceDeal.Amount = deal.value;
      if (deal.stage) salesforceDeal.StageName = deal.stage;
      if (deal.closeDate)
        salesforceDeal.CloseDate = deal.closeDate.toISOString().split('T')[0];

      await this.client.patch(
        `/services/data/v58.0/sobjects/Opportunity/${externalId}`,
        salesforceDeal
      );
      return true;
    } catch (error) {
      logger.error('Failed to update Salesforce deal:', error);
      return false;
    }
  }

  async deleteDeal(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(
        `/services/data/v58.0/sobjects/Opportunity/${externalId}`
      );
      return true;
    } catch (error) {
      logger.error('Failed to delete Salesforce deal:', error);
      return false;
    }
  }

  async getCompanies(lastSync?: Date): Promise<ExternalCompany[]> {
    try {
      let query = `SELECT Id, Name, Website, Industry, NumberOfEmployees, LastModifiedDate FROM Account`;

      if (lastSync) {
        const isoDate = lastSync.toISOString();
        query += ` WHERE LastModifiedDate > ${isoDate}`;
      }

      query += ` ORDER BY LastModifiedDate DESC LIMIT 2000`;

      const response = await this.client.get(
        `/services/data/v58.0/query/?q=${encodeURIComponent(query)}`
      );

      return response.data.records.map((record: any) => ({
        id: record.Id,
        name: record.Name,
        domain: record.Website,
        industry: record.Industry,
        size: record.NumberOfEmployees?.toString(),
        customFields: {},
        lastModified: new Date(record.LastModifiedDate),
      }));
    } catch (error) {
      logger.error('Failed to get Salesforce companies:', error);
      throw error;
    }
  }

  async createCompany(company: Company): Promise<string> {
    try {
      const salesforceCompany = {
        Name: company.name,
        Website: company.domain,
        Industry: company.industry,
        NumberOfEmployees: company.size ? parseInt(company.size) : undefined,
      };

      const response = await this.client.post(
        '/services/data/v58.0/sobjects/Account/',
        salesforceCompany
      );
      return response.data.id;
    } catch (error) {
      logger.error('Failed to create Salesforce company:', error);
      throw error;
    }
  }

  async updateCompany(
    externalId: string,
    company: Partial<Company>
  ): Promise<boolean> {
    try {
      const salesforceCompany: any = {};

      if (company.name) salesforceCompany.Name = company.name;
      if (company.domain) salesforceCompany.Website = company.domain;
      if (company.industry) salesforceCompany.Industry = company.industry;
      if (company.size)
        salesforceCompany.NumberOfEmployees = parseInt(company.size);

      await this.client.patch(
        `/services/data/v58.0/sobjects/Account/${externalId}`,
        salesforceCompany
      );
      return true;
    } catch (error) {
      logger.error('Failed to update Salesforce company:', error);
      return false;
    }
  }

  async deleteCompany(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(
        `/services/data/v58.0/sobjects/Account/${externalId}`
      );
      return true;
    } catch (error) {
      logger.error('Failed to delete Salesforce company:', error);
      return false;
    }
  }
}
