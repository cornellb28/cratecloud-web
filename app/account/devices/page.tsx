import type { Metadata } from 'next'
import { SettingsPage, SettingsRow, SettingsSection } from '@/components/settings'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Devices' }

export default async function DevicesPage() {
  await requireUser('/account/devices')

  // TODO(devices): there is no device data model yet. Do not create one here
  // without a decision on what a "device" is (desktop install, mobile, both).
  return (
    <SettingsPage title="Devices" description="The machines connected to your account.">
      <SettingsSection>
        <SettingsRow
          label="Connected devices"
          description="Coming with Cloud & Mobile. Nothing is stored about your devices today."
        />
      </SettingsSection>
    </SettingsPage>
  )
}
