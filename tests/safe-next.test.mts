// Run: node --test tests/*.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { safeNext, DEFAULT_NEXT } from '../lib/safe-next.ts'

const UNSAFE: Array<[string, unknown]> = [
  ['//evil.com', '//evil.com'],
  ['/\\evil.com', '/\\evil.com'],
  ['https://evil.com', 'https://evil.com'],
  ['/%2F/evil.com', '/%2F/evil.com'],
  ['%2F%2Fevil.com', '%2F%2Fevil.com'],
  ['/\\/evil.com', '/\\/evil.com'],
  ['/%5Cevil.com', '/%5Cevil.com'],
  ['/%5cevil.com (lowercase)', '/%5cevil.com'],
  ['javascript:alert(1)', 'javascript:alert(1)'],
  ['/ tab //evil.com', '/\t/evil.com'],
  ['/ newline //evil.com', '/\n/evil.com'],
  ['/%09/evil.com', '/%09/evil.com'],
  ['/%0a/evil.com', '/%0a/evil.com'],
  ['leading space', ' /account'],
  ['trailing newline', '/account\n'],
  ['NUL byte', '/account\u0000'],
  ['unicode space', '/ /evil.com'],
  ['malformed percent', '/%E0%A4%A'],
  ['relative (no slash)', 'account'],
  ['protocol-relative with encoded colon', '//evil.com%3A80'],
  ['empty string', ''],
  ['undefined', undefined],
  ['null', null],
  ['array', ['/account', '/other']],
  ['array with evil', ['//evil.com']],
  ['number', 5],
  ['object', { toString: () => '/account' }],
  ['too long', '/' + 'a'.repeat(3000)]
]

for (const [name, value] of UNSAFE) {
  test(`rejects ${name}`, () => {
    assert.equal(safeNext(value), DEFAULT_NEXT)
  })
}

const SAFE = [
  '/account',
  '/account/billing',
  '/account?tab=x',
  '/account/billing#plan',
  '/desktop/connect?challenge=abc_DEF-123&state=ghi_JKL-456',
  '/'
]

for (const value of SAFE) {
  test(`keeps ${value}`, () => {
    assert.equal(safeNext(value), value)
  })
}

test('fallback is /account', () => {
  assert.equal(DEFAULT_NEXT, '/account')
})
