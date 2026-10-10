import Link from 'next/link'
import Image from 'next/image'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAdjacentPosts, getAllPublishedSlugs, getApprovedComments, lookupPostBySlug } from '@/lib/queries'
import { renderMarkdown } from '@/lib/markdown'
import { getSettings } from '@/lib/settings'
import { formatDate } from '@/lib/format'
import { SITE_URL } from '@/lib/env'
import { bacaUntukPrerender } from '@/lib/prerender'
import { CommentSection } from '@/components/comment-section'
import { GoneNotice } from '@/components/gone-notice'

type Params = { params: Promise<{ slug: string }> }

/**
 * P1 / BRULE-26: halaman artikel WAJIB statis.
 * Tanpa generateStaticParams, Next merender on-demand dan setiap permintaan
 * pembaca menyentuh basis data — membatalkan BR-03 dan mitigasi cold start (R-2).
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await bacaUntukPrerender('/post/[slug]', getAllPublishedSlugs)
  return slugs.map((slug) => ({ slug }))
}

// Slug di luar daftar (mis. artikel yang baru terbit) tetap dilayani, lalu
// di-cache. Slug historis ditangani lookupPostBySlug → 301.
export const dynamicParams = true

/** FR-060: metadata per halaman artikel. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const result = await lookupPostBySlug(slug)

  // Artikel terarsip: lihat catatan BRULE-13 di bawah. Tidak dapat mengirim 410
  // dari page component, jadi penandaan noindex dilakukan lewat metadata + header.
  if (result.kind === 'gone') {
    return { title: 'Tulisan diarsipkan', robots: { index: false, follow: false } }
  }
  if (result.kind !== 'found') return { title: 'Tidak ditemukan', robots: { index: false, follow: false } }

  const { post } = result
  const settings = await getSettings()
  return {
    title: post.title,
    description: post.excerpt ?? settings.description,
    alternates: { canonical: `/post/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt ?? settings.description,
      url: `/post/${post.slug}`,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      tags: post.tags.map((t) => t.name),
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.excerpt ?? undefined },
  }
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params
  const result = await lookupPostBySlug(slug)

  // TS-04 §4.4: kontrak kode status.
  if (result.kind === 'moved') permanentRedirect(`/post/${result.slug}`) // 301, BRULE-12
  // BRULE-13 menetapkan 410 Gone. KETERBATASAN PLATFORM: Next.js 16 hanya
  // menyediakan notFound()/forbidden()/unauthorized() (404/403/401) — tidak ada
  // API untuk mengirim 410 dari page component. Mitigasi: halaman penjelas
  // eksplisit + robots noindex (generateMetadata) + X-Robots-Tag dari proxy,
  // sehingga mesin pencari tetap menerima sinyal de-indeks yang tegas.
  // Deviasi ini dicatat di docs/FRD.md BRULE-13.
  if (result.kind === 'gone') return <GoneNotice />
  if (result.kind === 'missing') notFound() // 404

  const { post } = result
  const [html, settings, comments, adjacent] = await Promise.all([
    renderMarkdown(post.content),
    getSettings(),
    getApprovedComments(post.id),
    post.publishedAt ? getAdjacentPosts(post.publishedAt) : Promise.resolve({ prev: null, next: null }),
  ])

  /** FR-065: data terstruktur BlogPosting dengan URL absolut (BRULE-27). */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt ?? undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { '@type': 'Person', name: post.author.name ?? settings.authorName },
    publisher: { '@type': 'Organization', name: settings.siteName },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/post/${post.slug}` },
    image: post.cover ? `${SITE_URL}${post.cover.url.startsWith('http') ? '' : ''}${post.cover.url}` : undefined,
    keywords: post.tags.map((t) => t.name).join(', ') || undefined,
    wordCount: post.wordCount,
    inLanguage: 'id-ID',
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article>
        <header className="border-b pb-6">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
          <div
            className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
            style={{ color: 'var(--fg-muted)' }}
          >
            {post.publishedAt && (
              <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>
            )}
            <span aria-hidden="true">·</span>
            <span>{post.readingTime} menit baca</span>
            <span aria-hidden="true">·</span>
            <span>{post.wordCount} kata</span>
          </div>

          {post.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/tag/${t.slug}`}
                    className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-[var(--bg-subtle)]"
                  >
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>

        {post.cover && (
          // FR-043: dimensi eksplisit + priority agar LCP cepat dan CLS nol.
          <Image
            src={post.cover.url}
            alt={post.cover.alt ?? ''}
            width={post.cover.width ?? 1200}
            height={post.cover.height ?? 630}
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="mt-8 w-full rounded-lg border object-cover"
          />
        )}

        {/* Konten sudah disanitasi di server oleh pipeline markdown (BRULE-18). */}
        <div
          className="prose prose-neutral dark:prose-invert mt-8 max-w-none prose-headings:scroll-mt-20"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>

      {(adjacent.prev || adjacent.next) && (
        <nav aria-label="Tulisan lain" className="mt-12 grid gap-4 border-t pt-6 sm:grid-cols-2">
          {adjacent.prev ? (
            <Link href={`/post/${adjacent.prev.slug}`} className="group rounded-lg border p-4 hover:bg-[var(--bg-subtle)]">
              <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                ← Sebelumnya
              </span>
              <span className="mt-1 block font-medium group-hover:underline">{adjacent.prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {adjacent.next && (
            <Link
              href={`/post/${adjacent.next.slug}`}
              className="group rounded-lg border p-4 hover:bg-[var(--bg-subtle)] sm:text-right"
            >
              <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                Berikutnya →
              </span>
              <span className="mt-1 block font-medium group-hover:underline">{adjacent.next.title}</span>
            </Link>
          )}
        </nav>
      )}

      {settings.commentsEnabled && (
        <CommentSection
          postId={post.id}
          comments={comments}
          closed={post.commentsClosed}
          guestAllowed={settings.guestCommentsEnabled}
        />
      )}
    </div>
  )
}
