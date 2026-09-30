// ── Request proxy (Next 16's renamed middleware) ──────────────────────────
// One job: refresh the Supabase session cookie on every request so a Server
// Component never reads an expired access token. Route protection is NOT
// done here — each protected page calls requireUser() itself, because a
// redirect decided in a page can carry a `next` param and this cannot.

import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, images and the Stripe webhook.
     *
     * The webhook exclusion matters: it arrives with no cookies and must not
     * be delayed by a token refresh that can only fail. Stripe retries on a
     * timeout, and a retried billing event is the last thing you want.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'
  ]
}
