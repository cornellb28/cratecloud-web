import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, Check } from '@/components/ui'
import { CheckoutButton } from '@/components/CheckoutButton'
import { FREE_TIER, PAID_TIERS } from '@/lib/plans'
import { getTierPricing } from '@/lib/stripe'
import { getUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Pricing' }

export default async function PricingPage() {
  // Amounts come from Stripe, never from a constant in this repo — a price
  // typed into a page is a price that will one day disagree with the one the
  // customer is charged. Empty until Stripe is configured, and the tiers'
  // fallbackPrice renders instead so this page works before that.
  const [pricing, user] = await Promise.all([getTierPricing(), getUser()])

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12 max-w-xl">
        <h1 className="text-3xl font-medium text-ink">Pricing</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          The desktop app is free and always will be. Cloud + Mobile is for carrying the same
          library between machines — and, when it lands, onto your phone.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="text-[15px] font-medium text-ink">{FREE_TIER.name}</h2>
          <p className="mt-1 text-[12px] text-muted">{FREE_TIER.tagline}</p>
          <p className="mt-5 text-2xl font-medium text-ink">{FREE_TIER.fallbackPrice}</p>
          <p className="mb-5 text-[11px] text-faint">forever</p>
          <ul className="flex flex-col gap-2">
            {FREE_TIER.features.map((f) => (
              <Check key={f}>{f}</Check>
            ))}
          </ul>
        </Card>

        {PAID_TIERS.map((tier) => (
          <Card key={tier.key} accent={tier.highlight}>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-medium text-ink">{tier.name}</h2>
              {tier.highlight && (
                <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] text-accent">
                  Most DJs
                </span>
              )}
            </div>
            <p className="mt-1 text-[12px] text-muted">{tier.tagline}</p>
            <p className="mt-5 text-2xl font-medium text-ink">
              {pricing[tier.key] ?? tier.fallbackPrice}
            </p>
            <p className="mb-5 text-[11px] text-faint">
              {pricing[tier.key] ? 'billed through Stripe' : 'pricing not final'}
            </p>
            <div className="mb-5">
              <CheckoutButton
                tier={tier.key}
                label={`Get ${tier.name}`}
                signedIn={Boolean(user)}
                variant={tier.highlight ? 'primary' : 'outline'}
              />
            </div>
            <ul className="flex flex-col gap-2">
              {tier.features.map((f) => (
                <Check key={f}>{f}</Check>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <p className="mt-10 max-w-xl text-[12px] leading-relaxed text-faint">
        Subscriptions are billed by Stripe and can be cancelled any time from your{' '}
        <Link href="/dashboard" className="text-muted underline underline-offset-2 hover:text-ink">
          dashboard
        </Link>
        . Cancelling keeps your access until the end of the period you have already paid for.
      </p>
    </div>
  )
}
