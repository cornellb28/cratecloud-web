import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, Label } from '@/components/ui'
import { SignOutButton } from '@/components/SignOutButton'
import { requireUser } from '@/lib/auth'
import { formatDate } from '@/lib/plans'

export const metadata: Metadata = { title: 'Account' }
export const dynamic = 'force-dynamic'

function providerLabel(provider: string | undefined): string {
  if (provider === 'google') return 'Signed in with Google'
  if (provider === 'email') return 'Signed in with email and password'
  return 'Signed in'
}

export default async function AccountPage() {
  const user = await requireUser('/account')

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-medium text-ink">Account</h1>
        <Link href="/dashboard" className="text-[12px] text-muted transition-colors hover:text-ink">
          Billing
        </Link>
      </header>

      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-lg text-accent"
            aria-hidden
          >
            {user.email?.trim()[0]?.toUpperCase() ?? '♪'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] text-ink">{user.email ?? 'Signed in'}</p>
            <p className="mt-1 text-[11px] text-faint">
              {providerLabel(user.app_metadata?.provider)}
              {user.created_at ? ` · Member since ${formatDate(user.created_at)}` : ''}
            </p>
          </div>
          <SignOutButton />
        </div>
      </Card>

      <Card>
        <Label>Desktop app</Label>
        <p className="text-[12px] leading-relaxed text-muted">
          This is the same account the CrateCloud desktop app signs into. Anything you buy here
          appears there the next time it reads your plan — no separate licence key, no activation
          code.
        </p>
      </Card>
    </div>
  )
}
