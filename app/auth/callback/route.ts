// ── OAuth / email-link callback ───────────────────────────────────────────
// Where Supabase hands the browser back after Google consent or a magic
// link. Exchanges the PKCE code for a session and sets the cookies.
//
// This URL must be listed in Supabase > Authentication > URL Configuration >
// Redirect URLs, alongside the desktop app's deepcrated://auth-callback.
// The two are not interchangeable: Google returns to Supabase, Supabase
// returns here (web) or to the custom scheme (desktop).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error_description') ?? searchParams.get('error')

  // A denied consent screen comes back with an error and no code. Reporting
  // "no code" would bury the reason the DJ actually needs to read.
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  // Same-site relative path only (see safeNext). An open redirect on an auth
  // callback is how you hand someone's session to another origin.
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) return NextResponse.redirect(`${origin}${next}`)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    )
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('No sign-in code was returned.')}`)
}
