import { downloadUrl } from '@/lib/storage/handlers'
import { runStorageRoute } from '@/lib/storage/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return runStorageRoute(request, downloadUrl)
}
