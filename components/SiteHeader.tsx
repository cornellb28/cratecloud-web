import Link from 'next/link'
import { Suspense } from 'react'
import { BRAND } from '@/lib/site'
import { AccountChip, AccountChipSkeleton } from '@/components/AccountChip'

const LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/cloud-mobile', label: 'Cloud & Mobile' },
  { href: '/download', label: 'Download' }
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-page/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <span className="text-accent" aria-hidden>
            ◫
          </span>
          {BRAND}
        </Link>

        <nav
          aria-label="Main"
          className="order-3 -mx-1 flex w-full items-center gap-5 overflow-x-auto text-[13px] font-medium text-muted sm:order-none sm:mx-0 sm:w-auto sm:flex-1"
        >
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap px-1 py-1 transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>

        <Suspense fallback={<AccountChipSkeleton />}>
          <AccountChip />
        </Suspense>
      </div>
    </header>
  )
}
