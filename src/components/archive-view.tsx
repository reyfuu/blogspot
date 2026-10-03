import Link from 'next/link'
import { PostCard } from '@/components/post-card'
import { formatDate } from '@/lib/format'
import type { PostCard as PostCardData } from '@/lib/queries'

/** Paginasi berbasis PATH (bukan query) agar halaman tetap dapat diprerender. */
export function archiveHref(page: number): string {
  return page <= 1 ? '/archive' : `/archive/page/${page}`
}

export function tagHref(slug: string, page: number): string {
  return page <= 1 ? `/tag/${slug}` : `/tag/${slug}/page/${page}`
}

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number
  totalPages: number
  hrefFor: (page: number) => string
}) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Paginasi" className="mt-12 flex items-center justify-between border-t pt-6 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className="hover:underline">
          ← Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <span style={{ color: 'var(--fg-muted)' }}>
        Halaman {page} dari {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next" className="hover:underline">
          Berikutnya →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}

/** FR-053: daftar arsip dikelompokkan per tahun. */
export function ArchiveList({ posts }: { posts: PostCardData[] }) {
  const byYear = new Map<number, PostCardData[]>()
  for (const p of posts) {
    const year = p.publishedAt?.getFullYear() ?? 0
    const list = byYear.get(year) ?? []
    list.push(p)
    byYear.set(year, list)
  }

  return (
    <div className="mt-8 space-y-10">
      {[...byYear.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([year, items]) => (
          <section key={year}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-muted)' }}>
              {year || 'Tanpa tanggal'}
            </h2>
            <ul className="space-y-2">
              {items.map((p) => (
                <li key={p.slug} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                  {p.publishedAt && (
                    <time
                      dateTime={p.publishedAt.toISOString()}
                      className="shrink-0 text-sm tabular-nums"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      {formatDate(p.publishedAt)}
                    </time>
                  )}
                  <Link href={`/post/${p.slug}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}

export function PostList({ posts }: { posts: PostCardData[] }) {
  return (
    <div className="mt-6">
      {posts.map((p) => (
        <PostCard key={p.slug} post={p} />
      ))}
    </div>
  )
}
