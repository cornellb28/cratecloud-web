// ── POST /api/checkout ────────────────────────────────────────────────────
// Creates a Stripe Checkout Session in subscription mode and returns its URL.
//
// The client sends a TIER KEY, never a price id. If it could send a price id
// it could send a cheaper one, and Stripe would charge it.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, isStripeConfigured, priceIdForTier } from '@/lib/stripe'
import { linkCustomer, readEntitlement } from '@/lib/entitlements'
import { isEntitled } from '@/lib/plans'
import { parseInterval } from '@/lib/price-map'
import { siteUrl } from '@/lib/site'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Checkout is not configured yet.' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  }

  let tier: unknown
  let rawInterval: unknown
  try {
    const body = await request.json()
    tier = body?.tier
    rawInterval = body?.interval
  } catch {
    return NextResponse.json({ error: 'Bad request body.' }, { status: 400 })
  }

  // The interval is validated here, server-side. Missing means monthly; the
  // price id is then chosen from env by (tier, interval) — never by the client.
  const interval = parseInterval(rawInterval)
  if (!interval) {
    return NextResponse.json({ error: 'Unknown billing interval.' }, { status: 400 })
  }

  const priceId = typeof tier === 'string' ? priceIdForTier(tier, interval) : null
  if (!priceId) {
    return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 })
  }

  const stripe = getStripe()
  const admin = createAdminClient()
  const entitlement = await readEntitlement(admin, user.id)

  // Already subscribed. A second Checkout Session would create a SECOND
  // subscription and bill them twice — plan changes belong in the Portal,
  // which handles the proration Stripe would otherwise skip.
  if (
    entitlement?.stripe_subscription_id &&
    entitlement.stripe_customer_id &&
    isEntitled(entitlement)
  ) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: entitlement.stripe_customer_id,
      return_url: `${siteUrl()}/dashboard`
    })
    return NextResponse.json({ url: portal.url, reason: 'already_subscribed' })
  }

  // Reuse the customer if there is one, so a DJ who cancelled and came back
  // keeps one invoice history instead of two.
  let customerId = entitlement?.stripe_customer_id ?? null

  if (customerId) {
    // A stored id can be stale — most often after switching between test and
    // live keys against the same database. Better to notice here than to
    // have Stripe reject the session with a message nobody will read.
    try {
      const existing = await stripe.customers.retrieve(customerId)
      if (existing.deleted) customerId = null
    } catch {
      customerId = null
    }
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id }
    })
    customerId = customer.id
    // Best-effort: the webhook writes this again from the subscription, so a
    // failure here costs nothing but a duplicate customer on a retry.
    await linkCustomer(admin, user.id, customerId)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],

    // How checkout.session.completed finds the user.
    client_reference_id: user.id,
    metadata: { supabase_user_id: user.id },

    // And the backstop: putting it on the SUBSCRIPTION means every later
    // subscription event carries the user id too, so a lost customer-id
    // write can never orphan the subscription.
    subscription_data: { metadata: { supabase_user_id: user.id } },

    success_url: `${siteUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/checkout/cancelled`,
    allow_promotion_codes: true
  })

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe returned no checkout URL.' }, { status: 502 })
  }

  return NextResponse.json({ url: session.url })
}
