import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, ButtonLink, Notice } from '@/components/ui'
import { requireUser } from '@/lib/auth'
import { getStripe, isStripeConfigured, planForPriceId } from '@/lib/stripe'
import { planName } from '@/lib/plans'
import { BRAND, DESKTOP_CHECKOUT_CALLBACK } from '@/lib/site'

export const metadata: Metadata = { title: 'Payment confirmed' }
export const dynamic = 'force-dynamic'

export default async function SuccessPage({
  searchParams
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const user = await requireUser('/account/billing')
  const { session_id: sessionId } = await searchParams

  // Confirmed by reading the Checkout Session DIRECTLY, not by waiting for
  // the entitlements row. Stripe's browser redirect and the webhook race,
  // and the redirect usually wins — a page that waited for the row would
  // show "something went wrong" to someone who just paid successfully.
  let tierLabel: string | null = null
  let confirmed = false
  let mismatch = false

  if (sessionId && isStripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId, {
        expand: ['line_items']
      })

      // A session id is just a string in a URL. Confirm it is THIS user's
      // before telling them anything about it.
      const owner = session.client_reference_id ?? session.metadata?.supabase_user_id
      if (owner && owner !== user.id) {
        mismatch = true
      } else {
        confirmed =
          session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
        const priceId = session.line_items?.data?.[0]?.price?.id ?? null
        const plan = planForPriceId(priceId)
        if (plan) tierLabel = planName(plan)
      }
    } catch {
      // A session that will not load is not worth a failed page. The DJ has
      // already paid; send them to the billing page, which reads the real row.
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <Card accent>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.8px] text-ok">
          {confirmed ? 'Payment confirmed' : 'Thanks'}
        </p>
        <h1 className="text-xl font-medium text-ink">
          {tierLabel ? `${tierLabel} is yours.` : 'You are all set.'}
        </h1>

        {mismatch ? (
          <div className="mt-4">
            <Notice>
              That checkout belongs to a different account. Check your billing page to see the plan on{' '}
              {user.email}.
            </Notice>
          </div>
        ) : (
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Activated for <span className="text-ink">{user.email}</span>. Make sure that is the
            account your {BRAND} desktop app is signed in as — a plan bought under a different
            account will not reach it.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {/* A plain anchor, not next/link: a custom scheme is not a route.
              And a button rather than an automatic redirect, because browsers
              want a user gesture for a custom scheme and someone who bought
              on a machine without the app installed would otherwise hit a
              dead end. */}
          <a href={DESKTOP_CHECKOUT_CALLBACK} className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-accent/85">
            Return to {BRAND}
          </a>
          <ButtonLink href="/account/billing" variant="ghost">
            Or view your billing
          </ButtonLink>
        </div>

        <p className="mt-5 border-t border-line-soft pt-4 text-[11px] leading-relaxed text-faint">
          Don&rsquo;t have {BRAND} on this machine? The app is free —{' '}
          <Link href="/" className="text-muted underline underline-offset-2 hover:text-ink">
            download it
          </Link>
          , sign in as {user.email}, and your plan will be there.
        </p>
      </Card>
    </div>
  )
}
