'use client'

// Opens Stripe's Customer Portal. Everything billing-shaped happens there —
// plan changes, cancellation, payment method, invoices — and comes back as a
// customer.subscription.* webhook. That is why this site has no cancel UI.

import { useState } from 'react'
import { Button } from '@/components/ui'

export function ManageBillingButton({ label = 'Manage billing' }: { label?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/portal', { method: 'POST' })
      const body = await res.json()
      if (!res.ok || !body.url) {
        setError(body.error ?? 'Could not open the billing portal.')
        setBusy(false)
        return
      }
      window.location.href = body.url
    } catch {
      setError('Could not reach the server.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={open} disabled={busy}>
        {busy ? 'Opening…' : label}
      </Button>
      {error && <p className="text-[11px] text-warn">{error}</p>}
    </div>
  )
}
