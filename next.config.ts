import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // TEMPORARY: send the home page to the waitlist (307). Remove this entry
      // when the real home page ships. Only "/" — /login, /desktop/connect,
      // checkout and the webhook are unaffected.
      { source: '/', destination: '/waitlist', permanent: false },
      // Pricing is undecided: the page file stays, but nothing links to it.
      // TODO(pricing): drop this redirect when tiers are final.
      { source: '/pricing', destination: '/cloud-mobile', permanent: false },
      // Billing moved into the account area; Stripe return URLs and the
      // old /dashboard links still point here.
      { source: '/dashboard', destination: '/account/billing', permanent: false }
    ]
  }
};

export default nextConfig;
