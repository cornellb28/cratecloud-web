// ── Waitlist input handling ───────────────────────────────────────────────
// Pure and env-free so it can be unit-tested and imported anywhere.

export const DJ_TYPES = [
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'working', label: 'Working' },
  { value: 'professional', label: 'Professional' },
  { value: 'veteran', label: 'Veteran' },
  { value: 'collector', label: 'Collector / archivist' }
] as const

export type DjType = (typeof DJ_TYPES)[number]['value']

const DJ_TYPE_VALUES: string[] = DJ_TYPES.map((t) => t.value)

// Deliberately simple: one @, something either side, a dot in the domain, no
// whitespace. The real check is whether the mail arrives; this only filters junk.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL = 254
const MAX_SOFTWARE = 100

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return null
  return email
}

export function normalizeDjType(raw: unknown): DjType | null {
  return typeof raw === 'string' && DJ_TYPE_VALUES.includes(raw) ? (raw as DjType) : null
}

export function normalizeSoftware(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_SOFTWARE)
  return s || null
}
