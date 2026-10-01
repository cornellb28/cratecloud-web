import type { Metadata } from 'next'
import { ButtonLink, Card } from '@/components/ui'

export const metadata: Metadata = { title: 'Checkout cancelled' }

export default function CancelledPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <Card>
        <h1 className="text-xl font-medium text-ink">Checkout cancelled</h1>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Nothing was charged. The desktop app is free and stays that way — come back whenever you
          want your library on more than one machine.
        </p>
        <div className="mt-6 flex gap-2">
          <ButtonLink href="/pricing">Back to pricing</ButtonLink>
          <ButtonLink href="/" variant="ghost">
            Home
          </ButtonLink>
        </div>
      </Card>
    </div>
  )
}
