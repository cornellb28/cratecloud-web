// Run: node --test tests/*.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { isSha256Hex, objectKey } from '../lib/storage/keys.ts'

const USER = '3f2b8c1e-9d4a-4b6e-8a17-5c2d9e0f1a34'
const HASH = 'a'.repeat(64)

test('key layout is u/{user_id}/{sha256}', () => {
  assert.equal(objectKey(USER, HASH), `u/${USER}/${HASH}`)
})

test('a path-like or malformed hash can never become part of a key', () => {
  for (const bad of ['../' + 'a'.repeat(61), 'a'.repeat(63), 'A'.repeat(64), 'a'.repeat(64) + '/x', '', 'u/other/' + 'a'.repeat(56)]) {
    assert.throws(() => objectKey(USER, bad), /content hash/)
    assert.equal(isSha256Hex(bad), false)
  }
})

test('a user id that is not a uuid (e.g. a client-supplied path) is rejected', () => {
  for (const bad of ['../etc', 'u/other', '', USER + '/x', 'not-a-uuid']) {
    assert.throws(() => objectKey(bad, HASH), /user id/)
  }
})

test('isSha256Hex rejects non-strings', () => {
  for (const bad of [undefined, null, 5, {}, ['a'.repeat(64)]]) assert.equal(isSha256Hex(bad), false)
})
