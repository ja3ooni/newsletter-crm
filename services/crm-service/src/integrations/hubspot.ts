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

interface HubSpotCredentials {
  accessToken: string;
  portalId?: string;
}

export class HubSpotIntegration extends BaseIntegration {
  private client: AxiosInstance;

  constructor(config: IntegrationConfig) {
    super(config);
    this.client = axios.create({
      baseURL: 'https://api.hubapi.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      const credentials = this.config.credentials as HubSpotCredentials;
      this.client.defaults.headers.common['Authorization'] =
        `Bearer ${credentials.accessToken}`;

      // Test the token by making a simple API call
      const response = await this.client.get(
        '/crm/v3/objects/contacts?limit=1'
      );

      logger.info('HubSpot authentication successful');
      return response.status === 200;
    } catch (error) {
      logger.error('HubSpot authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!(await this.authenticate())) {
        return false;
      }

      const response = await this.client.get(
        '/crm/v3/objects/contacts?limit=1'
      );
      return response.status === 200;
    } catch (error) {
      logger.error('HubSpot connection test failed:', error);
      return false;
    }
  }

  async getContacts(lastSync?: Date): Promise<ExternalContact[]> {
    try {
      const properties = [
        'email',
        'firstname',
        'lastname',
        'company',
        'phone',
        'lastmodifieddate',
      ];
      let url = `/crm/v3/objects/contacts?properties=${properties.join(',')}&limit=100`;

      if (lastSync) {
        const timestamp = lastSync.getTime();
        url += `&filterGroups=[{"filters":[{"propertyName":"lastmodifieddate","operator":"GT","value":"${timestamp}"}]}]`;
      }

      const contacts: ExternalContact[] = [];
      let hasMore = true;
      let after = '';

      while (hasMore) {
        const currentUrl = after ? `${url}&after=${after}` : url;
        const response = await this.client.get(currentUrl);

        const results = response.data.results.map((contact: any) => ({
          id: contact.id,
          email: contact.properties.email,
          firstName: contact.properties.firstname,
          lastName: contact.properties.lastname,
          company: contact.properties.company,
          phone: contact.properties.phone,
          customFields: {},
          lastModified: new Date(contact.properties.lastmodifieddate),
          source: 'hubspot',
        }));

        contacts.push(...results);

        hasMore = !!response.data.paging?.next;
        after = response.data.paging?.next?.after || '';
      }

      return contacts;
    } catch (error) {
      logger.error('Failed to get HubSpot contacts:', error);
      throw error;
    }
  }

  async createContact(contact: Contact): Promise<string> {
    try {
      const hubspotContact = {
        properties: {
          email: contact.email,
          firstname: contact.firstName,
          lastname: contact.lastName,
          phone: contact.phone,
          company: contact.company,
        },
      };

      const response = await this.client.post(
        '/crm/v3/objects/contacts',
        hubspotContact
      );
      return response.data.id;
    } catch (error) {
      logger.error('Failed to create HubSpot contact:', error);
      throw error;
    }
  }

  async updateContact(
    externalId: string,
    contact: Partial<Contact>
  ): Promise<boolean> {
    try {
      const properties: any = {};

      if (contact.email) properties.email = contact.email;
      if (contact.firstName) properties.firstname = contact.firstName;
      if (contact.lastName) properties.lastname = contact.lastName;
      if (contact.phone) properties.phone = contact.phone;
      if (contact.company) properties.company = contact.company;

      await this.client.patch(`/crm/v3/objects/contacts/${externalId}`, {
        properties,
      });
      return true;
    } catch (error) {
      logger.error('Failed to update HubSpot contact:', error);
      return false;
    }
  }

  async deleteContact(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(`/crm/v3/objects/contacts/${externalId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete HubSpot contact:', error);
      return false;
    }
  }

  async getDeals(lastSync?: Date): Promise<ExternalDeal[]> {
    try {
      const properties = [
        'dealname',
        'amount',
        'dealstage',
        'closedate',
        'lastmodifieddate',
      ];
      let url = `/crm/v3/objects/deals?properties=${properties.join(',')}&limit=100`;

      if (lastSync) {
        const timestamp = lastSync.getTime();
        url += `&filterGroups=[{"filters":[{"propertyName":"lastmodifieddate","operator":"GT","value":"${timestamp}"}]}]`;
      }

      const deals: ExternalDeal[] = [];
      let hasMore = true;
      let after = '';

      while (hasMore) {
        const currentUrl = after ? `${url}&after=${after}` : url;
        const response = await this.client.get(currentUrl);

        const results = response.data.results.map((deal: any) => ({
          id: deal.id,
          name: deal.properties.dealname,
          value: parseFloat(deal.properties.amount) || 0,
          stage: deal.properties.dealstage,
          closeDate: deal.properties.closedate
            ? new Date(deal.properties.closedate)
            : undefined,
          customFields: {},
          lastModified: new Date(deal.properties.lastmodifieddate),
        }));

        deals.push(...results);

        hasMore = !!response.data.paging?.next;
        after = response.data.paging?.next?.after || '';
      }

      return deals;
    } catch (error) {
      logger.error('Failed to get HubSpot deals:', error);
      throw error;
    }
  }

  async createDeal(deal: Deal): Promise<string> {
    try {
      const hubspotDeal = {
        properties: {
          dealname: deal.name,
          amount: deal.value.toString(),
          dealstage: deal.stage,
          closedate: deal.closeDate?.toISOString(),
        },
      };

      const response = await this.client.post(
        '/crm/v3/objects/deals',
        hubspotDeal
      );
      return response.data.id;
    } catch (error) {
      logger.error('Failed to create HubSpot deal:', error);
      throw error;
    }
  }

  async updateDeal(externalId: string, deal: Partial<Deal>): Promise<boolean> {
    try {
      const properties: any = {};

      if (deal.name) properties.dealname = deal.name;
      if (deal.value !== undefined) properties.amount = deal.value.toString();
      if (deal.stage) properties.dealstage = deal.stage;
      if (deal.closeDate) properties.closedate = deal.closeDate.toISOString();

      await this.client.patch(`/crm/v3/objects/deals/${externalId}`, {
        properties,
      });
      return true;
    } catch (error) {
      logger.error('Failed to update HubSpot deal:', error);
      return false;
    }
  }

  async deleteDeal(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(`/crm/v3/objects/deals/${externalId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete HubSpot deal:', error);
      return false;
    }
  }

  async getCompanies(lastSync?: Date): Promise<ExternalCompany[]> {
    try {
      const properties = [
        'name',
        'domain',
        'industry',
        'numberofemployees',
        'lastmodifieddate',
      ];
      let url = `/crm/v3/objects/companies?properties=${properties.join(',')}&limit=100`;

      if (lastSync) {
        const timestamp = lastSync.getTime();
        url += `&filterGroups=[{"filters":[{"propertyName":"lastmodifieddate","operator":"GT","value":"${timestamp}"}]}]`;
      }

      const companies: ExternalCompany[] = [];
      let hasMore = true;
      let after = '';

      while (hasMore) {
        const currentUrl = after ? `${url}&after=${after}` : url;
        const response = await this.client.get(currentUrl);

        const results = response.data.results.map((company: any) => ({
          id: company.id,
          name: company.properties.name,
          domain: company.properties.domain,
          industry: company.properties.industry,
          size: company.properties.numberofemployees,
          customFields: {},
          lastModified: new Date(company.properties.lastmodifieddate),
        }));

        companies.push(...results);

        hasMore = !!response.data.paging?.next;
        after = response.data.paging?.next?.after || '';
      }

      return companies;
    } catch (error) {
      logger.error('Failed to get HubSpot companies:', error);
      throw error;
    }
  }

  async createCompany(company: Company): Promise<string> {
    try {
      const hubspotCompany = {
        properties: {
          name: company.name,
          domain: company.domain,
          industry: company.industry,
          numberofemployees: company.size,
        },
      };

      const response = await this.client.post(
        '/crm/v3/objects/companies',
        hubspotCompany
      );
      return response.data.id;
    } catch (error) {
      logger.error('Failed to create HubSpot company:', error);
      throw error;
    }
  }

  async updateCompany(
    externalId: string,
    company: Partial<Company>
  ): Promise<boolean> {
    try {
      const properties: any = {};

      if (company.name) properties.name = company.name;
      if (company.domain) properties.domain = company.domain;
      if (company.industry) properties.industry = company.industry;
      if (company.size) properties.numberofemployees = company.size;

      await this.client.patch(`/crm/v3/objects/companies/${externalId}`, {
        properties,
      });
      return true;
    } catch (error) {
      logger.error('Failed to update HubSpot company:', error);
      return false;
    }
  }

  async deleteCompany(externalId: string): Promise<boolean> {
    try {
      await this.client.delete(`/crm/v3/objects/companies/${externalId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete HubSpot company:', error);
      return false;
    }
  }
}
