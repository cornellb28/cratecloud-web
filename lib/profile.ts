// ── What the UI shows about a signed-in user ──────────────────────────────
// Pure and env-free. `display_name` (set from /account) wins over what the
// provider supplied, because Google rewrites full_name/name on sign-in and
// would silently undo a rename.

import type { User } from '@supabase/supabase-js'

export interface Profile {
  name: string
  email: string
  avatarUrl: string | null
  initial: string
  providers: string[]
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function profileOf(user: User): Profile {
  const meta = user.user_metadata ?? {}
  const email = user.email ?? ''
  const name =
    str(meta.display_name) ?? str(meta.full_name) ?? str(meta.name) ?? (email.split('@')[0] || 'Account')

  const providers = new Set<string>()
  for (const i of user.identities ?? []) providers.add(i.provider)
  const appProviders = user.app_metadata?.providers
  if (Array.isArray(appProviders)) appProviders.forEach((p) => providers.add(String(p)))
  if (providers.size === 0 && user.app_metadata?.provider) providers.add(String(user.app_metadata.provider))

  return {
    name,
    email,
    avatarUrl: str(meta.avatar_url) ?? str(meta.picture),
    initial: (name.trim()[0] ?? email[0] ?? '♪').toUpperCase(),
    providers: [...providers]
  }
}
