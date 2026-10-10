// Run: node --test tests/*.test.mts
// Signing is offline, so these use a real S3Client with dummy credentials.
// The real Backblaze service is never contacted.
import test from 'node:test'
import assert from 'node:assert/strict'
import { S3Client } from '@aws-sdk/client-s3'
import { createObjectStorage } from '../lib/storage/b2-core.ts'
import { PRESIGN_EXPIRES_SECONDS } from '../lib/storage/config.ts'

const USER = '3f2b8c1e-9d4a-4b6e-8a17-5c2d9e0f1a34'
const KEY = `u/${USER}/${'a'.repeat(64)}`

function client() {
  return new S3Client({
    region: 'us-west-004',
    endpoint: 'https://s3.us-west-004.example.invalid',
    credentials: { accessKeyId: 'DUMMYKEYID', secretAccessKey: 'dummy-secret' },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  })
}

test('presigned PUT: 15 minute expiry, the key in the path, content type signed', async () => {
  const url = new URL(await createObjectStorage(client(), 'bkt').presignPut({ key: KEY, contentType: 'audio/flac', size: 1234 }))
  assert.equal(url.searchParams.get('X-Amz-Expires'), String(PRESIGN_EXPIRES_SECONDS))
  assert.equal(PRESIGN_EXPIRES_SECONDS, 900)
  assert.ok(url.pathname.endsWith(KEY) || url.hostname.startsWith('bkt.'), url.toString())
  assert.ok(decodeURIComponent(url.pathname).includes(KEY))
  assert.match(url.searchParams.get('X-Amz-SignedHeaders') ?? '', /content-type/)
  assert.ok(url.searchParams.get('X-Amz-Signature'))
})

test('presigned GET: 15 minute expiry and no content-type constraint on the request', async () => {
  const url = new URL(await createObjectStorage(client(), 'bkt').presignGet({ key: KEY, contentType: 'audio/mpeg' }))
  assert.equal(url.searchParams.get('X-Amz-Expires'), '900')
  assert.ok(decodeURIComponent(url.pathname).includes(KEY))
  assert.equal(url.searchParams.get('response-content-type'), 'audio/mpeg')
})

test('head maps S3 output; a 404 becomes null', async () => {
  const fake = {
    send: async () => ({ ContentLength: 42, VersionId: 'v9' })
  } as unknown as S3Client
  assert.deepEqual(await createObjectStorage(fake, 'bkt').head(KEY), { size: 42, versionId: 'v9' })

  const missing = {
    send: async () => {
      throw Object.assign(new Error('NotFound'), { $metadata: { httpStatusCode: 404 } })
    }
  } as unknown as S3Client
  assert.equal(await createObjectStorage(missing, 'bkt').head(KEY), null)

  const broken = {
    send: async () => {
      throw Object.assign(new Error('boom'), { $metadata: { httpStatusCode: 500 } })
    }
  } as unknown as S3Client
  await assert.rejects(createObjectStorage(broken, 'bkt').head(KEY), /boom/)
})

test('deleteVersion sends the VersionId; hideObject sends none (delete marker)', async () => {
  const sent: Array<Record<string, unknown>> = []
  const fake = {
    send: async (cmd: { input: Record<string, unknown>; constructor: { name: string } }) => {
      sent.push({ cmd: cmd.constructor.name, ...cmd.input })
      return {}
    }
  } as unknown as S3Client
  const s = createObjectStorage(fake, 'bkt')
  await s.deleteVersion(KEY, 'ver-7')
  await s.hideObject(KEY)
  assert.deepEqual(sent[0], { cmd: 'DeleteObjectCommand', Bucket: 'bkt', Key: KEY, VersionId: 'ver-7' })
  assert.deepEqual(sent[1], { cmd: 'DeleteObjectCommand', Bucket: 'bkt', Key: KEY })
})
