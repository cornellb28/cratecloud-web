// ── Supabase: non-persisting anon client ──────────────────────────────────
// Used only to turn a magiclink hashed_token into a session (verifyOtp) for
// the desktop handoff. Nothing is stored or refreshed server-side: the
// session is handed to the desktop app and this client is discarded.

import { createClient } from '@supabase/supabase-js'

export function createEphemeralClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
}
