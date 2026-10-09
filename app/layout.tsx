import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import { BRAND, siteUrl } from '@/lib/site'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

// metadataBase turns relative canonical/OG URLs absolute. siteUrl() prefers
// NEXT_PUBLIC_SITE_URL, which is the canonical host (https://www.deepcrated.com).
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${BRAND} — DJ library management`,
    template: `%s · ${BRAND}`
  },
  description:
    'Tag, crate and clean up your DJ library on the desktop for free. Add cloud sync and mobile to carry it between machines.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <div className="flex min-h-dvh flex-col">
          <Analytics />
          <SpeedInsights />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-line-soft">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-[12px] text-faint sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} {BRAND}</span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/privacy" className="transition-colors hover:text-ink">
            Privacy
          </Link>
          <span>The desktop app is free. Always.</span>
        </span>
      </div>
    </footer>
  )
}
