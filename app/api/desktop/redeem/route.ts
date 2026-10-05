// ── POST /api/desktop/redeem ──────────────────────────────────────────────
// Called by the desktop app (not a browser): { key, verifier } -> { access_token,
// refresh_token }. No cookies; proxy.ts skips this route.
//
// EVERY failure is the same 400. Never say whether a key was unknown, used,
// expired, or paired with the wrong verifier, and never log any of them.

import { NextResponse } from 'next/server'
import { clientIp, hit } from '@/lib/rate-limit'
import { redeemHandoff } from '@/lib/desktop-handoff'
import { supabaseIssuer, supabaseStore } from '@/lib/desktop-handoff-supabase'

export const runtime = 'nodejs'

const headers = { 'Cache-Control': 'no-store' }
const fail = (status = 400) => NextResponse.json({ error: 'invalid_request' }, { status, headers })

export async function POST(request: Request) {
  // Backstop only; see TODO(rate-limit) in lib/rate-limit.ts.
  // TODO(rate-limit): per-user limit needs the user, which is unknown until a
  // key resolves. Keys are 256-bit, so the IP limit and the WAF rule suffice.
  if (!hit(`redeem:ip:${clientIp(request)}`, 20, 60_000)) return fail(429)

  let body: { key?: unknown; verifier?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return fail()
  }

  try {
    const session = await redeemHandoff(
      { key: body.key, verifier: body.verifier },
      { store: supabaseStore(), issuer: supabaseIssuer() }
    )
    return session ? NextResponse.json(session, { headers }) : fail()
  } catch {
    return fail()
  }
}
