import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllActiveTagSlugs, getPostsByTag } from '@/lib/queries'
import { Pagination, PostList, tagHref } from '@/components/archive-view'

type Params = { params: Promise<{ slug: string }> }

/** P1: prerender seluruh halaman tag yang punya artikel terbit (BRULE-09). */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllActiveTagSlugs()
  return slugs.map((slug) => ({ slug }))
}

export const dynamicParams = true

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const result = await getPostsByTag(slug)
  if (!result || 'moved' in result) {
    return { title: 'Tag tidak ditemukan', robots: { index: false, follow: false } }
  }
  return {
    title: `Tag: ${result.tag.name}`,
    description: `Kumpulan tulisan dengan tag ${result.tag.name}.`,
    alternates: { canonical: `/tag/${slug}` },
  }
}

/** FR-052. BRULE-09: tag tanpa artikel terbit → 404. */
export default async function TagPage({ params }: Params) {
  const { slug } = await params
  const result = await getPostsByTag(slug, 1)
  if (!result) notFound()
  // BRULE-36: slug hasil merge → 301 ke tag tujuan.
  if ('moved' in result) permanentRedirect(`/tag/${result.moved}`)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Tag: {result.tag.name}</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
        {result.total} tulisan
      </p>
      <PostList posts={result.posts} />
      <Pagination page={1} totalPages={result.totalPages} hrefFor={(p) => tagHref(slug, p)} />
    </div>
  )
}
