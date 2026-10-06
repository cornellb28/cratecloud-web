// ── Desktop sign-in handoff: the logic ────────────────────────────────────
// Pure and dependency-injected so `node --test` can exercise it without Next
// or Supabase. The Supabase-backed store/issuer live in
// lib/desktop-handoff-supabase.ts. No local imports here on purpose.
//
// Flow: the signed-in browser mints a one-time key bound to the desktop app's
// challenge. The desktop app redeems it over HTTPS with the matching verifier
// and receives a fresh session. The key rides the deep link; tokens never do.
//
// Nothing here may log a key, verifier, or token.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const HANDOFF_TTL_MS = 60_000
export const MAX_RECENT_PER_USER = 5
export const RECENT_WINDOW_MS = 10 * 60_000
const CLEANUP_AFTER_MS = 60 * 60_000

export const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/ // base64url(SHA-256) = 43 chars
export const KEY_RE = /^[A-Za-z0-9_-]{43}$/ // 32 random bytes
export const VERIFIER_RE = /^[A-Za-z0-9_-]{43,128}$/

export type HandoffUser = { id: string; emailConfirmed: boolean }
export type Session = { access_token: string; refresh_token: string }

export interface HandoffStore {
  insert(row: { key_hash: string; challenge: string; user_id: string; expires_at: string }): Promise<void>
  /** MUST be one atomic statement: mark used where unused and unexpired, return the row. */
  consume(keyHash: string, nowIso: string): Promise<{ challenge: string; user_id: string } | null>
  countRecent(userId: string, sinceIso: string): Promise<number>
  deleteExpired(beforeIso: string): Promise<void>
}

export interface SessionIssuer {
  /** Fresh session for this user, or null if one cannot be issued. */
  issue(userId: string): Promise<Session | null>
}

export type HandoffErrorCode = 'unauthenticated' | 'unconfirmed' | 'bad_request' | 'rate_limited'

export class HandoffError extends Error {
  code: HandoffErrorCode
  constructor(code: HandoffErrorCode) {
    super(code)
    this.code = code
  }
}

export const sha256b64url = (s: string) => createHash('sha256').update(s).digest('base64url')
// key_hash is stored as hex; the challenge is base64url (it is the desktop app's format).
export const sha256hex = (s: string) => createHash('sha256').update(s).digest('hex')

// ── Rate limits: PROVISIONAL, awaiting owner approval ─────────────────────
// TODO(rate-limit): confirm or change these numbers, then delete this note.
export const RATE_LIMITS = {
  handoffPerIp: { limit: 20, windowMs: 60_000 },
  handoffPerUser: { limit: 10, windowMs: 60_000 },
  handoffActivePerUser: { limit: MAX_RECENT_PER_USER, windowMs: RECENT_WINDOW_MS }, // table-backed
  redeemPerIp: { limit: 20, windowMs: 60_000 }
} as const

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export async function createHandoff(
  input: { user: HandoffUser | null; challenge: unknown },
  deps: { store: HandoffStore; now?: () => number }
): Promise<{ key: string }> {
  const now = deps.now?.() ?? Date.now()
  const { user, challenge } = input

  if (!user) throw new HandoffError('unauthenticated')
  // Never issue a handoff for an unconfirmed email.
  if (!user.emailConfirmed) throw new HandoffError('unconfirmed')
  if (typeof challenge !== 'string' || !CHALLENGE_RE.test(challenge)) throw new HandoffError('bad_request')

  const recent = await deps.store.countRecent(user.id, new Date(now - RECENT_WINDOW_MS).toISOString())
  if (recent >= MAX_RECENT_PER_USER) throw new HandoffError('rate_limited')

  // Opportunistic cleanup; failure must not block sign-in.
  // TODO(cleanup): move to a scheduled job if this table ever gets busy.
  await deps.store.deleteExpired(new Date(now - CLEANUP_AFTER_MS).toISOString()).catch(() => {})

  const key = randomBytes(32).toString('base64url')
  await deps.store.insert({
    key_hash: sha256hex(key),
    challenge,
    user_id: user.id,
    expires_at: new Date(now + HANDOFF_TTL_MS).toISOString()
  })
  return { key }
}

/** Returns a session, or null for EVERY failure. Callers must not distinguish why. */
export async function redeemHandoff(
  input: { key: unknown; verifier: unknown },
  deps: { store: HandoffStore; issuer: SessionIssuer; now?: () => number }
): Promise<Session | null> {
  const { key, verifier } = input
  if (typeof key !== 'string' || !KEY_RE.test(key)) return null
  if (typeof verifier !== 'string' || !VERIFIER_RE.test(verifier)) return null

  const now = deps.now?.() ?? Date.now()

  // Single-use is enforced here, atomically. The key is spent BEFORE the
  // verifier is checked, so a stolen key gets exactly one guess.
  const row = await deps.store.consume(sha256hex(key), new Date(now).toISOString())
  if (!row) return null

  if (!safeEqual(sha256b64url(verifier), row.challenge)) return null

  return deps.issuer.issue(row.user_id)
}

// ── Redeem as an HTTP handler ─────────────────────────────────────────────
// Lives here (not only in the route file) so a test can prove every failure
// is byte-identical. The status, headers and body are one constant: bad JSON,
// unknown key, used, expired, wrong verifier, rate-limited and a thrown error
// all return exactly this.
export const REDEEM_FAILURE_BODY = '{"error":"invalid_request"}'
const NO_STORE = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
const redeemFailure = () => new Response(REDEEM_FAILURE_BODY, { status: 400, headers: NO_STORE })

export async function handleRedeem(
  request: Request,
  deps: { store: HandoffStore; issuer: SessionIssuer; allow: (request: Request) => boolean; now?: () => number }
): Promise<Response> {
  try {
    if (!deps.allow(request)) return redeemFailure()
    const body = (await request.json()) as { key?: unknown; verifier?: unknown }
    const session = await redeemHandoff({ key: body?.key, verifier: body?.verifier }, deps)
    if (!session?.access_token || !session.refresh_token) return redeemFailure()
    return new Response(JSON.stringify(session), { status: 200, headers: NO_STORE })
  } catch {
    return redeemFailure()
  }
}
