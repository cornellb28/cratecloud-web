'use client'

// Email/password + Google, against the SAME Supabase project the desktop app
// uses. Same auth.users row, same entitlements row — which is the whole point
// of this site existing.
//
// Signup has a third outcome that is neither success nor failure: if the
// project has email confirmation on, the account exists but cannot be used
// until the link is clicked. Modelling that as an error leaves the UI with
// nowhere to put a "resend" — the desktop app learned the same lesson, see
// SignUpResult in src/main/auth.ts.

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button, Notice } from '@/components/ui'

type Mode = 'sign-in' | 'sign-up'

export function LoginForm({
  next,
  initialError,
  initialMode = 'sign-in'
}: {
  next: string
  initialError?: string
  initialMode?: Mode
}) {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [confirmSent, setConfirmSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    if (mode === 'sign-up') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` }
      })
      if (error) {
        setError(error.message)
        setBusy(false)
        return
      }
      // No session means confirmation is on. A real outcome, not an error.
      if (!data.session) {
        setConfirmSent(true)
        setBusy(false)
        return
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setBusy(false)
        return
      }
    }

    // refresh() so the Server Components re-run with the new cookie before
    // the navigation lands, otherwise the next page renders as signed-out once.
    router.push(next)
    router.refresh()
  }

  async function google() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      }
    })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  async function resend() {
    setBusy(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    // Supabase rate-limits this server-side and says so plainly, so the
    // message is passed straight through rather than second-guessed with a
    // client-side cooldown that could disagree with it.
    setError(error ? error.message : null)
    setBusy(false)
  }

  if (confirmSent) {
    return (
      <div className="flex flex-col gap-4">
        <Notice kind="info">
          Account created. Check <span className="text-ink">{email}</span> for a confirmation link,
          then come back and sign in.
        </Notice>
        {error && <Notice>{error}</Notice>}
        <Button variant="outline" onClick={resend} disabled={busy}>
          {busy ? 'Sending…' : 'Resend the email'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Button variant="outline" onClick={google} disabled={busy} className="w-full">
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-[11px] text-faint">
        <span className="h-px flex-1 bg-line-soft" />
        or
        <span className="h-px flex-1 bg-line-soft" />
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/60"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-muted">Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/60"
          />
        </label>

        {error && <Notice>{error}</Notice>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Working…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
          setError(null)
        }}
        className="text-[12px] text-muted transition-colors hover:text-ink"
      >
        {mode === 'sign-in' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}
