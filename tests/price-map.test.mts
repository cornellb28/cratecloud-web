// Run: node --test tests/*.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PAID_PLANS,
  PRICE_ENV,
  parseInterval,
  planAndIntervalForPriceId,
  priceIdFor
} from '../lib/price-map.ts'

const ENV = {
  STRIPE_PRICE_SYNC: 'price_sync_m',
  STRIPE_PRICE_SYNC_ANNUAL: 'price_sync_y',
  STRIPE_PRICE_LIBRARY: 'price_lib_m',
  STRIPE_PRICE_LIBRARY_ANNUAL: 'price_lib_y',
  STRIPE_PRICE_TOURING: 'price_tour_m',
  STRIPE_PRICE_TOURING_ANNUAL: 'price_tour_y'
}

const EXPECTED = [
  ['price_sync_m', 'sync', 'month'],
  ['price_sync_y', 'sync', 'year'],
  ['price_lib_m', 'library', 'month'],
  ['price_lib_y', 'library', 'year'],
  ['price_tour_m', 'touring', 'month'],
  ['price_tour_y', 'touring', 'year']
] as const

for (const [id, plan, interval] of EXPECTED) {
  test(`${id} maps to ${plan} / ${interval}`, () => {
    assert.deepEqual(planAndIntervalForPriceId(id, ENV), { plan, interval })
  })
  test(`${plan} / ${interval} resolves back to ${id}`, () => {
    assert.equal(priceIdFor(plan, interval, ENV), id)
  })
}

test('unknown, retired, empty and missing price ids map to nothing', () => {
  assert.equal(planAndIntervalForPriceId('price_unknown', ENV), null)
  assert.equal(planAndIntervalForPriceId('price_old_cloud_mobile', ENV), null)
  assert.equal(planAndIntervalForPriceId('', ENV), null)
  assert.equal(planAndIntervalForPriceId(null, ENV), null)
  assert.equal(planAndIntervalForPriceId(undefined, ENV), null)
})

test('an unset env var never matches an empty price id', () => {
  assert.equal(planAndIntervalForPriceId('', {}), null)
  assert.equal(planAndIntervalForPriceId('price_sync_m', {}), null)
})

test('priceIdFor rejects free and unknown plans (client-supplied tier)', () => {
  assert.equal(priceIdFor('free', 'month', ENV), null)
  assert.equal(priceIdFor('cloud_mobile', 'month', ENV), null)
  assert.equal(priceIdFor('enterprise', 'year', ENV), null)
  assert.equal(priceIdFor(undefined, 'month', ENV), null)
})

test('priceIdFor is null when the env var is not set', () => {
  assert.equal(priceIdFor('sync', 'year', {}), null)
})

test('parseInterval: missing = month, month/year ok, anything else rejected', () => {
  assert.equal(parseInterval(undefined), 'month')
  assert.equal(parseInterval(null), 'month')
  assert.equal(parseInterval('month'), 'month')
  assert.equal(parseInterval('year'), 'year')
  for (const bad of ['yearly', 'week', '', 'YEAR', 12, {}, ['year']]) {
    assert.equal(parseInterval(bad), null, JSON.stringify(bad))
  }
})

test('there are exactly six env names, all distinct', () => {
  const names = PAID_PLANS.flatMap((p) => [PRICE_ENV[p].month, PRICE_ENV[p].year])
  assert.equal(names.length, 6)
  assert.equal(new Set(names).size, 6)
  assert.ok(names.every((n) => /^STRIPE_PRICE_(SYNC|LIBRARY|TOURING)(_ANNUAL)?$/.test(n)))
})
