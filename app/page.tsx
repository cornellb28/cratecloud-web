import { ButtonLink, Card, Check } from '@/components/ui'
import { FREE_TIER } from '@/lib/plans'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-6">
      <section className="py-20 sm:py-28">
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[1.2px] text-accent">
          DJ library management
        </p>
        <h1 className="max-w-2xl text-4xl font-medium leading-[1.15] text-ink sm:text-5xl">
          Your crates, actually in order.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
          CrateCloud tags, files and repairs your library — reading your real files, writing back to
          them, and importing the Serato library you already have. The desktop app is free, and
          nothing in it is locked.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/pricing">See plans</ButtonLink>
          <ButtonLink href="/pricing" variant="outline">
            Download for macOS
          </ButtonLink>
        </div>
      </section>

      <section className="grid gap-4 pb-20 sm:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-[13px] font-medium text-ink">Reads your real library</h2>
          <p className="text-[12px] leading-relaxed text-muted">
            Import a Serato library — database, crates and history — instead of starting from zero.
            Export back to <code className="font-mono text-ink-2">.crate</code> when you are done.
          </p>
        </Card>
        <Card>
          <h2 className="mb-3 text-[13px] font-medium text-ink">Survives a reorganise</h2>
          <p className="text-[12px] leading-relaxed text-muted">
            Move or rename files in Finder and your tags follow. Identity is tracked by an embedded
            id, then size and duration — not by filename.
          </p>
        </Card>
        <Card>
          <h2 className="mb-3 text-[13px] font-medium text-ink">Writes back to the file</h2>
          <p className="text-[12px] leading-relaxed text-muted">
            Edits land in the audio file itself, not just in an app database another program will
            never read.
          </p>
        </Card>
      </section>

      <section className="pb-24">
        <Card>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-md">
              <h2 className="text-[15px] font-medium text-ink">The desktop app is free</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                Not a trial, not a feature-limited tier. Cloud sync and the mobile app are a
                separate subscription, for the DJs who want their library on more than one machine.
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {FREE_TIER.features.map((f) => (
                <Check key={f}>{f}</Check>
              ))}
            </ul>
          </div>
        </Card>
      </section>
    </div>
  )
}
