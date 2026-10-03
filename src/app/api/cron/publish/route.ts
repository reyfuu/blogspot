import { NextResponse } from 'next/server'
import { updateTag } from 'next/cache'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { postMutationTags } from '@/lib/cache-tags'

/**
 * FR-025 / BRULE-10: promosi artikel SCHEDULED → PUBLISHED.
 *
 * Dieksekusi oleh proses terjadwal, BUKAN oleh kunjungan pembaca.
 * Interval ≤ 15 menit memenuhi toleransi keterlambatan BRULE-10.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Endpoint dilindungi rahasia bersama (TS-09).
  const auth = req.headers.get('authorization')
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const due = await db.post.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    select: { id: true, slug: true, tags: { select: { tag: { select: { slug: true } } } } },
  })

  if (due.length === 0) return NextResponse.json({ published: 0 })

  await db.post.updateMany({
    where: { id: { in: due.map((p) => p.id) } },
    data: { status: 'PUBLISHED', publishedAt: new Date(), scheduledAt: null },
  })

  const allTags = new Set<string>()
  for (const p of due) {
    for (const t of postMutationTags(p.slug, p.tags.map((x) => x.tag.slug))) allTags.add(t)
  }
  for (const t of allTags) updateTag(t)

  return NextResponse.json({ published: due.length, slugs: due.map((p) => p.slug) })
}
