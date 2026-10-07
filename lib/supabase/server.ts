// ── Supabase: server client (RSC, route handlers, server actions) ─────────
// Anon key plus the caller's session cookie, so RLS scopes every read to the
// signed-in user. THIS is what /account/billing and the account chip read the entitlement
// with — deliberately not the service role. Using the admin client for a
// user-facing read would turn a missing WHERE clause into a data leak.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component, which cannot set cookies. Safe
            // to swallow: proxy.ts refreshes the session on every request, so
            // the cookie is already current by the time this runs.
          }
        }
      }
    }
  )
}
