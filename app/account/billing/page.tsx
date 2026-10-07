import type { Metadata } from 'next'
import Link from 'next/link'
import { ManageBillingButton } from '@/components/ManageBillingButton'
import { SettingsPage, SettingsRow, SettingsSection } from '@/components/settings'
import { requireUser } from '@/lib/auth'
import { readEntitlement } from '@/lib/entitlements'
import { formatDate, planLabel, statusNote } from '@/lib/plans'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Billing' }

// Billing state must never be served from a cache.
export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const user = await requireUser('/account/billing')

  // The user's own client: RLS scopes this to their row. Only the webhook
  // uses the admin client.
  const e = await readEntitlement(await createClient(), user.id)
  const label = planLabel(e)
  const subscribed = label !== 'Free'
  const note = e ? statusNote(e) : null
  const ends = e?.cancel_at_period_end || e?.status === 'canceled'
  const date = formatDate(e?.current_period_end ?? null)

  return (
    <SettingsPage title="Billing" description="Your plan and subscription.">
      <SettingsSection>
        <SettingsRow label="Current plan">{label}</SettingsRow>
        <SettingsRow label="Status">
          {subscribed ? (e?.status ?? 'none').replace(/_/g, ' ') : 'No subscription'}
        </SettingsRow>
        {subscribed && date && <SettingsRow label={ends ? 'Access ends' : 'Renews'}>{date}</SettingsRow>}
        {subscribed && note && <SettingsRow label="Note">{note}</SettingsRow>}
        <SettingsRow
          label="Manage billing"
          description={
            e?.stripe_customer_id
              ? 'Change plan, update your card, view invoices or cancel in Stripe’s portal.'
              : 'Available once you have a subscription.'
          }
        >
          {e?.stripe_customer_id ? (
            <div className="sm:flex sm:justify-end">
              <ManageBillingButton />
            </div>
          ) : (
            <span className="text-muted">
              Nothing to manage yet. See <Link href="/cloud-mobile" className="underline underline-offset-2 hover:text-ink">Cloud &amp; Mobile</Link>.
            </span>
          )}
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  )
}
