// In-memory StorageStore with the same semantics as the SQL functions in
// supabase/migrations/*_storage.sql. The critical section of each method has
// NO await between check and write, which is the atomicity the real per-user
// row lock (SELECT ... FOR UPDATE) provides. The real database is exercised
// separately; this keeps the handler logic honest about races.
import type { StorageStore, StoredObject } from '../../lib/storage/types.ts'

interface Row {
  hash: string
  userId: string
  size: number
  contentType: string
  status: 'pending' | 'active' | 'hidden'
  versionId: string | null
  createdAt: Date
}

export function createMemoryStore(opts: { readOnlyUntil?: Record<string, Date>; now?: () => Date } = {}) {
  const clock = opts.now ?? (() => new Date())
  const rows: Row[] = []
  const usage = new Map<string, { used: number; reserved: number }>()
  const u = (id: string) => {
    if (!usage.has(id)) usage.set(id, { used: 0, reserved: 0 })
    return usage.get(id)!
  }
  let versionCounter = 0
  const tick = () => Promise.resolve() // yield so concurrent callers interleave

  const store: StorageStore = {
    async reserve({ userId, hash, size, contentType, capBytes, staleBefore }) {
      await tick()
      // ── critical section (atomic) ──
      const us = u(userId)
      for (const r of [...rows]) {
        if (r.userId === userId && r.status === 'pending' && r.createdAt < staleBefore) {
          us.reserved = Math.max(us.reserved - r.size, 0)
          rows.splice(rows.indexOf(r), 1)
        }
      }
      const live = rows.find((r) => r.userId === userId && r.hash === hash && (r.status === 'pending' || r.status === 'active'))
      if (live?.status === 'active') return { result: 'already_stored' }
      if (live?.status === 'pending') {
        return { result: 'reserved', objectId: 'existing', usedBytes: us.used, reservedBytes: us.reserved }
      }
      if (us.used + us.reserved + size > capBytes) {
        return { result: 'over_cap', usedBytes: us.used, reservedBytes: us.reserved }
      }
      rows.push({ hash, userId, size, contentType, status: 'pending', versionId: null, createdAt: clock() })
      us.reserved += size
      return { result: 'reserved', objectId: `obj-${rows.length}`, usedBytes: us.used, reservedBytes: us.reserved }
    },

    async complete({ userId, hash, size, versionId }) {
      await tick()
      const r = rows.find((x) => x.userId === userId && x.hash === hash && (x.status === 'pending' || x.status === 'active'))
      if (!r) return 'not_found'
      if (r.status === 'active') return 'already_active'
      if (r.size !== size) return 'size_mismatch'
      const us = u(userId)
      r.status = 'active'
      r.versionId = versionId
      us.reserved = Math.max(us.reserved - r.size, 0)
      us.used += r.size
      return 'completed'
    },

    async release({ userId, hash }) {
      await tick()
      const i = rows.findIndex((x) => x.userId === userId && x.hash === hash && x.status === 'pending')
      if (i >= 0) {
        u(userId).reserved = Math.max(u(userId).reserved - rows[i].size, 0)
        rows.splice(i, 1)
      }
    },

    async hide({ userId, hash }) {
      await tick()
      const r =
        rows.find((x) => x.userId === userId && x.hash === hash && x.status === 'active') ??
        rows.find((x) => x.userId === userId && x.hash === hash && x.status === 'hidden')
      if (!r) return { result: 'not_found', versionId: null }
      if (r.status === 'hidden') return { result: 'already_hidden', versionId: r.versionId }
      r.status = 'hidden'
      u(userId).used = Math.max(u(userId).used - r.size, 0)
      return { result: 'hidden', versionId: r.versionId }
    },

    async removeHidden({ userId, hash }) {
      await tick()
      const i = rows.findIndex((x) => x.userId === userId && x.hash === hash && x.status === 'hidden')
      if (i >= 0) rows.splice(i, 1)
    },

    async findObject(userId, hash): Promise<StoredObject | null> {
      await tick()
      const order = { active: 0, pending: 1, hidden: 2 } as const
      const r = rows
        .filter((x) => x.userId === userId && x.hash === hash)
        .sort((a, b) => order[a.status] - order[b.status])[0]
      return r ? { status: r.status, sizeBytes: r.size, contentType: r.contentType, versionId: r.versionId } : null
    },

    async getReadOnlyUntil(userId) {
      return opts.readOnlyUntil?.[userId] ?? null
    }
  }

  return {
    store,
    usage: (id: string) => ({ ...u(id) }),
    rows: () => rows.map((r) => ({ ...r })),
    nextVersion: () => `v${++versionCounter}`
  }
}
