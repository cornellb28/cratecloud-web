// Mocked ObjectStorage: records every call, never touches the network.
import type { ObjectStorage } from '../../lib/storage/types.ts'

export function createFakeStorage(opts: { failDelete?: boolean; failHide?: boolean; failPresign?: boolean } = {}) {
  const calls: Array<{ op: string; key?: string; versionId?: string; contentType?: string; size?: number }> = []
  const objects = new Map<string, { size: number; versionId: string }>()
  let n = 0

  const storage: ObjectStorage = {
    async presignPut({ key, contentType, size }) {
      if (opts.failPresign) throw new Error('presign boom')
      calls.push({ op: 'presignPut', key, contentType, size })
      return `https://example.invalid/put/${key}?sig=fake`
    },
    async presignGet({ key, contentType }) {
      calls.push({ op: 'presignGet', key, contentType })
      return `https://example.invalid/get/${key}?sig=fake`
    },
    async head(key) {
      calls.push({ op: 'head', key })
      const o = objects.get(key)
      return o ? { size: o.size, versionId: o.versionId } : null
    },
    async deleteVersion(key, versionId) {
      calls.push({ op: 'deleteVersion', key, versionId })
      if (opts.failDelete) throw new Error('delete boom')
      objects.delete(key)
    },
    async hideObject(key) {
      calls.push({ op: 'hideObject', key })
      if (opts.failHide) throw new Error('hide boom')
    }
  }

  return {
    storage,
    calls,
    // Simulate the client having uploaded to the signed URL.
    simulateUpload(key: string, size: number) {
      objects.set(key, { size, versionId: `ver-${++n}` })
    }
  }
}
