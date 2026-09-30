// ── Stripe SDK + the price/plan bridge ────────────────────────────────────
// `server-only`: this module reads STRIPE_SECRET_KEY and the price ids, none
// of which may ever be inlined into a client bundle.

import 'server-only'
import Stripe from 'stripe'
import type { Plan, SubscriptionStatus } from '@/lib/plans'

// ⚠ PINNED DELIBERATELY, and verified against stripe@22.6.2's own default.
//
// It matters here more than usual: on this API version `current_period_end`
// has been REMOVED from the Subscription object and lives only on the
// subscription ITEM (see periodEndISO below). Bumping this string without
// re-reading that field is how the renew date silently goes null.
export const STRIPE_API_VERSION = '2026-08-26.dahlia' as const

let cached: Stripe | null = null

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set.')
  }
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      // Shows up in the Stripe dashboard's logs, which is worth its weight
      // the first time you are staring at an event that did not land.
      appInfo: { name: 'cratecloud-web' }
    })
  }
  return cached
}

// ─── tier key <-> price id ────────────────────────────────────────────────
// The client sends a tier KEY ('cloud_mobile'), never a price id. If it could
// send a price id it could send a cheaper one, and Stripe would honour it.

const PRICE_ENV: Record<Exclude<Plan, 'free'>, string> = {
  cloud_mobile: 'STRIPE_PRICE_ID_CLOUD_MOBILE',
  cloud_mobile_plus: 'STRIPE_PRICE_ID_CLOUD_MOBILE_PLUS'
}

export function priceIdForTier(tier: string): string | null {
  const envName = PRICE_ENV[tier as Exclude<Plan, 'free'>]
  if (!envName) return null
  return process.env[envName] ?? null
}

// Read at call time rather than module load: on Vercel the env is present at
// runtime, and a map frozen at import would be empty in some build contexts.
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null
  for (const [tier, envName] of Object.entries(PRICE_ENV)) {
    if (process.env[envName] === priceId) return tier as Plan
  }
  return null
}

// ─── Reading a subscription into entitlement columns ──────────────────────

// The period end now lives on the subscription ITEM, not the subscription
// (Stripe removed it from Subscription — confirmed in stripe@22.6.2's
// CHANGELOG and its SubscriptionItems type). Taking the max across items is
// defensive: our subscriptions carry exactly one price, but a future addon
// item must not shorten someone's access.
export function periodEndISO(sub: Stripe.Subscription): string | null {
  const ends = (sub.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  if (ends.length === 0) return null
  return new Date(Math.max(...ends) * 1000).toISOString()
}

const KNOWN_STATUSES = new Set<string>([
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
  'revoked'
])

// Returns null for a status the entitlements CHECK constraint does not
// accept. The caller then OMITS the column rather than writing it: a row
// that keeps its last known good status is better than a constraint
// violation that 500s the webhook into a three-day retry loop. If Stripe
// ever adds a status, this is where you will see it in the logs.
export function mapStatus(status: string): SubscriptionStatus | null {
  return KNOWN_STATUSES.has(status) ? (status as SubscriptionStatus) : null
}

export function firstPriceId(sub: Stripe.Subscription): string | null {
  return sub.items?.data?.[0]?.price?.id ?? null
}

export function customerIdOf(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

// ─── Live prices for /pricing ─────────────────────────────────────────────
// Read from Stripe rather than hardcoded, so the page can never advertise an
// amount the checkout does not charge. Returns an empty map when Stripe is
// not configured yet, and the page falls back to Tier.fallbackPrice — which
// is what lets /pricing render during Phase 1.
export async function getTierPricing(): Promise<Record<string, string>> {
  if (!isStripeConfigured()) return {}

  const stripe = getStripe()
  const out: Record<string, string> = {}

  await Promise.all(
    Object.keys(PRICE_ENV).map(async (tier) => {
      const priceId = priceIdForTier(tier)
      if (!priceId) return
      try {
        const price = await stripe.prices.retrieve(priceId)
        if (price.unit_amount == null) return
        const amount = (price.unit_amount / 100).toLocaleString('en-US', {
          style: 'currency',
          currency: price.currency.toUpperCase(),
          minimumFractionDigits: price.unit_amount % 100 === 0 ? 0 : 2
        })
        const interval = price.recurring?.interval
        out[tier] = interval ? `${amount} / ${interval === 'month' ? 'mo' : interval}` : amount
      } catch {
        // A price id that does not resolve is a config problem, not a reason
        // to 500 the pricing page. The fallback copy renders instead.
      }
    })
  )

  return out
}
