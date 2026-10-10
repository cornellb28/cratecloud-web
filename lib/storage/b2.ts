// ── B2 client from env ────────────────────────────────────────────────────
// The only place B2 credentials are read. Never log or return them.

import 'server-only'
import { S3Client } from '@aws-sdk/client-s3'
import { createObjectStorage } from './b2-core'
import type { ObjectStorage } from './types'

const REQUIRED = ['B2_KEY_ID', 'B2_APPLICATION_KEY', 'B2_BUCKET', 'B2_ENDPOINT', 'B2_REGION'] as const

export function missingB2Env(env: Record<string, string | undefined> = process.env): string[] {
  return REQUIRED.filter((name) => !env[name])
}

let cached: ObjectStorage | null = null

export function getObjectStorage(): ObjectStorage {
  const missing = missingB2Env()
  if (missing.length > 0) {
    // Names only; never values.
    throw new Error(`Backblaze B2 is not configured. Missing env vars: ${missing.join(', ')}`)
  }
  if (!cached) {
    const endpoint = process.env.B2_ENDPOINT!
    const client = new S3Client({
      region: process.env.B2_REGION!,
      endpoint: /^https?:\/\//.test(endpoint) ? endpoint : `https://${endpoint}`,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID!,
        secretAccessKey: process.env.B2_APPLICATION_KEY!
      },
      // Newer SDK versions add checksum headers that S3-compatible stores
      // (B2, R2) may not accept on presigned requests.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED'
    })
    cached = createObjectStorage(client, process.env.B2_BUCKET!)
  }
  return cached
}
