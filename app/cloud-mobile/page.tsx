import type { Metadata } from 'next'
import { Eyebrow } from '@/components/marketing'
import { ButtonLink } from '@/components/ui'

export const metadata: Metadata = { title: 'Cloud & Mobile' }

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
        <ButtonLink href="/waitlist" variant="pillLg">
          Join the waitlist
        </ButtonLink>
      </div>
    </div>
  )
}
