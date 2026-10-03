import { NextResponse, type NextRequest } from 'next/server'

/**
 * Otorisasi lapis 1 — TRD TS-05 §5.2.
 *
 * Hanya memeriksa KEBERADAAN cookie sesi, bukan isinya: middleware berjalan di
 * edge tanpa akses basis data. Verifikasi peran yang sesungguhnya dilakukan di
 * layout /admin (lapis 2) dan di setiap Server Action (lapis 3).
 * Lapisan ini murni pengalaman pengguna — bukan batas keamanan.
 */
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token']

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const res = NextResponse.next()

  // TS-08: lingkungan non-produksi tidak boleh terindeks, apa pun metadata per halaman.
  const isPreviewEnv = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production'
  if (isPreviewEnv) res.headers.set('X-Robots-Tag', 'noindex, nofollow')

  // BRULE-14 / BRULE-26: pratinjau dan admin tidak pernah di-cache atau diindeks.
  if (pathname.startsWith('/admin') || pathname.startsWith('/preview')) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    res.headers.set('Cache-Control', 'no-store, must-revalidate')
  }

  if (pathname.startsWith('/admin')) {
    const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name))
    if (!hasSession) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.search = `?next=${encodeURIComponent(pathname + search)}`
      return NextResponse.redirect(url)
    }
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*', '/preview/:path*'],
}
