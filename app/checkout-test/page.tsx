// TEMPORARY, unlinked: verifies the deployed Stripe key is a test key.
// Delete this page and components/CheckoutModeCheck.tsx once verified.

import type { Metadata } from 'next'
import { CheckoutModeCheck } from '@/components/CheckoutModeCheck'
import { requireUser } from '@/lib/auth'
import { PAID_TIERS } from '@/lib/plans'

export const metadata: Metadata = { title: 'Stripe mode check', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function CheckoutTestPage() {
  await requireUser('/checkout-test')
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="mb-3 text-xl font-medium text-ink">Stripe mode check</h1>
      <p className="mb-6 text-[13px] text-muted">
        Temporary page. Creates a checkout session and reports whether it is test or live. Nothing is charged.
      </p>
      <CheckoutModeCheck tier={PAID_TIERS[0].key} />
    </div>
  )
}
