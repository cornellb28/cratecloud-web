// ── Supabase-backed StorageStore ──────────────────────────────────────────
// Calls the service-role-only SQL functions in
// supabase/migrations/*_storage.sql. All writes go through them.

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CompleteResult, HideResult, ReserveResult, StorageStore, StoredObject } from './types'

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.code ?? ''} ${res.error.message}`.trim())
  return res.data as T
}

export function createSupabaseStore(admin: SupabaseClient): StorageStore {
  return {
    async reserve({ userId, hash, size, contentType, capBytes, staleBefore }) {
      const rows = check(
        await admin.rpc('reserve_storage', {
          p_user: userId,
          p_hash: hash,
          p_size: size,
          p_content_type: contentType,
          p_cap: capBytes,
          p_stale_before: staleBefore.toISOString()
        }),
        'reserve_storage'
      ) as Array<{ result: string; object_id: string | null; used_bytes: number; reserved_bytes: number }>

      const row = rows?.[0]
      if (!row) throw new Error('reserve_storage returned no row')
      if (row.result === 'already_stored') return { result: 'already_stored' } satisfies ReserveResult
      if (row.result === 'over_cap') {
        return { result: 'over_cap', usedBytes: Number(row.used_bytes), reservedBytes: Number(row.reserved_bytes) }
      }
      return {
        result: 'reserved',
        objectId: String(row.object_id),
        usedBytes: Number(row.used_bytes),
        reservedBytes: Number(row.reserved_bytes)
      }
    },

    async complete({ userId, hash, size, versionId }) {
      return check(
        await admin.rpc('complete_storage', { p_user: userId, p_hash: hash, p_size: size, p_version: versionId }),
        'complete_storage'
      ) as CompleteResult
    },

    async release({ userId, hash }) {
      check(await admin.rpc('release_storage', { p_user: userId, p_hash: hash }), 'release_storage')
    },

    async hide({ userId, hash }) {
      const rows = check(
        await admin.rpc('hide_storage', { p_user: userId, p_hash: hash }),
        'hide_storage'
      ) as Array<{ result: HideResult['result']; version_id: string | null }>
      const row = rows?.[0]
      return { result: row?.result ?? 'not_found', versionId: row?.version_id ?? null }
    },

    async removeHidden({ userId, hash }) {
      check(await admin.rpc('remove_hidden_storage', { p_user: userId, p_hash: hash }), 'remove_hidden_storage')
    },

    async findObject(userId, hash) {
      const rows = check(
        await admin
          .from('storage_objects')
          .select('status, size_bytes, content_type, version_id')
          .eq('user_id', userId)
          .eq('content_hash', hash)
          .in('status', ['pending', 'active', 'hidden']),
        'storage_objects select'
      ) as Array<{ status: StoredObject['status']; size_bytes: number; content_type: string; version_id: string | null }>

      // Prefer a live (active/pending) record over hidden history.
      const order = { active: 0, pending: 1, hidden: 2 } as const
      const best = [...(rows ?? [])].sort((a, b) => order[a.status] - order[b.status])[0]
      if (!best) return null
      return {
        status: best.status,
        sizeBytes: Number(best.size_bytes),
        contentType: best.content_type,
        versionId: best.version_id
      }
    },

    async getReadOnlyUntil(userId) {
      const row = check(
        await admin.from('storage_usage').select('read_only_until').eq('user_id', userId).maybeSingle(),
        'storage_usage select'
      ) as { read_only_until: string | null } | null
      return row?.read_only_until ? new Date(row.read_only_until) : null
    }
  }
}

// Called by the Stripe webhook when a subscription ends: downloads stay
// allowed for 60 days. Upsert touches only read_only_until, never the counters.
export async function startReadOnlyWindow(admin: SupabaseClient, userId: string, until: Date): Promise<void> {
  const res = await admin
    .from('storage_usage')
    .upsert({ user_id: userId, read_only_until: until.toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (res.error) throw new Error(`startReadOnlyWindow: ${res.error.code ?? ''} ${res.error.message}`.trim())
}
