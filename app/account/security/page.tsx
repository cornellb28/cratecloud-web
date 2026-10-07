import type { Metadata } from 'next'
import { ChangePasswordForm } from '@/components/ChangePasswordForm'
import { SettingsPage, SettingsRow, SettingsSection } from '@/components/settings'
import { SignOutEverywhereButton } from '@/components/SignOutEverywhereButton'
import { requireUser } from '@/lib/auth'
import { profileOf } from '@/lib/profile'

export const metadata: Metadata = { title: 'Security' }
export const dynamic = 'force-dynamic'

export default async function SecurityPage() {
  const user = await requireUser('/account/security')
  const { providers } = profileOf(user)
  const hasPassword = providers.includes('email')
  const hasGoogle = providers.includes('google')

  return (
    <SettingsPage title="Security" description="How you sign in, and where you’re signed in.">
      <SettingsSection title="Sign-in">
        <SettingsRow
          label="Password"
          description={hasPassword ? 'Choose a new password for your email sign-in.' : undefined}
        >
          {hasPassword ? <ChangePasswordForm /> : 'You sign in with Google, so there’s no password to change.'}
        </SettingsRow>
        <SettingsRow label="Google" description="Sign in with your Google account.">
          {hasGoogle ? <span className="text-ok">Connected</span> : 'Not connected'}
          {/* TODO(security): linking/unlinking Google needs manual identity linking enabled in Supabase. */}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Sessions">
        <SettingsRow
          label="Sign out everywhere"
          description="Ends your session on every browser and device, including the desktop app."
        >
          <SignOutEverywhereButton />
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  )
}
