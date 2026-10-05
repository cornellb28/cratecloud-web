// ── /desktop/connect ──────────────────────────────────────────────────────
// The desktop app opens this in the system browser with ?challenge&state
// (&mode=signup). Signed out: through /login and back to THIS exact URL, for
// email and Google alike (the existing `next` plumbing carries it). Signed in:
// ask before handing the session to the app.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { DesktopConnect } from '@/components/DesktopConnect'
import { Card, Notice } from '@/components/ui'
import { getUser } from '@/lib/auth'
import { CHALLENGE_RE } from '@/lib/desktop-handoff'

export const metadata: Metadata = { title: 'Connect DeepCrate', robots: { index: false } }

const STATE_RE = /^[A-Za-z0-9_-]{16,128}$/

export default async function DesktopConnectPage({
  searchParams
}: {
  searchParams: Promise<{ challenge?: string; state?: string; mode?: string }>
}) {
  const { challenge, state, mode } = await searchParams

  if (!challenge || !state || !CHALLENGE_RE.test(challenge) || !STATE_RE.test(state)) {
    return (
      <div className="mx-auto max-w-sm px-6 py-20">
        <Card>
          <Notice>This sign-in link isn’t valid. Go back to the DeepCrate app and try again.</Notice>
        </Card>
      </div>
    )
  }

  const here = `/desktop/connect?challenge=${challenge}&state=${state}`
  const user = await getUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(here)}${mode === 'signup' ? '&mode=signup' : ''}`)
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-20">
      <Card>
        <DesktopConnect
          email={user.email ?? ''}
          emailConfirmed={!!user.email_confirmed_at}
          challenge={challenge}
          state={state}
          loginHref={`/login?next=${encodeURIComponent(here)}`}
        />
      </Card>
    </div>
  )
}
