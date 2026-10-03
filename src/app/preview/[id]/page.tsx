import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { db } from '@/lib/db'
import { renderMarkdown } from '@/lib/markdown'
import { formatDate } from '@/lib/format'

/** BRULE-14: pratinjau dinamis, tanpa cache, noindex. */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Pratinjau',
  robots: { index: false, follow: false, nocache: true },
}

/**
 * FR-029: pratinjau draf bertoken.
 *
 * Token salah / tidak ada / sudah dicabut → 404, BUKAN 403. Memberi 403 akan
 * mengonfirmasi bahwa draf tersebut ada (FR-029, TS-09 anti-enumerasi).
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const [{ id }, { token }] = await Promise.all([params, searchParams])
  if (!token) notFound()

  const post = await db.post.findFirst({
    where: { id, previewToken: token },
    select: {
      title: true,
      content: true,
      status: true,
      publishedAt: true,
      readingTime: true,
      wordCount: true,
      cover: { select: { url: true, alt: true, width: true, height: true } },
      tags: { select: { tag: { select: { slug: true, name: true } } } },
    },
  })
  if (!post) notFound()

  const html = await renderMarkdown(post.content)

  return (
    <div className="min-h-dvh">
      {/* Penanda pratinjau yang tidak mungkin terlewat. */}
      <div
        className="sticky top-0 z-50 border-b px-4 py-2 text-center text-sm font-medium"
        style={{ background: 'oklch(0.85 0.14 85)', color: 'oklch(0.25 0.04 85)' }}
      >
        Pratinjau — status: {post.status}. Halaman ini tidak terindeks dan tidak tampil publik.
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10">
        <article>
          <header className="border-b pb-6">
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-3 text-sm" style={{ color: 'var(--fg-muted)' }}>
              <span>{post.publishedAt ? formatDate(post.publishedAt) : 'Belum terbit'}</span>
              <span aria-hidden="true">·</span>
              <span>{post.readingTime} menit baca</span>
              <span aria-hidden="true">·</span>
              <span>{post.wordCount} kata</span>
            </div>
            {post.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {post.tags.map(({ tag }) => (
                  <li key={tag.slug} className="rounded-full border px-2.5 py-0.5 text-xs">
                    {tag.name}
                  </li>
                ))}
              </ul>
            )}
          </header>

          {post.cover && (
            <Image
              src={post.cover.url}
              alt={post.cover.alt ?? ''}
              width={post.cover.width ?? 1200}
              height={post.cover.height ?? 630}
              className="mt-8 w-full rounded-lg border object-cover"
            />
          )}

          <div
            className="prose prose-neutral dark:prose-invert mt-8 max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </article>

        <Link href="/admin/posts" className="mt-12 inline-block text-sm hover:underline">
          ← Kembali ke daftar artikel
        </Link>
      </div>
    </div>
  )
}
