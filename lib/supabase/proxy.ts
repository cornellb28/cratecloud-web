// ── Supabase: session refresh at the edge of every request ────────────────
// Supabase access tokens expire hourly. Without this, a Server Component
// would read an expired token and bounce a signed-in user to /login.
// updateSession exchanges the refresh token and writes the rotated cookies
// back onto the response.
//
// Two rules this file exists to keep, both of which bite silently:
//   1. getClaims() must be called, and must be called BEFORE anything else
//      touches the response — it is what actually performs the refresh.
//   2. The returned response object must be the one that is returned, with
//      its cookies intact. Building a fresh NextResponse here drops the
//      rotated cookies and logs everyone out roughly once an hour.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        }
      }
    }
  )

  await supabase.auth.getClaims()

  return supabaseResponse
}
