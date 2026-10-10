// ── Storage store: the persistence contract ───────────────────────────────
// Implemented by the Supabase RPC store (service.ts) and by an in-memory fake
// in tests. Atomicity of reserve() is the point of this seam.

export type ReserveResult =
  | { result: 'reserved'; objectId: string; usedBytes: number; reservedBytes: number }
  | { result: 'already_stored' }
  | { result: 'over_cap'; usedBytes: number; reservedBytes: number }

export type CompleteResult = 'completed' | 'already_active' | 'size_mismatch' | 'not_found'

export interface HideResult {
  result: 'hidden' | 'already_hidden' | 'not_found'
  versionId: string | null
}

export interface StoredObject {
  status: 'pending' | 'active' | 'hidden'
  sizeBytes: number
  contentType: string
  versionId: string | null
}

export interface StorageStore {
  reserve(args: {
    userId: string
    hash: string
    size: number
    contentType: string
    capBytes: number
    staleBefore: Date
  }): Promise<ReserveResult>
  complete(args: { userId: string; hash: string; size: number; versionId: string | null }): Promise<CompleteResult>
  release(args: { userId: string; hash: string }): Promise<void>
  hide(args: { userId: string; hash: string }): Promise<HideResult>
  removeHidden(args: { userId: string; hash: string }): Promise<void>
  findObject(userId: string, hash: string): Promise<StoredObject | null>
  getReadOnlyUntil(userId: string): Promise<Date | null>
}

// The slice of S3 the handlers use. Real implementation: lib/storage/b2-core.ts.
export interface ObjectStorage {
  presignPut(args: { key: string; contentType: string; size: number }): Promise<string>
  presignGet(args: { key: string; contentType: string }): Promise<string>
  head(key: string): Promise<{ size: number; versionId: string | null } | null>
  deleteVersion(key: string, versionId: string): Promise<void>
  hideObject(key: string): Promise<void> // DeleteObject with no version id => delete marker
}
