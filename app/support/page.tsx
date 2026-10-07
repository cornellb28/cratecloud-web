import type { Metadata } from 'next'
import { Eyebrow } from '@/components/marketing'
import { BRAND, CONTACT_EMAIL } from '@/lib/site'

export const metadata: Metadata = { title: 'Support' }

// TODO(support): placeholder copy — replace with real answers.
const FAQ = [
  {
    q: 'How do I import my Serato library?',
    a: `Open ${BRAND}, choose Import, and point it at your Serato folder. Your database, crates and history are read from the real files. Placeholder — detailed steps coming.`
  },
  {
    q: `Do I need an account to use ${BRAND}?`,
    a: 'No. The desktop app works fully signed out. You only need an account for Cloud & Mobile once it launches.'
  },
  {
    q: 'How do I sign in on the desktop app?',
    a: 'Choose Sign in in the app. It opens your browser; sign in or sign up there and the app is connected automatically. Use the same account on every machine.'
  },
  {
    q: 'What’s free?',
    a: 'The whole desktop app — tagging, crates, library health and Serato import — is free, and nothing in it is locked.'
  }
]

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <Eyebrow>Support</Eyebrow>
      <h1 className="text-headline font-extrabold text-ink">How can we help?</h1>

      <div className="mt-12 divide-y divide-line-soft border-y border-line-soft">
        {FAQ.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              <span aria-hidden className="text-muted transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-10 text-[14px] text-muted">
        Still stuck?{' '}
        {CONTACT_EMAIL ? (
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline underline-offset-2">
            Email us
          </a>
        ) : (
          // TODO(support): set NEXT_PUBLIC_CONTACT_EMAIL.
          'Contact details coming soon.'
        )}
      </p>
    </div>
  )
}
