// ── POST /api/desktop/handoff ─────────────────────────────────────────────
// Called by the /desktop/connect page after the user confirms. Authenticated
// by the web session cookie. Mints a single-use key (60s) bound to the desktop
// app's challenge and returns it. Body: { challenge }.
//
// Same-origin only: a cookie-authenticated POST from another site must not be
// able to mint keys on a visitor's behalf.

import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { clientIp, hit } from '@/lib/rate-limit'
import { createHandoff, HandoffError } from '@/lib/desktop-handoff'
import { supabaseStore } from '@/lib/desktop-handoff-supabase'

export const runtime = 'nodejs'

const headers = { 'Cache-Control': 'no-store' }
const fail = (status: number) => NextResponse.json({ error: 'invalid_request' }, { status, headers })

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return fail(403)

  // Backstop only; see TODO(rate-limit) in lib/rate-limit.ts.
  if (!hit(`handoff:ip:${clientIp(request)}`, 20, 60_000)) return fail(429)

  const user = await getUser()
  if (user && !hit(`handoff:user:${user.id}`, 10, 60_000)) return fail(429)

  let body: { challenge?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return fail(400)
  }

  try {
    const { key } = await createHandoff(
      { user: user ? { id: user.id, emailConfirmed: !!user.email_confirmed_at } : null, challenge: body.challenge },
      { store: supabaseStore() }
    )
    return NextResponse.json({ key }, { headers })
  } catch (e) {
    if (e instanceof HandoffError) {
      return fail(e.code === 'unauthenticated' ? 401 : e.code === 'rate_limited' ? 429 : e.code === 'bad_request' ? 400 : 403)
    }
    return fail(500)
  }
}
