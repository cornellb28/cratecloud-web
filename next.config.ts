import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
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
