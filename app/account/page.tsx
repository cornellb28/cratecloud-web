import type { Metadata } from 'next'
import { Avatar } from '@/components/Avatar'
import { DisplayNameForm } from '@/components/DisplayNameForm'
import { SettingsPage, SettingsRow, SettingsSection } from '@/components/settings'
import { requireUser } from '@/lib/auth'
import { formatDate } from '@/lib/plans'
import { profileOf } from '@/lib/profile'
import { BRAND } from '@/lib/site'

export const metadata: Metadata = { title: 'Profile' }
export const dynamic = 'force-dynamic'

const PROVIDER_LABEL: Record<string, string> = { email: 'Email and password', google: 'Google' }

export default async function AccountPage() {
  const user = await requireUser('/account')
  const p = profileOf(user)
  const since = formatDate(user.created_at ?? null)

  return (
    <SettingsPage
      title="Profile"
      description={`This is the same account the ${BRAND} desktop app signs into.`}
    >
      <SettingsSection>
        <SettingsRow label="Avatar" description="Taken from your Google account when you sign in with Google.">
          <div className="sm:flex sm:justify-end">
            <Avatar url={p.avatarUrl} initial={p.initial} size={48} />
          </div>
        </SettingsRow>
        <SettingsRow label="Display name" description="Shown in the menu and the desktop app.">
          <DisplayNameForm initial={p.name} />
        </SettingsRow>
        <SettingsRow label="Email" description="Read only.">
          <span className="break-all">{p.email}</span>
        </SettingsRow>
        <SettingsRow
          label="Sign-in method"
          description={since ? `Member since ${since}` : undefined}
        >
          {p.providers.map((x) => PROVIDER_LABEL[x] ?? x).join(', ') || 'Unknown'}
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  )
}
