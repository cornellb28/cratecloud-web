import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'CrateCloud — DJ library management',
    template: '%s · CrateCloud'
  },
  description:
    'Tag, crate and clean up your DJ library on the desktop for free. Add Cloud + Mobile to carry it between machines.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  )
}

function SiteHeader() {
  return (
    <header className="border-b border-line-soft">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium text-ink">
          <span className="text-accent" aria-hidden>
            ◫
          </span>
          CrateCloud
        </Link>
        <nav className="flex items-center gap-5 text-[13px] text-muted">
          <Link href="/pricing" className="transition-colors hover:text-ink">
            Pricing
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-ink">
            Account
          </Link>
        </nav>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-line-soft">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-[12px] text-faint sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} CrateCloud</span>
        <span>The desktop app is free. Always.</span>
      </div>
    </footer>
  )
}
