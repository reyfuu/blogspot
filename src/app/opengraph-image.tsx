import { ImageResponse } from 'next/og'
import { DEFAULT_SETTINGS, getSettings } from '@/lib/settings'

/**
 * FR-061: gambar pratinjau sosial bawaan untuk seluruh halaman yang tidak punya
 * gambarnya sendiri (beranda, arsip, tag, pencarian, tentang).
 * Artikel menimpa ini lewat `(public)/post/[slug]/opengraph-image.tsx`.
 */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Pratinjau situs'

export default async function OpengraphImage() {
  // E-SEO-01: kegagalan pembuatan gambar tidak boleh menggagalkan render halaman.
  let { siteName, tagline } = DEFAULT_SETTINGS
  try {
    const settings = await getSettings()
    siteName = settings.siteName
    tagline = settings.tagline
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
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #15171c 0%, #23272f 100%)',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 96,
            fontWeight: 700,
            color: '#f4f5f7',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
          }}
        >
          {siteName}
        </div>
        <div style={{ display: 'flex', marginTop: 28, width: 96, height: 8, background: '#5b7cfa', borderRadius: 4 }} />
        <div style={{ display: 'flex', marginTop: 28, fontSize: 38, color: '#8b93a7', lineHeight: 1.3 }}>
          {tagline.length > 90 ? `${tagline.slice(0, 90)}…` : tagline}
        </div>
      </div>
    ),
    size,
  )
}
