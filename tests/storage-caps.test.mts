// Run: node --test tests/*.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { capBytes, evaluateAccess, fitsUnderCap } from '../lib/storage/caps.ts'
import { GB } from '../lib/storage/config.ts'

const ent = (plan: string, status = 'active', end: string | null = null) => ({ plan, status, current_period_end: end })
const NOW = new Date('2026-10-09T12:00:00Z')

test('caps by plan id: free 0, sync 10 GB, library 250 GB, touring 1 TB', () => {
  assert.equal(capBytes('free'), 0)
  assert.equal(capBytes('sync'), 10 * GB)
  assert.equal(capBytes('library'), 250 * GB)
  assert.equal(capBytes('touring'), 1000 * GB)
  assert.equal(capBytes('cloud_mobile'), 0) // retired / unknown plan ids get nothing
})

test('fitsUnderCap at the boundaries', () => {
  const cap = 10 * GB
  assert.equal(fitsUnderCap(0, 0, cap, cap), true) // exactly fills the cap
  assert.equal(fitsUnderCap(0, 0, cap + 1, cap), false) // one byte over
  assert.equal(fitsUnderCap(cap - 1, 0, 1, cap), true)
  assert.equal(fitsUnderCap(cap - 1, 0, 2, cap), false)
  assert.equal(fitsUnderCap(5 * GB, 5 * GB, 1, cap), false) // reservations count
  assert.equal(fitsUnderCap(0, 0, 1, 0), false) // a zero cap fits nothing
})

test('a free user (status active, plan free) cannot upload or download', () => {
  const a = evaluateAccess(ent('free'), null, NOW)
  assert.equal(a.canUpload, false)
  assert.equal(a.canDownload, false)
  assert.equal(a.uploadBlock, 'NOT_ENTITLED')
})

test('no entitlement row at all behaves like free', () => {
  const a = evaluateAccess(null, null, NOW)
  assert.equal(a.canUpload, false)
  assert.equal(a.canDownload, false)
})

test('active paid plans may upload and download with the plan cap', () => {
  for (const [plan, gb] of [['sync', 10], ['library', 250], ['touring', 1000]] as const) {
    const a = evaluateAccess(ent(plan), null, NOW)
    assert.equal(a.canUpload, true, plan)
    assert.equal(a.canDownload, true, plan)
    assert.equal(a.capBytes, gb * GB, plan)
  }
})

test('past_due keeps access only until the period end', () => {
  const inGrace = evaluateAccess(ent('library', 'past_due', '2026-10-20T00:00:00Z'), null, NOW)
  assert.equal(inGrace.canUpload, true)
  const expired = evaluateAccess(ent('library', 'past_due', '2026-10-01T00:00:00Z'), null, NOW)
  assert.equal(expired.canUpload, false)
})

test('cancelled: downloads allowed inside the 60-day read-only window, uploads never', () => {
  const until = new Date('2026-12-01T00:00:00Z')
  const a = evaluateAccess(ent('free', 'canceled'), until, NOW)
  assert.equal(a.canDownload, true)
  assert.equal(a.canUpload, false)
  assert.equal(a.uploadBlock, 'READ_ONLY')
})

test('cancelled: after the window closes, downloads stop too', () => {
  const until = new Date('2026-10-09T11:59:59Z') // one second ago
  const a = evaluateAccess(ent('free', 'canceled'), until, NOW)
  assert.equal(a.canDownload, false)
  assert.equal(a.uploadBlock, 'NOT_ENTITLED')
})

test('the window boundary is exclusive: at read_only_until exactly, access is gone', () => {
  const a = evaluateAccess(ent('free', 'canceled'), new Date(NOW), NOW)
  assert.equal(a.canDownload, false)
})
