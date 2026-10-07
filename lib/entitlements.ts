// ── Writing public.entitlements ───────────────────────────────────────────
// The service role is the ONLY writer of this table — there is deliberately
// no INSERT or UPDATE policy for authenticated users, because a client that
// could set its own `plan` column is not an entitlement, it's a suggestion.
//
// Every write here is an UPDATE of absolute values against a row the signup
// trigger has already created. That makes each one naturally idempotent,
// which matters: Stripe retries, and a handler that ran twice must land in
// the same place as one that ran once.

import 'server-only'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Entitlement, Plan } from '@/lib/plans'
import { customerIdOf, firstPriceId, mapStatus, periodEndISO, planForPriceId } from '@/lib/stripe'

const COLUMNS =
  'user_id, plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end, cancel_at_period_end'

// Works with either client. Called with the USER's client from /account/billing
// (RLS scopes it to their own row) and with the admin client from the
// webhook and /api/checkout.
export async function readEntitlement(
  supabase: SupabaseClient,
  userId: string
): Promise<Entitlement | null> {
  const { data, error } = await supabase
    .from('entitlements')
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()

  // maybeSingle, not single: "no row" is a legitimate answer in the moments
  // before the signup trigger has committed, and single() would turn that
  // into an error on a brand-new account's first page load.
  if (error || !data) return null
  return data as Entitlement
}

// ─── Resolving a Stripe event back to a user ──────────────────────────────
// A Stripe event carries the customer or the subscription id, never our
// user_id. The two partial indexes in 20260922000000_entitlements.sql exist
// for exactly these two lookups.
//
// Order matters. Subscription id is the most specific; customer id is next;
// the metadata copy is the backstop that survives a lost customer-id write,
// which is why /api/checkout stamps supabase_user_id onto subscription_data.
export async function resolveUserId(
  admin: SupabaseClient,
  hints: { subscriptionId?: string | null; customerId?: string | null; metadataUserId?: string | null }
): Promise<string | null> {
  if (hints.subscriptionId) {
    const { data } = await admin
      .from('entitlements')
      .select('user_id')
      .eq('stripe_subscription_id', hints.subscriptionId)
      .maybeSingle()
    if (data?.user_id) return data.user_id as string
  }

  if (hints.customerId) {
    const { data } = await admin
      .from('entitlements')
      .select('user_id')
      .eq('stripe_customer_id', hints.customerId)
      .maybeSingle()
    if (data?.user_id) return data.user_id as string
  }

  if (hints.metadataUserId) {
    // Confirm the row exists before trusting a metadata string as a user id.
    const { data } = await admin
      .from('entitlements')
      .select('user_id')
      .eq('user_id', hints.metadataUserId)
      .maybeSingle()
    if (data?.user_id) return data.user_id as string
  }

  return null
}

// ─── The writes ───────────────────────────────────────────────────────────

export interface WriteResult {
  ok: boolean
  error?: string
}

async function update(
  admin: SupabaseClient,
  userId: string,
  patch: Record<string, unknown>
): Promise<WriteResult> {
  const { data, error } = await admin
    .from('entitlements')
    .update(patch)
    .eq('user_id', userId)
    .select('user_id')

  if (error) return { ok: false, error: error.message }
  // Zero rows means no entitlement row for this user. The signup trigger
  // guarantees one, so this is a genuine alarm, not a retryable blip.
  if (!data || data.length === 0) return { ok: false, error: `No entitlements row for user ${userId}` }
  return { ok: true }
}

// Written by checkout.session.completed and customer.subscription.updated.
// Both go through here so the two paths cannot drift apart in what they set.
export function subscriptionPatch(sub: Stripe.Subscription): Record<string, unknown> {
  const priceId = firstPriceId(sub)
  const plan: Plan | null = planForPriceId(priceId)
  const status = mapStatus(sub.status)

  const patch: Record<string, unknown> = {
    stripe_customer_id: customerIdOf(sub.customer),
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    current_period_end: periodEndISO(sub),
    cancel_at_period_end: sub.cancel_at_period_end
  }

  // A price id we do not recognise means someone bought something this build
  // does not know about — a price created in the dashboard and never wired
  // into env. Leave `plan` alone rather than guessing: the subscription
  // columns above are still true and still worth writing.
  if (plan) patch.plan = plan

  // Omitted rather than written when Stripe sends a status our CHECK
  // constraint does not accept. See mapStatus().
  if (status) patch.status = status

  return patch
}

export async function applySubscription(
  admin: SupabaseClient,
  userId: string,
  sub: Stripe.Subscription
): Promise<WriteResult> {
  return update(admin, userId, subscriptionPatch(sub))
}

// customer.subscription.deleted — the subscription is over NOW. Stripe fires
// this at period end for a scheduled cancel and immediately for a cancel-now,
// so either way the answer is the same: back to free.
//
// stripe_customer_id is deliberately KEPT, so a DJ who re-subscribes reuses
// their customer instead of collecting a second one with a split invoice
// history.
export async function applyFree(admin: SupabaseClient, userId: string): Promise<WriteResult> {
  return update(admin, userId, {
    plan: 'free',
    status: 'canceled',
    cancel_at_period_end: false,
    current_period_end: null,
    stripe_subscription_id: null,
    stripe_price_id: null
  })
}

// Called from /api/checkout the first time a user is handed a Stripe
// customer, so a repeat visit to the pricing page reuses it rather than
// creating a duplicate. The webhook writes it again from the subscription;
// both are the same value, which is the point.
export async function linkCustomer(
  admin: SupabaseClient,
  userId: string,
  customerId: string
): Promise<WriteResult> {
  return update(admin, userId, { stripe_customer_id: customerId })
}
