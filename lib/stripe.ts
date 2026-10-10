// ── Stripe SDK + the price/plan bridge ────────────────────────────────────
// `server-only`: this module reads STRIPE_SECRET_KEY and the price ids, none
// of which may ever be inlined into a client bundle.

import 'server-only'
import Stripe from 'stripe'
import type { Plan, SubscriptionStatus } from '@/lib/plans'
import {
  INTERVALS,
  PAID_PLANS,
  planAndIntervalForPriceId,
  priceIdFor,
  type Interval
} from '@/lib/price-map'

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
      appInfo: { name: 'deepcrated-web' }
    })
  }
  return cached
}

// ─── tier key <-> price id ────────────────────────────────────────────────
// The client sends a tier KEY ('library') and an interval, never a price id.
// If it could send a price id it could send a cheaper one, and Stripe would
// honour it. The mapping itself lives in lib/price-map.ts (unit-tested).

export function priceIdForTier(tier: string, interval: Interval = 'month'): string | null {
  return priceIdFor(tier, interval)
}

export function planForPriceId(priceId: string | null | undefined): Plan | null {
  return planAndIntervalForPriceId(priceId)?.plan ?? null
}

export { planAndIntervalForPriceId }

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
export type TierPricing = Record<string, Partial<Record<Interval, string>>>

export async function getTierPricing(): Promise<TierPricing> {
  if (!isStripeConfigured()) return {}

  const stripe = getStripe()
  const out: TierPricing = {}

  await Promise.all(
    PAID_PLANS.flatMap((tier) =>
      INTERVALS.map(async (interval) => {
        const priceId = priceIdFor(tier, interval)
        if (!priceId) return
        try {
          const price = await stripe.prices.retrieve(priceId)
          if (price.unit_amount == null) return
          const amount = (price.unit_amount / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: price.currency.toUpperCase(),
            minimumFractionDigits: price.unit_amount % 100 === 0 ? 0 : 2
          })
          const unit = interval === 'month' ? 'mo' : 'yr'
          out[tier] = { ...out[tier], [interval]: `${amount} / ${unit}` }
        } catch {
          // A price id that does not resolve is a config problem, not a reason
          // to 500 the pricing page. The fallback copy renders instead.
        }
      })
    )
  )

  return out
}
