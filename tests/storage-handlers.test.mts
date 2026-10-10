// Run: node --test tests/*.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { completeUpload, deleteObject, downloadUrl, uploadUrl, type Deps } from '../lib/storage/handlers.ts'
import { GB, MAX_FILE_BYTES } from '../lib/storage/config.ts'
import { createMemoryStore } from './helpers/memory-store.mts'
import { createFakeStorage } from './helpers/fake-storage.mts'

const USER = '3f2b8c1e-9d4a-4b6e-8a17-5c2d9e0f1a34'
const OTHER = '9a1c2d3e-4f50-4a6b-8c7d-0e1f2a3b4c5d'
const NOW = new Date('2026-10-09T12:00:00Z')
const h = (c: string) => c.repeat(64)

const SYNC = { plan: 'sync', status: 'active', current_period_end: null }
const FREE = { plan: 'free', status: 'active', current_period_end: null }

function setup(opts: {
  entitlement?: { plan: string; status: string; current_period_end: string | null } | null
  readOnlyUntil?: Record<string, Date>
  storage?: Parameters<typeof createFakeStorage>[0]
} = {}) {
  const clock = { now: NOW }
  const mem = createMemoryStore({ readOnlyUntil: opts.readOnlyUntil, now: () => clock.now })
  const fake = createFakeStorage(opts.storage)
  const logs: string[] = []
  let entitlement = opts.entitlement === undefined ? SYNC : opts.entitlement
  const deps: Deps = {
    store: mem.store,
    storage: fake.storage,
    getEntitlement: async () => entitlement,
    now: () => clock.now,
    log: (e) => logs.push(e)
  }
  return { deps, mem, fake, logs, clock, setEntitlement: (e: typeof entitlement) => (entitlement = e) }
}

// Files are limited to 1 GB each, so filling a cap takes several uploads.
async function fill(ctx: ReturnType<typeof setup>, gb: number, prefix = 0) {
  for (let i = 0; i < gb; i++) {
    const r = await uploadUrl(ctx.deps, USER, upload((prefix + i).toString(16).padStart(64, '0'), 1 * GB))
    assert.equal(r.status, 200)
  }
}

const upload = (hash: string, size: number, contentType = 'audio/mpeg') => ({ hash, sizeBytes: size, contentType })

// ── upload-url ────────────────────────────────────────────────────────────
test('upload-url reserves bytes and signs a PUT for u/{user}/{hash}', async () => {
  const { deps, mem, fake } = setup()
  const r = await uploadUrl(deps, USER, upload(h('a'), 1 * GB))
  assert.equal(r.status, 200)
  assert.equal(r.body.status, 'upload')
  assert.equal(r.body.method, 'PUT')
  assert.equal(fake.calls[0].key, `u/${USER}/${h('a')}`)
  assert.deepEqual(mem.usage(USER), { used: 0, reserved: 1 * GB })
})

test('a client-supplied key, path or user id in the body is ignored', async () => {
  const { deps, fake } = setup()
  await uploadUrl(deps, USER, { ...upload(h('b'), 1000), key: 'u/' + OTHER + '/x', path: '../../etc', userId: OTHER, user_id: OTHER, capBytes: 999 * GB })
  assert.equal(fake.calls[0].key, `u/${USER}/${h('b')}`)
})

test('exactly filling the cap is allowed; one byte more is OVER_CAP', async () => {
  const ctx = setup() // sync = 10 GB
  await fill(ctx, 9, 100) // 9 GB reserved
  const half = await uploadUrl(ctx.deps, USER, upload(h('b'), GB / 2)) // 9.5 GB, 0.5 GB left
  assert.equal(half.status, 200)
  const over = await uploadUrl(ctx.deps, USER, upload(h('c'), GB / 2 + 1)) // one byte too many
  assert.equal(over.status, 409)
  assert.equal((over.body.error as { code: string }).code, 'OVER_CAP')
  assert.equal((over.body.error as { capBytes: number }).capBytes, 10 * GB)
  const exact = await uploadUrl(ctx.deps, USER, upload(h('d'), GB / 2)) // exactly fills the cap
  assert.equal(exact.status, 200)
  assert.equal(ctx.mem.usage(USER).reserved, 10 * GB)
  const one = await uploadUrl(ctx.deps, USER, upload(h('e'), 1)) // full: even 1 byte is refused
  assert.equal(one.status, 409)
})

test('concurrent reservations cannot exceed the cap', async () => {
  const { deps, mem } = setup() // 10 GB cap, 1 GB files, 25 parallel uploads
  const results = await Promise.all(
    Array.from({ length: 25 }, (_, i) => uploadUrl(deps, USER, upload(i.toString(16).padStart(64, '0'), 1 * GB)))
  )
  const ok = results.filter((r) => r.status === 200).length
  const over = results.filter((r) => r.status === 409).length
  assert.equal(ok, 10)
  assert.equal(over, 15)
  assert.equal(mem.usage(USER).reserved, 10 * GB)
})

test('parallel uploads of the SAME file reserve its bytes once', async () => {
  const { deps, mem } = setup()
  const results = await Promise.all(Array.from({ length: 5 }, () => uploadUrl(deps, USER, upload(h('d'), 1 * GB))))
  assert.ok(results.every((r) => r.status === 200))
  assert.equal(mem.usage(USER).reserved, 1 * GB)
})

test('stale pending reservations are released after 30 minutes', async () => {
  const ctx = setup()
  await fill(ctx, 10) // cap full of pending reservations
  assert.equal((await uploadUrl(ctx.deps, USER, upload(h('b'), 1 * GB))).status, 409)
  ctx.clock.now = new Date(NOW.getTime() + 29 * 60 * 1000) // not stale yet
  assert.equal((await uploadUrl(ctx.deps, USER, upload(h('b'), 1 * GB))).status, 409)
  ctx.clock.now = new Date(NOW.getTime() + 31 * 60 * 1000) // abandoned uploads no longer count
  assert.equal((await uploadUrl(ctx.deps, USER, upload(h('b'), 1 * GB))).status, 200)
  assert.equal(ctx.mem.usage(USER).reserved, 1 * GB)
})

test('dedupe is per user: the same hash for a different user is a fresh reservation', async () => {
  const { deps, mem, fake } = setup()
  const a = await uploadUrl(deps, USER, upload(h('e'), 1000))
  fake.simulateUpload(`u/${USER}/${h('e')}`, 1000)
  await completeUpload(deps, USER, { hash: h('e') })
  const again = await uploadUrl(deps, USER, upload(h('e'), 1000))
  assert.equal(again.body.status, 'already_stored')
  const theirs = await uploadUrl(deps, OTHER, upload(h('e'), 1000))
  assert.equal(theirs.body.status, 'upload')
  assert.equal(a.status, 200)
  assert.equal(mem.usage(OTHER).reserved, 1000)
  assert.equal(fake.calls.filter((c) => c.op === 'presignPut').at(-1)?.key, `u/${OTHER}/${h('e')}`)
})

test('input validation: type allow-list, size limit, hash, body shape', async () => {
  const { deps } = setup()
  assert.equal((await uploadUrl(deps, USER, upload(h('a'), 100, 'application/zip'))).status, 415)
  assert.equal((await uploadUrl(deps, USER, upload(h('a'), 100, 'text/html'))).status, 415)
  assert.equal((await uploadUrl(deps, USER, upload(h('a'), MAX_FILE_BYTES + 1))).status, 413)
  assert.equal((await uploadUrl(deps, USER, upload(h('a'), MAX_FILE_BYTES))).status, 200)
  assert.equal((await uploadUrl(deps, USER, upload('nothex', 100))).status, 400)
  assert.equal((await uploadUrl(deps, USER, upload(h('a'), 0))).status, 400)
  assert.equal((await uploadUrl(deps, USER, upload(h('a'), 1.5))).status, 400)
  assert.equal((await uploadUrl(deps, USER, { hash: h('a'), sizeBytes: '100', contentType: 'audio/mpeg' })).status, 400)
  assert.equal((await uploadUrl(deps, USER, null)).status, 400)
  assert.equal((await uploadUrl(deps, USER, [1])).status, 400)
})

test('free users and users with no row are NOT_ENTITLED', async () => {
  for (const ent of [FREE, null]) {
    const { deps } = setup({ entitlement: ent })
    const r = await uploadUrl(deps, USER, upload(h('a'), 100))
    assert.equal(r.status, 403)
    assert.equal((r.body.error as { code: string }).code, 'NOT_ENTITLED')
  }
})

test('cancelled users in the read-only window get READ_ONLY on upload', async () => {
  const { deps } = setup({
    entitlement: { plan: 'free', status: 'canceled', current_period_end: null },
    readOnlyUntil: { [USER]: new Date('2026-12-01T00:00:00Z') }
  })
  const r = await uploadUrl(deps, USER, upload(h('a'), 100))
  assert.equal((r.body.error as { code: string }).code, 'READ_ONLY')
})

test('if signing fails the reservation is released and the error is generic', async () => {
  const { deps, mem } = setup({ storage: { failPresign: true } })
  const r = await uploadUrl(deps, USER, upload(h('a'), 1 * GB))
  assert.equal(r.status, 500)
  assert.equal(JSON.stringify(r.body).includes('boom'), false)
  assert.equal(mem.usage(USER).reserved, 0)
})

// ── complete ──────────────────────────────────────────────────────────────
test('complete: HEAD confirms the size, marks active, moves reserved to used', async () => {
  const { deps, mem, fake } = setup()
  await uploadUrl(deps, USER, upload(h('a'), 1 * GB))
  fake.simulateUpload(`u/${USER}/${h('a')}`, 1 * GB)
  const r = await completeUpload(deps, USER, { hash: h('a') })
  assert.equal(r.body.status, 'active')
  assert.deepEqual(mem.usage(USER), { used: 1 * GB, reserved: 0 })
  assert.equal(mem.rows()[0].versionId, 'ver-1')
})

test('complete before the upload finishes is NOT_UPLOADED and keeps the reservation', async () => {
  const { deps, mem } = setup()
  await uploadUrl(deps, USER, upload(h('a'), 1 * GB))
  const r = await completeUpload(deps, USER, { hash: h('a') })
  assert.equal((r.body.error as { code: string }).code, 'NOT_UPLOADED')
  assert.equal(mem.usage(USER).reserved, 1 * GB)
})

test('complete with the wrong size releases the reservation and deletes the stray version', async () => {
  const { deps, mem, fake } = setup()
  await uploadUrl(deps, USER, upload(h('a'), 1 * GB))
  fake.simulateUpload(`u/${USER}/${h('a')}`, 1 * GB - 1)
  const r = await completeUpload(deps, USER, { hash: h('a') })
  assert.equal((r.body.error as { code: string }).code, 'SIZE_MISMATCH')
  assert.deepEqual(mem.usage(USER), { used: 0, reserved: 0 })
  assert.ok(fake.calls.some((c) => c.op === 'deleteVersion'))
})

test('complete for something never reserved is NOT_FOUND', async () => {
  const { deps } = setup()
  assert.equal((await completeUpload(deps, USER, { hash: h('f') })).status, 404)
})

// ── download-url ──────────────────────────────────────────────────────────
async function stored(ctx: ReturnType<typeof setup>, hash: string, size: number) {
  await uploadUrl(ctx.deps, USER, upload(hash, size))
  ctx.fake.simulateUpload(`u/${USER}/${hash}`, size)
  await completeUpload(ctx.deps, USER, { hash })
}

test('download-url signs a GET for an active object of the caller', async () => {
  const ctx = setup()
  await stored(ctx, h('a'), 1000)
  const r = await downloadUrl(ctx.deps, USER, { hash: h('a') })
  assert.equal(r.status, 200)
  assert.equal(ctx.fake.calls.at(-1)?.key, `u/${USER}/${h('a')}`)
})

test("one user cannot get a URL for another user's object", async () => {
  const ctx = setup()
  await stored(ctx, h('a'), 1000)
  const r = await downloadUrl(ctx.deps, OTHER, { hash: h('a') })
  assert.equal(r.status, 404)
  assert.equal(ctx.fake.calls.filter((c) => c.op === 'presignGet').length, 0)
})

test('downloads work in the read-only window and stop after it', async () => {
  const ctx = setup()
  await stored(ctx, h('a'), 1000)
  ctx.setEntitlement({ plan: 'free', status: 'canceled', current_period_end: null })
  assert.equal((await downloadUrl(ctx.deps, USER, { hash: h('a') })).status, 403) // no window recorded
  const inWindow = setup({ entitlement: { plan: 'free', status: 'canceled', current_period_end: null }, readOnlyUntil: { [USER]: new Date('2026-12-01T00:00:00Z') } })
  await inWindow.mem.store.reserve({ userId: USER, hash: h('a'), size: 1000, contentType: 'audio/mpeg', capBytes: 10 * GB, staleBefore: new Date(0) })
  await inWindow.mem.store.complete({ userId: USER, hash: h('a'), size: 1000, versionId: 'v1' })
  assert.equal((await downloadUrl(inWindow.deps, USER, { hash: h('a') })).status, 200)
})

test('after a downgrade (over the cap) uploads are blocked but downloads and deletes work', async () => {
  const ctx = setup({ entitlement: { plan: 'library', status: 'active', current_period_end: null } }) // 250 GB
  // Seed 100 GB of stored audio directly (files are limited to 1 GB per upload).
  await ctx.mem.store.reserve({ userId: USER, hash: h('a'), size: 100 * GB, contentType: 'audio/flac', capBytes: 250 * GB, staleBefore: new Date(0) })
  await ctx.mem.store.complete({ userId: USER, hash: h('a'), size: 100 * GB, versionId: 'v1' })
  ctx.setEntitlement(SYNC) // now a 10 GB cap with 100 GB stored
  const up = await uploadUrl(ctx.deps, USER, upload(h('b'), 1))
  assert.equal((up.body.error as { code: string }).code, 'OVER_CAP')
  assert.equal((await downloadUrl(ctx.deps, USER, { hash: h('a') })).status, 200)
  assert.equal((await deleteObject(ctx.deps, USER, { hash: h('a'), mode: 'hide' })).status, 200)
  // nothing was purged automatically, and usage dropped so uploads work again
  assert.equal(ctx.mem.usage(USER).used, 0)
  assert.equal((await uploadUrl(ctx.deps, USER, upload(h('b'), 1))).status, 200)
})

// ── delete ────────────────────────────────────────────────────────────────
test('delete hide: bytes stop counting, delete marker requested, no version deleted', async () => {
  const ctx = setup()
  await stored(ctx, h('a'), 1 * GB)
  const r = await deleteObject(ctx.deps, USER, { hash: h('a'), mode: 'hide' })
  assert.equal(r.body.status, 'hidden')
  assert.equal(ctx.mem.usage(USER).used, 0)
  assert.ok(ctx.fake.calls.some((c) => c.op === 'hideObject'))
  assert.equal(ctx.fake.calls.some((c) => c.op === 'deleteVersion'), false)
  // hidden objects can no longer be downloaded
  assert.equal((await downloadUrl(ctx.deps, USER, { hash: h('a') })).status, 404)
})

test('delete hide is idempotent and re-sends the S3 call so a failed first try heals', async () => {
  const ctx = setup()
  await stored(ctx, h('a'), 1000)
  await deleteObject(ctx.deps, USER, { hash: h('a'), mode: 'hide' })
  const again = await deleteObject(ctx.deps, USER, { hash: h('a'), mode: 'hide' })
  assert.equal(again.status, 200)
  assert.equal(ctx.fake.calls.filter((c) => c.op === 'hideObject').length, 2)
})

test('delete purge removes the stored version by id and drops the record', async () => {
  const ctx = setup()
  await stored(ctx, h('a'), 1 * GB)
  const r = await deleteObject(ctx.deps, USER, { hash: h('a'), mode: 'purge' })
  assert.equal(r.body.status, 'purged')
  const del = ctx.fake.calls.find((c) => c.op === 'deleteVersion')
  assert.equal(del?.versionId, 'ver-1')
  assert.equal(del?.key, `u/${USER}/${h('a')}`)
  assert.equal(ctx.mem.rows().length, 0)
  assert.equal(ctx.mem.usage(USER).used, 0)
})

test('delete purge failing at S3 returns a generic error and falls back to hiding', async () => {
  const ctx = setup({ storage: { failDelete: true } })
  await stored(ctx, h('a'), 1000)
  const r = await deleteObject(ctx.deps, USER, { hash: h('a'), mode: 'purge' })
  assert.equal(r.status, 500)
  assert.equal(JSON.stringify(r.body).includes('boom'), false)
  assert.ok(ctx.fake.calls.some((c) => c.op === 'hideObject')) // lifecycle rule will clean up
  assert.equal(ctx.mem.rows().length, 1) // record kept for a retry
})

test('delete validates mode and hash; unknown object is NOT_FOUND', async () => {
  const { deps } = setup()
  assert.equal((await deleteObject(deps, USER, { hash: h('a'), mode: 'nuke' })).status, 400)
  assert.equal((await deleteObject(deps, USER, { hash: 'x', mode: 'hide' })).status, 400)
  assert.equal((await deleteObject(deps, USER, { hash: h('a'), mode: 'hide' })).status, 404)
})

test('error bodies never contain keys, urls or internal messages', async () => {
  const ctx = setup({ storage: { failPresign: true } })
  const r = await uploadUrl(ctx.deps, USER, upload(h('a'), 100))
  const text = JSON.stringify(r.body)
  assert.ok(!/https?:|u\/|secret|key/i.test(text.replace('Something went wrong. Please try again.', '')))
  assert.ok(ctx.logs.length > 0)
})
