'use client'

// Stored in auth user_metadata.display_name (no DB change). Not full_name:
// Google rewrites that on every sign-in and would undo the edit.

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

export function DisplayNameForm({ initial }: { initial: string }) {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const dirty = value.trim() !== initial && value.trim().length > 0

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await createClient().auth.updateUser({ data: { display_name: value.trim() } })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message })
    setMsg({ ok: true, text: 'Saved.' })
    router.refresh()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 sm:items-end">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="display-name">
          Display name
        </label>
        <input
          id="display-name"
          value={value}
          maxLength={60}
          onChange={(e) => setValue(e.target.value)}
          className="w-52 rounded-lg border border-line bg-page px-3 py-2 text-[14px] text-ink"
        />
        <Button type="submit" variant="outline" disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {msg && (
        <p role="status" className={`text-[12px] ${msg.ok ? 'text-ok' : 'text-warn'}`}>
          {msg.text}
        </p>
      )}
    </form>
  )
}
