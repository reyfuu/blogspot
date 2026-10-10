import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllActiveTagSlugs, getPostsByTag } from '@/lib/queries'
import { bacaUntukPrerender } from '@/lib/prerender'
import { Pagination, PostList, tagHref } from '@/components/archive-view'

type Params = { params: Promise<{ slug: string; page: string }> }

/** P1: prerender setiap halaman paginasi tag yang benar-benar ada. */
export async function generateStaticParams(): Promise<{ slug: string; page: string }[]> {
  const slugs = await bacaUntukPrerender('/tag/[slug]/page/[page]', getAllActiveTagSlugs)
  const out: { slug: string; page: string }[] = []
  for (const slug of slugs) {
    const result = await getPostsByTag(slug, 1)
    if (!result || 'moved' in result) continue
    for (let page = 2; page <= result.totalPages; page += 1) out.push({ slug, page: String(page) })
  }
  return out
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, page } = await params
  return {
    title: `Tag: ${slug} — halaman ${page}`,
    alternates: { canonical: `/tag/${slug}/page/${page}` },
  }
}

export default async function TagPaginatedPage({ params }: Params) {
  const { slug, page: pageParam } = await params
  const page = Number.parseInt(pageParam, 10)
  if (!Number.isInteger(page) || page < 2) notFound()

  const result = await getPostsByTag(slug, page)
  if (!result) notFound()
  if ('moved' in result) permanentRedirect(`/tag/${result.moved}`)
  if (page > result.totalPages) notFound() // BRULE-24

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Tag: {result.tag.name}</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
        {result.total} tulisan · halaman {page}
      </p>
      <PostList posts={result.posts} />
      <Pagination page={page} totalPages={result.totalPages} hrefFor={(p) => tagHref(slug, p)} />
    </div>
  )
}
