// ── Shared wrapper for the four /api/storage/* routes ─────────────────────
// Authenticates (Bearer Supabase access token, falling back to the session
// cookie for the website), parses JSON, builds real dependencies, and turns
// any unexpected throw into a generic error. The user id passed to the
// handlers is ONLY ever the verified session's id.

import 'server-only'
import { NextResponse } from 'next/server'
import { readEntitlement } from '@/lib/entitlements'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getObjectStorage } from './b2'
import { fail, type Deps, type Result } from './handlers'
import { createSupabaseStore } from './service'

async function verifiedUserId(request: Request, admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const header = request.headers.get('authorization')
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (token) {
    const { data, error } = await admin.auth.getUser(token)
    return error || !data.user ? null : data.user.id
  }
  const { data, error } = await (await createClient()).auth.getUser()
  return error || !data.user ? null : data.user.id
}

export async function runStorageRoute(
  request: Request,
  op: (deps: Deps, userId: string, input: unknown) => Promise<Result>
): Promise<NextResponse> {
  const respond = (r: Result) => NextResponse.json(r.body, { status: r.status })

  try {
    const admin = createAdminClient()
    const userId = await verifiedUserId(request, admin)
    if (!userId) return respond(fail('UNAUTHENTICATED'))

    let input: unknown
    try {
      input = await request.json()
    } catch {
      return respond(fail('BAD_REQUEST'))
    }

    const deps: Deps = {
      store: createSupabaseStore(admin),
      storage: getObjectStorage(),
      getEntitlement: (id) => readEntitlement(admin, id),
      now: () => new Date(),
      log: (event, fields) => console.error(`[storage] ${event}`, fields ?? {})
    }
    return respond(await op(deps, userId, input))
  } catch (err) {
    // Details stay server-side; never include env values, keys or signed URLs.
    console.error('[storage] unexpected error:', (err as Error).message)
    return respond(fail('SERVER_ERROR'))
  }
}
