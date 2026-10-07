'use client'

import { useState } from 'react'

// Google photo if present, else the first initial. Falls back to the initial
// if the image fails to load (expired or blocked photo URLs happen).
export function Avatar({
  url,
  initial,
  size = 32
}: {
  url: string | null
  initial: string
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size, fontSize: size * 0.42 }

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- provider-hosted photo, no fixed domain to allowlist
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={style}
        className="shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent/20 font-semibold text-accent"
    >
      {initial}
    </span>
  )
}
