// Run: node --test tests/*.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDjType, normalizeEmail, normalizeSoftware } from '../lib/waitlist.ts'

test('normalizeEmail lowercases and trims', () => {
  assert.equal(normalizeEmail('  Foo@Example.COM '), 'foo@example.com')
})

for (const bad of ['', 'nope', 'a@b', '@x.com', 'a b@x.com', 'a@@x.com', undefined, null, 5, ['a@b.co'], 'a@b.co' + 'x'.repeat(260)]) {
  test(`normalizeEmail rejects ${JSON.stringify(bad)?.slice(0, 30)}`, () => {
    assert.equal(normalizeEmail(bad), null)
  })
}

test('normalizeDjType accepts the listed values only', () => {
  assert.equal(normalizeDjType('bedroom'), 'bedroom')
  assert.equal(normalizeDjType('collector'), 'collector')
  assert.equal(normalizeDjType('wizard'), null)
  assert.equal(normalizeDjType(undefined), null)
})

test('normalizeSoftware trims, strips control chars, caps length', () => {
  assert.equal(normalizeSoftware('  Serato\n'), 'Serato')
  assert.equal(normalizeSoftware(''), null)
  assert.equal(normalizeSoftware(7), null)
  assert.equal(normalizeSoftware('x'.repeat(500))?.length, 100)
})
