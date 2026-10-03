import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/env'

/** FR-063. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Rute yang tidak boleh dirayapi (FR-063, BRULE-14, BRULE-25).
        disallow: ['/admin', '/admin/', '/api/', '/preview/', '/search'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
