// Run: node --test tests/*.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { PAID_TIERS, isPaid, planLabel, storageCapGb } from '../lib/plans.ts'

test('storage caps come from the plan id', () => {
  assert.equal(storageCapGb('free'), 0)
  assert.equal(storageCapGb('sync'), 10)
  assert.equal(storageCapGb('library'), 250)
  assert.equal(storageCapGb('touring'), 1000)
})

test('unknown or retired plan ids get no storage', () => {
  assert.equal(storageCapGb('cloud_mobile'), 0)
  assert.equal(storageCapGb('cloud_mobile_plus'), 0)
  assert.equal(storageCapGb('whatever'), 0)
})

test('paid tiers are exactly sync, library, touring', () => {
  assert.deepEqual(PAID_TIERS.map((t) => t.key), ['sync', 'library', 'touring'])
})

test('isPaid is plan !== free', () => {
  assert.equal(isPaid('free'), false)
  assert.equal(isPaid('sync'), true)
})

test('planLabel falls back to Free', () => {
  assert.equal(planLabel(null), 'Free')
  assert.equal(planLabel({ plan: 'library', status: 'none' }), 'Free')
  assert.equal(planLabel({ plan: 'library', status: 'active' }), 'Library')
})
