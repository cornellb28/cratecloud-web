// Run: node --test tests/*.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import {
  createHandoff,
  redeemHandoff,
  sha256b64url,
  HandoffError,
  HANDOFF_TTL_MS,
  type HandoffStore,
  type SessionIssuer
} from '../lib/desktop-handoff.ts'

const USER = { id: 'user-1', emailConfirmed: true }
const verifier = () => randomBytes(32).toString('base64url')

// In-memory store. consume() has no await between check and write, which is
// the atomicity the real UPDATE ... RETURNING gives us; the real database is
// covered by scripts/verify-handoff.mjs.
function fakeStore() {
  const rows = new Map<string, { challenge: string; user_id: string; expires_at: number; used: boolean; created: number }>()
  const store: HandoffStore = {
    async insert(r) {
      rows.set(r.key_hash, { challenge: r.challenge, user_id: r.user_id, expires_at: Date.parse(r.expires_at), used: false, created: Date.now() })
    },
    async consume(h, nowIso) {
      const r = rows.get(h)
      if (!r || r.used || r.expires_at <= Date.parse(nowIso)) return null
      r.used = true
      return { challenge: r.challenge, user_id: r.user_id }
    },
    async countRecent(userId) {
      return [...rows.values()].filter((r) => r.user_id === userId).length
    },
    async deleteExpired() {}
  }
  return { store, rows }
}

const issuer: SessionIssuer = {
  async issue(userId) {
    return { access_token: `a-${userId}-${randomBytes(4).toString('hex')}`, refresh_token: 'r' }
  }
}

async function mint(store: HandoffStore, v = verifier(), now?: () => number) {
  const { key } = await createHandoff({ user: USER, challenge: sha256b64url(v) }, { store, now })
  return { key, v }
}

test('valid redeem succeeds once', async () => {
  const { store } = fakeStore()
  const { key, v } = await mint(store)
  const s = await redeemHandoff({ key, verifier: v }, { store, issuer })
  assert.ok(s?.access_token)
})

test('second redeem fails', async () => {
  const { store } = fakeStore()
  const { key, v } = await mint(store)
  assert.ok(await redeemHandoff({ key, verifier: v }, { store, issuer }))
  assert.equal(await redeemHandoff({ key, verifier: v }, { store, issuer }), null)
})

test('expired key fails', async () => {
  const { store } = fakeStore()
  const t0 = Date.now()
  const { key, v } = await mint(store, verifier(), () => t0)
  const late = () => t0 + HANDOFF_TTL_MS + 1
  assert.equal(await redeemHandoff({ key, verifier: v }, { store, issuer, now: late }), null)
})

test('wrong verifier fails and burns the key', async () => {
  const { store } = fakeStore()
  const { key, v } = await mint(store)
  assert.equal(await redeemHandoff({ key, verifier: verifier() }, { store, issuer }), null)
  assert.equal(await redeemHandoff({ key, verifier: v }, { store, issuer }), null)
})

test('unknown / malformed key fails', async () => {
  const { store } = fakeStore()
  assert.equal(await redeemHandoff({ key: randomBytes(32).toString('base64url'), verifier: verifier() }, { store, issuer }), null)
  assert.equal(await redeemHandoff({ key: 'x', verifier: verifier() }, { store, issuer }), null)
  assert.equal(await redeemHandoff({ key: 1, verifier: null }, { store, issuer }), null)
})

test('unconfirmed email is refused', async () => {
  const { store, rows } = fakeStore()
  await assert.rejects(
    createHandoff({ user: { id: 'u', emailConfirmed: false }, challenge: sha256b64url(verifier()) }, { store }),
    (e: unknown) => e instanceof HandoffError && e.code === 'unconfirmed'
  )
  assert.equal(rows.size, 0)
})

test('unauthenticated create is refused', async () => {
  const { store, rows } = fakeStore()
  await assert.rejects(
    createHandoff({ user: null, challenge: sha256b64url(verifier()) }, { store }),
    (e: unknown) => e instanceof HandoffError && e.code === 'unauthenticated'
  )
  assert.equal(rows.size, 0)
})

test('malformed challenge is refused', async () => {
  const { store } = fakeStore()
  await assert.rejects(createHandoff({ user: USER, challenge: 'short' }, { store }), (e: unknown) => e instanceof HandoffError && e.code === 'bad_request')
})

test('per-user create limit', async () => {
  const { store } = fakeStore()
  for (let i = 0; i < 5; i++) await mint(store)
  await assert.rejects(mint(store), (e: unknown) => e instanceof HandoffError && e.code === 'rate_limited')
})

test('two simultaneous redeems give exactly one success', async () => {
  const { store } = fakeStore()
  const { key, v } = await mint(store)
  const results = await Promise.all([
    redeemHandoff({ key, verifier: v }, { store, issuer }),
    redeemHandoff({ key, verifier: v }, { store, issuer })
  ])
  assert.equal(results.filter(Boolean).length, 1)
})

// "generateLink twice in a row for the same user still lets both sign-ins
// work" cannot be proven with a fake: it is Supabase's behaviour. It lives in
// scripts/verify-handoff.mjs and must be run against the real project.
