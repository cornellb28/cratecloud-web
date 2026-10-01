'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui'

export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await createClient().auth.signOut()
        router.push('/')
        router.refresh()
      }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}
