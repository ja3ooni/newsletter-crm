import Stripe from 'stripe';
import { logger } from '../utils/logger';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

// Webhook endpoint secret for verifying webhook signatures
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_WEBHOOK_SECRET) {
  logger.warn(
    'STRIPE_WEBHOOK_SECRET not set - webhook signature verification disabled'
  );
}

// Default currency
export const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'usd';

// Stripe configuration constants
export const STRIPE_CONFIG = {
  DEFAULT_CURRENCY,
  WEBHOOK_SECRET: STRIPE_WEBHOOK_SECRET,
  API_VERSION: '2023-10-16' as const,
  MAX_NETWORK_RETRIES: 3,
  TIMEOUT: 30000, // 30 seconds
} as const;
