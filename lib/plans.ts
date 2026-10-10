// ── Plan vocabulary + the entitlement rule ────────────────────────────────
// Mirrors public.entitlements in the shared Supabase project. This module is
// deliberately env-free and side-effect-free so it is safe to import from a
// client component; anything that needs STRIPE_PRICE_ID_* lives in
// lib/stripe.ts behind `server-only`.
//
// The desktop app has its own copy of this vocabulary in
// src/renderer/src/lib/plan.ts. Keep the two in step — a tier renamed here
// has to be renamed there, in the DB check constraint, and in Stripe.

// Final plan ids (pricing model decided 2026-10-08). The desktop app is free
// and ungated; paid plans are cloud sync + mobile only. Nothing may gate a
// local feature on a plan. The durable test for "is paid" is `plan !== 'free'`
// (isPaid() below, same as the desktop). Mirrored in the DB check constraint
// on public.entitlements.plan and in the desktop's plan.ts — keep all in step.
export type Plan = 'free' | 'sync' | 'library' | 'touring'

// Every status Stripe can put on a subscription, plus 'revoked' for a manual
// or refund-driven revocation that has no Stripe equivalent. Accepting all of
// them is the point — a narrower union would make the webhook throw on a live
// event, and the event most likely to hit it is a card declining.
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | 'revoked'

// One row per account, created at signup by the DB trigger. Columns are
// exactly public.entitlements; the one-time purchase columns (seats,
// purchased_at, stripe_checkout_session_id) are omitted because nothing on
// this site reads or writes them.
export interface Entitlement {
  user_id: string
  plan: Plan
  status: SubscriptionStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}

// ─── THE entitlement rule ─────────────────────────────────────────────────
// This is the one place it exists. It cannot live in the database: it depends
// on current_period_end as well as status, which no check constraint or
// generated column can express.
//
// The past_due grace is what stops a retryable card from cutting a DJ off
// mid-set. Get it wrong in the other direction and you serve someone who
// stopped paying a month ago.
export function isEntitled(e: Pick<Entitlement, 'status' | 'current_period_end'>): boolean {
  if (e.status === 'active' || e.status === 'trialing') return true
  if (e.status !== 'past_due') return false
  if (!e.current_period_end) return false
  return new Date(e.current_period_end).getTime() > Date.now()
}

export function isPaid(plan: Plan | string): boolean {
  return plan !== 'free'
}

// ─── Tiers, as the pricing page shows them ────────────────────────────────
// `key` is what /api/checkout accepts from the client. It is NOT a Stripe
// price id: the client must never be able to name a price, or it could name
// a cheaper one. lib/stripe.ts maps key -> price id from server-only env.
export interface Tier {
  key: Plan
  name: string
  tagline: string
  features: string[]
  // Shown only if Stripe has not been configured yet, so /pricing renders
  // during Phase 1. Once STRIPE_SECRET_KEY is set the real amount is read
  // from Stripe and this is ignored — there is no second price to drift.
  fallbackPrice: string
  // Annual price shown the same way (annual = 10x monthly). Free has none.
  fallbackAnnual?: string
  highlight?: boolean
}

const DESKTOP_FEATURES = [
  'Unlimited tracks, crates and tags',
  'BPM and key analysis',
  'Serato import and .crate export',
  'Live folder watching and relink'
]

export const FREE_TIER: Tier = {
  key: 'free',
  name: 'Free',
  tagline: 'The full desktop app, at no cost — nothing in it is locked.',
  features: DESKTOP_FEATURES,
  fallbackPrice: '$0'
}

// ─── List prices ──────────────────────────────────────────────────────────
// Stripe is the source of truth for what is charged (getTierPricing reads the
// live amount); these are the page fallbacks and the inputs to the margin guard
// test. Keep them equal to the Stripe prices.
//
// ANNUAL = 10x MONTHLY (two months free, a 16.7% discount). The earlier "cap
// annual discounts at 10%" rule is withdrawn.
export const LIST_PRICE_USD: Record<Exclude<Plan, 'free'>, { month: number; year: number }> = {
  sync: { month: 10, year: 100 },
  library: { month: 19, year: 190 },
  touring: { month: 55, year: 550 }
}

// ─── Margin guardrail (>= 75% at full cap, every plan and interval) ───────
// Worst case = the subscriber fills the whole cap. Cost per month is:
//   storage:  cap x 1.10 (mobile proxies at 10% of library size) x $6.95/TB
//   Stripe:   2.9% + $0.30 per charge (an annual charge spread over 12 months)
//   per user: $0.50 for database and support
// Indicative figures at the time of writing (B2-based, see lib/margins.ts and
// tests/margins.test.mts, which fail if any row drops under 75%):
//   Sync     10 GB   monthly 88.3%   annual 89.9%
//   Library  250 GB  monthly 82.8%   annual 81.7%
//   Touring  1 TB    monthly 81.7%   annual 79.3%   (about $9.50/mo cost on annual)
// Re-check before changing any price, cap or inclusion.
//
// Assumes WEB checkout through Stripe. App Store in-app purchase fees would
// break it, so the mobile app must not sell subscriptions.
//
// TODO(addon): 250 GB extra storage block, proposed $15/mo. Not built.
export const PAID_TIERS: Tier[] = [
  {
    key: 'sync',
    name: 'Sync',
    tagline: 'Your library and tags on every machine and your phone.',
    features: [
      ...DESKTOP_FEATURES,
      'Cloud sync of library metadata and tags',
      'Mobile app access + 10 GB cloud audio storage'
    ],
    fallbackPrice: '$10 / mo',
    fallbackAnnual: '$100 / yr'
  },
  {
    key: 'library',
    name: 'Library',
    tagline: 'Your whole library in the cloud, ready to play on mobile.',
    features: ['Everything in Sync', 'Mobile app access + 250 GB cloud audio storage'],
    fallbackPrice: '$19 / mo',
    fallbackAnnual: '$190 / yr',
    highlight: true
  },
  {
    key: 'touring',
    name: 'Touring',
    tagline: 'A bigger cloud library for the DJ who carries everything.',
    features: ['Everything in Sync', 'Mobile app access + 1 TB cloud audio storage'],
    fallbackPrice: '$55 / mo',
    fallbackAnnual: '$550 / yr'
  }
]

// Cloud library caps in GB, enforced SERVER-SIDE from the plan id. Never trust
// a client-supplied cap. Unknown or free plans get 0.
export const STORAGE_CAP_GB: Record<Plan, number> = {
  free: 0,
  sync: 10,
  library: 250,
  touring: 1000
}

export function storageCapGb(plan: string): number {
  return STORAGE_CAP_GB[plan as Plan] ?? 0
}

export const ALL_TIERS: Tier[] = [FREE_TIER, ...PAID_TIERS]

export function tierByKey(key: string): Tier | undefined {
  return ALL_TIERS.find((t) => t.key === key)
}

// A plan value the webhook wrote after this build shipped still has to render
// as something: its own name rather than a blank.
export function planName(plan: Plan | string): string {
  return tierByKey(plan)?.name ?? String(plan).replace(/_/g, ' ')
}

// What the account chip and billing page show for the plan. Derived from the
// row's own `plan` string rather than PAID_TIERS, so renaming or adding a tier
// never needs a change here. No row, plan 'free' or status 'none' all read as
// Free.
export function planLabel(e: { plan: string; status: string } | null | undefined): string {
  if (!e || e.status === 'none' || e.plan === 'free') return 'Free'
  const words = String(e.plan).replace(/[_-]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Free'
}

// ─── Status, in a DJ's words ──────────────────────────────────────────────
// Same wording as the desktop's plan.ts subscriptionNote(), so the two
// surfaces never disagree about what a row means.
export function statusNote(e: Pick<Entitlement, 'status' | 'current_period_end' | 'cancel_at_period_end'>): string | null {
  const end = formatDate(e.current_period_end)

  switch (e.status) {
    case 'active':
      if (e.cancel_at_period_end) return end ? `Ends ${end}` : 'Ends at the end of this period'
      return end ? `Renews ${end}` : null
    case 'trialing':
      return end ? `Trial ends ${end}` : 'Trial'
    case 'past_due':
      return end ? `Payment failed — access until ${end}` : 'Payment failed'
    case 'paused':
      return 'Paused'
    case 'canceled':
      return 'Canceled'
    case 'unpaid':
      return 'Unpaid'
    case 'revoked':
      return 'Revoked'
    default:
      // incomplete / incomplete_expired — a checkout that never finished.
      return 'Not finished'
  }
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
