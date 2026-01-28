/**
 * Stripe service – subscription management and webhooks.
 * Requires STRIPE_SECRET_KEY and optional STRIPE_WEBHOOK_SECRET.
 */

import Stripe from 'stripe';
import logger from '../middleware/logger.js';
import type { TierId } from '../config/pricing.js';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function stripeClient(): Stripe | null {
  if (!STRIPE_SECRET || !STRIPE_SECRET.startsWith('sk_')) return null;
  return new Stripe(STRIPE_SECRET, { apiVersion: '2025-02-24.acacia' });
}

export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET && STRIPE_SECRET.startsWith('sk_');
}

export interface CreateCheckoutParams {
  userId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string | null;
  customerEmail?: string | null;
  metadata?: Record<string, string>;
}

/**
 * Create a Stripe Checkout session for subscription.
 */
export async function createCheckoutSession(params: CreateCheckoutParams): Promise<{
  url?: string;
  sessionId?: string;
  error?: string;
}> {
  const stripe = stripeClient();
  if (!stripe) {
    logger.warn('Stripe not configured');
    return { error: 'Billing not configured' };
  }
  const { userId, priceId, successUrl, cancelUrl, customerId, customerEmail, metadata = {} } = params;
  const meta: Record<string, string> = { userId, priceId, ...metadata };
  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: meta,
      subscription_data: { metadata: meta },
    };
    if (customerId) {
      sessionParams.customer = customerId;
    } else if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }
    const session = await stripe.checkout.sessions.create(sessionParams);
    return { url: session.url ?? undefined, sessionId: session.id };
  } catch (e) {
    const err = e as Error;
    logger.error({ err: err.message }, 'Stripe checkout session create failed');
    return { error: err.message || 'Checkout failed' };
  }
}

/**
 * Handle Stripe webhook (subscription updated, payment succeeded, etc.).
 * Verifies signature, handles checkout.session.completed and subscription events.
 */
export async function handleWebhook(
  payload: string | Buffer,
  signature: string
): Promise<{ handled: boolean; error?: string }> {
  if (!STRIPE_WEBHOOK_SECRET) {
    return { handled: false, error: 'Webhook secret not set' };
  }
  const stripe = stripeClient();
  if (!stripe) return { handled: false, error: 'Stripe not configured' };
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    const err = e as Error;
    logger.warn({ err: err.message }, 'Stripe webhook signature verification failed');
    return { handled: false, error: 'Invalid signature' };
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      const tier = tierFromPriceId(session.metadata?.priceId);
      logger.info({ userId, customerId, subscriptionId: subId, tier }, 'Checkout completed');
      if (userId && (customerId || subId)) {
        await updateUserBillingMetadata(userId, {
          stripe_customer_id: customerId ?? undefined,
          subscription_id: subId ?? undefined,
          subscription_tier: tier,
        });
      }
      return { handled: true };
    }
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      const price = sub.items?.data?.[0]?.price;
      const priceId = typeof price?.id === 'string' ? price.id : undefined;
      const tier = event.type === 'customer.subscription.deleted' ? 'free' : tierFromPriceId(priceId);
      logger.info({ userId, subscriptionId: sub.id, tier }, 'Subscription updated');
      if (userId) {
        await updateUserBillingMetadata(userId, {
          subscription_id: sub.id,
          subscription_tier: tier,
        });
      }
      return { handled: true };
    }
    logger.debug({ type: event.type }, 'Stripe webhook event ignored');
    return { handled: true };
  } catch (e) {
    const err = e as Error;
    logger.error({ err: err.message, type: event.type }, 'Stripe webhook handler error');
    return { handled: false, error: err.message };
  }
}

function tierFromPriceId(priceId?: string): TierId {
  if (!priceId) return 'free';
  const pro = [process.env.STRIPE_PRICE_PRO_MONTHLY, process.env.STRIPE_PRICE_PRO_YEARLY].filter(Boolean);
  const team = [process.env.STRIPE_PRICE_TEAM_MONTHLY, process.env.STRIPE_PRICE_TEAM_YEARLY].filter(Boolean);
  if (pro.includes(priceId)) return 'pro';
  if (team.includes(priceId)) return 'team';
  return 'free';
}

interface BillingMetadata {
  stripe_customer_id?: string;
  subscription_id?: string;
  subscription_tier?: TierId;
}

async function updateUserBillingMetadata(userId: string, updates: BillingMetadata): Promise<void> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key || url === 'https://your-project.supabase.co') return;
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data } = await supabase.auth.admin.getUserById(userId);
    const existing = ((data?.user?.user_metadata) as Record<string, unknown>) ?? {};
    const next = { ...existing, ...updates };
    await supabase.auth.admin.updateUserById(userId, { user_metadata: next });
    logger.info({ userId }, 'Updated user billing metadata');
  } catch (e) {
    logger.warn({ userId, err: (e as Error).message }, 'Failed to update user billing metadata');
  }
}
