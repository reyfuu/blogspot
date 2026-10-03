import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllTagsWithCount } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'Topik',
  description: 'Seluruh topik tulisan, diurutkan dari yang paling banyak dibahas.',
  alternates: { canonical: '/tag' },
}

/**
 * FR-059: indeks seluruh topik.
 * Statis — data berasal dari kueri ter-cache, sehingga tidak menyentuh basis
 * data pada permintaan pembaca (P1).
 */
export default async function TagIndexPage() {
  const tags = await getAllTagsWithCount()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Topik</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
        {tags.length} topik
      </p>

      {tags.length === 0 ? (
        <p className="py-16 text-center">Belum ada topik.</p>
      ) : (
        <ul className="mt-8 flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/tag/${t.slug}`}
                className="inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-sm hover:bg-[var(--bg-subtle)]"
              >
                {t.name}
                <span className="text-xs tabular-nums" style={{ color: 'var(--fg-muted)' }}>
                  {t.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
