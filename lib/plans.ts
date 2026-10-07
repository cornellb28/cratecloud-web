// ── Plan vocabulary + the entitlement rule ────────────────────────────────
// Mirrors public.entitlements in the shared Supabase project. This module is
// deliberately env-free and side-effect-free so it is safe to import from a
// client component; anything that needs STRIPE_PRICE_ID_* lives in
// lib/stripe.ts behind `server-only`.
//
// The desktop app has its own copy of this vocabulary in
// src/renderer/src/lib/plan.ts. Keep the two in step — a tier renamed here
// has to be renamed there, in the DB check constraint, and in Stripe.

// ⚠ PROVISIONAL NAMES (agreed 2026-09-23). The tier lineup is not final and
// these WILL change. Nothing may branch on a specific paid value: the only
// durable test is `plan !== 'free'`, which is what isPaid() below does and
// what the desktop does too.
export type Plan = 'free' | 'cloud_mobile' | 'cloud_mobile_plus'

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

// TODO(tiers): what Plus adds over Cloud + Mobile is not decided. Both list
// the same things on purpose — advertising a difference that does not exist
// yet is worse than listing none.
export const PAID_TIERS: Tier[] = [
  {
    key: 'cloud_mobile',
    name: 'Cloud + Mobile',
    tagline: 'Your library follows you between machines.',
    features: [
      ...DESKTOP_FEATURES,
      'Tags, crates and play history synced across your machines',
      'Browse and tag from the mobile app'
    ],
    fallbackPrice: '$8 / mo',
    highlight: true
  },
  {
    key: 'cloud_mobile_plus',
    name: 'Cloud + Mobile Plus',
    tagline: 'Everything in Cloud + Mobile.',
    features: [
      ...DESKTOP_FEATURES,
      'Tags, crates and play history synced across your machines',
      'Browse and tag from the mobile app'
    ],
    fallbackPrice: '$15 / mo'
  }
]

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
