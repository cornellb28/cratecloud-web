// ── Cap math and who may do what ──────────────────────────────────────────
// Pure. The cap always comes from the plan id on the server-read entitlement;
// there is no code path that accepts a cap from a client.

import { isEntitled, isPaid, storageCapGb } from '../plans.ts'
import { GB } from './config.ts'

export function capBytes(plan: string): number {
  return storageCapGb(plan) * GB
}

export interface AccessInput {
  plan: string
  status: string
  current_period_end: string | null
}

export interface Access {
  // Paid plan with an entitled status (active / trialing / past_due in grace).
  entitled: boolean
  capBytes: number
  canUpload: boolean
  canDownload: boolean
  // Why uploads are blocked, if they are.
  uploadBlock: 'NOT_ENTITLED' | 'READ_ONLY' | null
}

export function evaluateAccess(
  entitlement: AccessInput | null,
  readOnlyUntil: Date | null,
  now: Date = new Date()
): Access {
  const entitled = Boolean(
    entitlement &&
      isPaid(entitlement.plan) &&
      isEntitled({
        status: entitlement.status as never,
        current_period_end: entitlement.current_period_end
      })
  )

  const cap = entitled && entitlement ? capBytes(entitlement.plan) : 0
  const inReadOnlyWindow = Boolean(readOnlyUntil && now.getTime() < readOnlyUntil.getTime())

  return {
    entitled,
    capBytes: cap,
    canUpload: entitled && cap > 0,
    canDownload: entitled || inReadOnlyWindow,
    uploadBlock: entitled ? (cap > 0 ? null : 'NOT_ENTITLED') : inReadOnlyWindow ? 'READ_ONLY' : 'NOT_ENTITLED'
  }
}

// Would adding `size` fit under `cap`, given what is stored and reserved?
// Inclusive at the boundary: exactly filling the cap is allowed.
export function fitsUnderCap(usedBytes: number, reservedBytes: number, size: number, cap: number): boolean {
  return usedBytes + reservedBytes + size <= cap
}
