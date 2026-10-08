'use client'

// TEMPORARY (remove after verifying Stripe test mode): creates a checkout
// session via /api/checkout and reports only whether it is test or live.
// It never navigates to Stripe.

import { useState } from 'react'
import { Button } from '@/components/ui'

export function CheckoutModeCheck({ tier }: { tier: string }) {
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
      })
      const body = await res.json()
      if (!res.ok || !body.url) return setResult(`Failed (${res.status}): ${body.error ?? 'no url'}`)
      const url = String(body.url)
      if (body.reason === 'already_subscribed') return setResult('Already subscribed: got a billing-portal URL, not a checkout session.')
      if (url.includes('/c/pay/cs_test_')) return setResult('TEST mode (cs_test_)')
      if (url.includes('/c/pay/cs_live_')) return setResult('LIVE mode (cs_live_) — not test!')
      setResult('Got a URL but could not tell the mode.')
    } catch {
      setResult('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={run} disabled={busy}>
        {busy ? 'Checking…' : 'Check Stripe mode'}
      </Button>
      {result && (
        <p role="status" className="text-[14px] text-ink">
          {result}
        </p>
      )}
    </div>
  )
}
