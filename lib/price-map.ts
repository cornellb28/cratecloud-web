// ── Stripe price id <-> plan + billing interval ───────────────────────────
// Pure and env-injectable (no `server-only`, no Stripe SDK) so every mapping
// can be unit-tested. lib/stripe.ts and the webhook both go through here, so
// checkout and the webhook can never disagree about what a price means.
//
// Six prices: monthly and annual for each paid plan. Annual = 10x monthly
// (two months free). The price ids live in env, never in code.
//
// TODO(live-mode): before launch, create the six LIVE-mode Prices in Stripe
// (same amounts, one Product per plan) and swap their ids into the Production
// env vars below. Production currently holds TEST-mode ids.

import type { Plan } from '@/lib/plans'

export type PaidPlan = Exclude<Plan, 'free'>
export type Interval = 'month' | 'year'

export const PAID_PLANS: PaidPlan[] = ['sync', 'library', 'touring']
export const INTERVALS: Interval[] = ['month', 'year']

export const PRICE_ENV: Record<PaidPlan, Record<Interval, string>> = {
  sync: { month: 'STRIPE_PRICE_SYNC', year: 'STRIPE_PRICE_SYNC_ANNUAL' },
  library: { month: 'STRIPE_PRICE_LIBRARY', year: 'STRIPE_PRICE_LIBRARY_ANNUAL' },
  touring: { month: 'STRIPE_PRICE_TOURING', year: 'STRIPE_PRICE_TOURING_ANNUAL' }
}

type Env = Record<string, string | undefined>

export function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === 'string' && (PAID_PLANS as string[]).includes(value)
}

// Missing interval means monthly (older clients); anything else that is not
// exactly 'month' or 'year' is rejected.
export function parseInterval(raw: unknown): Interval | null {
  if (raw === undefined || raw === null) return 'month'
  return raw === 'month' || raw === 'year' ? raw : null
}

export function priceIdFor(plan: unknown, interval: Interval, env: Env = process.env): string | null {
  if (!isPaidPlan(plan)) return null
  return env[PRICE_ENV[plan][interval]] || null
}

// Read at call time, not module load: on Vercel the env is present at runtime
// and a map frozen at import would be empty in some build contexts.
export function planAndIntervalForPriceId(
  priceId: string | null | undefined,
  env: Env = process.env
): { plan: PaidPlan; interval: Interval } | null {
  if (!priceId) return null
  for (const plan of PAID_PLANS) {
    for (const interval of INTERVALS) {
      const configured = env[PRICE_ENV[plan][interval]]
      if (configured && configured === priceId) return { plan, interval }
    }
  }
  return null
}
