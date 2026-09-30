'use client'

// The buy button. POSTs a TIER KEY to /api/checkout and follows the URL it
// returns — the price id never touches the browser.
//
// Signed-out visitors are sent to /login with the tier remembered, so they
// land back here and finish rather than having to find the page again.

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'

export function CheckoutButton({
  tier,
  label,
  signedIn,
  variant = 'primary'
}: {
  tier: string
  label: string
  signedIn: boolean
  variant?: 'primary' | 'outline'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/pricing?tier=${tier}`)}`)
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
      })
      const body = await res.json()

      if (!res.ok || !body.url) {
        setError(body.error ?? 'Could not start checkout.')
        setBusy(false)
        return
      }

      // Stripe's hosted page, or the Portal if they are already subscribed
      // (see the already_subscribed branch in /api/checkout).
      window.location.href = body.url
    } catch {
      setError('Could not reach the server. Check your connection.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant={variant} onClick={start} disabled={busy} className="w-full">
        {busy ? 'Opening checkout…' : label}
      </Button>
      {error && <p className="text-[11px] text-warn">{error}</p>}
    </div>
  )
}
