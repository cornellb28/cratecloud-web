'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

export function SignOutEverywhereButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    const { error } = await createClient().auth.signOut({ scope: 'global' })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <Button variant="outline" onClick={go} disabled={busy}>
        {busy ? 'Signing out…' : 'Sign out everywhere'}
      </Button>
      {error && <p className="text-[12px] text-warn">{error}</p>}
    </div>
  )
}
