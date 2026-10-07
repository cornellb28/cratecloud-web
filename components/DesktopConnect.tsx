'use client'

// Confirm step of the desktop handoff. The confirm click matters: without it,
// anyone who can get you to open a link carrying THEIR challenge would sign
// THEIR app into YOUR account.
//
// `state` never goes to the server; it is only echoed into the deep link so
// the app can match the callback to the sign-in it started.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Notice } from '@/components/ui'
import { BRAND, DESKTOP_AUTH_CALLBACK } from '@/lib/site'

export function DesktopConnect({
  email,
  emailConfirmed,
  challenge,
  state,
  loginHref
}: {
  email: string
  emailConfirmed: boolean
  challenge: string
  state: string
  loginHref: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)

  async function open() {
    setBusy(true)
    setError(false)
    try {
      // Every click, including "Didn't open? Try again", mints a fresh key.
      const res = await fetch('/api/desktop/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge })
      })
      if (!res.ok) throw new Error('handoff')
      const { key } = (await res.json()) as { key: string }
      setSent(true)
      // Custom-scheme hand-off to the desktop app, not an internal route.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `${DESKTOP_AUTH_CALLBACK}?key=${encodeURIComponent(key)}&state=${encodeURIComponent(state)}`
    } catch {
      setError(true)
    }
    setBusy(false)
  }

  async function switchAccount() {
    setBusy(true)
    await createClient().auth.signOut()
    router.push(loginHref)
    router.refresh()
  }

  if (!emailConfirmed) {
    return (
      <div className="flex flex-col gap-4">
        <Notice kind="info">
          Confirm <span className="text-ink">{email}</span> from the email we sent, then reopen
          sign-in from the {BRAND} app.
        </Notice>
        <Button variant="ghost" onClick={switchAccount} disabled={busy}>
          Use a different account
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-medium text-ink">
        Open {BRAND} as <span className="break-all">{email}</span>?
      </h1>
      {error && <Notice>Something went wrong. Try again.</Notice>}
      {sent && <Notice kind="info">Opening {BRAND}… you can close this tab once the app signs in.</Notice>}
      {sent ? (
        <Button variant="outline" onClick={open} disabled={busy}>
          Didn’t open? Try again
        </Button>
      ) : (
        <Button onClick={open} disabled={busy}>
          {busy ? 'Working…' : `Open ${BRAND}`}
        </Button>
      )}
      <Button variant="ghost" onClick={switchAccount} disabled={busy}>
        Use a different account
      </Button>
    </div>
  )
}
