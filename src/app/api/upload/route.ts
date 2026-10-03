import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/guard'
import { AppError, ERRORS } from '@/lib/errors'
import { MAX_UPLOAD_BYTES, storeImage } from '@/lib/storage'

/**
 * FR-040/041: unggah media.
 *
 * Route handler (bukan Server Action) karena perlu menerima multipart.
 * Otorisasi tetap diperiksa di sini — lapis 3 berlaku untuk route handler juga.
 */
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: ERRORS['E-AUTH-01'], code: 'E-AUTH-01' }, { status: 401 })
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: ERRORS['E-AUTH-04'], code: 'E-AUTH-04' }, { status: 403 })
  }

  // TS-09: verifikasi origin untuk endpoint non-Server-Action.
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: ERRORS['E-SYS-01'], code: 'E-SYS-01' }, { status: 403 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file')
    const alt = String(form.get('alt') ?? '')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: ERRORS['E-MEDIA-01'], code: 'E-MEDIA-01' }, { status: 415 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: ERRORS['E-MEDIA-02'], code: 'E-MEDIA-02' }, { status: 413 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const stored = await storeImage(bytes, file.type)

    const media = await db.media.create({
      data: {
        url: stored.url,
        pathname: stored.pathname,
        mimeType: stored.mimeType,
        size: stored.size,
        alt: alt || null,
      },
      select: { id: true, url: true, alt: true, width: true, height: true },
    })

    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === 'E-MEDIA-02' ? 413 : error.code === 'E-MEDIA-01' ? 415 : 502
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('[upload] gagal', error)
    return NextResponse.json({ error: ERRORS['E-MEDIA-03'], code: 'E-MEDIA-03' }, { status: 502 })
  }
}
