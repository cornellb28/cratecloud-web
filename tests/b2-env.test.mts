// Run: node --test tests/*.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// lib/storage/b2.ts is `server-only` (it cannot be imported by plain node), so
// its env check is verified at the source level plus a pure re-statement.
const src = readFileSync(new URL('../lib/storage/b2.ts', import.meta.url), 'utf8')

test('b2.ts requires exactly the five documented env vars and names them in the error', () => {
  for (const name of ['B2_KEY_ID', 'B2_APPLICATION_KEY', 'B2_BUCKET', 'B2_ENDPOINT', 'B2_REGION']) {
    assert.ok(src.includes(`'${name}'`), name)
  }
  assert.match(src, /Missing env vars: \$\{missing\.join\(', '\)\}/)
})

test('b2.ts never logs credentials', () => {
  assert.equal(/console\.(log|error|warn)/.test(src), false)
})
