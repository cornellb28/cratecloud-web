// ── Cloud audio storage: constants ────────────────────────────────────────
// Pure (no env, no server-only) so tests and handlers can import it.

export const GB = 1_000_000_000 // decimal, matching STORAGE_CAP_GB in lib/plans.ts

// Largest single audio file accepted by upload-url. One named constant, easy to
// raise: change the number here and nothing else (it is enforced server-side in
// handlers.ts and covered by tests/storage-handlers.test.mts). Lossless files
// such as long WAV/AIFF DJ sets are the ones that approach it.
export const MAX_FILE_BYTES = 1 * GB
export const PRESIGN_EXPIRES_SECONDS = 15 * 60
export const STALE_PENDING_MS = 30 * 60 * 1000
export const READ_ONLY_DAYS = 60

// Audio only. Anything else is rejected before a URL is signed.
export const ALLOWED_CONTENT_TYPES = [
  'audio/mpeg', // mp3
  'audio/wav',
  'audio/x-wav',
  'audio/aiff',
  'audio/x-aiff',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4', // m4a
  'audio/x-m4a'
] as const

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number]

export function isAllowedContentType(value: unknown): value is AllowedContentType {
  return typeof value === 'string' && (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value)
}

// Machine-readable codes the apps can show. Messages stay generic.
export type StorageErrorCode =
  | 'UNAUTHENTICATED'
  | 'BAD_REQUEST'
  | 'UNSUPPORTED_TYPE'
  | 'FILE_TOO_LARGE'
  | 'NOT_ENTITLED' // no paid plan, or the subscription is not active
  | 'READ_ONLY' // cancelled: downloads allowed for 60 days, uploads blocked
  | 'OVER_CAP' // storage is full (including after a downgrade): no new uploads
  | 'NOT_FOUND'
  | 'NOT_UPLOADED'
  | 'SIZE_MISMATCH'
  | 'SERVER_ERROR'
