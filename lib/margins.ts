// ── Gross margin at full cap ──────────────────────────────────────────────
// Pure arithmetic behind the 75% guardrail documented in lib/plans.ts and
// enforced by tests/margins.test.mts. Indicative: storage price and the
// per-user line are assumptions, not invoices.

// Relative .ts imports so the plain-node test runner can load this file.
import { LIST_PRICE_USD, STORAGE_CAP_GB } from './plans.ts'
import type { Interval, PaidPlan } from './price-map.ts'

export const B2_USD_PER_TB_MONTH = 6.95
export const PROXY_OVERHEAD = 0.1 // mobile proxy files, as a share of library size
export const STRIPE_PERCENT = 0.029
export const STRIPE_FIXED_USD = 0.3
export const PER_USER_USD_MONTH = 0.5 // database + support
export const MARGIN_FLOOR = 0.75

export interface MarginRow {
  revenue: number // per month
  cost: number // per month
  margin: number // 0..1
}

export function marginAtFullCap(plan: PaidPlan, interval: Interval): MarginRow {
  const months = interval === 'year' ? 12 : 1
  const charge = LIST_PRICE_USD[plan][interval]
  const revenue = charge / months
  const storage = ((STORAGE_CAP_GB[plan] * (1 + PROXY_OVERHEAD)) / 1000) * B2_USD_PER_TB_MONTH
  const stripe = (STRIPE_PERCENT * charge + STRIPE_FIXED_USD) / months
  const cost = storage + stripe + PER_USER_USD_MONTH
  return { revenue, cost, margin: (revenue - cost) / revenue }
}
