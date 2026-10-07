// The right-hand end of the global nav. Server component: the user and plan
// are read before the HTML is sent, so there is no signed-out flash. The
// plan label comes from the entitlement row (RLS-scoped, user's own client).

import Link from 'next/link'
import { AccountMenu } from '@/components/AccountMenu'
import { ButtonLink } from '@/components/ui'
import { getUser } from '@/lib/auth'
import { readEntitlement } from '@/lib/entitlements'
import { planLabel } from '@/lib/plans'
import { profileOf } from '@/lib/profile'
import { createClient } from '@/lib/supabase/server'

export async function AccountChip() {
  const user = await getUser()

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="rounded-full px-2 py-1 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
        >
          Log in
        </Link>
        <ButtonLink href="/login?mode=signup" variant="pillLight">
          Sign up
        </ButtonLink>
      </div>
    )
  }

  const entitlement = await readEntitlement(await createClient(), user.id)
  const profile = profileOf(user)

  return (
    <AccountMenu
      name={profile.name}
      email={profile.email}
      avatarUrl={profile.avatarUrl}
      initial={profile.initial}
      planLabel={planLabel(entitlement)}
    />
  )
}

// Shown while the chip streams in: same footprint, so the nav doesn't jump.
export function AccountChipSkeleton() {
  return <div aria-hidden className="h-9 w-24 animate-pulse rounded-full bg-surface" />
}
