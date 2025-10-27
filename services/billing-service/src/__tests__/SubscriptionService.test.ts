import { BillingRepository } from '../repositories/BillingRepository';
import { EventService } from '../services/EventService';
import { StripeService } from '../services/StripeService';
import { SubscriptionService } from '../services/SubscriptionService';
import { CreateSubscriptionRequest, SubscriptionPlan } from '../types';

// Mock the dependencies
jest.mock('../services/StripeService');
jest.mock('../repositories/BillingRepository');
jest.mock('../services/EventService');

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let mockStripeService: jest.Mocked<StripeService>;
  let mockBillingRepository: jest.Mocked<BillingRepository>;
  let mockEventService: jest.Mocked<EventService>;

  beforeEach(() => {
    mockStripeService = new StripeService() as jest.Mocked<StripeService>;
    mockBillingRepository =
      new BillingRepository() as jest.Mocked<BillingRepository>;
    mockEventService = new EventService(
      mockBillingRepository
    ) as jest.Mocked<EventService>;

    subscriptionService = new SubscriptionService(
      mockStripeService,
      mockBillingRepository,
      mockEventService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    const mockPlan: SubscriptionPlan = {
      id: 'plan-123',
      name: 'Premium Plan',
      description: 'Premium subscription plan',
      type: 'premium',
      billingInterval: 'month',
      price: 2999, // $29.99
      currency: 'usd',
      features: [
        {
          name: 'Unlimited newsletters',
          description: 'Send unlimited newsletters',
          included: true,
        },
        {
          name: 'Advanced analytics',
          description: 'Detailed analytics dashboard',
          included: true,
        },
      ],
      limits: {
        newsletters: -1, // unlimited
        subscribers: 10000,
        emailsPerMonth: 50000,
        automations: 10,
        templates: 50,
        apiCalls: 10000,
      },
      trialDays: 14,
      isActive: true,
      stripePriceId: 'price_stripe_123',
      stripeProductId: 'prod_stripe_123',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockRequest: CreateSubscriptionRequest = {
      userId: 'user-123',
      planId: 'plan-123',
      paymentMethodId: 'pm_test_123',
      metadata: { source: 'web' },
    };

    it('should create a subscription successfully', async () => {
      // Mock repository responses
      mockBillingRepository.getSubscriptionPlan.mockResolvedValue(mockPlan);
      mockBillingRepository.getActiveSubscriptionByUserId.mockResolvedValue(
        null
      );
      mockBillingRepository.createSubscription.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        planId: 'plan-123',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
        metadata: { source: 'web' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock Stripe responses
      const mockStripeCustomer = {
        id: 'cus_stripe_123',
        email: 'user@example.com',
      };
      const mockStripeSubscription = {
        id: 'sub_stripe_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(
          (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000
        ),
        cancel_at_period_end: false,
        canceled_at: null,
        trial_start: null,
        trial_end: null,
      };

      // Mock the StripeService methods
      mockStripeService.listCustomers = jest
        .fn()
        .mockResolvedValue({ data: [mockStripeCustomer] });
      mockStripeService.getCustomer = jest
        .fn()
        .mockResolvedValue(mockStripeCustomer);

      mockStripeService.createSubscription.mockResolvedValue(
        mockStripeSubscription as any
      );
      mockStripeService.attachPaymentMethod.mockResolvedValue({} as any);
      mockStripeService.setDefaultPaymentMethod.mockResolvedValue({} as any);

      // Mock event service
      mockEventService.publishEvent.mockResolvedValue();

      // Execute the test
      const result = await subscriptionService.createSubscription(mockRequest);

      // Assertions
      expect(result).toBeDefined();
      expect(result.id).toBe('sub-123');
      expect(result.userId).toBe('user-123');
      expect(result.planId).toBe('plan-123');
      expect(result.status).toBe('active');

      // Verify service calls
      expect(mockBillingRepository.getSubscriptionPlan).toHaveBeenCalledWith(
        'plan-123'
      );
      expect(
        mockBillingRepository.getActiveSubscriptionByUserId
      ).toHaveBeenCalledWith('user-123');
      expect(mockStripeService.createSubscription).toHaveBeenCalled();
      expect(mockBillingRepository.createSubscription).toHaveBeenCalled();
      expect(mockEventService.publishEvent).toHaveBeenCalledWith({
        type: 'subscription.created',
        userId: 'user-123',
        subscriptionId: 'sub-123',
        data: expect.objectContaining({
          planId: 'plan-123',
          planName: 'Premium Plan',
          status: 'active',
        }),
      });
    });

    it('should throw error if plan not found', async () => {
      mockBillingRepository.getSubscriptionPlan.mockResolvedValue(null);

      await expect(
        subscriptionService.createSubscription(mockRequest)
      ).rejects.toThrow('Subscription plan not found');

      expect(mockBillingRepository.getSubscriptionPlan).toHaveBeenCalledWith(
        'plan-123'
      );
    });

    it('should throw error if plan is not active', async () => {
      const inactivePlan = { ...mockPlan, isActive: false };
      mockBillingRepository.getSubscriptionPlan.mockResolvedValue(inactivePlan);

      await expect(
        subscriptionService.createSubscription(mockRequest)
      ).rejects.toThrow('Subscription plan is not active');
    });

    it('should throw error if user already has active subscription', async () => {
      mockBillingRepository.getSubscriptionPlan.mockResolvedValue(mockPlan);
      mockBillingRepository.getActiveSubscriptionByUserId.mockResolvedValue({
        id: 'existing-sub',
        userId: 'user-123',
        planId: 'other-plan',
        status: 'active',
      } as any);

      await expect(
        subscriptionService.createSubscription(mockRequest)
      ).rejects.toThrow('User already has an active subscription');
    });
  });

  describe('getSubscription', () => {
    it('should return subscription if found', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: 'user-123',
        planId: 'plan-123',
        status: 'active',
      };

      mockBillingRepository.getSubscription.mockResolvedValue(
        mockSubscription as any
      );

      const result = await subscriptionService.getSubscription('sub-123');

      expect(result).toEqual(mockSubscription);
      expect(mockBillingRepository.getSubscription).toHaveBeenCalledWith(
        'sub-123'
      );
    });

    it('should return null if subscription not found', async () => {
      mockBillingRepository.getSubscription.mockResolvedValue(null);

      const result = await subscriptionService.getSubscription('non-existent');

      expect(result).toBeNull();
      expect(mockBillingRepository.getSubscription).toHaveBeenCalledWith(
        'non-existent'
      );
    });
  });

  describe('cancelSubscription', () => {
    const mockSubscription = {
      id: 'sub-123',
      userId: 'user-123',
      planId: 'plan-123',
      status: 'active',
      stripeSubscriptionId: 'sub_stripe_123',
    };

    it('should cancel subscription successfully', async () => {
      mockBillingRepository.getSubscription.mockResolvedValue(
        mockSubscription as any
      );

      const mockStripeSubscription = {
        id: 'sub_stripe_123',
        status: 'canceled',
        cancel_at_period_end: false,
        canceled_at: Math.floor(Date.now() / 1000),
      };

      mockStripeService.cancelSubscription.mockResolvedValue(
        mockStripeSubscription as any
      );

      const updatedSubscription = {
        ...mockSubscription,
        status: 'cancelled',
        cancelledAt: new Date(),
      };

      mockBillingRepository.updateSubscription.mockResolvedValue(
        updatedSubscription as any
      );
      mockEventService.publishEvent.mockResolvedValue();

      const result = await subscriptionService.cancelSubscription(
        'sub-123',
        false
      );

      expect(result.status).toBe('cancelled');
      expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith(
        'sub_stripe_123',
        false
      );
      expect(mockEventService.publishEvent).toHaveBeenCalledWith({
        type: 'subscription.cancelled',
        userId: 'user-123',
        subscriptionId: 'sub-123',
        data: expect.objectContaining({
          immediately: false,
        }),
      });
    });

    it('should throw error if subscription not found', async () => {
      mockBillingRepository.getSubscription.mockResolvedValue(null);

      await expect(
        subscriptionService.cancelSubscription('non-existent', false)
      ).rejects.toThrow('Subscription not found');
    });
  });
});
