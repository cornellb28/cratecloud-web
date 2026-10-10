// ── The four storage operations, as pure functions ────────────────────────
// Route handlers (app/api/storage/*) authenticate, parse, and call these with
// real dependencies; tests call them with fakes. Nothing here reads env or the
// request, and a user id only ever arrives as an argument that the caller took
// from the verified session.

import { evaluateAccess, type AccessInput } from './caps.ts'
import {
  isAllowedContentType,
  MAX_FILE_BYTES,
  STALE_PENDING_MS,
  PRESIGN_EXPIRES_SECONDS,
  type StorageErrorCode
} from './config.ts'
import { isSha256Hex, objectKey } from './keys.ts'
import type { ObjectStorage, StorageStore } from './types.ts'

export interface Deps {
  store: StorageStore
  storage: ObjectStorage
  getEntitlement(userId: string): Promise<AccessInput | null>
  now(): Date
  // Never pass keys or full signed URLs to this.
  log(event: string, fields?: Record<string, string | number>): void
}

export interface Result {
  status: number
  body: Record<string, unknown>
}

const MESSAGES: Record<StorageErrorCode, string> = {
  UNAUTHENTICATED: 'Sign in first.',
  BAD_REQUEST: 'Bad request.',
  UNSUPPORTED_TYPE: 'That file type is not supported.',
  FILE_TOO_LARGE: 'That file is too large.',
  NOT_ENTITLED: 'Cloud storage is not available on this plan.',
  READ_ONLY: 'Your plan has ended. Your files are read-only for now.',
  OVER_CAP: 'Your cloud storage is full.',
  NOT_FOUND: 'Not found.',
  NOT_UPLOADED: 'The upload has not finished.',
  SIZE_MISMATCH: 'The uploaded file did not match.',
  SERVER_ERROR: 'Something went wrong. Please try again.'
}

const STATUS: Record<StorageErrorCode, number> = {
  UNAUTHENTICATED: 401,
  BAD_REQUEST: 400,
  UNSUPPORTED_TYPE: 415,
  FILE_TOO_LARGE: 413,
  NOT_ENTITLED: 403,
  READ_ONLY: 403,
  OVER_CAP: 409,
  NOT_FOUND: 404,
  NOT_UPLOADED: 409,
  SIZE_MISMATCH: 409,
  SERVER_ERROR: 500
}

export function fail(code: StorageErrorCode, extra: Record<string, unknown> = {}): Result {
  return { status: STATUS[code], body: { error: { code, message: MESSAGES[code], ...extra } } }
}

function asObject(input: unknown): Record<string, unknown> | null {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : null
}

// ── POST /api/storage/upload-url ─────────────────────────────────────────
export async function uploadUrl(deps: Deps, userId: string, input: unknown): Promise<Result> {
  const body = asObject(input)
  if (!body) return fail('BAD_REQUEST')

  const { hash, sizeBytes, contentType } = body
  if (!isSha256Hex(hash)) return fail('BAD_REQUEST')
  if (typeof sizeBytes !== 'number' || !Number.isInteger(sizeBytes) || sizeBytes <= 0) return fail('BAD_REQUEST')
  if (!isAllowedContentType(contentType)) return fail('UNSUPPORTED_TYPE')
  if (sizeBytes > MAX_FILE_BYTES) return fail('FILE_TOO_LARGE')

  const now = deps.now()
  const entitlement = await deps.getEntitlement(userId)
  const readOnlyUntil = await deps.store.getReadOnlyUntil(userId)
  const access = evaluateAccess(entitlement, readOnlyUntil, now)
  if (!access.canUpload) return fail(access.uploadBlock ?? 'NOT_ENTITLED')

  const reserved = await deps.store.reserve({
    userId,
    hash,
    size: sizeBytes,
    contentType,
    capBytes: access.capBytes, // derived from the plan id, never from the client
    staleBefore: new Date(now.getTime() - STALE_PENDING_MS)
  })

  if (reserved.result === 'already_stored') return { status: 200, body: { status: 'already_stored' } }
  if (reserved.result === 'over_cap') {
    return fail('OVER_CAP', { usedBytes: reserved.usedBytes, capBytes: access.capBytes })
  }

  try {
    const url = await deps.storage.presignPut({
      key: objectKey(userId, hash),
      contentType,
      size: sizeBytes
    })
    return {
      status: 200,
      body: {
        status: 'upload',
        url,
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        expiresInSeconds: PRESIGN_EXPIRES_SECONDS
      }
    }
  } catch (err) {
    deps.log('upload-url: presign failed', { user: userId, error: (err as Error).name })
    await deps.store.release({ userId, hash })
    return fail('SERVER_ERROR')
  }
}

// ── POST /api/storage/complete ───────────────────────────────────────────
export async function completeUpload(deps: Deps, userId: string, input: unknown): Promise<Result> {
  const body = asObject(input)
  if (!body || !isSha256Hex(body.hash)) return fail('BAD_REQUEST')
  const hash = body.hash
  const key = objectKey(userId, hash)

  const record = await deps.store.findObject(userId, hash)
  if (!record || record.status === 'hidden') return fail('NOT_FOUND')
  if (record.status === 'active') return { status: 200, body: { status: 'active' } }

  let head
  try {
    head = await deps.storage.head(key)
  } catch (err) {
    deps.log('complete: head failed', { user: userId, error: (err as Error).name })
    return fail('SERVER_ERROR')
  }
  if (!head) return fail('NOT_UPLOADED')

  if (head.size !== record.sizeBytes) {
    // Wrong bytes were uploaded: drop the reservation and the stray version.
    await deps.store.release({ userId, hash })
    if (head.versionId) {
      try {
        await deps.storage.deleteVersion(key, head.versionId)
      } catch (err) {
        deps.log('complete: cleanup of mismatched upload failed', { user: userId, error: (err as Error).name })
      }
    }
    return fail('SIZE_MISMATCH')
  }

  const result = await deps.store.complete({ userId, hash, size: head.size, versionId: head.versionId })
  if (result === 'completed' || result === 'already_active') return { status: 200, body: { status: 'active' } }
  if (result === 'size_mismatch') return fail('SIZE_MISMATCH')
  return fail('NOT_FOUND')
}

// ── POST /api/storage/download-url ───────────────────────────────────────
// Allowed while subscribed AND during the 60-day read-only window. Being over
// the cap (after a downgrade) never blocks downloads.
export async function downloadUrl(deps: Deps, userId: string, input: unknown): Promise<Result> {
  const body = asObject(input)
  if (!body || !isSha256Hex(body.hash)) return fail('BAD_REQUEST')
  const hash = body.hash

  const entitlement = await deps.getEntitlement(userId)
  const readOnlyUntil = await deps.store.getReadOnlyUntil(userId)
  if (!evaluateAccess(entitlement, readOnlyUntil, deps.now()).canDownload) return fail('NOT_ENTITLED')

  const record = await deps.store.findObject(userId, hash)
  if (!record || record.status !== 'active') return fail('NOT_FOUND')

  try {
    const url = await deps.storage.presignGet({ key: objectKey(userId, hash), contentType: record.contentType })
    return { status: 200, body: { url, method: 'GET', expiresInSeconds: PRESIGN_EXPIRES_SECONDS } }
  } catch (err) {
    deps.log('download-url: presign failed', { user: userId, error: (err as Error).name })
    return fail('SERVER_ERROR')
  }
}

// ── POST /api/storage/delete ─────────────────────────────────────────────
// Deleting is always allowed for the owner, including when over the cap or
// read-only: it is the way out of being over the cap.
//   hide  -> bytes stop counting; the object gets a delete marker and the
//            bucket lifecycle rule removes it 14 days later.
//   purge -> the stored version is deleted now ("delete from cloud").
export async function deleteObject(deps: Deps, userId: string, input: unknown): Promise<Result> {
  const body = asObject(input)
  if (!body || !isSha256Hex(body.hash)) return fail('BAD_REQUEST')
  if (body.mode !== 'hide' && body.mode !== 'purge') return fail('BAD_REQUEST')
  const hash = body.hash
  const key = objectKey(userId, hash)

  const hidden = await deps.store.hide({ userId, hash })
  if (hidden.result === 'not_found') return fail('NOT_FOUND')

  if (body.mode === 'hide') {
    try {
      // Also runs for already_hidden, so a retry after a failed S3 call heals.
      await deps.storage.hideObject(key)
      return { status: 200, body: { status: 'hidden' } }
    } catch (err) {
      deps.log('delete(hide): hide failed', { user: userId, error: (err as Error).name })
      return fail('SERVER_ERROR')
    }
  }

  try {
    if (hidden.versionId) {
      await deps.storage.deleteVersion(key, hidden.versionId)
    } else {
      // No version id recorded: fall back to hiding so the lifecycle rule
      // still removes it.
      await deps.storage.hideObject(key)
    }
    await deps.store.removeHidden({ userId, hash })
    return { status: 200, body: { status: 'purged' } }
  } catch (err) {
    deps.log('delete(purge): delete failed', { user: userId, error: (err as Error).name })
    try {
      await deps.storage.hideObject(key) // so the lifecycle rule cleans up if retries never come
    } catch {
      /* already logged above */
    }
    return fail('SERVER_ERROR')
  }
}
