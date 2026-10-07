// Claude-style settings layout: sectioned rows with the label and
// description on the left, the value or control on the right, thin dividers,
// no cards. Server-safe.

import type { ReactNode } from 'react'

export function SettingsPage({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      {description && <p className="mt-1.5 text-[13px] text-muted">{description}</p>}
      <div className="mt-8 flex flex-col gap-10">{children}</div>
    </div>
  )
}

export function SettingsSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="mb-1 text-[15px] font-semibold text-ink">{title}</h2>}
      <div className="divide-y divide-line-soft border-y border-line-soft">{children}</div>
    </section>
  )
}

export function SettingsRow({
  label,
  description,
  children
}: {
  label: string
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0 sm:max-w-[45%]">
        <p className="text-[14px] font-medium text-ink">{label}</p>
        {description && <p className="mt-1 text-[12px] leading-relaxed text-muted">{description}</p>}
      </div>
      {children != null && <div className="min-w-0 text-[14px] text-ink-2 sm:text-right">{children}</div>}
    </div>
  )
}
