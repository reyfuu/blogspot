import { ImageResponse } from 'next/og'
import { getAllPublishedSlugs, lookupPostBySlug } from '@/lib/queries'
import { getSettings } from '@/lib/settings'

/**
 * FR-061: gambar pratinjau sosial otomatis per artikel.
 * Berjalan di runtime edge — tidak butuh akses basis data pada jalur permintaan
 * karena hasilnya di-cache bersama halaman statisnya.
 */
export const size = { width: 1200, height: 630 }

/** P1: gambar OG diprerender per artikel, bukan dibuat ulang tiap permintaan. */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllPublishedSlugs()
  return slugs.map((slug) => ({ slug }))
}
export const contentType = 'image/png'
export const alt = 'Pratinjau artikel'

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // E-SEO-01: kegagalan pembuatan gambar tidak boleh menggagalkan render halaman.
  let title = 'Tulisan'
  let siteName = 'Blogspot'
  let readingTime = 1
  try {
    const [result, settings] = await Promise.all([lookupPostBySlug(slug), getSettings()])
    siteName = settings.siteName
    if (result.kind === 'found') {
      title = result.post.title
      readingTime = result.post.readingTime
    }
  } catch {
    // Mundur ke nilai bawaan di atas.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #15171c 0%, #23272f 100%)',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: '#8b93a7', letterSpacing: '0.04em' }}>
          {siteName.toUpperCase()}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: title.length > 70 ? 58 : 72,
            fontWeight: 700,
            color: '#f4f5f7',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
          }}
        >
          {title.length > 110 ? `${title.slice(0, 110)}…` : title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 28, color: '#8b93a7' }}>
          <div style={{ display: 'flex', width: 56, height: 6, background: '#5b7cfa', borderRadius: 3 }} />
          <div style={{ display: 'flex' }}>{readingTime} menit baca</div>
        </div>
      </div>
    ),
    size,
  )
}
