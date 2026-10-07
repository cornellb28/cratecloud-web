// ── Desktop download links ────────────────────────────────────────────────
// TODO(downloads): no release hosting is wired up yet. Fill in the macOS `url`
// (GitHub Releases, R2, …) and `RELEASE_NOTES_URL`; until then the /download
// page shows the macOS button disabled with an explanation.
// Windows and Linux are 'soon': no url, no button. Flip `status` and add a url
// when a build exists.

export type OsKey = 'mac' | 'windows' | 'linux'

export interface Platform {
  key: OsKey
  label: string
  status: 'available' | 'soon'
  url: string | null
}

export const PLATFORMS: Platform[] = [
  { key: 'mac', label: 'macOS', status: 'available', url: null },
  { key: 'windows', label: 'Windows', status: 'soon', url: null },
  { key: 'linux', label: 'Linux', status: 'soon', url: null }
]

export const RELEASE_NOTES_URL: string | null = null

// Server-side, from the User-Agent header, so the right content is in the
// first HTML with no client-side flash. 'other' = unknown.
export function detectOs(userAgent: string | null): OsKey | 'mobile' | 'other' {
  const ua = userAgent ?? ''
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return 'mobile'
  if (/Windows/i.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac'
  if (/Linux|X11|CrOS/i.test(ua)) return 'linux'
  return 'other'
}
