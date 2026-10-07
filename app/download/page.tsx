import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Eyebrow } from '@/components/marketing'
import { ButtonLink } from '@/components/ui'
import { detectOs, PLATFORMS, RELEASE_NOTES_URL } from '@/lib/downloads'
import { BRAND } from '@/lib/site'

export const metadata: Metadata = { title: 'Download' }

export default async function DownloadPage() {
  // No account needed. OS comes from the User-Agent, server-side.
  const os = detectOs((await headers()).get('user-agent'))
  const mac = PLATFORMS.find((p) => p.key === 'mac')!
  const soon = PLATFORMS.filter((p) => p.status === 'soon')
  const visitorPlatform = PLATFORMS.find((p) => p.key === os)

  return (
    <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <div className="text-center">
        <Eyebrow>Download</Eyebrow>
        <h1 className="text-display font-extrabold text-ink">Get {BRAND}.</h1>
        <p className="mx-auto mt-6 max-w-md text-[16px] leading-relaxed text-muted">
          Free, no account needed. Sign in only if you want Cloud &amp; Mobile later.
        </p>
      </div>

      {/* Windows/Linux visitors still get the macOS download, plus a note. */}
      {visitorPlatform && visitorPlatform.status === 'soon' && (
        <p className="mx-auto mt-8 max-w-md text-center text-[14px] text-ink-2" role="note">
          {visitorPlatform.label} is coming soon. {BRAND} is available for macOS today.
        </p>
      )}
      {os === 'mobile' && (
        <p className="mx-auto mt-8 max-w-md text-center text-[14px] text-ink-2" role="note">
          {BRAND} is a desktop app — open this page on your computer to download it.
        </p>
      )}

      <section aria-labelledby="mac-heading" className="mt-10 rounded-3xl bg-surface p-8 text-center shadow-lift">
        <h2 id="mac-heading" className="text-[20px] font-bold text-ink">
          {mac.label}
        </h2>
        <div className="mt-6 flex flex-col items-center gap-3">
          {mac.url ? (
            <ButtonLink href={mac.url} variant="pillLg">
              Download for {mac.label}
            </ButtonLink>
          ) : (
            // TODO(downloads): enable once lib/downloads.ts has a real macOS url.
            <>
              <button
                type="button"
                disabled
                aria-describedby="mac-unavailable"
                className="inline-flex cursor-not-allowed items-center justify-center rounded-full bg-accent px-8 py-3.5 text-[15px] font-semibold text-white opacity-50"
              >
                Download for {mac.label}
              </button>
              <p id="mac-unavailable" className="max-w-sm text-[13px] text-ink-2">
                Not available yet — the macOS download hasn’t been published. Check back soon.
              </p>
            </>
          )}
        </div>
      </section>

      <section aria-label="Other platforms" className="mt-4 grid gap-4 sm:grid-cols-2">
        {soon.map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-4 rounded-3xl bg-surface px-6 py-5">
            <h2 className="text-[16px] font-semibold text-ink">{p.label}</h2>
            <span className="rounded-full bg-surface-3 px-3 py-1 text-[12px] font-medium text-ink-2">
              Coming soon
            </span>
          </div>
        ))}
      </section>

      <p className="mt-12 text-center text-[13px] text-muted">
        {RELEASE_NOTES_URL ? (
          <a href={RELEASE_NOTES_URL} className="underline underline-offset-2 hover:text-ink">
            Release notes
          </a>
        ) : (
          // TODO(downloads): link release notes once published.
          'Release notes coming soon.'
        )}
      </p>
    </div>
  )
}
