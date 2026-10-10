// Run: node --test tests/*.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { MARGIN_FLOOR, marginAtFullCap } from '../lib/margins.ts'
import { LIST_PRICE_USD, STORAGE_CAP_GB, storageCapGb } from '../lib/plans.ts'
import { PAID_PLANS } from '../lib/price-map.ts'

for (const plan of PAID_PLANS) {
  for (const interval of ['month', 'year'] as const) {
    test(`${plan} ${interval}: margin at full cap stays above 75%`, () => {
      const m = marginAtFullCap(plan, interval)
      assert.ok(m.margin > MARGIN_FLOOR, `${plan}/${interval} margin ${(m.margin * 100).toFixed(1)}%`)
    })
  }
}

test('annual price is exactly 10x monthly for every plan', () => {
  for (const plan of PAID_PLANS) {
    assert.equal(LIST_PRICE_USD[plan].year, LIST_PRICE_USD[plan].month * 10, plan)
  }
})

test('monthly prices are 10 / 19 / 55', () => {
  assert.deepEqual(
    PAID_PLANS.map((p) => LIST_PRICE_USD[p].month),
    [10, 19, 55]
  )
})

test('storage caps: free 0, sync 10, library 250, touring 1000 GB', () => {
  assert.deepEqual(STORAGE_CAP_GB, { free: 0, sync: 10, library: 250, touring: 1000 })
  assert.equal(storageCapGb('touring'), 1000)
  assert.equal(storageCapGb('cloud_mobile'), 0)
})

test('touring annual cost is about $9.50 a month', () => {
  const m = marginAtFullCap('touring', 'year')
  assert.ok(Math.abs(m.cost - 9.5) < 0.05, `cost ${m.cost.toFixed(2)}`)
})
