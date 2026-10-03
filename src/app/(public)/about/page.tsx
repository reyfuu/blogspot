import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  return {
    title: 'Tentang',
    description: `Tentang ${s.authorName} dan blog ${s.siteName}.`,
    alternates: { canonical: '/about' },
  }
}

/** FR-055: halaman statis Tentang, isinya dikelola lewat pengaturan situs. */
export default async function AboutPage() {
  const s = await getSettings()
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Tentang</h1>
      <div className="prose prose-neutral dark:prose-invert mt-6 max-w-none">
        <p className="lead">{s.description}</p>
        <h2>Penulis</h2>
        <p>
          <strong>{s.authorName}</strong>
        </p>
        {s.authorBio ? <p>{s.authorBio}</p> : <p>Bio belum diisi.</p>}
      </div>
    </div>
  )
}
