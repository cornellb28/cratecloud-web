import { Chip, Eyebrow, FeatureRow } from '@/components/marketing'
import { ButtonLink } from '@/components/ui'
import { BRAND } from '@/lib/site'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <section className="py-24 text-center sm:py-36">
        <Eyebrow>DJ library management</Eyebrow>
        <h1 className="mx-auto max-w-4xl text-display font-extrabold text-ink">
          Your crates, actually in order.
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-muted">
          {BRAND} tags, files and repairs your DJ library — right on your machine. The desktop app is
          free, and nothing in it is locked.
        </p>
        <div className="mt-10">
          <ButtonLink href="/download" variant="pillLg">
            Download
          </ButtonLink>
        </div>
      </section>

      <section id="features" aria-label="Features" className="scroll-mt-20 divide-y divide-line-soft">
        <FeatureRow
          eyebrow="Tagging"
          title="Tag it once. Find it in a second."
          body="Genre, energy, mood, your own labels — tag tracks fast and search the whole library instantly. Your tags are written to your files, so they go wherever the music goes."
          visual={
            <div className="flex flex-col gap-4">
              <p className="text-[15px] font-semibold text-ink">Midnight Drive — Kora</p>
              <div className="flex flex-wrap gap-2">
                <Chip active>Peak time</Chip>
                <Chip>Deep house</Chip>
                <Chip>124 BPM</Chip>
                <Chip>A minor</Chip>
                <Chip>Vocal</Chip>
              </div>
            </div>
          }
        />
        <FeatureRow
          reverse
          eyebrow="Crates & Serato"
          title="Crates you can trust."
          body="Build crates the way you think about a set. Bring in your Serato library — database, crates and history — and export back to .crate when you are done."
          visual={
            <ul className="flex flex-col gap-2 text-[14px] text-ink-2">
              {['Warm-up · 42 tracks', 'Peak time · 118 tracks', 'Closing · 27 tracks'].map((c, i) => (
                <li key={c} className={`rounded-xl px-4 py-3 ${i === 1 ? 'bg-accent/20 text-ink' : 'bg-surface-3'}`}>
                  {c}
                </li>
              ))}
            </ul>
          }
        />
        <FeatureRow
          eyebrow="Library health"
          title="Fix what's broken before the gig."
          body="Move or rename files in Finder and your tags follow. Spot missing files, duplicates and tracks that need relinking — before they surface mid-set."
          visual={
            <div className="flex flex-col gap-3 text-[13px] text-ink-2">
              {[
                ['Missing files', 'w-1/5'],
                ['Duplicates', 'w-2/5'],
                ['Untagged', 'w-3/5']
              ].map(([label, w]) => (
                <div key={label}>
                  <div className="mb-1.5 flex justify-between">
                    <span>{label}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-3">
                    <div className={`h-2 rounded-full bg-accent ${w}`} />
                  </div>
                </div>
              ))}
            </div>
          }
        />
        <FeatureRow
          reverse
          eyebrow="Import"
          title="Start from the library you already have."
          body={`No starting from zero. Point ${BRAND} at your existing library and it reads your real files, your crates and your history.`}
          visual={
            <div className="flex items-center justify-center gap-4 py-6 text-[14px] font-medium text-ink-2">
              <span className="rounded-xl bg-surface-3 px-4 py-3">Serato</span>
              <span className="text-accent">→</span>
              <span className="rounded-xl bg-accent/20 px-4 py-3 text-ink">{BRAND}</span>
            </div>
          }
        />
      </section>

      <section className="my-16 rounded-3xl bg-surface p-8 shadow-lift sm:p-14">
        <Eyebrow>Cloud &amp; Mobile</Eyebrow>
        <h2 className="max-w-2xl text-headline font-bold text-ink">Your library, on every machine.</h2>
        <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-muted">
          Sync your tags, crates and play history between computers, and browse them from your phone. Coming
          soon — your audio files always stay where they are.
        </p>
        <div className="mt-8">
          <ButtonLink href="/cloud-mobile" variant="pillOutline">
            Learn more
          </ButtonLink>
        </div>
      </section>

      <section className="py-24 text-center">
        <h2 className="mx-auto max-w-3xl text-headline font-extrabold text-ink">
          Get your library sorted tonight.
        </h2>
        <div className="mt-9">
          <ButtonLink href="/download" variant="pillLg">
            Download for free
          </ButtonLink>
        </div>
      </section>
    </div>
  )
}
