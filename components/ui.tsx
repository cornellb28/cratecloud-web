// Small shared primitives. Deliberately not a component library — this site
// is eight pages and a design system would be more code than the site.

import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

// Marketing + account-chip buttons: pill-shaped, one accent. `pillLight` is
// the quiet secondary (e.g. Sign up) so a screen keeps a single accent CTA.
const PILL =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'

export const VARIANT = {
  primary: `${BASE} bg-accent text-white hover:bg-accent/85`,
  outline: `${BASE} border border-line text-ink hover:border-accent/50 hover:text-accent`,
  ghost: `${BASE} text-muted hover:text-ink`,
  pill: `${PILL} bg-accent text-white hover:scale-[1.03] hover:bg-accent/90`,
  pillLg: `${PILL} bg-accent px-8 py-3.5 text-[15px] text-white hover:scale-[1.03] hover:bg-accent/90`,
  pillLight: `${PILL} bg-ink text-page hover:scale-[1.03] hover:bg-white`,
  pillOutline: `${PILL} border border-line text-ink hover:border-ink`
} as const

export type Variant = keyof typeof VARIANT

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return <button className={`${VARIANT[variant]} ${className}`} {...props} />
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${VARIANT[variant]} ${className}`} {...props} />
}

export function Card({
  children,
  className = '',
  accent = false
}: {
  children: ReactNode
  className?: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-lg border bg-surface p-5 ${
        accent ? 'border-accent/30' : 'border-line'
      } ${className}`}
    >
      {children}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.8px] text-faint">
      {children}
    </div>
  )
}

export function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-2">
      <span className="mt-px text-ok" aria-hidden>
        ✓
      </span>
      <span>{children}</span>
    </li>
  )
}

// Errors and notices surfaced from a query param or a failed fetch.
export function Notice({ kind = 'error', children }: { kind?: 'error' | 'info'; children: ReactNode }) {
  const tone = kind === 'error' ? 'border-warn/40 text-warn' : 'border-line text-muted'
  return (
    <div className={`rounded-md border px-3 py-2 text-[12px] ${tone}`} role="status">
      {children}
    </div>
  )
}
