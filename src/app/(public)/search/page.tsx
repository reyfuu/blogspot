import type { Metadata } from 'next'
import Link from 'next/link'
import { PostCard } from '@/components/post-card'
import { searchPosts } from '@/lib/queries'

/** BRULE-25: halaman pencarian ditandai noindex agar tidak jadi halaman tipis. */
export const metadata: Metadata = {
  title: 'Pencarian',
  robots: { index: false, follow: true },
}

// BRULE-26: pencarian adalah salah satu dari sedikit rute yang memang dinamis.
export const dynamic = 'force-dynamic'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const query = (q ?? '').trim()
  const results = query.length >= 2 ? await searchPosts(query) : []

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Pencarian</h1>

      <form action="/search" method="get" className="mt-6 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Kata kunci
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Cari tulisan…"
          minLength={2}
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          style={{ background: 'var(--bg)', color: 'var(--fg)' }}
        />
        <button
          type="submit"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-[var(--bg-subtle)]"
        >
          Cari
        </button>
      </form>

      {query.length > 0 && query.length < 2 && (
        <p className="mt-6 text-sm" style={{ color: 'var(--fg-muted)' }}>
          Masukkan minimal 2 karakter.
        </p>
      )}

      {query.length >= 2 && (
        <div className="mt-8">
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            {results.length} hasil untuk “{query}”
          </p>
          {results.length === 0 ? (
            <div className="py-12">
              <p className="font-medium">Tidak ada hasil untuk “{query}”.</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
                Coba kata kunci lain, atau{' '}
                <Link href="/archive" className="underline">
                  telusuri arsip
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="mt-2">
              {results.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
