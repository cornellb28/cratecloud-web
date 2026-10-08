// ── POST /api/waitlist ────────────────────────────────────────────────────
// Public signup. Inserts with the service role (the table has RLS on and no
// policies), then mirrors to Loops best-effort.
//
// Never reveals whether an email is already registered: a duplicate gets the
// same { ok: true } as a new signup. A honeypot hit also gets { ok: true } so a
// bot learns nothing.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLoopsContact } from '@/lib/loops'
import { clientIp, hit } from '@/lib/rate-limit'
import { normalizeDjType, normalizeEmail, normalizeSoftware } from '@/lib/waitlist'

export const runtime = 'nodejs'

// Per-instance only (see lib/rate-limit.ts). TODO(rate-limit): add a Vercel WAF
// rate-limit rule for /api/waitlist; code alone cannot do this reliably.
const LIMIT = 5
const WINDOW_MS = 10 * 60 * 1000

const ok = () => NextResponse.json({ ok: true })
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

export async function POST(request: Request) {
  if (!hit(`waitlist:ip:${clientIp(request)}`, LIMIT, WINDOW_MS)) {
    return bad('Too many attempts. Try again in a few minutes.', 429)
  }

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return bad('Bad request.')
    body = parsed as Record<string, unknown>
  } catch {
    return bad('Bad request.')
  }

  // Honeypot: a field real users never see or fill.
  if (typeof body.website === 'string' && body.website.trim() !== '') return ok()

  const email = normalizeEmail(body.email)
  if (!email) return bad('Enter a valid email address.')

  const admin = createAdminClient()
  const { error } = await admin.from('waitlist').insert({
    email,
    dj_type: normalizeDjType(body.djType),
    dj_software: normalizeSoftware(body.djSoftware),
    source: 'waitlist'
  })

  if (error) {
    // 23505 = unique violation: already on the list. Same response as success.
    if (error.code === '23505') return ok()
    console.error('Waitlist insert failed:', error)
    return bad('Something went wrong. Please try again.', 500)
  }

  await createLoopsContact(email)
  return ok()
}
