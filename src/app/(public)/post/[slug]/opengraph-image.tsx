import { ImageResponse } from 'next/og'
import { getAllPublishedSlugs, lookupPostBySlug } from '@/lib/queries'
import { getSettings } from '@/lib/settings'
import { SITE_URL } from '@/lib/env'
import { loadImageAsDataUri } from '@/lib/og-image'
import { bacaUntukPrerender } from '@/lib/prerender'

/**
 * FR-061: gambar pratinjau sosial otomatis per artikel.
 * Berjalan di runtime edge — tidak butuh akses basis data pada jalur permintaan
 * karena hasilnya di-cache bersama halaman statisnya.
 */
export const size = { width: 1200, height: 630 }

/** P1: gambar OG diprerender per artikel, bukan dibuat ulang tiap permintaan. */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await bacaUntukPrerender('/post/[slug]/opengraph-image', getAllPublishedSlugs)
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
  // FR-061: sampul artikel dipakai sebagai latar bila ada. Judul dan nama blog
  // tetap ditulis di atasnya agar gambar tetap membawa identitas situs.
  let cover: string | null = null
  try {
    const [result, settings] = await Promise.all([lookupPostBySlug(slug), getSettings()])
    siteName = settings.siteName
    if (result.kind === 'found') {
      title = result.post.title
      readingTime = result.post.readingTime
      if (result.post.cover) cover = await loadImageAsDataUri(result.post.cover.url, SITE_URL)
    }
  } catch {
    // Mundur ke nilai bawaan di atas.
  }

  // Sampul bisa seterang apa pun; bayangan menjaga teks terbaca tanpa harus
  // memekatkan peredup sampai gambarnya sendiri tidak kelihatan.
  // Disebar bersyarat, bukan diberi `undefined`: Satori memanggil toString()
  // pada setiap nilai style, sehingga properti bernilai undefined menggagalkan build.
  const shadow = cover ? { textShadow: '0 2px 14px rgba(0,0,0,0.78)' } : {}
  // Label sekunder dicerahkan di atas sampul — peredup paling tipis ada di
  // pita atas, tempat sampul terang bisa menelan warna abu-abu biasa.
  const mutedColor = cover ? '#e4e8f0' : '#b2b9c9'

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
        {cover && (
          <img
            src={cover}
            alt=""
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {cover && (
          // Peredup: menjaga kontras teks terhadap sampul seterang apa pun.
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background:
                'linear-gradient(180deg, rgba(14,16,20,0.28) 0%, rgba(14,16,20,0.55) 50%, rgba(14,16,20,0.88) 100%)',
            }}
          />
        )}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: cover ? 'transparent' : 'linear-gradient(135deg, #15171c 0%, #23272f 100%)',
            padding: '80px',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ display: 'flex', fontSize: 30, color: mutedColor, letterSpacing: '0.04em', ...shadow }}>
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
              ...shadow,
            }}
          >
            {title.length > 110 ? `${title.slice(0, 110)}…` : title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 28, color: mutedColor, ...shadow }}>
            <div style={{ display: 'flex', width: 56, height: 6, background: '#5b7cfa', borderRadius: 3 }} />
            <div style={{ display: 'flex' }}>{readingTime} menit baca</div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
