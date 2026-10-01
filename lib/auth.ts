// ── Who is signed in ──────────────────────────────────────────────────────
// Shared by every protected page and route handler so the redirect target
// and the 401 shape are decided in one place.

import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// getUser() rather than getSession(): getSession reads the cookie and trusts
// it, getUser revalidates against the auth server. On a page that decides
// whether to show billing controls, trusting an unverified cookie is not a
// trade worth making.
export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}

export async function requireUser(next: string): Promise<User> {
  const user = await getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  return user
}
