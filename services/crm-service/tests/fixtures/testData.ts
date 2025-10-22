import {
    Contact,
    ContactConsent,
    ContactPreferences,
    CreateContactRequest,
    CreateSegmentRequest,
    EngagementEvent,
    Segment,
    UpdateContactRequest
} from '../../src/types';

export const mockContactConsent: ContactConsent = {
  marketing: true,
  analytics: true
};

export const mockContactPreferences: ContactPreferences = {
  emailFrequency: 'weekly',
  contentTypes: ['newsletter', 'updates'],
  communicationChannels: ['email'],
  timezone: 'UTC',
  language: 'en'
};

export const mockContact: Contact = {
  id: 'contact-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  company: 'Test Corp',
  jobTitle: 'Developer',
  phone: '+1234567890',
  customFields: {
    industry: 'Technology',
    companySize: '50-100'
  },
  tags: ['vip', 'newsletter-subscriber'],
  leadScore: 75,
  lifecycle: 'lead',
  source: 'website',
  consent: mockContactConsent,
  preferences: mockContactPreferences,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15')
};

export const mockSegment: Segment = {
  id: 'segment-123',
  name: 'High Value Leads',
  description: 'Contacts with high lead scores and engagement',
  conditions: [
    {
      field: 'leadScore',
      operator: 'greater_than',
      value: 50
    },
    {
      field: 'lifecycle',
      operator: 'equals',
      value: 'lead',
      logicalOperator: 'AND'
    }
  ],
  contactCount: 25,
  isAutoUpdating: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15')
};

export const validCreateContactRequest: CreateContactRequest = {
  email: 'newcontact@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  company: 'New Corp',
  jobTitle: 'Manager',
  phone: '+1987654321',
  customFields: {
    industry: 'Finance'
  },
  tags: ['new-lead'],
  source: 'form-submission'
};

export const validUpdateContactRequest: UpdateContactRequest = {
  firstName: 'Jane',
  lastName: 'Doe',
  company: 'Updated Corp',
  jobTitle: 'Senior Manager',
  customFields: {
    industry: 'Technology',
    companySize: '100-500'
  }
};

export const validCreateSegmentRequest: CreateSegmentRequest = {
  name: 'Premium Customers',
  description: 'Customers with premium subscriptions',
  conditions: [
    {
      field: 'customFields.subscription',
      operator: 'equals',
      value: 'premium'
    }
  ],
  isAutoUpdating: true
};

export const mockEngagementEvent: Omit<EngagementEvent, 'id' | 'contactId' | 'timestamp' | 'createdAt'> = {
  eventType: 'email_open',
  metadata: {
    campaignId: 'campaign-123',
    emailId: 'email-456'
  }
};

export const mockEngagementEventClick: Omit<EngagementEvent, 'id' | 'contactId' | 'timestamp' | 'createdAt'> = {
  eventType: 'email_click',
  metadata: {
    campaignId: 'campaign-123',
    emailId: 'email-456',
    linkUrl: 'https://example.com/product'
  }
};

export const mockContactSearchResponse = {
  contacts: [mockContact],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1
};

export const mockContactStats = {
  total: 100,
  byLifecycle: {
    subscriber: 40,
    lead: 35,
    customer: 20,
    evangelist: 5
  },
  bySource: {
    website: 50,
    social: 20,
    referral: 15,
    direct: 15
  },
  recentActivity: 25
};
