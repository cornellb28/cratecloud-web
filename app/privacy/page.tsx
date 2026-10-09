import type { Metadata } from 'next'
import { PolicyText } from '@/components/PolicyText'
import { POLICY_CONFIG, SECTIONS, SUMMARY } from '@/lib/privacy-policy'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How DeepCrated handles your information: local-first by default, optional accounts, and what is stored if you use cloud sync and mobile.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true }
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      {!POLICY_CONFIG.policyReviewed && (
        <div role="note" className="mb-8 rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-[14px] text-warn">
          <strong className="font-semibold">Draft:</strong> this policy is pending review and may change before
          launch.
        </div>
      )}

      <h1 className="text-headline font-extrabold text-ink">DeepCrated Privacy Policy</h1>
      <p className="mt-3 text-[14px] text-muted">Last updated: {formatDate(POLICY_CONFIG.lastUpdated)}</p>

      <section aria-labelledby="summary-heading" className="mt-8 rounded-2xl bg-surface p-6 shadow-lift">
        <h2 id="summary-heading" className="text-[16px] font-bold text-ink">
          The short version
        </h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[14px] leading-relaxed text-ink-2">
          {SUMMARY.map((item) => (
            <li key={item}>
              <PolicyText text={item} />
            </li>
          ))}
        </ul>
      </section>

      <nav aria-label="Table of contents" className="mt-10">
        <h2 className="text-[13px] font-semibold uppercase tracking-[1.2px] text-faint">Contents</h2>
        <ol className="mt-3 grid list-decimal gap-x-8 gap-y-1.5 pl-5 text-[14px] text-muted sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="underline-offset-2 transition-colors hover:text-ink hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 flex flex-col gap-10">
        {SECTIONS.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
            <h2 id={`${s.id}-h`} className="text-[20px] font-bold text-ink">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-ink-2">
              {s.blocks.map((b, j) =>
                b.type === 'p' ? (
                  <p key={j}>
                    <PolicyText text={b.text} />
                  </p>
                ) : (
                  <ul key={j} className="flex list-disc flex-col gap-1.5 pl-5">
                    {b.items.map((item) => (
                      <li key={item}>
                        <PolicyText text={item} />
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
