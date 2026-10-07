import type { Metadata } from 'next'
import { Eyebrow } from '@/components/marketing'
import { CONTACT_EMAIL } from '@/lib/site'

export const metadata: Metadata = { title: 'Cloud & Mobile' }

const PILLS =
  'inline-flex items-center justify-center rounded-full px-8 py-3.5 text-[15px] font-semibold'

const ITEMS = [
  {
    title: 'Cloud sync',
    body: 'Keep your tags, crates and play history in step across every computer you use. Edit on one machine, pick up on the next.'
  },
  {
    title: 'Mobile',
    body: 'Browse your library and crates from your phone — at the venue, in the car, on the sofa.'
  },
  {
    title: 'Your files stay yours',
    body: 'Only your library data is synced. Your audio files stay exactly where they are.'
  }
]

export default function CloudMobilePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
      <header className="mx-auto max-w-3xl text-center">
        <Eyebrow>Coming soon</Eyebrow>
        <h1 className="text-display font-extrabold text-ink">Cloud &amp; Mobile.</h1>
        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
          Carry the same library between machines — and onto your phone. The desktop app stays free; this
          is the optional extra.
        </p>
      </header>

      {/* No plans, prices or limits on purpose — pricing is undecided. */}
      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {ITEMS.map((i) => (
          <div key={i.title} className="rounded-3xl bg-surface p-7">
            <h2 className="text-[17px] font-bold text-ink">{i.title}</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{i.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 text-center">
        {/* TODO(waitlist): a real waitlist needs a table — ask before creating one. */}
        {CONTACT_EMAIL ? (
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Notify me about Cloud & Mobile')}`}
            className={`${PILLS} bg-accent text-white transition hover:scale-[1.03] hover:bg-accent/90`}
          >
            Notify me
          </a>
        ) : (
          <>
            <span aria-disabled="true" className={`${PILLS} cursor-not-allowed bg-accent text-white opacity-50`}>
              Notify me
            </span>
            <p className="mt-3 text-[12px] text-faint">Set NEXT_PUBLIC_CONTACT_EMAIL to enable this.</p>
          </>
        )}
      </div>
    </div>
  )
}
