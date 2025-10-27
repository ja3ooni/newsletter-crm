import { BillingRepository } from '../repositories/BillingRepository';
import { StripeService } from '../services/StripeService';
import { SubscriptionPlan } from '../types';
import { logger } from '../utils/logger';

const SUBSCRIPTION_PLANS = [
  {
    name: 'Free',
    description: 'Perfect for getting started with newsletter automation',
    type: 'freemium' as const,
    billingInterval: 'month' as const,
    price: 0,
    currency: 'usd',
    features: [
      {
        name: 'Basic newsletter creation',
        description: 'Create and send newsletters',
        included: true,
      },
      {
        name: 'Email support',
        description: 'Get help via email',
        included: true,
      },
      {
        name: 'Basic templates',
        description: 'Access to basic newsletter templates',
        included: true,
      },
    ],
    limits: {
      newsletters: 5,
      subscribers: 100,
      emailsPerMonth: 1000,
      automations: 1,
      templates: 5,
      apiCalls: 100,
    },
    trialDays: 0,
  },
  {
    name: 'Professional',
    description: 'For growing businesses that need advanced features',
    type: 'premium' as const,
    billingInterval: 'month' as const,
    price: 2999, // $29.99
    currency: 'usd',
    features: [
      {
        name: 'Unlimited newsletters',
        description: 'Create and send unlimited newsletters',
        included: true,
      },
      {
        name: 'Advanced analytics',
        description: 'Detailed performance analytics',
        included: true,
      },
      {
        name: 'A/B testing',
        description: 'Test different versions of your newsletters',
        included: true,
      },
      {
        name: 'Custom templates',
        description: 'Create and customize your own templates',
        included: true,
      },
      {
        name: 'Priority support',
        description: 'Get priority email and chat support',
        included: true,
      },
      {
        name: 'Marketing automation',
        description: 'Set up automated email sequences',
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
  },
  {
    name: 'Enterprise',
    description: 'For large organizations with advanced needs',
    type: 'enterprise' as const,
    billingInterval: 'month' as const,
    price: 9999, // $99.99
    currency: 'usd',
    features: [
      {
        name: 'Everything in Professional',
        description: 'All Professional features included',
        included: true,
      },
      {
        name: 'Unlimited subscribers',
        description: 'No limit on subscriber count',
        included: true,
      },
      {
        name: 'Advanced CRM integration',
        description: 'Deep integration with CRM systems',
        included: true,
      },
      {
        name: 'Custom integrations',
        description: 'Build custom integrations via API',
        included: true,
      },
      {
        name: 'Dedicated support',
        description: 'Dedicated customer success manager',
        included: true,
      },
      {
        name: 'White-label options',
        description: 'Remove branding and customize interface',
        included: true,
      },
      {
        name: 'Advanced security',
        description: 'SSO, audit logs, and compliance features',
        included: true,
      },
    ],
    limits: {
      newsletters: -1, // unlimited
      subscribers: -1, // unlimited
      emailsPerMonth: -1, // unlimited
      automations: -1, // unlimited
      templates: -1, // unlimited
      apiCalls: -1, // unlimited
    },
    trialDays: 30,
  },
];

async function seedSubscriptionPlans(): Promise<void> {
  const stripeService = new StripeService();
  const billingRepository = new BillingRepository();

  try {
    logger.info('Starting to seed subscription plans...');

    for (const planData of SUBSCRIPTION_PLANS) {
      logger.info(`Processing plan: ${planData.name}`);

      // Create Stripe product
      const stripeProduct = await stripeService.createProduct(
        planData.name,
        planData.description
      );

      // Create Stripe price (skip for free plan)
      let stripePrice;
      if (planData.price > 0) {
        stripePrice = await stripeService.createPrice(
          stripeProduct.id,
          planData.price,
          planData.currency,
          planData.billingInterval
        );
      } else {
        // For free plans, we still need a price object in Stripe
        stripePrice = await stripeService.createPrice(
          stripeProduct.id,
          0,
          planData.currency,
          planData.billingInterval
        );
      }

      // Create plan in database
      const plan: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'> = {
        name: planData.name,
        description: planData.description,
        type: planData.type,
        billingInterval: planData.billingInterval,
        price: planData.price,
        currency: planData.currency,
        features: planData.features,
        limits: planData.limits,
        trialDays: planData.trialDays,
        isActive: true,
        stripePriceId: stripePrice.id,
        stripeProductId: stripeProduct.id,
        metadata: {
          seeded: true,
          seedDate: new Date().toISOString(),
        },
      };

      const createdPlan = await billingRepository.createSubscriptionPlan(plan);

      logger.info(
        `Successfully created plan: ${createdPlan.name} (ID: ${createdPlan.id})`
      );
    }

    logger.info('All subscription plans seeded successfully');
  } catch (error) {
    logger.error('Failed to seed subscription plans', { error: error.message });
    throw error;
  }
}

// Run seeding if this script is executed directly
if (require.main === module) {
  seedSubscriptionPlans()
    .then(() => {
      logger.info('Seeding process completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Seeding process failed', { error: error.message });
      process.exit(1);
    });
}

export { seedSubscriptionPlans };
