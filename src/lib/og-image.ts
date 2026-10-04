/**
 * Pemuatan gambar sampul untuk `ImageResponse` (FR-061).
 *
 * Satori mengambil `<img src>` jarak jauh sendiri, tetapi kegagalannya terjadi
 * di dalam proses render dan akan menggagalkan build halaman. E-SEO-01 melarang
 * itu: pembuatan gambar OG tidak boleh menggagalkan render. Karena itu berkas
 * diambil lebih dulu di sini, di dalam `try/catch`, lalu disematkan sebagai
 * data URI sehingga Satori tidak perlu menyentuh jaringan sama sekali.
 */

/** Sampul lebih besar dari ini tidak sepadan untuk keluaran 1200 × 630. */
export const MAX_COVER_BYTES = 8 * 1024 * 1024

/** Build tidak boleh menggantung karena satu host gambar yang lambat. */
export const COVER_FETCH_TIMEOUT_MS = 5_000

/**
 * Mengubah URL sampul tersimpan menjadi URL absolut yang bisa diambil.
 *
 * Hanya `http`/`https` dan jalur absolut yang diterima. Skema lain (`data:`,
 * `file:`) ditolak agar pembuat artikel tidak bisa mengarahkan proses build
 * membaca berkas lokal lewat nilai basis data.
 */
export function resolveCoverUrl(url: string, siteUrl: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/')) return `${siteUrl.replace(/\/$/, '')}${trimmed}`
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

/**
 * Mengambil gambar dan mengembalikannya sebagai data URI.
 * Mengembalikan `null` untuk setiap kegagalan — pemanggil mundur ke kartu judul.
 */
export async function loadImageAsDataUri(url: string, siteUrl: string): Promise<string | null> {
  const resolved = resolveCoverUrl(url, siteUrl)
  if (!resolved) return null

  try {
    const res = await fetch(resolved, { signal: AbortSignal.timeout(COVER_FETCH_TIMEOUT_MS) })
    if (!res.ok) return null

    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
    if (!contentType.startsWith('image/')) return null

    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_COVER_BYTES) return null

    return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`
  } catch {
    return null
  }
}
