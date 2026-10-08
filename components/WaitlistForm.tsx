'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import { DJ_TYPES } from '@/lib/waitlist'

type State = 'idle' | 'loading' | 'success' | 'error'

const FIELD =
  'w-full rounded-xl border border-line bg-page px-4 py-3 text-[15px] text-ink placeholder:text-faint'

export function WaitlistForm() {
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setState('loading')
    setMessage(null)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.get('email'),
          djType: data.get('djType'),
          djSoftware: data.get('djSoftware'),
          website: data.get('website')
        })
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.ok) return setState('success')
      setMessage(body.error ?? 'Something went wrong. Please try again.')
      setState('error')
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div role="status" className="rounded-2xl bg-surface-3 p-6 text-center">
        <p className="text-[18px] font-semibold text-ink">You’re on the list</p>
        <p className="mt-2 text-[14px] text-muted">
          We’ll email you when cloud sync and mobile are ready. Nothing else, and you can unsubscribe any time.
        </p>
      </div>
    )
  }

  const busy = state === 'loading'

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 text-left" noValidate={false}>
      <div>
        <label htmlFor="wl-email" className="mb-1.5 block text-[13px] font-medium text-ink-2">
          Email
        </label>
        <input
          id="wl-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          maxLength={254}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="wl-type" className="mb-1.5 block text-[13px] font-medium text-ink-2">
          What kind of DJ are you? <span className="text-faint">(optional)</span>
        </label>
        <select id="wl-type" name="djType" defaultValue="" className={FIELD}>
          <option value="">Prefer not to say</option>
          {DJ_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="wl-software" className="mb-1.5 block text-[13px] font-medium text-ink-2">
          DJ software you use <span className="text-faint">(optional)</span>
        </label>
        <input
          id="wl-software"
          name="djSoftware"
          type="text"
          maxLength={100}
          placeholder="Serato, Rekordbox, Traktor…"
          className={FIELD}
        />
      </div>

      {/* Honeypot: hidden from people and assistive tech, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="wl-website">Website</label>
        <input id="wl-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" variant="pillLg" disabled={busy} className="w-full">
        {busy ? 'Joining…' : 'Join the waitlist'}
      </Button>

      {state === 'error' && message && (
        <p role="alert" className="text-[13px] text-warn">
          {message}
        </p>
      )}
    </form>
  )
}
