import type { Metadata } from 'next'
import { getPostsPage } from '@/lib/queries'
import { ArchiveList, Pagination, archiveHref } from '@/components/archive-view'

export const metadata: Metadata = {
  title: 'Arsip',
  description: 'Seluruh tulisan, dikelompokkan per tahun.',
  alternates: { canonical: '/archive' },
}

/** FR-053. Statis — paginasi memakai path, bukan query (menopang P1). */
export default async function ArchivePage() {
  const { posts, totalPages, total } = await getPostsPage(1)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Arsip</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
        {total} tulisan
      </p>

      {total === 0 ? <p className="py-16 text-center">Belum ada tulisan.</p> : <ArchiveList posts={posts} />}

      <Pagination page={1} totalPages={totalPages} hrefFor={archiveHref} />
    </div>
  )
}
