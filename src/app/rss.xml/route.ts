import { getPublishedForFeeds } from '@/lib/queries'
import { getSettings } from '@/lib/settings'
import { renderMarkdown } from '@/lib/markdown'
import { SITE_URL } from '@/lib/env'

/** FR-064: feed RSS, 20 item terbaru (Lampiran A). */
// P1: feed diprerender dan hanya dibentuk ulang saat tag `feed`/`sitemap`
// di-invalidasi — bukan pada setiap permintaan.
export const dynamic = 'force-static'

const FEED_LIMIT = 20

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const [{ posts }, settings] = await Promise.all([getPublishedForFeeds(), getSettings()])
  const items = posts.slice(0, FEED_LIMIT)

  const rendered = await Promise.all(items.map((p) => renderMarkdown(p.content)))

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(settings.siteName)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(settings.description)}</description>
    <language>id-ID</language>
    <lastBuildDate>${(items[0]?.publishedAt ?? new Date()).toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (p, i) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${SITE_URL}/post/${p.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/post/${p.slug}</guid>
      <pubDate>${(p.publishedAt ?? new Date()).toUTCString()}</pubDate>
      <description>${escapeXml(p.excerpt ?? '')}</description>
      <content:encoded><![CDATA[${(rendered[i] ?? '').replace(/\]\]>/g, ']]&gt;')}]]></content:encoded>
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
