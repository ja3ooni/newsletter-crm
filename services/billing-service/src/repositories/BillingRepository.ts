import { query } from '../config/database';
import {
  BillingEvent,
  DatabaseSubscription,
  DatabaseSubscriptionPlan,
  Invoice,
  Subscription,
  SubscriptionPlan,
  UsageRecord,
} from '../types';

export class BillingRepository {
  /**
   * Subscription Plans
   */
  async createSubscriptionPlan(
    plan: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SubscriptionPlan> {
    const sql = `
      INSERT INTO subscription_plans (
        name, description, type, billing_interval, price, currency,
        features, limits, trial_days, is_active, stripe_price_id,
        stripe_product_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      plan.name,
      plan.description,
      plan.type,
      plan.billingInterval,
      plan.price,
      plan.currency,
      JSON.stringify(plan.features),
      JSON.stringify(plan.limits),
      plan.trialDays,
      plan.isActive,
      plan.stripePriceId,
      plan.stripeProductId,
      JSON.stringify(plan.metadata),
    ];

    const result = await query(sql, values);
    return this.mapDatabasePlanToModel(result.rows[0]);
  }

  async getSubscriptionPlan(planId: string): Promise<SubscriptionPlan | null> {
    const sql = 'SELECT * FROM subscription_plans WHERE id = $1';
    const result = await query(sql, [planId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDatabasePlanToModel(result.rows[0]);
  }

  async getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const sql =
      'SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price ASC';
    const result = await query(sql);

    return result.rows.map((row: DatabaseSubscriptionPlan) =>
      this.mapDatabasePlanToModel(row)
    );
  }

  async updateSubscriptionPlan(
    planId: string,
    updates: Partial<SubscriptionPlan>
  ): Promise<SubscriptionPlan> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClause.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClause.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.price !== undefined) {
      setClause.push(`price = $${paramIndex++}`);
      values.push(updates.price);
    }
    if (updates.features !== undefined) {
      setClause.push(`features = $${paramIndex++}`);
      values.push(JSON.stringify(updates.features));
    }
    if (updates.limits !== undefined) {
      setClause.push(`limits = $${paramIndex++}`);
      values.push(JSON.stringify(updates.limits));
    }
    if (updates.isActive !== undefined) {
      setClause.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }
    if (updates.metadata !== undefined) {
      setClause.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    setClause.push(`updated_at = NOW()`);
    values.push(planId);

    const sql = `
      UPDATE subscription_plans
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(sql, values);
    return this.mapDatabasePlanToModel(result.rows[0]);
  }

  /**
   * Subscriptions
   */
  async createSubscription(
    subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Subscription> {
    const sql = `
      INSERT INTO subscriptions (
        user_id, plan_id, status, current_period_start, current_period_end,
        cancel_at_period_end, cancelled_at, trial_start, trial_end,
        stripe_subscription_id, stripe_customer_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      subscription.userId,
      subscription.planId,
      subscription.status,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.cancelAtPeriodEnd,
      subscription.cancelledAt,
      subscription.trialStart,
      subscription.trialEnd,
      subscription.stripeSubscriptionId,
      subscription.stripeCustomerId,
      JSON.stringify(subscription.metadata),
    ];

    const result = await query(sql, values);
    return this.mapDatabaseSubscriptionToModel(result.rows[0]);
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    const sql = 'SELECT * FROM subscriptions WHERE id = $1';
    const result = await query(sql, [subscriptionId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDatabaseSubscriptionToModel(result.rows[0]);
  }

  async getActiveSubscriptionByUserId(
    userId: string
  ): Promise<Subscription | null> {
    const sql = `
      SELECT * FROM subscriptions
      WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await query(sql, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDatabaseSubscriptionToModel(result.rows[0]);
  }

  async getSubscriptionsByUserId(userId: string): Promise<Subscription[]> {
    const sql = `
      SELECT * FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await query(sql, [userId]);

    return result.rows.map((row: DatabaseSubscription) =>
      this.mapDatabaseSubscriptionToModel(row)
    );
  }

  async updateSubscription(
    subscriptionId: string,
    updates: Partial<Subscription>
  ): Promise<Subscription> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updates.planId !== undefined) {
      setClause.push(`plan_id = $${paramIndex++}`);
      values.push(updates.planId);
    }
    if (updates.status !== undefined) {
      setClause.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.currentPeriodStart !== undefined) {
      setClause.push(`current_period_start = $${paramIndex++}`);
      values.push(updates.currentPeriodStart);
    }
    if (updates.currentPeriodEnd !== undefined) {
      setClause.push(`current_period_end = $${paramIndex++}`);
      values.push(updates.currentPeriodEnd);
    }
    if (updates.cancelAtPeriodEnd !== undefined) {
      setClause.push(`cancel_at_period_end = $${paramIndex++}`);
      values.push(updates.cancelAtPeriodEnd);
    }
    if (updates.cancelledAt !== undefined) {
      setClause.push(`cancelled_at = $${paramIndex++}`);
      values.push(updates.cancelledAt);
    }
    if (updates.metadata !== undefined) {
      setClause.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    setClause.push(`updated_at = NOW()`);
    values.push(subscriptionId);

    const sql = `
      UPDATE subscriptions
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(sql, values);
    return this.mapDatabaseSubscriptionToModel(result.rows[0]);
  }

  /**
   * Usage Records
   */
  async createUsageRecord(
    usageRecord: Omit<UsageRecord, 'id'>
  ): Promise<UsageRecord> {
    const sql = `
      INSERT INTO usage_records (
        subscription_id, user_id, metric_name, quantity, timestamp,
        stripe_usage_record_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      usageRecord.subscriptionId,
      usageRecord.userId,
      usageRecord.metricName,
      usageRecord.quantity,
      usageRecord.timestamp,
      usageRecord.stripeUsageRecordId,
      JSON.stringify(usageRecord.metadata),
    ];

    const result = await query(sql, values);
    return {
      id: result.rows[0].id,
      subscriptionId: result.rows[0].subscription_id,
      userId: result.rows[0].user_id,
      metricName: result.rows[0].metric_name,
      quantity: result.rows[0].quantity,
      timestamp: result.rows[0].timestamp,
      stripeUsageRecordId: result.rows[0].stripe_usage_record_id,
      metadata: result.rows[0].metadata,
    };
  }

  async getUsageRecords(
    subscriptionId: string,
    metricName?: string,
    limit = 100
  ): Promise<UsageRecord[]> {
    let sql = `
      SELECT * FROM usage_records
      WHERE subscription_id = $1
    `;
    const values = [subscriptionId];

    if (metricName) {
      sql += ` AND metric_name = $2`;
      values.push(metricName);
    }

    sql += ` ORDER BY timestamp DESC LIMIT $${values.length + 1}`;
    values.push(limit.toString());

    const result = await query(sql, values);

    return result.rows.map((row: any) => ({
      id: row.id,
      subscriptionId: row.subscription_id,
      userId: row.user_id,
      metricName: row.metric_name,
      quantity: row.quantity,
      timestamp: row.timestamp,
      stripeUsageRecordId: row.stripe_usage_record_id,
      metadata: row.metadata,
    }));
  }

  /**
   * Invoices
   */
  async createInvoice(
    invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Invoice> {
    const sql = `
      INSERT INTO invoices (
        subscription_id, user_id, stripe_invoice_id, status, amount, currency,
        due_date, paid_at, period_start, period_end, items, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      invoice.subscriptionId,
      invoice.userId,
      invoice.stripeInvoiceId,
      invoice.status,
      invoice.amount,
      invoice.currency,
      invoice.dueDate,
      invoice.paidAt,
      invoice.periodStart,
      invoice.periodEnd,
      JSON.stringify(invoice.items),
      JSON.stringify(invoice.metadata),
    ];

    const result = await query(sql, values);
    return {
      id: result.rows[0].id,
      subscriptionId: result.rows[0].subscription_id,
      userId: result.rows[0].user_id,
      stripeInvoiceId: result.rows[0].stripe_invoice_id,
      status: result.rows[0].status,
      amount: result.rows[0].amount,
      currency: result.rows[0].currency,
      dueDate: result.rows[0].due_date,
      paidAt: result.rows[0].paid_at,
      periodStart: result.rows[0].period_start,
      periodEnd: result.rows[0].period_end,
      items: result.rows[0].items,
      metadata: result.rows[0].metadata,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at,
    };
  }

  async getInvoicesByUserId(userId: string, limit = 50): Promise<Invoice[]> {
    const sql = `
      SELECT * FROM invoices
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await query(sql, [userId, limit]);

    return result.rows.map((row: any) => ({
      id: row.id,
      subscriptionId: row.subscription_id,
      userId: row.user_id,
      stripeInvoiceId: row.stripe_invoice_id,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      dueDate: row.due_date,
      paidAt: row.paid_at,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      items: row.items,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Billing Events
   */
  async createBillingEvent(
    event: Omit<BillingEvent, 'id' | 'createdAt'>
  ): Promise<BillingEvent> {
    const sql = `
      INSERT INTO billing_events (type, subscription_id, user_id, data, processed_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      event.type,
      event.subscriptionId,
      event.userId,
      JSON.stringify(event.data),
      event.processedAt,
    ];

    const result = await query(sql, values);
    return {
      id: result.rows[0].id,
      type: result.rows[0].type,
      subscriptionId: result.rows[0].subscription_id,
      userId: result.rows[0].user_id,
      data: result.rows[0].data,
      processedAt: result.rows[0].processed_at,
      createdAt: result.rows[0].created_at,
    };
  }

  /**
   * Helper methods to map database models to domain models
   */
  private mapDatabasePlanToModel(
    dbPlan: DatabaseSubscriptionPlan
  ): SubscriptionPlan {
    return {
      id: dbPlan.id,
      name: dbPlan.name,
      description: dbPlan.description,
      type: dbPlan.type as 'freemium' | 'premium' | 'enterprise',
      billingInterval: dbPlan.billing_interval as 'month' | 'year',
      price: dbPlan.price,
      currency: dbPlan.currency,
      features: dbPlan.features,
      limits: dbPlan.limits,
      trialDays: dbPlan.trial_days,
      isActive: dbPlan.is_active,
      stripePriceId: dbPlan.stripe_price_id,
      stripeProductId: dbPlan.stripe_product_id,
      metadata: dbPlan.metadata,
      createdAt: dbPlan.created_at,
      updatedAt: dbPlan.updated_at,
    };
  }

  private mapDatabaseSubscriptionToModel(
    dbSub: DatabaseSubscription
  ): Subscription {
    return {
      id: dbSub.id,
      userId: dbSub.user_id,
      planId: dbSub.plan_id,
      status: dbSub.status,
      currentPeriodStart: dbSub.current_period_start,
      currentPeriodEnd: dbSub.current_period_end,
      cancelAtPeriodEnd: dbSub.cancel_at_period_end,
      cancelledAt: dbSub.cancelled_at,
      trialStart: dbSub.trial_start,
      trialEnd: dbSub.trial_end,
      stripeSubscriptionId: dbSub.stripe_subscription_id,
      stripeCustomerId: dbSub.stripe_customer_id,
      metadata: dbSub.metadata,
      createdAt: dbSub.created_at,
      updatedAt: dbSub.updated_at,
    };
  }
}
