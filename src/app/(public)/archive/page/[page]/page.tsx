import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getArchivePageCount, getPostsPage } from '@/lib/queries'
import { bacaUntukPrerender } from '@/lib/prerender'
import { ArchiveList, Pagination, archiveHref } from '@/components/archive-view'

type Params = { params: Promise<{ page: string }> }

/** Prerender setiap halaman arsip agar tidak ada yang dirender on-demand. */
export async function generateStaticParams(): Promise<{ page: string }[]> {
  const count = await bacaUntukPrerender('/archive/page/[page]', getArchivePageCount)
  // Halaman 1 disajikan oleh /archive.
  return Array.from({ length: Math.max(0, count - 1) }, (_, i) => ({ page: String(i + 2) }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { page } = await params
  return {
    title: `Arsip — halaman ${page}`,
    // BRULE-27 + FR-065: halaman paginasi kanonik ke dirinya sendiri,
    // bukan ke halaman pertama.
    alternates: { canonical: `/archive/page/${page}` },
  }
}

export default async function ArchivePaginatedPage({ params }: Params) {
  const { page: pageParam } = await params
  const page = Number.parseInt(pageParam, 10)
  if (!Number.isInteger(page) || page < 2) notFound()

  const { posts, totalPages, total } = await getPostsPage(page)
  if (page > totalPages) notFound() // BRULE-24

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Arsip</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
        {total} tulisan · halaman {page}
      </p>
      <ArchiveList posts={posts} />
      <Pagination page={page} totalPages={totalPages} hrefFor={archiveHref} />
    </div>
  )
}
