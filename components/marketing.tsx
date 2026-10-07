// Marketing-page building blocks (Spotify-influenced: oversized type, pills,
// lifted cards). Colors/sizes come from the @theme tokens in globals.css.

import type { ReactNode } from 'react'

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-[12px] font-semibold uppercase tracking-[1.4px] text-accent">{children}</p>
  )
}

// One feature, alternating sides on wide screens. `visual` is a decorative
// panel, hidden from assistive tech.
export function FeatureRow({
  eyebrow,
  title,
  body,
  visual,
  reverse = false
}: {
  eyebrow: string
  title: string
  body: string
  visual: ReactNode
  reverse?: boolean
}) {
  return (
    <div className="grid items-center gap-10 py-14 md:grid-cols-2 md:gap-16 md:py-20">
      <div className={reverse ? 'md:order-2' : ''}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="text-headline font-bold text-ink">{title}</h3>
        <p className="mt-5 max-w-md text-[16px] leading-relaxed text-muted">{body}</p>
      </div>
      <div
        aria-hidden
        className={`rounded-3xl bg-surface p-6 shadow-lift sm:p-8 ${reverse ? 'md:order-1' : ''}`}
      >
        {visual}
      </div>
    </div>
  )
}

export function Chip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[12px] font-medium ${
        active ? 'bg-accent text-white' : 'bg-surface-3 text-ink-2'
      }`}
    >
      {children}
    </span>
  )
}
