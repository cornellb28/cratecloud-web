import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/LoginForm'
import { Card } from '@/components/ui'
import { getUser } from '@/lib/auth'
import { safeNext } from '@/lib/safe-next'
import { BRAND } from '@/lib/site'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>
}) {
  const params = await searchParams

  // Same-site relative path only (see safeNext) — anything else is an open redirect.
  const next = safeNext(params.next)

  if (await getUser()) redirect(next)

  return (
    <div className="mx-auto max-w-sm px-6 py-20">
      <h1 className="mb-2 text-2xl font-medium text-ink">Sign in</h1>
      <p className="mb-7 text-[12px] leading-relaxed text-muted">
        Use the same account you use in the {BRAND} desktop app — that is what ties a
        subscription bought here to the library on your machine.
      </p>
      <Card>
        <LoginForm
          next={next}
          initialError={params.error}
          initialMode={params.mode === 'signup' ? 'sign-up' : 'sign-in'}
        />
      </Card>
    </div>
  )
}
