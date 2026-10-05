// ── Best-effort in-memory rate limit ──────────────────────────────────────
// Fixed window, per server instance. On serverless each instance has its own
// counters, so this only blunts a burst hitting one warm instance. It is a
// backstop, not the control.
//
// TODO(rate-limit): the real per-IP limit for /api/desktop/handoff and
// /api/desktop/redeem is a Vercel WAF rate-limit rule (Firewall > Rules).
// Add it in the dashboard before launch; code alone cannot do this reliably.

const buckets = new Map<string, { count: number; resetAt: number }>()

export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k)
  }
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  b.count += 1
  return b.count <= limit
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}
