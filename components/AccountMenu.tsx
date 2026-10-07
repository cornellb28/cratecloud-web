'use client'

// The signed-in half of the account chip: avatar + name + chevron, opening a
// menu. Rendered from server-supplied props, so there is no signed-out flash.
// Keyboard: Enter/Space/ArrowDown opens, arrows/Home/End move, Escape closes
// and returns focus to the trigger, Tab closes.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Avatar } from '@/components/Avatar'
import { createClient } from '@/lib/supabase/client'

interface Props {
  name: string
  email: string
  avatarUrl: string | null
  initial: string
  planLabel: string
}

const ITEM =
  'block w-full rounded-md px-3 py-2 text-left text-[13px] text-ink-2 outline-none transition-colors hover:bg-surface-3 hover:text-ink focus-visible:bg-surface-3 focus-visible:text-ink'

export function AccountMenu({ name, email, avatarUrl, initial, planLabel }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const items = () =>
    Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  // Outside click + Escape.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  // Focus the first item when opened.
  useEffect(() => {
    if (open) items()[0]?.focus()
  }, [open])

  function close(returnFocus = false) {
    setOpen(false)
    if (returnFocus) trigger.current?.focus()
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const list = items()
    const i = list.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      list[(i + 1) % list.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      list[(i - 1 + list.length) % list.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      list[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      list[list.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  async function signOut() {
    setSigningOut(true)
    await createClient().auth.signOut()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-[13px] text-ink transition-colors hover:bg-surface-3"
      >
        <Avatar url={avatarUrl} initial={initial} size={28} />
        <span className="max-w-[9rem] truncate font-medium max-sm:hidden">{name}</span>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={`h-3 w-3 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only sm:hidden">{name}</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl bg-surface-2 p-1.5 shadow-lift"
        >
          <div className="px-3 pb-2 pt-2.5">
            <p className="truncate text-[13px] font-medium text-ink">{name}</p>
            <p className="truncate text-[12px] text-muted">{email}</p>
            <p className="mt-2 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              {planLabel}
            </p>
          </div>
          <div className="my-1 h-px bg-line" role="separator" />
          <Link href="/account" role="menuitem" tabIndex={-1} className={ITEM} onClick={() => close()}>
            Account
          </Link>
          <Link href="/account/billing" role="menuitem" tabIndex={-1} className={ITEM} onClick={() => close()}>
            Billing
          </Link>
          <Link href="/download" role="menuitem" tabIndex={-1} className={ITEM} onClick={() => close()}>
            Download
          </Link>
          <Link href="/support" role="menuitem" tabIndex={-1} className={ITEM} onClick={() => close()}>
            Help
          </Link>
          <div className="my-1 h-px bg-line" role="separator" />
          <button type="button" role="menuitem" tabIndex={-1} className={ITEM} onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      )}
    </div>
  )
}
