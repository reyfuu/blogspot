import { put, del } from '@vercel/blob'
import { randomBytes } from 'node:crypto'
import { env, isBlobConfigured } from './env'
import { AppError } from './errors'

/**
 * Abstraksi penyimpanan media — TRD TR-9.
 * Seluruh aplikasi melalui modul ini, sehingga Vercel Blob dapat diganti
 * tanpa menyentuh kode fitur.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // FR-041
export const MAX_DIMENSION = 4000

export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

/**
 * BRULE-21: SVG hanya diterima bila sanitasi dapat dijamin. Kita tidak
 * menjaminnya di v1, jadi SVG ditolak — keputusan sadar, bukan kelalaian.
 */
export const REJECTED_MIME = new Set(['image/svg+xml'])

/** Validasi magic bytes, bukan hanya MIME yang dikirim klien (TS-09). */
export function sniffMime(buf: Uint8Array): string | null {
  const b = buf
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  const ascii = String.fromCharCode(...b.slice(0, 12))
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp'
  if (ascii.slice(4, 8) === 'ftyp' && ascii.slice(8, 12).includes('avif')) return 'image/avif'
  return null
}

export type StoredFile = { url: string; pathname: string; mimeType: string; size: number }

/** BRULE-20: nama berkas asli tidak pernah dipakai pada URL. */
function randomName(mime: string): string {
  const ext =
    { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' }[
      mime
    ] ?? 'bin'
  return `${randomBytes(16).toString('hex')}.${ext}`
}

export async function storeImage(bytes: Uint8Array, declaredMime: string): Promise<StoredFile> {
  if (REJECTED_MIME.has(declaredMime)) throw new AppError('E-MEDIA-01')
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new AppError('E-MEDIA-02')

  const sniffed = sniffMime(bytes)
  if (!sniffed || !ALLOWED_MIME.has(sniffed)) throw new AppError('E-MEDIA-01')

  if (!isBlobConfigured) {
    throw new AppError('E-MEDIA-03', 'Penyimpanan media belum dikonfigurasi (BLOB_READ_WRITE_TOKEN).')
  }

  const pathname = `media/${randomName(sniffed)}`
  const blob = await put(pathname, Buffer.from(bytes), {
    access: 'public',
    contentType: sniffed,
    token: env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
  })

  return { url: blob.url, pathname, mimeType: sniffed, size: bytes.byteLength }
}

export async function deleteImage(url: string): Promise<void> {
  if (!isBlobConfigured) return
  await del(url, { token: env.BLOB_READ_WRITE_TOKEN })
}
