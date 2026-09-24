// ── Supabase: browser client ──────────────────────────────────────────────
// Anon key only. Publishable by design, and every table is behind RLS —
// entitlements exposes exactly one policy, own-row SELECT.
//
// Never import lib/supabase/admin.ts from anything that reaches a client
// component; that module carries `server-only` so the build fails if you do.

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
