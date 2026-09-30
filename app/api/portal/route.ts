// ── POST /api/portal ──────────────────────────────────────────────────────
// Hands the DJ to Stripe's Customer Portal: plan changes, cancellation,
// payment method, invoices. Every change there comes back as a
// customer.subscription.* webhook, which is why this site needs no custom
// cancel or upgrade UI at all.
//
// The portal's allowed products are configured in the Stripe dashboard
// (Settings > Billing > Customer portal). Without that, upgrades are not
// offered and the page looks broken for reasons no code change will fix.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { readEntitlement } from '@/lib/entitlements'
import { siteUrl } from '@/lib/site'

export const runtime = 'nodejs'

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured yet.' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const admin = createAdminClient()
  const entitlement = await readEntitlement(admin, user.id)

  if (!entitlement?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account yet.' }, { status: 400 })
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: entitlement.stripe_customer_id,
    return_url: `${siteUrl()}/dashboard`
  })

  return NextResponse.json({ url: session.url })
}
