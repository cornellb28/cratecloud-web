// ── Supabase: service-role client ─────────────────────────────────────────
// Bypasses RLS entirely. Two callers only:
//   - app/api/stripe/webhook/route.ts — the sole writer of entitlements
//   - app/api/checkout/route.ts       — reads stripe_customer_id so a repeat
//                                       buyer does not get a second customer
//
// `server-only` makes an accidental import from a client component a BUILD
// failure rather than a shipped key. Keep it as the first line.
//
// This key must never reach the desktop app. cratecloud-v3/.env.example says
// so explicitly, and it holds only MAIN_VITE_SUPABASE_URL + the anon key.

import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase admin client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  // No session handling at all: this client acts as the service role, not as
  // a user, and persisting or refreshing anything here would be meaningless.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}
