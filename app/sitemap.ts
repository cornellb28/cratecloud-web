import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

// TODO(sitemap): only /privacy and /waitlist are listed while the home page
// redirects to the waitlist. Expand this at launch (home, download,
// cloud-mobile, support, pricing).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return [
    { url: `${base}/privacy`, changeFrequency: 'yearly' },
    { url: `${base}/waitlist`, changeFrequency: 'monthly' }
  ]
}
