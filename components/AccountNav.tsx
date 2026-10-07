'use client'

// Sidebar on wide screens, a horizontal tab bar on mobile — same links, so it
// works without JS beyond the active highlight.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/account', label: 'Profile' },
  { href: '/account/billing', label: 'Billing' },
  { href: '/account/security', label: 'Security' },
  { href: '/account/devices', label: 'Devices' }
]

export function AccountNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Account"
      className="-mx-6 flex gap-1 overflow-x-auto border-b border-line-soft px-6 pb-3 md:mx-0 md:w-52 md:shrink-0 md:flex-col md:overflow-visible md:border-0 md:px-0 md:pb-0"
    >
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-medium transition-colors ${
              active ? 'bg-surface-3 text-ink' : 'text-muted hover:bg-surface hover:text-ink'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
