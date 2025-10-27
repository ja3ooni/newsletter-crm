import Stripe from 'stripe';
import { DEFAULT_CURRENCY, stripe } from '../config/stripe';
import { logger } from '../utils/logger';

export class StripeService {
  /**
   * Create a Stripe customer
   */
  async createCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: metadata || {},
      });

      logger.info('Stripe customer created', {
        customerId: customer.id,
        email,
      });
      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer', { email, error });
      throw error;
    }
  }

  /**
   * Create a subscription
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    paymentMethodId?: string,
    trialDays?: number,
    promoCodeId?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        metadata: metadata || {},
        expand: ['latest_invoice.payment_intent'],
      };

      if (paymentMethodId) {
        subscriptionData.default_payment_method = paymentMethodId;
      }

      if (trialDays && trialDays > 0) {
        subscriptionData.trial_period_days = trialDays;
      }

      if (promoCodeId) {
        subscriptionData.promotion_code = promoCodeId;
      }

      const subscription = await stripe.subscriptions.create(subscriptionData);

      logger.info('Stripe subscription created', {
        subscriptionId: subscription.id,
        customerId,
        priceId,
        status: subscription.status,
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to create Stripe subscription', {
        customerId,
        priceId,
        error,
      });
      throw error;
    }
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: {
      priceId?: string;
      cancelAtPeriodEnd?: boolean;
      promoCodeId?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<Stripe.Subscription> {
    try {
      const updateData: Stripe.SubscriptionUpdateParams = {};

      if (updates.priceId) {
        // Get current subscription to update items
        const currentSub = await stripe.subscriptions.retrieve(subscriptionId);
        updateData.items = [
          {
            id: currentSub.items.data[0].id,
            price: updates.priceId,
          },
        ];
      }

      if (updates.cancelAtPeriodEnd !== undefined) {
        updateData.cancel_at_period_end = updates.cancelAtPeriodEnd;
      }

      if (updates.promoCodeId) {
        updateData.promotion_code = updates.promoCodeId;
      }

      if (updates.metadata) {
        updateData.metadata = updates.metadata;
      }

      const subscription = await stripe.subscriptions.update(
        subscriptionId,
        updateData
      );

      logger.info('Stripe subscription updated', {
        subscriptionId,
        updates,
        status: subscription.status,
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to update Stripe subscription', {
        subscriptionId,
        updates,
        error,
      });
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediately = false
  ): Promise<Stripe.Subscription> {
    try {
      let subscription: Stripe.Subscription;

      if (immediately) {
        subscription = await stripe.subscriptions.cancel(subscriptionId);
      } else {
        subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }

      logger.info('Stripe subscription cancelled', {
        subscriptionId,
        immediately,
        status: subscription.status,
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to cancel Stripe subscription', {
        subscriptionId,
        immediately,
        error,
      });
      throw error;
    }
  }

  /**
   * Create a usage record for metered billing
   */
  async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    timestamp?: Date
  ): Promise<Stripe.UsageRecord> {
    try {
      const usageRecord = await stripe.subscriptionItems.createUsageRecord(
        subscriptionItemId,
        {
          quantity,
          timestamp: timestamp
            ? Math.floor(timestamp.getTime() / 1000)
            : undefined,
        }
      );

      logger.info('Stripe usage record created', {
        subscriptionItemId,
        quantity,
        timestamp,
        usageRecordId: usageRecord.id,
      });

      return usageRecord;
    } catch (error) {
      logger.error('Failed to create Stripe usage record', {
        subscriptionItemId,
        quantity,
        timestamp,
        error,
      });
      throw error;
    }
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await stripe.paymentMethods.attach(
        paymentMethodId,
        {
          customer: customerId,
        }
      );

      logger.info('Payment method attached to customer', {
        paymentMethodId,
        customerId,
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to attach payment method', {
        paymentMethodId,
        customerId,
        error,
      });
      throw error;
    }
  }

  /**
   * Set default payment method for customer
   */
  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      logger.info('Default payment method set', {
        customerId,
        paymentMethodId,
      });

      return customer;
    } catch (error) {
      logger.error('Failed to set default payment method', {
        customerId,
        paymentMethodId,
        error,
      });
      throw error;
    }
  }

  /**
   * Create a promotion code
   */
  async createPromotionCode(
    couponId: string,
    code: string,
    maxRedemptions?: number,
    expiresAt?: Date
  ): Promise<Stripe.PromotionCode> {
    try {
      const promotionCodeData: Stripe.PromotionCodeCreateParams = {
        coupon: couponId,
        code,
      };

      if (maxRedemptions) {
        promotionCodeData.max_redemptions = maxRedemptions;
      }

      if (expiresAt) {
        promotionCodeData.expires_at = Math.floor(expiresAt.getTime() / 1000);
      }

      const promotionCode =
        await stripe.promotionCodes.create(promotionCodeData);

      logger.info('Stripe promotion code created', {
        promotionCodeId: promotionCode.id,
        code,
        couponId,
      });

      return promotionCode;
    } catch (error) {
      logger.error('Failed to create Stripe promotion code', {
        couponId,
        code,
        error,
      });
      throw error;
    }
  }

  /**
   * Create a coupon
   */
  async createCoupon(
    type: 'percentage' | 'fixed_amount',
    value: number,
    currency?: string,
    duration: 'forever' | 'once' | 'repeating' = 'once',
    durationInMonths?: number
  ): Promise<Stripe.Coupon> {
    try {
      const couponData: Stripe.CouponCreateParams = {
        duration,
      };

      if (type === 'percentage') {
        couponData.percent_off = value;
      } else {
        couponData.amount_off = value;
        couponData.currency = currency || DEFAULT_CURRENCY;
      }

      if (duration === 'repeating' && durationInMonths) {
        couponData.duration_in_months = durationInMonths;
      }

      const coupon = await stripe.coupons.create(couponData);

      logger.info('Stripe coupon created', {
        couponId: coupon.id,
        type,
        value,
        duration,
      });

      return coupon;
    } catch (error) {
      logger.error('Failed to create Stripe coupon', {
        type,
        value,
        duration,
        error,
      });
      throw error;
    }
  }

  /**
   * Retrieve subscription with expanded data
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['customer', 'items.data.price.product', 'latest_invoice'],
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to retrieve Stripe subscription', {
        subscriptionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Retrieve customer with expanded data
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.retrieve(customerId, {
        expand: ['subscriptions', 'invoice_settings.default_payment_method'],
      });

      return customer as Stripe.Customer;
    } catch (error) {
      logger.error('Failed to retrieve Stripe customer', {
        customerId,
        error,
      });
      throw error;
    }
  }

  /**
   * List customers with optional filters
   */
  async listCustomers(options?: {
    metadata?: Record<string, string>;
    limit?: number;
    email?: string;
  }): Promise<Stripe.ApiList<Stripe.Customer>> {
    try {
      const customers = await stripe.customers.list({
        ...options,
      });

      logger.info('Listed Stripe customers', {
        count: customers.data.length,
        options,
      });

      return customers;
    } catch (error) {
      logger.error('Failed to list Stripe customers', { options, error });
      throw error;
    }
  }

  /**
   * List customer invoices
   */
  async getCustomerInvoices(
    customerId: string,
    limit = 10,
    startingAfter?: string
  ): Promise<Stripe.ApiList<Stripe.Invoice>> {
    try {
      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit,
        starting_after: startingAfter,
        expand: ['data.subscription'],
      });

      return invoices;
    } catch (error) {
      logger.error('Failed to retrieve customer invoices', {
        customerId,
        limit,
        error,
      });
      throw error;
    }
  }

  /**
   * Retry invoice payment
   */
  async retryInvoicePayment(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await stripe.invoices.pay(invoiceId);

      logger.info('Invoice payment retried', {
        invoiceId,
        status: invoice.status,
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to retry invoice payment', {
        invoiceId,
        error,
      });
      throw error;
    }
  }

  /**
   * Create a product for subscription plans
   */
  async createProduct(
    name: string,
    description?: string
  ): Promise<Stripe.Product> {
    try {
      const product = await stripe.products.create({
        name,
        description,
        type: 'service',
      });

      logger.info('Stripe product created', {
        productId: product.id,
        name,
      });

      return product;
    } catch (error) {
      logger.error('Failed to create Stripe product', {
        name,
        description,
        error,
      });
      throw error;
    }
  }

  /**
   * Create a price for a product
   */
  async createPrice(
    productId: string,
    unitAmount: number,
    currency: string = DEFAULT_CURRENCY,
    interval: 'month' | 'year' = 'month'
  ): Promise<Stripe.Price> {
    try {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: unitAmount,
        currency,
        recurring: {
          interval,
        },
      });

      logger.info('Stripe price created', {
        priceId: price.id,
        productId,
        unitAmount,
        interval,
      });

      return price;
    } catch (error) {
      logger.error('Failed to create Stripe price', {
        productId,
        unitAmount,
        currency,
        interval,
        error,
      });
      throw error;
    }
  }
}
