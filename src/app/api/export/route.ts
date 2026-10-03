import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/guard'
import { ERRORS } from '@/lib/errors'

/**
 * FR-036 / BRULE-19: ekspor seluruh konten ke Markdown.
 *
 * Ini mekanisme keluar yang memitigasi R-4 (vendor lock-in): harus bisa
 * dijalankan kapan saja tanpa akses basis data langsung.
 *
 * Keluaran berupa satu berkas Markdown gabungan dengan front matter per artikel,
 * dialirkan (streamed) agar tidak menahan seluruh konten di memori (E-SYS-02).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function frontMatter(p: {
  title: string
  slug: string
  status: string
  publishedAt: Date | null
  updatedAt: Date
  excerpt: string | null
  tags: { tag: { name: string } }[]
}): string {
  const esc = (s: string) => s.replace(/"/g, '\\"')
  return [
    '---',
    `title: "${esc(p.title)}"`,
    `slug: "${p.slug}"`,
    `status: ${p.status}`,
    `publishedAt: ${p.publishedAt?.toISOString() ?? 'null'}`,
    `updatedAt: ${p.updatedAt.toISOString()}`,
    `excerpt: "${esc(p.excerpt ?? '')}"`,
    `tags: [${p.tags.map((t) => `"${esc(t.tag.name)}"`).join(', ')}]`,
    '---',
    '',
  ].join('\n')
}

export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== 'OWNER') {
    return new Response(ERRORS['E-AUTH-04'], { status: user ? 403 : 401 })
  }

  const posts = await db.post.findMany({
    where: { status: { not: 'TRASHED' } },
    orderBy: { createdAt: 'asc' },
    select: {
      title: true,
      slug: true,
      content: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      excerpt: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  })

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      controller.enqueue(
        enc.encode(`# Ekspor konten\n\nDibuat: ${new Date().toISOString()}\nJumlah artikel: ${posts.length}\n\n`),
      )
      for (const p of posts) {
        controller.enqueue(enc.encode(`\n\n${'='.repeat(72)}\n\n${frontMatter(p)}${p.content}\n`))
      }
      controller.close()
    },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="blogspot-export-${stamp}.md"`,
      'Cache-Control': 'no-store',
    },
  })
}
