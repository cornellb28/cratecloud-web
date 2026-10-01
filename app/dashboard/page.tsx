import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, ButtonLink, Check, Label, Notice } from '@/components/ui'
import { ManageBillingButton } from '@/components/ManageBillingButton'
import { createClient } from '@/lib/supabase/server'
import { readEntitlement } from '@/lib/entitlements'
import { requireUser } from '@/lib/auth'
import { isEntitled, isPaid, planName, statusNote, tierByKey } from '@/lib/plans'

export const metadata: Metadata = { title: 'Dashboard' }

// Billing state must never be served from a cache.
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireUser('/dashboard')

  // Read through the USER's client, not the service role: RLS scopes this to
  // their own row, which is the guarantee doing it the other way would throw
  // away. The webhook is the only thing here that needs the admin client.
  const supabase = await createClient()
  const entitlement = await readEntitlement(supabase, user.id)

  const paid = entitlement ? isPaid(entitlement.plan) : false
  const note = entitlement ? statusNote(entitlement) : null
  const tier = entitlement ? tierByKey(entitlement.plan) : undefined
  const active = entitlement ? isEntitled(entitlement) : false

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-medium text-ink">Billing</h1>
        <Link href="/account" className="text-[12px] text-muted transition-colors hover:text-ink">
          Account settings
        </Link>
      </header>

      <Card accent={paid} className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label>Current plan</Label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium text-ink">
                {entitlement ? planName(entitlement.plan) : 'Free'}
              </span>
              {paid && (
                <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] text-accent">
                  Subscription
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              {tier?.tagline ?? 'The full desktop app, at no cost — nothing in it is locked.'}
            </p>
            {note && <p className="mt-2 text-[12px] text-warn">{note}</p>}
          </div>

          {paid && <ManageBillingButton />}
        </div>

        {tier && (
          <ul className="mt-5 flex flex-col gap-2 border-t border-line-soft pt-4">
            {tier.features.map((f) => (
              <Check key={f}>{f}</Check>
            ))}
          </ul>
        )}
      </Card>

      {/* past_due inside the paid period: still entitled, but the card needs
          attention before the period ends. Saying so here is cheaper than a
          support email later. */}
      {paid && !active && (
        <div className="mb-4">
          <Notice>
            This subscription is not currently active. Open the billing portal to update your
            payment method.
          </Notice>
        </div>
      )}

      {!paid && (
        <Card>
          <h2 className="text-[13px] font-medium text-ink">Cloud + Mobile</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Keep your tags, crates and play history in sync across every machine — and browse them
            on your phone when mobile lands. Your audio files stay where they are.
          </p>
          <div className="mt-4">
            <ButtonLink href="/pricing">See plans</ButtonLink>
          </div>
        </Card>
      )}

      <p className="mt-8 text-[11px] leading-relaxed text-faint">
        Bought a plan and the desktop app still shows Free? Open Settings &rsaquo; Account in
        CrateCloud and hit <span className="text-muted">Refresh</span>. Make sure it is signed in as{' '}
        <span className="text-muted">{user.email}</span> — the same account you used here.
      </p>
    </div>
  )
}
