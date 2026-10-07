// ── Post-login redirect target ────────────────────────────────────────────
// Every post-login redirect (and every `next` we forward) goes through
// safeNext(). It returns a same-site path or DEFAULT_NEXT, never anything
// else, so a raw `next` must never reach redirect(), router.push(),
// window.location or a constructed URL.
//
// Rejected: non-strings (e.g. ?next=a&next=b arrives as an array), anything
// not starting with a single `/`, `//host`, backslashes (browsers treat
// `/\host` as `//host`), control characters and whitespace (browsers strip
// tab/newline, so `/<TAB>/host` becomes `//host`), and percent-encoded
// variants of all of those — the value is decoded ONCE and re-checked.
// Finally it is resolved against a dummy origin and rejected if the origin
// changes.
//
// Trade-off: a path containing an encoded space or other whitespace is
// rejected too. We never generate such paths.

export const DEFAULT_NEXT = '/account'

const MAX_LENGTH = 2048
const DUMMY_ORIGIN = 'http://safe-next.invalid'
// C0/C1 controls, DEL, and any Unicode whitespace.
const FORBIDDEN = /[\u0000-\u001f\u007f-\u009f\s\\]/

function looksSafe(v: string): boolean {
  if (!v.startsWith('/')) return false // also rejects absolute URLs and javascript:
  if (v.startsWith('//')) return false
  if (FORBIDDEN.test(v)) return false
  return true
}

export function safeNext(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) return DEFAULT_NEXT
  if (!looksSafe(raw)) return DEFAULT_NEXT

  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return DEFAULT_NEXT // malformed percent-encoding
  }
  if (!looksSafe(decoded)) return DEFAULT_NEXT

  try {
    const url = new URL(raw, DUMMY_ORIGIN)
    if (url.origin !== DUMMY_ORIGIN) return DEFAULT_NEXT
  } catch {
    return DEFAULT_NEXT
  }

  return raw
}
