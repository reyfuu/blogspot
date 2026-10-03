import type { MetadataRoute } from 'next'
import { getPublishedForFeeds } from '@/lib/queries'
import { SITE_URL } from '@/lib/env'

/**
 * FR-062 sitemap.
 *
 * HANYA artikel PUBLISHED dan tag yang punya artikel terbit (BRULE-04, BRULE-09).
 * Draf, terjadwal, terarsip, terhapus, pratinjau, pencarian, dan /admin
 * tidak pernah masuk — ini diuji di tests/integration/seo.test.ts.
 */
export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { posts, tagSlugs } = await getPublishedForFeeds()

  const latest = posts[0]?.updatedAt ?? new Date()

  return [
    { url: `${SITE_URL}/`, lastModified: latest, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/archive`, lastModified: latest, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: latest, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/tag`, lastModified: latest, changeFrequency: 'weekly', priority: 0.5 },
    ...posts.map((p) => ({
      url: `${SITE_URL}/post/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...tagSlugs.map((slug) => ({
      url: `${SITE_URL}/tag/${slug}`,
      lastModified: latest,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ]
}
