import axios from 'axios';
import { DripCampaignRepository } from '../../src/repositories/DripCampaignRepository';
import { DripCampaignService } from '../../src/services/DripCampaignService';
import {
  CampaignSubscription,
  CreateDripCampaignRequest,
  DripCampaign
} from '../../src/types';
import { queueManager } from '../../src/utils/queue';

// Mock dependencies
jest.mock('../../src/repositories/DripCampaignRepository');
jest.mock('../../src/utils/queue');
jest.mock('../../src/utils/logger');
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DripCampaignService', () => {
  let dripCampaignService: DripCampaignService;
  let mockDripCampaignRepository: jest.Mocked<DripCampaignRepository>;
  let mockQueueManager: jest.Mocked<typeof queueManager>;

  beforeEach(() => {
    mockDripCampaignRepository = new DripCampaignRepository() as jest.Mocked<DripCampaignRepository>;
    mockQueueManager = queueManager as jest.Mocked<typeof queueManager>;

    (DripCampaignRepository as jest.Mock).mockImplementation(() => mockDripCampaignRepository);

    dripCampaignService = new DripCampaignService();
    jest.clearAllMocks();
  });

  describe('createDripCampaign', () => {
    const validCampaignData: CreateDripCampaignRequest = {
      name: 'Welcome Series',
      description: 'Welcome new users',
      emails: [
        {
          id: 'email-1',
          subject: 'Welcome!',
          content: 'Welcome to our platform',
          delay: 0,
          order: 1
        },
        {
          id: 'email-2',
          subject: 'Getting Started',
          content: 'Here is how to get started',
          delay: 24,
          order: 2
        }
      ],
      trigger: {
        type: 'event',
        eventType: 'user_signup'
      }
    };

    it('should create drip campaign with valid data', async () => {
      const expectedCampaign: DripCampaign = {
        id: 'campaign-123',
        name: validCampaignData.name,
        description: validCampaignData.description,
        emails: validCampaignData.emails,
        trigger: validCampaignData.trigger,
        status: 'draft',
        metrics: {
          totalSubscribers: 0,
          activeSubscribers: 0,
          completedSubscribers: 0,
          unsubscribed: 0,
          averageCompletionRate: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDripCampaignRepository.create.mockResolvedValue(expectedCampaign);

      const result = await dripCampaignService.createDripCampaign(validCampaignData, 'user-123');

      expect(result).toEqual(expectedCampaign);
      expect(mockDripCampaignRepository.create).toHaveBeenCalledWith(validCampaignData, 'user-123');
    });

    it('should throw error for invalid campaign structure', async () => {
      const invalidCampaignData = {
        ...validCampaignData,
        name: ''
      };

      await expect(dripCampaignService.createDripCampaign(invalidCampaignData, 'user-123'))
        .rejects.toThrow('Campaign name is required');
    });

    it('should throw error for campaign without emails', async () => {
      const invalidCampaignData = {
        ...validCampaignData,
        emails: []
      };

      await expect(dripCampaignService.createDripCampaign(invalidCampaignData, 'user-123'))
        .rejects.toThrow('Campaign must have at least one email');
    });

    it('should validate email sequence', async () => {
      const invalidCampaignData = {
        ...validCampaignData,
        emails: [
          {
            id: 'email-1',
            subject: '',
            content: 'Welcome to our platform',
            delay: 0,
            order: 1
          }
        ]
      };

      await expect(dripCampaignService.createDripCampaign(invalidCampaignData, 'user-123'))
        .rejects.toThrow('Email 1 must have a subject');
    });
  });

  describe('subscribeToCampaign', () => {
    const campaignId = 'campaign-123';
    const contactId = 'contact-123';

    const activeCampaign: DripCampaign = {
      id: campaignId,
      name: 'Welcome Series',
      description: 'Welcome new users',
      emails: [
        {
          id: 'email-1',
          subject: 'Welcome!',
          content: 'Welcome to our platform',
          delay: 0,
          order: 1
        }
      ],
      trigger: { type: 'manual' },
      status: 'active',
      metrics: {
        totalSubscribers: 0,
        activeSubscribers: 0,
        completedSubscribers: 0,
        unsubscribed: 0,
        averageCompletionRate: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should subscribe contact to active campaign', async () => {
      const subscription: CampaignSubscription = {
        id: 'sub-123',
        campaignId,
        contactId,
        status: 'active',
        currentEmailIndex: 0,
        subscribedAt: new Date(),
        metadata: {}
      };

      mockDripCampaignRepository.findById.mockResolvedValue(activeCampaign);
      mockDripCampaignRepository.findSubscriptionsByCampaign.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0
      });
      mockDripCampaignRepository.createSubscription.mockResolvedValue(subscription);
      mockDripCampaignRepository.updateSubscription.mockResolvedValue(subscription);
      mockQueueManager.addDripEmail.mockResolvedValue(undefined);

      const result = await dripCampaignService.subscribeToCampaign(campaignId, contactId);

      expect(result).toEqual(subscription);
      expect(mockDripCampaignRepository.createSubscription).toHaveBeenCalledWith(
        campaignId,
        contactId,
        undefined
      );
    });

    it('should throw error for non-existent campaign', async () => {
      mockDripCampaignRepository.findById.mockResolvedValue(null);

      await expect(dripCampaignService.subscribeToCampaign(campaignId, contactId))
        .rejects.toThrow(`Campaign ${campaignId} not found`);
    });

    it('should throw error for inactive campaign', async () => {
      const inactiveCampaign = { ...activeCampaign, status: 'paused' as const };
      mockDripCampaignRepository.findById.mockResolvedValue(inactiveCampaign);

      await expect(dripCampaignService.subscribeToCampaign(campaignId, contactId))
        .rejects.toThrow(`Campaign ${campaignId} is not active`);
    });

    it('should throw error for already subscribed contact', async () => {
      const existingSubscription: CampaignSubscription = {
        id: 'existing-sub',
        campaignId,
        contactId,
        status: 'active',
        currentEmailIndex: 0,
        subscribedAt: new Date(),
        metadata: {}
      };

      mockDripCampaignRepository.findById.mockResolvedValue(activeCampaign);
      mockDripCampaignRepository.findSubscriptionsByCampaign.mockResolvedValue({
        data: [existingSubscription],
        total: 1,
        page: 1,
        limit: 1000,
        totalPages: 1
      });

      await expect(dripCampaignService.subscribeToCampaign(campaignId, contactId))
        .rejects.toThrow('Contact is already subscribed to this campaign');
    });
  });

  describe('processDripEmail', () => {
    const subscriptionId = 'sub-123';
    const emailIndex = 0;
    const emailId = 'email-1';

    const subscription: CampaignSubscription = {
      id: subscriptionId,
      campaignId: 'campaign-123',
      contactId: 'contact-123',
      status: 'active',
      currentEmailIndex: emailIndex,
      subscribedAt: new Date(),
      metadata: {}
    };

    const campaign: DripCampaign = {
      id: 'campaign-123',
      name: 'Welcome Series',
      description: 'Welcome new users',
      emails: [
        {
          id: emailId,
          subject: 'Welcome!',
          content: 'Welcome to our platform',
          delay: 0,
          order: 1
        },
        {
          id: 'email-2',
          subject: 'Getting Started',
          content: 'Here is how to get started',
          delay: 24,
          order: 2
        }
      ],
      trigger: { type: 'manual' },
      status: 'active',
      metrics: {
        totalSubscribers: 0,
        activeSubscribers: 0,
        completedSubscribers: 0,
        unsubscribed: 0,
        averageCompletionRate: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should process drip email successfully', async () => {
      mockDripCampaignRepository.findSubscriptionById.mockResolvedValue(subscription);
      mockDripCampaignRepository.findById.mockResolvedValue(campaign);
      mockDripCampaignRepository.updateSubscription.mockResolvedValue({
        ...subscription,
        currentEmailIndex: 1
      });
      mockQueueManager.addDripEmail.mockResolvedValue(undefined);
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      await dripCampaignService.processDripEmail(subscriptionId, emailIndex, emailId);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/emails/send'),
        expect.objectContaining({
          to: subscription.contactId,
          subject: 'Welcome!',
          content: 'Welcome to our platform'
        }),
        expect.any(Object)
      );
    });

    it('should skip processing for inactive subscription', async () => {
      const inactiveSubscription = { ...subscription, status: 'paused' as const };
      mockDripCampaignRepository.findSubscriptionById.mockResolvedValue(inactiveSubscription);

      await dripCampaignService.processDripEmail(subscriptionId, emailIndex, emailId);

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should skip processing for inactive campaign', async () => {
      const inactiveCampaign = { ...campaign, status: 'paused' as const };
      mockDripCampaignRepository.findSubscriptionById.mockResolvedValue(subscription);
      mockDripCampaignRepository.findById.mockResolvedValue(inactiveCampaign);

      await dripCampaignService.processDripEmail(subscriptionId, emailIndex, emailId);

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should complete campaign when all emails sent', async () => {
      const lastEmailSubscription = { ...subscription, currentEmailIndex: 1 };
      const lastEmailId = 'email-2';

      mockDripCampaignRepository.findSubscriptionById.mockResolvedValue(lastEmailSubscription);
      mockDripCampaignRepository.findById.mockResolvedValue(campaign);
      mockDripCampaignRepository.updateSubscription.mockResolvedValue({
        ...lastEmailSubscription,
        status: 'completed',
        completedAt: new Date()
      });
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      await dripCampaignService.processDripEmail(subscriptionId, 1, lastEmailId);

      expect(mockDripCampaignRepository.updateSubscription).toHaveBeenCalledWith(
        subscriptionId,
        expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date)
        })
      );
    });
  });

  describe('unsubscribeFromCampaign', () => {
    it('should unsubscribe from campaign successfully', async () => {
      const subscriptionId = 'sub-123';
      const unsubscribedSubscription: CampaignSubscription = {
        id: subscriptionId,
        campaignId: 'campaign-123',
        contactId: 'contact-123',
        status: 'unsubscribed',
        currentEmailIndex: 0,
        subscribedAt: new Date(),
        metadata: {}
      };

      mockQueueManager.cancelDripSubscription.mockResolvedValue(undefined);
      mockDripCampaignRepository.updateSubscription.mockResolvedValue(unsubscribedSubscription);

      const result = await dripCampaignService.unsubscribeFromCampaign(subscriptionId);

      expect(result).toEqual(unsubscribedSubscription);
      expect(mockQueueManager.cancelDripSubscription).toHaveBeenCalledWith(subscriptionId);
      expect(mockDripCampaignRepository.updateSubscription).toHaveBeenCalledWith(
        subscriptionId,
        { status: 'unsubscribed' }
      );
    });
  });

  describe('pauseSubscription', () => {
    it('should pause subscription successfully', async () => {
      const subscriptionId = 'sub-123';
      const pausedSubscription: CampaignSubscription = {
        id: subscriptionId,
        campaignId: 'campaign-123',
        contactId: 'contact-123',
        status: 'paused',
        currentEmailIndex: 0,
        subscribedAt: new Date(),
        metadata: {}
      };

      mockQueueManager.cancelDripSubscription.mockResolvedValue(undefined);
      mockDripCampaignRepository.updateSubscription.mockResolvedValue(pausedSubscription);

      const result = await dripCampaignService.pauseSubscription(subscriptionId);

      expect(result).toEqual(pausedSubscription);
      expect(mockQueueManager.cancelDripSubscription).toHaveBeenCalledWith(subscriptionId);
    });
  });

  describe('resumeSubscription', () => {
    it('should resume paused subscription successfully', async () => {
      const subscriptionId = 'sub-123';
      const pausedSubscription: CampaignSubscription = {
        id: subscriptionId,
        campaignId: 'campaign-123',
        contactId: 'contact-123',
        status: 'paused',
        currentEmailIndex: 0,
        subscribedAt: new Date(),
        metadata: {}
      };

      const resumedSubscription = { ...pausedSubscription, status: 'active' as const };

      const campaign: DripCampaign = {
        id: 'campaign-123',
        name: 'Welcome Series',
        description: 'Welcome new users',
        emails: [
          {
            id: 'email-1',
            subject: 'Welcome!',
            content: 'Welcome to our platform',
            delay: 0,
            order: 1
          }
        ],
        trigger: { type: 'manual' },
        status: 'active',
        metrics: {
          totalSubscribers: 0,
          activeSubscribers: 0,
          completedSubscribers: 0,
          unsubscribed: 0,
          averageCompletionRate: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDripCampaignRepository.findSubscriptionById.mockResolvedValue(pausedSubscription);
      mockDripCampaignRepository.findById.mockResolvedValue(campaign);
      mockDripCampaignRepository.updateSubscription
        .mockResolvedValueOnce(resumedSubscription)
        .mockResolvedValueOnce(resumedSubscription);
      mockQueueManager.addDripEmail.mockResolvedValue(undefined);

      const result = await dripCampaignService.resumeSubscription(subscriptionId);

      expect(result).toEqual(resumedSubscription);
      expect(mockDripCampaignRepository.updateSubscription).toHaveBeenCalledWith(
        subscriptionId,
        { status: 'active' }
      );
    });

    it('should throw error for non-paused subscription', async () => {
      const subscriptionId = 'sub-123';
      const activeSubscription: CampaignSubscription = {
        id: subscriptionId,
        campaignId: 'campaign-123',
        contactId: 'contact-123',
        status: 'active',
        currentEmailIndex: 0,
        subscribedAt: new Date(),
        metadata: {}
      };

      mockDripCampaignRepository.findSubscriptionById.mockResolvedValue(activeSubscription);

      await expect(dripCampaignService.resumeSubscription(subscriptionId))
        .rejects.toThrow(`Subscription ${subscriptionId} is not paused`);
    });
  });

  describe('deleteDripCampaign', () => {
    it('should delete campaign without active subscriptions', async () => {
      const campaignId = 'campaign-123';

      mockDripCampaignRepository.findSubscriptionsByCampaign.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 1,
        totalPages: 0
      });
      mockDripCampaignRepository.delete.mockResolvedValue(true);

      const result = await dripCampaignService.deleteDripCampaign(campaignId);

      expect(result).toBe(true);
      expect(mockDripCampaignRepository.delete).toHaveBeenCalledWith(campaignId);
    });

    it('should throw error when campaign has active subscriptions', async () => {
      const campaignId = 'campaign-123';
      const activeSubscription: CampaignSubscription = {
        id: 'sub-123',
        campaignId,
        contactId: 'contact-123',
        status: 'active',
        currentEmailIndex: 0,
        subscribedAt: new Date(),
        metadata: {}
      };

      mockDripCampaignRepository.findSubscriptionsByCampaign.mockResolvedValue({
        data: [activeSubscription],
        total: 1,
        page: 1,
        limit: 1,
        totalPages: 1
      });

      await expect(dripCampaignService.deleteDripCampaign(campaignId))
        .rejects.toThrow('Cannot delete campaign with active subscriptions');
    });
  });

  describe('getCampaignAnalytics', () => {
    it('should return campaign analytics', async () => {
      const campaignId = 'campaign-123';
      const campaign: DripCampaign = {
        id: campaignId,
        name: 'Welcome Series',
        description: 'Welcome new users',
        emails: [
          {
            id: 'email-1',
            subject: 'Welcome!',
            content: 'Welcome to our platform',
            delay: 0,
            order: 1
          }
        ],
        trigger: { type: 'manual' },
        status: 'active',
        metrics: {
          totalSubscribers: 10,
          activeSubscribers: 5,
          completedSubscribers: 3,
          unsubscribed: 2,
          averageCompletionRate: 0.3
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const subscriptions: CampaignSubscription[] = [
        {
          id: 'sub-1',
          campaignId,
          contactId: 'contact-1',
          status: 'active',
          currentEmailIndex: 0,
          subscribedAt: new Date(),
          metadata: {}
        },
        {
          id: 'sub-2',
          campaignId,
          contactId: 'contact-2',
          status: 'completed',
          currentEmailIndex: 1,
          subscribedAt: new Date(),
          metadata: {}
        }
      ];

      mockDripCampaignRepository.findById.mockResolvedValue(campaign);
      mockDripCampaignRepository.findSubscriptionsByCampaign.mockResolvedValue({
        data: subscriptions,
        total: 2,
        page: 1,
        limit: 1000,
        totalPages: 1
      });

      const result = await dripCampaignService.getCampaignAnalytics(campaignId);

      expect(result.campaign).toEqual(campaign);
      expect(result.totalSubscribers).toBe(2);
      expect(result.activeSubscribers).toBe(1);
      expect(result.completedSubscribers).toBe(1);
      expect(result.emailPerformance).toHaveLength(1);
      expect(result.conversionFunnel).toHaveLength(1);
    });
  });
});
