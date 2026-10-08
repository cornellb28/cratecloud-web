// ── Loops: create a contact ───────────────────────────────────────────────
// Plain fetch, no SDK. Best-effort by design: the Supabase row is the source of
// truth, so a Loops failure is logged and never fails a signup.
//
// TODO(loops): djType / djSoftware are not sent. Loops only accepts custom
// properties that already exist in the account; create them there, then add
// them to `body` below.

import 'server-only'

const ENDPOINT = 'https://app.loops.so/api/v1/contacts/create'

export async function createLoopsContact(email: string): Promise<void> {
  const key = process.env.LOOPS_API_KEY
  if (!key) {
    console.warn('Loops: LOOPS_API_KEY not set, skipping contact create.')
    return
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'waitlist', userGroup: 'waitlist' }),
      signal: AbortSignal.timeout(5000)
    })
    // 409 = contact already exists in Loops, which is fine.
    if (!res.ok && res.status !== 409) {
      console.error('Loops contact create failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('Loops contact create threw:', err)
  }
}
