// ── Desktop handoff: Supabase-backed store and session issuer ─────────────
// Service role. Server only.

import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createEphemeralClient } from '@/lib/supabase/ephemeral'
import type { HandoffStore, SessionIssuer } from '@/lib/desktop-handoff'

const TABLE = 'desktop_auth_handoffs'

export function supabaseStore(admin = createAdminClient()): HandoffStore {
  return {
    async insert(row) {
      const { error } = await admin.from(TABLE).insert(row)
      if (error) throw new Error('handoff insert failed')
    },
    async consume(keyHash, nowIso) {
      // One UPDATE ... WHERE used_at IS NULL AND expires_at > now RETURNING:
      // Postgres row-locks it, so of two simultaneous redeems exactly one
      // matches a row.
      const { data, error } = await admin
        .from(TABLE)
        .update({ used_at: nowIso })
        .eq('key_hash', keyHash)
        .is('used_at', null)
        .gt('expires_at', nowIso)
        .select('challenge, user_id')
      if (error || !data || data.length !== 1) return null
      return data[0]
    },
    async countRecent(userId, sinceIso) {
      const { count, error } = await admin
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sinceIso)
      if (error) throw new Error('handoff count failed')
      return count ?? 0
    },
    async deleteExpired(beforeIso) {
      await admin.from(TABLE).delete().lt('expires_at', beforeIso)
    }
  }
}

// generateLink (magiclink) sends NO email — it only returns a hashed_token.
// verifyOtp on it yields a real session and confirms the email, which is why
// the confirmed-email check happens before the key is ever minted.
//
// Each generateLink overwrites the user's stored one-time token, so two
// redeems for the same user at the same instant can invalidate each other.
// One retry covers that; scripts/verify-handoff.mjs proves it against the
// real project.
export function supabaseIssuer(admin = createAdminClient()): SessionIssuer {
  return {
    async issue(userId) {
      const { data: found, error: userErr } = await admin.auth.admin.getUserById(userId)
      const user = found?.user
      if (userErr || !user?.email || !user.email_confirmed_at) return null

      for (let attempt = 0; attempt < 2; attempt++) {
        const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: user.email
        })
        const hashed = link?.properties?.hashed_token
        if (linkErr || !hashed) continue

        const { data, error } = await createEphemeralClient().auth.verifyOtp({
          token_hash: hashed,
          type: 'email'
        })
        if (error || !data.session || data.user?.id !== userId) continue
        return {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        }
      }
      return null
    }
  }
}
