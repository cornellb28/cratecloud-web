// ── POST /api/stripe/webhook ──────────────────────────────────────────────
// The ONLY writer of public.entitlements. Runs as the service role, which is
// why it can exist only here and never in the desktop app.
//
// Four events, and no more — configure the Stripe endpoint to send exactly
// these so you are not returning 200 to noise:
//
//   checkout.session.completed      links user <-> customer <-> subscription
//   customer.subscription.updated   the workhorse; SOLE writer of `status`
//   customer.subscription.deleted   back to free
//   invoice.payment_failed          notification only; writes NOTHING
//
// customer.subscription.created is deliberately NOT handled: it would race
// checkout.session.completed for the same row and win or lose at random.
//
// ── Response codes are not cosmetic ──────────────────────────────────────
// Stripe retries any non-2xx for up to three days.
//   400  bad signature            — never retry, the payload is not ours
//   500  transient (DB) failure   — DO retry, we want the redelivery
//   200  handled, ignored, OR unresolvable — retrying cannot fix any of them

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyFree, applySubscription, resolveUserId } from '@/lib/entitlements'
import { READ_ONLY_DAYS } from '@/lib/storage/config'
import { startReadOnlyWindow } from '@/lib/storage/service'

// Node, not Edge: the raw-body read and Stripe's crypto both want it, and
// this route is nowhere near hot enough to care.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

class TransientError extends Error {}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'No signature.' }, { status: 400 })

  // The RAW body. Do not parse it first — the signature is computed over
  // these exact bytes, and anything that re-serialises them breaks it.
  const raw = await request.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret)
  } catch (err) {
    // Anyone on the internet can POST here. The signature is the only thing
    // that makes the payload worth reading, so nothing below runs without it.
    console.error('[stripe] signature verification failed:', (err as Error).message)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    await handle(event)
  } catch (err) {
    if (err instanceof TransientError) {
      // 500 on purpose: we WANT Stripe to redeliver this one.
      console.error(`[stripe] ${event.type} (${event.id}) failed, asking for a retry:`, err.message)
      return NextResponse.json({ error: 'Temporary failure.' }, { status: 500 })
    }
    console.error(`[stripe] ${event.type} (${event.id}) threw:`, err)
    return NextResponse.json({ error: 'Temporary failure.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handle(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      return onCheckoutCompleted(event.data.object)
    case 'customer.subscription.updated':
      return onSubscriptionUpdated(event.data.object)
    case 'customer.subscription.deleted':
      return onSubscriptionDeleted(event.data.object)
    case 'invoice.payment_failed':
      return onPaymentFailed(event.data.object)
    default:
      // Configured-out, but a stray event must not be a failure — a 500 here
      // would put Stripe into a three-day retry loop over something we have
      // decided not to care about.
      console.log(`[stripe] ignoring ${event.type}`)
  }
}

// ─── 1. checkout.session.completed ────────────────────────────────────────
// The linking event: the only one that carries our user id directly.
// Writes: stripe_customer_id, stripe_subscription_id, stripe_price_id, plan,
//         status, current_period_end, cancel_at_period_end.
async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== 'subscription') {
    console.log(`[stripe] checkout ${session.id} was mode=${session.mode}, not ours`)
    return
  }

  // 'no_payment_required' is a real success — it is what a 100%-off coupon
  // or a trial without a card produces.
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    console.log(`[stripe] checkout ${session.id} payment_status=${session.payment_status}, skipping`)
    return
  }

  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

  if (!subscriptionId) {
    console.error(`[stripe] checkout ${session.id} completed with no subscription`)
    return
  }

  const admin = createAdminClient()
  const userId = await resolveUserId(admin, {
    subscriptionId,
    customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    metadataUserId: session.client_reference_id ?? session.metadata?.supabase_user_id ?? null
  })

  if (!userId) return orphan('checkout.session.completed', session.id)

  // Retrieved fresh rather than trusting the session payload, which is
  // already a moment stale by the time this runs — and the session does not
  // carry the period end at all.
  const sub = await getStripe().subscriptions.retrieve(subscriptionId)

  const result = await applySubscription(admin, userId, sub)
  if (!result.ok) throw new TransientError(result.error ?? 'write failed')

  console.log(`[stripe] activated ${userId} on ${sub.id} (${sub.status})`)
}

// ─── 2. customer.subscription.updated ─────────────────────────────────────
// Renewals, upgrades and downgrades from the Portal, cards failing into
// past_due, recoveries back to active, pauses, and cancel-at-period-end.
// THE SOLE WRITER OF `status`.
// Writes: status, plan, stripe_price_id, current_period_end,
//         cancel_at_period_end, and stripe_subscription_id if it was null.
async function onSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const admin = createAdminClient()
  const userId = await resolveUserId(admin, {
    subscriptionId: sub.id,
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    metadataUserId: sub.metadata?.supabase_user_id ?? null
  })

  if (!userId) return orphan('customer.subscription.updated', sub.id)

  const result = await applySubscription(admin, userId, sub)
  if (!result.ok) throw new TransientError(result.error ?? 'write failed')

  console.log(`[stripe] updated ${userId}: ${sub.status}, cancel_at_period_end=${sub.cancel_at_period_end}`)
}

// ─── 3. customer.subscription.deleted ─────────────────────────────────────
// The subscription is over NOW — Stripe fires this at period end for a
// scheduled cancel and immediately for a cancel-now.
// Writes: plan='free', status='canceled', cancel_at_period_end=false,
//         current_period_end=null, stripe_subscription_id=null,
//         stripe_price_id=null. KEEPS stripe_customer_id.
async function onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const admin = createAdminClient()
  const userId = await resolveUserId(admin, {
    subscriptionId: sub.id,
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    metadataUserId: sub.metadata?.supabase_user_id ?? null
  })

  if (!userId) return orphan('customer.subscription.deleted', sub.id)

  const result = await applyFree(admin, userId)
  if (!result.ok) throw new TransientError(result.error ?? 'write failed')

  // Cloud audio stays downloadable (read-only) for 60 days after the paid period
  // ends. Uploads stay blocked. Failing here asks Stripe to redeliver; the
  // entitlement write above is idempotent.
  try {
    await startReadOnlyWindow(admin, userId, new Date(Date.now() + READ_ONLY_DAYS * 86_400_000))
  } catch (err) {
    throw new TransientError((err as Error).message)
  }

  console.log(`[stripe] ${userId} back to free (subscription ${sub.id} ended)`)
}

// ─── 4. invoice.payment_failed ────────────────────────────────────────────
// WRITES NOTHING. customer.subscription.updated carries the authoritative
// past_due transition; making this a second status writer buys a race where
// a delayed payment_failed lands after a successful retry's `updated` and
// downgrades someone who has already paid.
//
// This exists so you have somewhere to hang the dunning email.
async function onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // Stripe removed `subscription` from Invoice — it now lives under
  // parent.subscription_details (verified against stripe@22.6.2). Reading the
  // old field would silently give undefined on every single invoice.
  const details = invoice.parent?.subscription_details
  const subscriptionId =
    typeof details?.subscription === 'string' ? details.subscription : details?.subscription?.id

  const admin = createAdminClient()
  const userId = await resolveUserId(admin, {
    subscriptionId,
    customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
    metadataUserId: details?.metadata?.supabase_user_id ?? null
  })

  if (!userId) return orphan('invoice.payment_failed', invoice.id ?? '(no id)')

  // TODO(dunning): email the DJ here. Their access continues to
  // current_period_end — see isEntitled() in lib/plans.ts — so this is a
  // "your card failed, here is the portal link", not a lockout notice.
  console.warn(`[stripe] payment failed for ${userId} (invoice ${invoice.id}) — no entitlement write`)
}

// An event we cannot attach to a user. Retrying will never fix it, so a 500
// would just buy three days of noise. 200 and make it loud instead: in
// practice this means someone paid under an account we do not know about.
function orphan(eventType: string, objectId: string): void {
  console.error(
    `[stripe] ORPHANED ${eventType} for ${objectId} — no entitlements row resolved. ` +
      'Someone may have paid under a different account than they signed into.'
  )
}
