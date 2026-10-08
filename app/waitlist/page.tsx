import type { Metadata } from 'next'
import { WaitlistForm } from '@/components/WaitlistForm'
import { Eyebrow } from '@/components/marketing'
import { BRAND } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Join the waitlist',
  description: `Cloud sync and mobile for ${BRAND} are coming soon. Join the waitlist.`
}

export default function WaitlistPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20 sm:py-28">
      <div className="text-center">
        <Eyebrow>Waitlist · Coming soon</Eyebrow>
        <h1 className="text-headline font-extrabold text-ink">
          Your music library shouldn’t be trapped behind your computer.
        </h1>
        <p className="mx-auto mt-6 max-w-md text-[16px] leading-relaxed text-muted">
          Cloud sync and mobile for DJs, coming soon. This is a waitlist — nothing is available yet. Your
          collection stays your own: your files stay where they are, and nothing is streamed.
        </p>
      </div>

      <div className="mt-10 rounded-3xl bg-surface p-6 shadow-lift sm:p-8">
        <WaitlistForm />
      </div>

      <p className="mt-8 text-center text-[13px] text-muted">
        Unsubscribe any time.{' '}
        {/* TODO(legal): link Privacy and Terms here once those pages exist. */}
      </p>
    </div>
  )
}
