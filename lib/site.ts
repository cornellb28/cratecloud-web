// ── Where this site lives ─────────────────────────────────────────────────
// Stripe's success_url / cancel_url / return_url must be absolute, and they
// must be RIGHT — a production checkout that redirects to a preview URL is a
// bug nobody notices until a customer reports it.
//
// NEXT_PUBLIC_SITE_URL wins. VERCEL_URL is the preview fallback only: on a
// production deployment it is the deployment's own generated hostname, not
// the custom domain, so relying on it in production sends buyers to a URL
// they have never seen.

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/+$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// The desktop deep link. Registered by the Electron app via
// app.setAsDefaultProtocolClient('cratecloud') and declared in
// electron-builder.yml, so a packaged build on any OS answers it.
export const DESKTOP_CHECKOUT_CALLBACK = 'cratecloud://checkout-complete'

// Where the /desktop/connect page sends the one-time key. The app accepts
// only this exact scheme + authority (see deepcrate-desktop-deeplink).
export const DESKTOP_AUTH_CALLBACK = 'cratecloud://auth-callback'
