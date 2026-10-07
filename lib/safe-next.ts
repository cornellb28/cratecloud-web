// ── Post-login redirect target ────────────────────────────────────────────
// Only ever a same-site relative path. Reflecting anything else back into a
// redirect is an open redirect. Rejected: absolute URLs, protocol-relative
// `//host`, and backslash forms (`/\host`) that some browsers normalise to
// `//host`.

export const DEFAULT_NEXT = '/account'

export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return DEFAULT_NEXT
  return raw
}
