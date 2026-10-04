import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { signIn } from '@/lib/auth'
import { getSessionUser } from '@/lib/guard'
import { isAuthConfigured } from '@/lib/env'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = {
  title: 'Masuk',
  robots: { index: false, follow: false },
}

/** Hanya tujuan internal yang diterima — mencegah pengalihan terbuka. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/admin'
  return next
}

/** FR-001: halaman masuk. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams
  const user = await getSessionUser()

  // Sudah masuk: langsung ke tujuan semula (FR-001).
  if (user) redirect(user.role === 'OWNER' ? safeNext(next) : '/')

  const settings = await getSettings()
  const target = safeNext(next)

  async function login(formData: FormData) {
    'use server'
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')

    try {
      await signIn('credentials', { email, password, redirectTo: target })
    } catch (err) {
      // signIn melempar NEXT_REDIRECT saat berhasil — itu harus diteruskan.
      if (err instanceof AuthError) {
        redirect(`/login?error=1&next=${encodeURIComponent(target)}`)
      }
      throw err
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Masuk ke {settings.siteName}</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
        Halaman ini hanya untuk pemilik blog. Pembaca tidak perlu akun.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md border px-4 py-3 text-sm"
          style={{ color: 'oklch(0.55 0.19 25)' }}
        >
          {/* Tidak menyebut mana yang salah — email atau kata sandi (E-AUTH-02). */}
          Email atau kata sandi salah.
        </p>
      )}

      {isAuthConfigured ? (
        <form className="mt-8 flex flex-col gap-4" action={login}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              autoFocus
              className="rounded-md border px-3 py-2 text-sm"
              style={{ background: 'var(--bg)' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Kata sandi
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-md border px-3 py-2 text-sm"
              style={{ background: 'var(--bg)' }}
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-[var(--bg-subtle)]"
          >
            Masuk
          </button>
        </form>
      ) : (
        // Jujur soal konfigurasi yang belum lengkap, bukan tombol yang diam-diam gagal.
        <div className="mt-8 rounded-md border px-4 py-4 text-sm" style={{ background: 'var(--bg-subtle)' }}>
          <p className="font-medium">Autentikasi belum dikonfigurasi</p>
          <p className="mt-2" style={{ color: 'var(--fg-muted)' }}>
            Isi <code>OWNER_EMAIL</code> dan <code>OWNER_PASSWORD_HASH</code> pada environment. Hash dibuat dengan{' '}
            <code>pnpm hash-password</code>; panduan ada di <code>docs/SETUP.md</code>.
          </p>
        </div>
      )}

      <Link href="/" className="mt-8 text-sm hover:underline" style={{ color: 'var(--fg-muted)' }}>
        ← Kembali ke beranda
      </Link>
    </div>
  )
}
