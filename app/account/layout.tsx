// Account area shell. Protection is per page (requireUser(next)), not here:
// a layout can't know which URL to send the user back to after login.

import { AccountNav } from '@/components/AccountNav'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12 md:flex-row md:gap-14 md:py-16">
      <AccountNav />
      <div className="min-w-0 max-w-2xl flex-1">{children}</div>
    </div>
  )
}
