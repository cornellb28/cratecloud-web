'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

const MIN = 8

export function ChangePasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (password.length < MIN) return setMsg({ ok: false, text: `Use at least ${MIN} characters.` })
    if (password !== confirm) return setMsg({ ok: false, text: 'Passwords don’t match.' })
    setBusy(true)
    const { error } = await createClient().auth.updateUser({ password })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message })
    setPassword('')
    setConfirm('')
    setMsg({ ok: true, text: 'Password updated.' })
  }

  const input = 'w-56 rounded-lg border border-line bg-page px-3 py-2 text-[14px] text-ink'
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:items-end">
      <label className="sr-only" htmlFor="new-password">
        New password
      </label>
      <input id="new-password" type="password" autoComplete="new-password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      <label className="sr-only" htmlFor="confirm-password">
        Confirm new password
      </label>
      <input id="confirm-password" type="password" autoComplete="new-password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
      <Button type="submit" variant="outline" disabled={busy || !password}>
        {busy ? 'Updating…' : 'Update password'}
      </Button>
      {msg && (
        <p role="status" className={`text-[12px] ${msg.ok ? 'text-ok' : 'text-warn'}`}>
          {msg.text}
        </p>
      )}
    </form>
  )
}
