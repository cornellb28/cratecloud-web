// ── Object keys ───────────────────────────────────────────────────────────
// u/{user_id}/{sha256}. The user id comes from the verified session, the hash
// is validated hex. No client-supplied path, name or extension is ever part of
// a key, so a client cannot address another user's objects.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA256_RE = /^[0-9a-f]{64}$/

export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA256_RE.test(value)
}

export function objectKey(userId: string, contentHash: string): string {
  if (!UUID_RE.test(userId)) throw new Error('objectKey: user id is not a uuid')
  if (!SHA256_RE.test(contentHash)) throw new Error('objectKey: content hash is not lowercase sha256 hex')
  return `u/${userId}/${contentHash}`
}
