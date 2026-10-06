// ── POST /api/desktop/redeem ──────────────────────────────────────────────
// Called by the desktop app (not a browser): { key, verifier } -> { access_token,
// refresh_token }. No cookies; proxy.ts skips this route. The app refuses
// redirects, so this must answer at exactly /api/desktop/redeem (no trailing
// slash).
//
// EVERY failure is the same 400 with the same body (see handleRedeem). Never
// say whether a key was unknown, used, expired, wrong-verifier or throttled,
// and never log any of them.

import { clientIp, hit } from '@/lib/rate-limit'
import { handleRedeem, RATE_LIMITS } from '@/lib/desktop-handoff'
import { supabaseIssuer, supabaseStore } from '@/lib/desktop-handoff-supabase'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { limit, windowMs } = RATE_LIMITS.redeemPerIp
  return handleRedeem(request, {
    store: supabaseStore(),
    issuer: supabaseIssuer(),
    // Backstop only; see TODO(rate-limit) in lib/rate-limit.ts.
    // TODO(rate-limit): no per-key_hash limit. Keys are 256-bit and single-use,
    // so there is nothing to guess; revisit if the WAF rule proves insufficient.
    allow: (req) => hit(`redeem:ip:${clientIp(req)}`, limit, windowMs)
  })
}
