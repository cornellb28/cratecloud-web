// ── Backblaze B2 (S3-compatible) object operations ────────────────────────
// No env and no `server-only`, so tests can drive it with a dummy client.
// Only signed PUT and GET URLs are used: B2 does not support browser POST
// uploads, object tagging or object-level ACLs, and access rules live in the
// route handlers, not on the bucket.

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PRESIGN_EXPIRES_SECONDS } from './config.ts'
import type { ObjectStorage } from './types.ts'

export function createObjectStorage(client: S3Client, bucket: string): ObjectStorage {
  return {
    async presignPut({ key, contentType, size }) {
      return getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }),
        {
          expiresIn: PRESIGN_EXPIRES_SECONDS,
          // The SDK signs content-length but NOT content-type by default. Sign it
          // too, so the client must upload with exactly the allow-listed type.
          signableHeaders: new Set(['content-type'])
        }
      )
    },

    async presignGet({ key, contentType }) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentType: contentType }),
        { expiresIn: PRESIGN_EXPIRES_SECONDS }
      )
    },

    async head(key) {
      try {
        const out = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        return { size: Number(out.ContentLength ?? -1), versionId: out.VersionId ?? null }
      } catch (err) {
        const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        if (status === 404) return null
        throw err
      }
    },

    // With a VersionId this deletes that version permanently and immediately.
    async deleteVersion(key, versionId) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key, VersionId: versionId }))
    },

    // Without a VersionId on a versioned bucket this inserts a delete marker,
    // i.e. hides the file. The bucket lifecycle rule (daysFromHidingToDeleting
    // = 14, configured in the Backblaze console) removes it later.
    async hideObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    }
  }
}
