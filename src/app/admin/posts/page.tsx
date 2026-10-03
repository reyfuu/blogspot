import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/guard'
import { formatDateTime } from '@/lib/format'
import { NewPostButton } from '@/components/new-post-button'
import { getTagsForAdmin } from '@/lib/queries'
import { PostRowActions } from '@/components/post-row-actions'
import type { PostStatus } from '@/generated/prisma/enums'

const PER_PAGE = 20
const STATUSES: (PostStatus | 'ALL')[] = ['ALL', 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED', 'TRASHED']

/** FR-081: daftar artikel dengan penyaringan, pencarian, dan paginasi. */
export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; tag?: string; page?: string }>
}) {
  await requireOwner()
  const { status, q, tag, page: pageParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const activeStatus = (STATUSES.includes(status as PostStatus) ? status : 'ALL') as PostStatus | 'ALL'
  const query = (q ?? '').trim()
  const activeTag = (tag ?? '').trim()

  const where = {
    ...(activeStatus !== 'ALL' ? { status: activeStatus } : {}),
    ...(query ? { title: { contains: query, mode: 'insensitive' as const } } : {}),
    // FR-081: penyaringan berdasarkan tag, bukan hanya status.
    ...(activeTag ? { tags: { some: { tag: { slug: activeTag } } } } : {}),
  }

  /** Mempertahankan filter lain saat salah satu diubah. */
  const hrefWith = (patch: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams()
    const merged = { status: activeStatus, q: query, tag: activeTag, ...patch }
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '' && !(k === 'status' && v === 'ALL')) sp.set(k, String(v))
    }
    const qs = sp.toString()
    return qs ? `/admin/posts?${qs}` : '/admin/posts'
  }

  const [total, posts, allTags] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
        tags: { select: { tag: { select: { name: true } } } },
        _count: { select: { comments: true } },
      },
    }),
    getTagsForAdmin(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Artikel</h1>
        <NewPostButton />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={hrefWith({ status: s, page: undefined })}
            className="rounded-full border px-3 py-1 text-sm hover:bg-[var(--bg-subtle)]"
            style={activeStatus === s ? { background: 'var(--bg-subtle)', fontWeight: 600 } : undefined}
            aria-current={activeStatus === s ? 'true' : undefined}
          >
            {s === 'ALL' ? 'Semua' : s}
          </Link>
        ))}
      </div>

      <form action="/admin/posts" method="get" role="search" className="mt-4 flex gap-2">
        <input type="hidden" name="status" value={activeStatus} />
        {activeTag && <input type="hidden" name="tag" value={activeTag} />}
        <label htmlFor="q" className="sr-only">
          Cari judul
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Cari judul…"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          style={{ background: 'var(--bg)', color: 'var(--fg)' }}
        />
        <button type="submit" className="rounded-md border px-4 py-2 text-sm hover:bg-[var(--bg-subtle)]">
          Cari
        </button>
      </form>

      {allTags.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>
            Tag:
          </span>
          <Link
            href={hrefWith({ tag: undefined, page: undefined })}
            className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-[var(--bg-subtle)]"
            style={!activeTag ? { background: 'var(--bg-subtle)', fontWeight: 600 } : undefined}
            aria-current={!activeTag ? 'true' : undefined}
          >
            Semua
          </Link>
          {allTags.map((t) => (
            <Link
              key={t.slug}
              href={hrefWith({ tag: t.slug, page: undefined })}
              className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-[var(--bg-subtle)]"
              style={activeTag === t.slug ? { background: 'var(--bg-subtle)', fontWeight: 600 } : undefined}
              aria-current={activeTag === t.slug ? 'true' : undefined}
            >
              {t.name} <span style={{ color: 'var(--fg-muted)' }}>{t.count}</span>
            </Link>
          ))}
          <Link href="/admin/tags" className="ml-1 text-xs underline" style={{ color: 'var(--fg-muted)' }}>
            Kelola tag
          </Link>
        </div>
      )}

      {posts.length === 0 ? (
        <p className="py-16 text-center" style={{ color: 'var(--fg-muted)' }}>
          Belum ada artikel.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Daftar artikel beserta status dan jumlah komentar</caption>
            <thead>
              <tr className="border-b text-left" style={{ color: 'var(--fg-muted)' }}>
                <th scope="col" className="py-2 pr-4 font-medium">Judul</th>
                <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2 pr-4 font-medium">Tag</th>
                <th scope="col" className="py-2 pr-4 font-medium">Komentar</th>
                <th scope="col" className="py-2 pr-4 font-medium">Diperbarui</th>
                <th scope="col" className="py-2 font-medium"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {posts.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 pr-4">
                    <Link href={`/admin/posts/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{p.status}</td>
                  <td className="py-3 pr-4" style={{ color: 'var(--fg-muted)' }}>
                    {p.tags.map((t) => t.tag.name).join(', ') || '—'}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{p._count.comments}</td>
                  <td className="py-3 pr-4 whitespace-nowrap" style={{ color: 'var(--fg-muted)' }}>
                    {formatDateTime(p.updatedAt)}
                  </td>
                  <td className="py-3">
                    <PostRowActions id={p.id} status={p.status} slug={p.slug} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Paginasi" className="mt-8 flex items-center justify-between border-t pt-4 text-sm">
          {page > 1 ? (
            <Link href={hrefWith({ page: page - 1 })} className="hover:underline">
              ← Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          <span style={{ color: 'var(--fg-muted)' }}>
            Halaman {page} dari {totalPages} · {total} artikel
          </span>
          {page < totalPages ? (
            <Link href={hrefWith({ page: page + 1 })} className="hover:underline">
              Berikutnya →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  )
}
