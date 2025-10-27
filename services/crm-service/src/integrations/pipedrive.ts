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

interface PipedriveCredentials {
  apiToken: string;
  companyDomain: string;
}

export class PipedriveIntegration extends BaseIntegration {
  private client: AxiosInstance;

  constructor(config: IntegrationConfig) {
    super(config);
    const credentials = this.config.credentials as PipedriveCredentials;

    this.client = axios.create({
      baseURL: `https://${credentials.companyDomain}.pipedrive.com/api/v1`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        api_token: credentials.apiToken,
      },
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      // Test the token by making a simple API call
      const response = await this.client.get('/users/me');

      logger.info('Pipedrive authentication successful');
      return response.status === 200;
    } catch (error) {
      logger.error('Pipedrive authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/users/me');
      return response.status === 200;
    } catch (error) {
      logger.error('Pipedrive connection test failed:', error);
      return false;
    }
  }

  async getContacts(lastSync?: Date): Promise<ExternalContact[]> {
    try {
      let url = '/persons';
      const params: any = { limit: 500 };

      if (lastSync) {
        params.since = lastSync.toISOString();
      }

      const contacts: ExternalContact[] = [];
      let start = 0;
      let hasMore = true;

      while (hasMore) {
        params.start = start;
        const response = await this.client.get(url, { params });

        if (response.data.success && response.data.data) {
          const results = response.data.data.map((person: any) => ({
            id: person.id.toString(),
            email: person.primary_email || person.email?.[0]?.value,
            firstName: person.first_name,
            lastName: person.last_name,
            company: person.org_name,
            phone: person.primary_phone || person.phone?.[0]?.value,
            customFields: {},
            lastModified: new Date(person.update_time),
            source: 'pipedrive',
          }));

          contacts.push(...results);
        }

        hasMore =
          response.data.additional_data?.pagination?.more_items_in_collection ||
          false;
        start = response.data.additional_data?.pagination?.next_start || 0;
      }

      return contacts;
    } catch (error) {
      logger.error('Failed to get Pipedrive contacts:', error);
      throw error;
    }
  }

  async createContact(contact: Contact): Promise<string> {
    try {
      const pipedriveContact = {
        name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        first_name: contact.firstName,
        last_name: contact.lastName,
        email: [{ value: contact.email, primary: true }],
        phone: contact.phone
          ? [{ value: contact.phone, primary: true }]
          : undefined,
      };

      const response = await this.client.post('/persons', pipedriveContact);
      return response.data.data.id.toString();
    } catch (error) {
      logger.error('Failed to create Pipedrive contact:', error);
      throw error;
    }
  }

  async updateContact(
    externalId: string,
    contact: Partial<Contact>
  ): Promise<boolean> {
    try {
      const pipedriveContact: any = {};

      if (contact.firstName || contact.lastName) {
        pipedriveContact.name =
          `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
        if (contact.firstName) pipedriveContact.first_name = contact.firstName;
        if (contact.lastName) pipedriveContact.last_name = contact.lastName;
      }

      if (contact.email) {
        pipedriveContact.email = [{ value: contact.email, primary: true }];
      }

      if (contact.phone) {
        pipedriveContact.phone = [{ value: contact.phone, primary: true }];
      }

      await this.client.put(`/persons/${externalId}`, pipedriveContact);
      return true;
    } catch (error) {
      logger.error('Failed to update Pipedrive contact:', error);
      return false;
    }
  }

  async deleteContact(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(`/persons/${externalId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete Pipedrive contact:', error);
      return false;
    }
  }

  async getDeals(lastSync?: Date): Promise<ExternalDeal[]> {
    try {
      let url = '/deals';
      const params: any = { limit: 500 };

      if (lastSync) {
        params.since = lastSync.toISOString();
      }

      const deals: ExternalDeal[] = [];
      let start = 0;
      let hasMore = true;

      while (hasMore) {
        params.start = start;
        const response = await this.client.get(url, { params });

        if (response.data.success && response.data.data) {
          const results = response.data.data.map((deal: any) => ({
            id: deal.id.toString(),
            name: deal.title,
            value: parseFloat(deal.value) || 0,
            stage: deal.stage_name,
            contactId: deal.person_id?.toString(),
            companyId: deal.org_id?.toString(),
            closeDate: deal.expected_close_date
              ? new Date(deal.expected_close_date)
              : undefined,
            customFields: {},
            lastModified: new Date(deal.update_time),
          }));

          deals.push(...results);
        }

        hasMore =
          response.data.additional_data?.pagination?.more_items_in_collection ||
          false;
        start = response.data.additional_data?.pagination?.next_start || 0;
      }

      return deals;
    } catch (error) {
      logger.error('Failed to get Pipedrive deals:', error);
      throw error;
    }
  }

  async createDeal(deal: Deal): Promise<string> {
    try {
      const pipedriveDeal = {
        title: deal.name,
        value: deal.value,
        stage_id: deal.stage, // This would need to be mapped to Pipedrive stage IDs
        expected_close_date: deal.closeDate?.toISOString().split('T')[0],
      };

      const response = await this.client.post('/deals', pipedriveDeal);
      return response.data.data.id.toString();
    } catch (error) {
      logger.error('Failed to create Pipedrive deal:', error);
      throw error;
    }
  }

  async updateDeal(externalId: string, deal: Partial<Deal>): Promise<boolean> {
    try {
      const pipedriveDeal: any = {};

      if (deal.name) pipedriveDeal.title = deal.name;
      if (deal.value !== undefined) pipedriveDeal.value = deal.value;
      if (deal.stage) pipedriveDeal.stage_id = deal.stage;
      if (deal.closeDate)
        pipedriveDeal.expected_close_date = deal.closeDate
          .toISOString()
          .split('T')[0];

      await this.client.put(`/deals/${externalId}`, pipedriveDeal);
      return true;
    } catch (error) {
      logger.error('Failed to update Pipedrive deal:', error);
      return false;
    }
  }

  async deleteDeal(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(`/deals/${externalId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete Pipedrive deal:', error);
      return false;
    }
  }

  async getCompanies(lastSync?: Date): Promise<ExternalCompany[]> {
    try {
      let url = '/organizations';
      const params: any = { limit: 500 };

      if (lastSync) {
        params.since = lastSync.toISOString();
      }

      const companies: ExternalCompany[] = [];
      let start = 0;
      let hasMore = true;

      while (hasMore) {
        params.start = start;
        const response = await this.client.get(url, { params });

        if (response.data.success && response.data.data) {
          const results = response.data.data.map((org: any) => ({
            id: org.id.toString(),
            name: org.name,
            domain: org.website,
            industry: org.category,
            size: org.people_count?.toString(),
            customFields: {},
            lastModified: new Date(org.update_time),
          }));

          companies.push(...results);
        }

        hasMore =
          response.data.additional_data?.pagination?.more_items_in_collection ||
          false;
        start = response.data.additional_data?.pagination?.next_start || 0;
      }

      return companies;
    } catch (error) {
      logger.error('Failed to get Pipedrive companies:', error);
      throw error;
    }
  }

  async createCompany(company: Company): Promise<string> {
    try {
      const pipedriveCompany = {
        name: company.name,
        website: company.domain,
        category: company.industry,
        people_count: company.size ? parseInt(company.size) : undefined,
      };

      const response = await this.client.post(
        '/organizations',
        pipedriveCompany
      );
      return response.data.data.id.toString();
    } catch (error) {
      logger.error('Failed to create Pipedrive company:', error);
      throw error;
    }
  }

  async updateCompany(
    externalId: string,
    company: Partial<Company>
  ): Promise<boolean> {
    try {
      const pipedriveCompany: any = {};

      if (company.name) pipedriveCompany.name = company.name;
      if (company.domain) pipedriveCompany.website = company.domain;
      if (company.industry) pipedriveCompany.category = company.industry;
      if (company.size) pipedriveCompany.people_count = parseInt(company.size);

      await this.client.put(`/organizations/${externalId}`, pipedriveCompany);
      return true;
    } catch (error) {
      logger.error('Failed to update Pipedrive company:', error);
      return false;
    }
  }

  async deleteCompany(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(`/organizations/${externalId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete Pipedrive company:', error);
      return false;
    }
  }
}
