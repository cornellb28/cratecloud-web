// Real-Supabase checks that mocks cannot prove. Run AFTER applying the migration:
//   node --env-file=.env.local scripts/verify-handoff.mjs
// Creates a throwaway confirmed user and deletes it at the end. Prints no tokens.

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anon || !svc) throw new Error('Missing Supabase env')

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, svc, opts)
const fresh = () => createClient(url, anon, opts)

let failed = 0
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed++
}

async function session(email) {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) return null
  const { data, error: e2 } = await fresh().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
  return e2 ? null : data.session
}
const works = async (s) => !!s && !(await fresh().auth.getUser(s.access_token)).error

const email = `handoff-verify-${randomUUID()}@example.com`
const password = randomUUID()
const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
if (cErr) throw new Error('could not create test user')
const userId = created.user.id

try {
  // 1. generateLink twice in a row, sequentially
  const a = await session(email)
  const b = await session(email)
  check('sequential: both sign-ins work', (await works(a)) && (await works(b)))

  // 2. generateLink concurrently (the risky one)
  const [c, d] = await Promise.all([session(email), session(email)])
  const both = (await works(c)) && (await works(d))
  check('concurrent: both sign-ins work (if FAIL, the issuer retry is what saves it)', both)

  // 3. RLS: an ordinary authenticated client can neither read nor write the table
  const user = fresh()
  const { error: siErr } = await user.auth.signInWithPassword({ email, password })
  check('test user can sign in', !siErr)
  const T = 'desktop_auth_handoffs'
  const r = await user.from(T).select('*')
  check('authenticated SELECT denied or empty', !!r.error || (r.data ?? []).length === 0)
  const i = await user.from(T).insert({ key_hash: 'x', challenge: 'x', user_id: userId, expires_at: new Date().toISOString() })
  check('authenticated INSERT denied', !!i.error)
  const u = await user.from(T).update({ used_at: new Date().toISOString() }).eq('user_id', userId).select()
  check('authenticated UPDATE denied or affects nothing', !!u.error || (u.data ?? []).length === 0)
  const del = await user.from(T).delete().eq('user_id', userId).select()
  check('authenticated DELETE denied or affects nothing', !!del.error || (del.data ?? []).length === 0)
  const anonR = await fresh().from(T).select('*')
  check('anon SELECT denied or empty', !!anonR.error || (anonR.data ?? []).length === 0)

  // 4. real atomicity: two simultaneous consumes of one row
  const now = new Date()
  await admin.from(T).insert({ key_hash: `verify-${userId}`, challenge: 'c', user_id: userId, expires_at: new Date(now.getTime() + 60000).toISOString() })
  const consume = () =>
    admin.from(T).update({ used_at: now.toISOString() }).eq('key_hash', `verify-${userId}`).is('used_at', null).gt('expires_at', now.toISOString()).select('id')
  const [x, y] = await Promise.all([consume(), consume()])
  check('real DB: simultaneous consume yields exactly one winner', (x.data?.length ?? 0) + (y.data?.length ?? 0) === 1)
} finally {
  await admin.auth.admin.deleteUser(userId)
}
process.exit(failed ? 1 : 0)
