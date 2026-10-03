import Link from 'next/link'
import { PostCard } from '@/components/post-card'
import { getRecentPosts } from '@/lib/queries'
import { getSettings } from '@/lib/settings'

/**
 * FR-050 beranda.
 * BRULE-26 / P1: statis. Seluruh data berasal dari kueri bertag cache,
 * sehingga permintaan pembaca tidak menyentuh basis data.
 */
export default async function HomePage() {
  const [posts, settings] = await Promise.all([getRecentPosts(10), getSettings()])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <section className="border-b pb-8">
        <h1 className="text-3xl font-bold tracking-tight">{settings.siteName}</h1>
        <p className="mt-2 text-lg" style={{ color: 'var(--fg-muted)' }}>
          {settings.tagline}
        </p>
      </section>

      {posts.length === 0 ? (
        // FRD §13: keadaan kosong yang sopan, bukan halaman kosong.
        <div className="py-16 text-center">
          <p className="text-lg font-medium">Belum ada tulisan.</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>
            Tulisan pertama akan muncul di sini.
          </p>
        </div>
      ) : (
        <>
          <h2 className="sr-only">Tulisan terbaru</h2>
          <div>
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
          <div className="mt-8">
            <Link href="/archive" className="text-sm font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              Lihat semua tulisan →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
